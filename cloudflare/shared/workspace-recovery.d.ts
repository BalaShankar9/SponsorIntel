import type {CareerData} from '../src/career-data';
export type RecoveryCopy={raw:string;snapshot:{version:1;userId:string;revision:number;createdAt:string;data:CareerData}|null};
export const recoveryKey:(id:string)=>string;
export const workspaceKey:(id:string)=>string;
export function readRecoveryCopy(storage:Storage,id:string):RecoveryCopy|null;
export function preserveRecoveryCopy(storage:Storage,id:string,data:CareerData,revision:number,now?:number):RecoveryCopy;
export function discardRecoveryCopy(storage:Storage,id:string,expected:string):void;
export function switchCloudWorkspace(options:{storage:Storage;id:string;data:CareerData;revision:number;readCloud:()=>Promise<{data:CareerData;revision:number;accountId:string}>;isCurrent:(before:string)=>boolean;onPreserved:(copy:RecoveryCopy)=>void;now?:number}):Promise<{data:CareerData;revision:number;accountId:string}>;
