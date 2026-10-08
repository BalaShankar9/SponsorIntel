import {safeSourceDiagnostic} from '../shared/source-diagnostics.js';
// A private WeakMap prevents an arbitrary exception's fields/body being retained.
const checked=new WeakMap();
export class SourceCheckError extends Error {
  constructor(code, context={}, message='Source check could not be completed') {
    super(message);this.name='SourceCheckError';
    checked.set(this,Object.freeze(safeSourceDiagnostic({...context,code})));
  }
}
export function sourceDiagnostic(error){
  return checked.get(error)||safeSourceDiagnostic({code:error?.name==='TimeoutError'||error?.name==='AbortError'?'request_timeout':'unclassified'});
}
export function withSourceContext(error,context){
  const diagnostic=sourceDiagnostic(error);
  // Preserve the more specific inner phase, adding the caller's current count.
  return new SourceCheckError(diagnostic.code,{...context,...diagnostic,requests:context.requests??diagnostic.requests});
}
