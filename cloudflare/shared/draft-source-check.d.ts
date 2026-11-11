export const DRAFT_CHECK_VERSION:string;
export type DraftSourceMatch={id:string;label:string;question:string;offset:number;length:number;excerpt:string;excerpt_start:number;excerpt_end:number};
export function draftSourceChecks(text?:string,kind?:string):{version:string;state:string;matches:DraftSourceMatch[];total:number;limited:boolean;verified:boolean};
