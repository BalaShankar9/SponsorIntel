import type {CareerData,CareerApplication,CareerProfile} from '../src/career-data';
export const BATCH_LIMIT:number;
export const BATCH_HISTORY_LIMIT:number;
export const batchLabels:Record<string,string>;
export function batchHash(value:unknown):Promise<string>;
export function batchApplication(a:CareerApplication):Record<string,string>;
export function batchSelection(data:CareerData,ids:string[]):{profile:CareerProfile;applications:CareerApplication[]};
export function batchSelectionHash(data:CareerData,ids:string[]):Promise<string>;
export function batchWorkspaceHash(data:CareerData):Promise<string>;
