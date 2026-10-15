export const CITY_DIRECTORY_PATH: string;
export type CityFilters = { city:string; q:string; employer:string; route:string; sort:string; page:number };
export type CityItem = { city:string; count:number; skilled_worker:number };
export type CityEmployer = { id:string; name:string; city:string; county:string; routes:string[]; ratings:string[] };
export type CityResult = { items:(CityItem|CityEmployer)[]; total:number; page:number; pages:number; filters:CityFilters; source_date:string; checked_at:string; generated_at:string; stale:boolean; routes:{name:string;count:number}[]; summary:{entries:number;locations:number;without_city:number} };
export function readCityFilters(search?:string):CityFilters;
export function cityDirectoryPath(filters:Partial<CityFilters>,page?:number):string;
export function readInitialCityDirectory(raw:string,search:string,now?:number):CityResult|null;
