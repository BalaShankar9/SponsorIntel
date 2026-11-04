// Account-scoped, device-only recovery. Never treats a download click as delivery.
export const recoveryKey = id => 'si.career.reload-backup.' + id;
export const workspaceKey = id => 'si.career.user.' + id;
export function readRecoveryCopy(storage,id) {
 if(!id)return null;
 const raw=storage.getItem(recoveryKey(id));if(raw===null)return null;
 let snapshot=null;
 try{const v=JSON.parse(raw);if(v?.version===1&&v.userId===id&&Number.isSafeInteger(v.revision)&&v.revision>=0&&typeof v.createdAt==='string'&&Number.isFinite(Date.parse(v.createdAt))&&v.data?.version===2&&v.data.profile&&Array.isArray(v.data.applications)&&Array.isArray(v.data.searches))snapshot=v;}catch{}
 return {raw,snapshot};
}
export function preserveRecoveryCopy(storage,id,data,revision,now=Date.now()) {
 if(!id||!Number.isSafeInteger(revision)||revision<0)throw Error('Wait for your account workspace to finish loading.');
 const old=readRecoveryCopy(storage,id);
 if(old)throw Error('A recovery copy is already kept on this device. Save or restore it, then remove it before switching again.');
 const raw=JSON.stringify({version:1,userId:id,revision,createdAt:new Date(now).toISOString(),data});
 try{storage.setItem(recoveryKey(id),raw);}catch{throw Error('Browser storage is full or unavailable. Download your current workspace before switching.');}
 if(storage.getItem(recoveryKey(id))!==raw)throw Error('The recovery copy could not be verified. Your workspace was not replaced.');
 return {raw,snapshot:JSON.parse(raw)};
}
export function discardRecoveryCopy(storage,id,expected) {
 if(storage.getItem(recoveryKey(id))!==expected)throw Error('The recovery copy changed in another tab. Refresh before removing it.');
 storage.removeItem(recoveryKey(id));
 if(storage.getItem(recoveryKey(id))!==null)throw Error('The recovery copy could not be removed.');
}
export async function switchCloudWorkspace({storage,id,data,revision,readCloud,isCurrent,onPreserved,now=Date.now()}) {
 const cache=storage.getItem(workspaceKey(id)),before=JSON.stringify(data);
 const backup=preserveRecoveryCopy(storage,id,data,revision,now);onPreserved(backup);
 const remote=await readCloud();
 if(!isCurrent(before))throw Error('Your workspace or account changed. Your current work was kept; the recovery copy is still available.');
 if(remote?.accountId!==id)throw Error('Your signed-in account changed. Your current work was kept.');
 if(!Number.isSafeInteger(remote?.revision)||remote.revision<0||remote.data?.version!==2)throw Error('The cloud workspace could not be verified. Your current work was kept.');
 if(storage.getItem(recoveryKey(id))!==backup.raw||storage.getItem(workspaceKey(id))!==cache)throw Error('Another tab changed the saved workspace or recovery copy. Your current work was kept.');
 const next=JSON.stringify({data:remote.data,revision:remote.revision,dirty:false});
 storage.setItem(workspaceKey(id),next);
 if(storage.getItem(workspaceKey(id))!==next)throw Error('The cloud copy could not be saved on this device. Your recovery copy is still available.');
 return remote;
}
