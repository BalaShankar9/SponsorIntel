import {bodyJSON,reply,sameOrigin,limit} from './auth.js';
import {scopeSnapshot} from './research-scope.js';
import {reviewScope} from './research-scope-controls.js';
export async function scopeAPI(request,env,owner){
 if(request.method==='GET')return reply(await scopeSnapshot(env));
 if(request.method!=='POST')return reply({error:'Not found'},404);
 if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
 if(!await limit(env,'research-scope:'+owner.user.id,20))return reply({error:'Please wait before another review.'},429);
 try{const body=await bodyJSON(request,2000),result=await reviewScope(env,owner.user.id,body);return reply({...result,message:body.action==='prepare'?'Separate scope campaign prepared and paused. No call was made.':body.action==='resume'?'Enabled for the next eligible genuine daily dispatch; today is not reset.':'Scope campaign paused. All receipts remain.'});}
 catch(error){const uncertain=/D1|SQLITE|binding|fetch|secret|token|network|timeout/i.test(error.message);return reply({error:uncertain?'The save outcome is uncertain. Recheck the same request before making another decision.':error.message},uncertain?503:400);}
}
