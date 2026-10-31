import {bodyJSON,digest,limit,reply} from './auth.js';
import {emptyWorkbook,parseWorkbook,MAX_IMPORT_BYTES} from '../shared/founder.js';

const keyOK=k=>typeof k==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(k);
const conflict=()=>reply({code:'founder_revision_conflict',error:'Your saved founder workbook changed or your account is no longer available. Keep this copy and review the saved workbook before choosing what to save.'},409);
async function receipt(env,id,key,hash){
 const row=await env.DB.prepare('SELECT request_hash,revision,saved_at FROM founder_save_receipts WHERE user_id=? AND request_key=?').bind(id,key).first();
 if(!row)return null;
 return row.request_hash===hash?reply({accountId:id,revision:row.revision,updatedAt:row.saved_at,replayed:true}):reply({error:'This save key belongs to different content. Your saved workbook was not changed.'},409);
}
export async function founderWorkspaceAPI(request,env,user){
 if(!['GET','PUT'].includes(request.method))return reply({error:'Method not allowed'},405);
 // Deployment gate: do not advertise saving until the separate schema is
 // applied and verified. Existing public tab-only work remains available.
 if(env.FOUNDER_SAVING_ENABLED!=='true')return reply({error:'Account saving for founder workbooks is not available yet. Keep your exported workbook.',available:false},503);
 if(request.method==='GET'){
  const row=await env.DB.prepare('SELECT payload,revision,updated_at FROM founder_workspaces WHERE user_id=?').bind(user.id).first();
  return reply({accountId:user.id,workbook:row?parseWorkbook(row.payload):emptyWorkbook(),revision:row?.revision||0,updatedAt:row?.updated_at||null});
 }
 let input,workbook;
 try{
  input=await bodyJSON(request,MAX_IMPORT_BYTES+1000);
  if(!input||Object.keys(input).sort().join(',')!=='accountId,request_key,revision,workbook'||!keyOK(input.request_key)||!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER)throw Error();
  workbook=parseWorkbook(JSON.stringify(input.workbook));
 }catch{return reply({error:'Check the founder workbook format and size. Your existing work was not changed.'},400);}
 if(input.accountId!==user.id)return reply({error:'Your signed-in account changed. This workbook was not saved to another account.'},409);
 const payload=JSON.stringify(workbook),hash=await digest(JSON.stringify({revision:input.revision,workbook}));
 const prior=await receipt(env,user.id,input.request_key,hash);if(prior)return prior;
 if(!await limit(env,'founder-save:'+user.id,20,3600))return reply({error:'Please wait before another founder save. Keep your device copy or export.'},429);
 const at=new Date().toISOString();
 const write=env.DB.prepare(`INSERT INTO founder_workspaces(user_id,revision,payload,request_key,request_hash,updated_at)
  SELECT ?,1,?,?,?,? WHERE ?=0 AND EXISTS(SELECT 1 FROM user WHERE id=?)
  ON CONFLICT(user_id) DO NOTHING RETURNING revision`).bind(user.id,payload,input.request_key,hash,at,input.revision,user.id);
 const update=env.DB.prepare(`UPDATE founder_workspaces SET revision=revision+1,payload=?,request_key=?,request_hash=?,updated_at=?
  WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM user WHERE id=?) RETURNING revision`).bind(payload,input.request_key,hash,at,user.id,input.revision,user.id);
 let result;
 try{
  result=await env.DB.batch([
   input.revision===0?write:update,
   env.DB.prepare(`INSERT INTO founder_save_receipts(user_id,request_key,request_hash,revision,saved_at)
    SELECT user_id,request_key,request_hash,revision,updated_at FROM founder_workspaces
    WHERE user_id=? AND request_key=? AND request_hash=? AND revision=?`).bind(user.id,input.request_key,hash,input.revision+1),
  ]);
 }catch(error){
  // Concurrent identical requests or a lost acknowledgement must reconcile the
  // original receipt. Never retry a different write inside this request.
  const saved=await receipt(env,user.id,input.request_key,hash);if(saved)return saved;
  throw error;
 }
 if(!result[0].results?.length)return conflict();
 return reply({accountId:user.id,revision:input.revision+1,updatedAt:at,replayed:false});
}
