export const PACK_SCOPE:string;
export const PACK_BYTES_LIMIT:number;
export const packLabels:Record<string,string>;
export type PackDocument={filename:string;type:string;text:string;bytes:number;sha256:string};
export function packDocument(text:string,filename:string):Promise<PackDocument>;
