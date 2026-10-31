import type {CareerApplication, CareerData} from '../src/career-data';
import type {PreparationState} from './preparation-availability.js';
export type AdvertSnapshot = Pick<CareerApplication, 'jobId'|'company'|'title'|'location'|'description'|'url'|'sponsorship'|'evidence'> & {
  deadline:string; closesAt:string; salary:string; employment:string; workplace:string; version:string; checkedAt:string;
};
export type PreparationSnapshot = {state:PreparationState; advert?:AdvertSnapshot};
export function validAdvert(advert:unknown):advert is AdvertSnapshot;
export function workingAdvert(application:Partial<CareerApplication>):Pick<CareerApplication,'company'|'title'|'location'|'description'|'url'|'sponsorship'|'evidence'>;
export function sourceAdvert(job:Record<string,unknown>):Omit<AdvertSnapshot,'version'|'checkedAt'>;
export function savedAdvertState(application:Partial<CareerApplication>|undefined,snapshot:PreparationSnapshot):PreparationState;
export function acceptAdvertReview(data:CareerData,expected:CareerApplication,advert:AdvertSnapshot,keepText?:boolean):{status:'saved'|'changed'|'too_long';data:CareerData};
