export type SourceDiagnostic = {code:string;phase?:string;posting_ref?:string;page_offset?:number;requests?:number;http_status?:number;changed_fields?:string[]};
export type SourceFailure = SourceDiagnostic & {attempt:number;checked_at:string};
export const SOURCE_DIAGNOSTICS: Readonly<Record<string,{title:string;action:string}>>;
export const SOURCE_CHANGED_FIELDS: Readonly<Record<string,string>>;
export function safeSourceDiagnostic(value:unknown): SourceDiagnostic;
export function sourceFailureHistory(raw:unknown): SourceFailure[];
