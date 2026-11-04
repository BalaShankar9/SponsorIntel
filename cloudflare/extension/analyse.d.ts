export const MAX_TEXT:number;
export const labels:Record<string,string>;
export type AdvertResult={status:'offered'|'conditional'|'unavailable'|'unclear';title:string;reason:string;evidence:{kind:string;quote:string}[]};
export function analyseAdvert(text:string,confirmed?:boolean):AdvertResult;
