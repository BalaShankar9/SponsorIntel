import type {CareerData, Job} from '../src/career-data';
import type {JobNote} from './job-note.js';
export type JobNoteImportResult = {status:'added'|'existing';id:string}|{status:'changed'|'ambiguous'|'full'|'blocked'};
export function planJobNoteImport(data:CareerData,note:JobNote,company:string,expectedScope:string,currentScope:string):
  {status:'ready';job:Job;notes:string}|{status:'existing';id:string}|{status:'changed'|'ambiguous'|'full'};
