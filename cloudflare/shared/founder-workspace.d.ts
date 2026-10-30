import type {Workbook} from './founder.js';
export type FounderState={accountId:string|null;book:Workbook;base:Workbook;revision:number;known:boolean;pending:{accountId:string;revision:number;request_key:string;workbook:Workbook}|null;recovery:Workbook|null;incoming:{book:Workbook;revision:number}|null;busy:boolean;leaving:boolean;error:string;status:string;rawBackup:string|null};
export type FounderStore={readonly state:FounderState;readonly hasHiddenWork:boolean;setIdentity(id:string|null):void;change(next:Workbook):void;open(id:string):Promise<void>;refresh():Promise<void>;choose(which:'cloud'|'local'):void;restoreRecovery():void;removeRecovery():void;save():Promise<void>;discardDevice():void;prepareExit(id:string):void;cancelExit():void;finishExit(id:string):void};
export function founderDeviceKey(id:string):string;
export function founderDirty(state:Pick<FounderState,'pending'|'book'|'base'>):boolean;
export function createFounderWorkspace(options:{storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;request:(method:string,body?:unknown)=>Promise<any>;uuid?:()=>string;notify?:(state:FounderState)=>void}):FounderStore;
export function prepareFounderExit(storage:Storage,id:string):string|null;
export function cancelFounderExit():void;
export function finishFounderExit(storage:Storage,id:string,expected:string|null,options?:{deleted?:boolean}):boolean;
