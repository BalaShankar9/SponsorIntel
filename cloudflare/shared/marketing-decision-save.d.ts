export type DecisionKind = 'held'|'reviewed'|'published'|'failed'|'uncertain'|'cancelled';
export type DecisionBrief = {id:string;revision:number;state:string;expires_at:string;media:{sha256:string}[]};
export type DecisionDestination = {account:string;provider:string};
export type DecisionForm = {note:string;checked:boolean;mediaChecked:boolean;external:string;postURL:string};
export function prepareDecisionSave(brief:DecisionBrief,destination:DecisionDestination,form:DecisionForm,kind:DecisionKind,now?:number,key?:string):string;
export class DecisionSaveError extends Error {uncertain:boolean;}
export function sendDecisionSave(serialized:string,fetcher?:typeof fetch):Promise<{id:string;state?:string;replayed?:boolean}>;
