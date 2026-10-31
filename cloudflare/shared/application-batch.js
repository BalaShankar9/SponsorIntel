import {validateWorkspace} from '../worker/career-validation.js';

export const BATCH_LIMIT = 100;
export const BATCH_HISTORY_LIMIT = 20;
export const batchLabels = {prepared:'Evidence notes prepared',needs_information:'Information needed',needs_review:'Review needed',blocked:'Role unavailable',changed:'Inputs changed',missing:'Saved role removed'};
export async function batchHash(value) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function batchApplication(a) {
  return Object.fromEntries(['id','jobId','sourceVersion','company','title','location','description','url','sponsorship','evidence','stage','cv','coverLetter'].map(k=>[k,a[k]||'']));
}
export function batchSelection(data,ids) {
  if(!Array.isArray(ids)||!ids.length||ids.length>BATCH_LIMIT||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw Error('Choose between 1 and 100 distinct saved roles.');
  const clean=validateWorkspace(data),byId=new Map(clean.applications.map(a=>[a.id,a]));
  const applications=[...ids].sort().map(id=>{const a=byId.get(id);if(!a)throw Error('A selected role is no longer in your workspace.');return a;});
  const jobIds=applications.map(a=>a.jobId||a.id);
  if(new Set(jobIds).size!==jobIds.length)throw Error('This selection contains the same role more than once. Choose one saved copy.');
  return {profile:clean.profile,applications};
}
export async function batchSelectionHash(data,ids) {
  const {profile,applications}=batchSelection(data,ids);
  return batchHash({profile,applications:applications.map(batchApplication)});
}
export async function batchWorkspaceHash(data){return batchHash(validateWorkspace(data));}
