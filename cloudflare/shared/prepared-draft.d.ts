import type {CareerData,CareerProfile,CareerApplication} from '../src/career-data';
export type PreparationTicket={scope:string;requestId:number;kind:string;input:{profile:CareerProfile;application:Pick<CareerApplication,'id'|'jobId'|'title'|'company'|'description'|'sponsorship'|'evidence'>};sourceURL:string;previousText:string};
export function beginPreparedDraft(data:CareerData,id:string,kind:string,scope:string,requestId:number):PreparationTicket;
export function acceptPreparedDraft(data:CareerData,ticket:PreparationTicket,result:{text:string;generatedAt:string},scope:string,requestId:number|undefined):{status:'superseded'|'changed'|'invalid'|'saved';data:CareerData};
