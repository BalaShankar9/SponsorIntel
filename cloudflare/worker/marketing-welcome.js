import {boundedText} from './data.js';
import {plainText} from './jobs.js';
import {currentJobs} from './current-jobs.js';
import assets from '../shared/marketing-media.json' with {type:'json'};
import {publishedGuideFetcher} from './guide-evidence.js';

export const WELCOME_TOPIC='instagram-welcome-v1';
export const WELCOME_SOURCES=Object.freeze([
 {path:'/guides/sponsorship-in-job-adverts',title:'Reading sponsorship wording',facts:[
  'A sponsor licence and the wording in a job advert answer different questions. The licence relates to the employer. The advert gives evidence about a particular vacancy.',
  'Automated labels can miss nuance, and employers can change their adverts. Open the original listing and compare the quotation with the current text.',
 ]},
 {path:'/guides/build-a-shortlist',title:'Building an evidenced application',facts:[
  'Choose two or three requirements you genuinely meet. For each one, describe something you did and the result you can evidence. The application studio can help organise a draft, but you should check every line and remove any claim you cannot support.',
 ]},
]);
// A dated template, not an AI review or publisher. Only fixed first-party pages
// are read; page text cannot supply instructions, URLs, media or destinations.
export async function instagramWelcomeContent(env,fetcher=publishedGuideFetcher(env),now=Date.now()){
 const checked_at=new Date(now).toISOString(),sources=[];
 for(const source of WELCOME_SOURCES){
  const url='https://sponsorintel.london'+source.path;
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(response.status!==200||!response.headers.get('content-type')?.includes('text/html'))throw Object.assign(Error('Welcome source unavailable. Try again after the guide is available.'),{status:503});
  const html=await boundedText(response,250000);
  const article=html.match(/<article\b[^>]*class="resource-article"[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const visible=article?plainText(article).replace(/\s+/g,' ').trim():'';
  if(!source.facts.every(f=>visible.includes(f)))throw Object.assign(Error('Welcome source changed; review its claims before preparing another draft.'),{status:409});
  sources.push({url,title:source.title,excerpt:source.facts.join(' '),checked_at});
 }
 const current=currentJobs(now);
 const jobs=await env.DB.prepare(`SELECT COUNT(*) total FROM jobs WHERE ${current.sql}`).bind(...current.values).first();
 if(!jobs?.total)throw Object.assign(Error('Current vacancy evidence is unavailable.'),{status:409});
 sources.push({url:'https://sponsorintel.london/jobs',title:'Current selected vacancy collection',excerpt:`The current collection contains ${jobs.total} roles at the observation time. The card describes discovery tools, not a promise of sponsorship or a comprehensive vacancy census.`,checked_at});
 const asset=assets.find(a=>a.id==='launch-square-2026-10');
 return {topic_key:WELCOME_TOPIC,destination:'instagram-company',title:'Welcome to Sponsor Intel on Instagram',
  purpose:'Introduce the verified company account with a reusable product card and careful advert-reading/application guidance. The image and caption need independent review; this does not schedule or publish a post.',
  text:'Welcome to Sponsor Intel.\n\nResearch UK employer vacancies, check sponsorship evidence and prepare a focused application.\n\nA sponsor licence relates to the employer. It does not tell you that every vacancy offers sponsorship. Open the original advert and check what it actually says.\n\nUse examples you can evidence in your application. If you use Application Studio, check every line and remove claims you cannot support.\n\nExplore sponsorintel.london\n\n#UKJobs #InternationalStudents #JobSearch',
  sources,expires_at:new Date(now+7*86400000).toISOString(),media:[{asset_id:asset.id,alt:asset.alt}]};
}
