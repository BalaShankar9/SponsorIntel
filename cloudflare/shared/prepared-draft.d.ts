import type {CareerData,CareerProfile} from '../src/career-data';
export type PreparationTicket={scope:string;requestId:number;kind:string;input:{profile:CareerProfile;application:Record<string,string>};sourceURL:string;previousText:string};
export function beginPreparedDraft(data:CareerData,id:string,kind:string,scope:string,requestId:number):PreparationTicket;
export function acceptPreparedDraft(data:CareerData,ticket:PreparationTicket,result:{text:string;generatedAt:string},scope:string,requestId:number|undefined):{status:'superseded'|'changed'|'invalid'|'saved';data:CareerData};
