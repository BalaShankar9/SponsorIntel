export type JobNote={schema:'sponsor-intel.job-note';version:1;source:{url:string;title:string;company:string;location:string;observedAt:string};advert:{text:string;sha256:string};wording:{status:string;evidence:Array<{kind:string;quote:string}>;method:string}};
export function publicJobURL(value:string):string;
export function createJobNote(input:{text:string;url:string;title:string;company?:string;location?:string;observedAt?:string;confirmed:boolean}):Promise<JobNote>;
export function readJobNote(value:string):Promise<JobNote&{id:string}>;
