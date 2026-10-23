export const factAnswerFields: {key:string;label:string;hint:string}[];
export function validateFactAnswers(value:unknown):Record<string,string|null>;
export const factPackLabels:Record<string,string>;
export function factSafeAttempt<T extends {body:Record<string,unknown>}>(attempt:T):T;
