export const CV_TEXT_LIMIT: number;
export const CV_FILE_LIMIT: number;
export function completeCVText(text: string): string;
export function readJSONResume(raw: string): {text:string;profile:Record<string,string>;warnings:string[]};
export function importProfileDetails(profile?: Record<string,string>): {details:Record<string,string>;warnings:string[]};
export function profileSignature(profile: unknown): string;
export function applyCVPreview<T extends {profile:Record<string,string>}>(data:T, baseline:string, parsed:{text:string;profile?:Record<string,string>}, useDetails:boolean):T;
