export type ScheduleBrief = {id:string;revision:number;state:string;expires_at:string;media:{sha256:string}[]};
export type ScheduleDestination = {account:string;provider:string};
export type ScheduleForm = {external:string;observed:string;scheduled:string;note:string;observer:string;checked:boolean;mediaChecked:boolean};
export function prepareScheduleSave(brief:ScheduleBrief,destination:ScheduleDestination,form:ScheduleForm,now?:number,key?:string):string;
export class ScheduleSaveError extends Error {uncertain:boolean;}
export function sendScheduleSave(serialized:string,fetcher?:typeof fetch):Promise<{id:string;state?:string;replayed?:boolean}>;
