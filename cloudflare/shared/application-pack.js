export const PACK_SCOPE = 'content_review_only_v1';
export const PACK_BYTES_LIMIT = 5000000;
export const packLabels = {approved_content:'Content approved · sending unavailable',revoked:'Approval revoked',superseded:'Earlier version',batch_changed:'Batch changed · review again',inputs_changed:'Role or documents changed',facts_changed:'Facts need confirmation'};
// Raw UTF-8 digest: exactly the bytes offered as a plain-text download, not a
// JSON string digest or an assertion about a regenerated PDF/Word attachment.
export async function packDocument(text,filename) {
 const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);
 return {filename,type:'text/plain;charset=utf-8',text,bytes:bytes.length,sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
}
