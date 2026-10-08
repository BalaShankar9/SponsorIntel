export const TEACHING_ORIGIN='https://teaching-vacancies.service.gov.uk';
export const TEACHING_QUOTE='Skilled Worker visas can be sponsored';
export const TEACHING_UNAVAILABLE='Visas cannot be sponsored';
export const TEACHING_TERMS=TEACHING_ORIGIN+'/pages/terms-and-conditions#terms-and-conditions-for-api-users';
export const TEACHING_ATTRIBUTION='Contains Department for Education Teaching Vacancies listing information licensed under the Open Government Licence v3.0. Advertiser claims require review.';
export function teachingJobURL(value){
 try{const u=new URL(value,TEACHING_ORIGIN);return u.origin===TEACHING_ORIGIN&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/jobs\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(u.pathname)&&u.pathname.length<=250?u.href:null;}catch{return null;}
}
export function teachingBoardIdentity(board){
 const match=typeof board?.board==='string'&&board.board.match(/^([0-9]{6})--([a-z0-9]+(?:-[a-z0-9]+)*)$/);
 if(board?.provider!=='teaching-vacancies'||!match||board.board.length>80||typeof board.company!=='string'||!board.company.trim()||board.sector!=='education')throw Error('Use a school URN, its Teaching Vacancies organisation name and the education sector.');
 return {urn:match[1],slug:match[2],company:board.company,search:`${TEACHING_ORIGIN}/jobs?organisation_slug=${match[2]}&sort_by=publish_on`};
}
