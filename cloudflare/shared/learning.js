// Curated links, not generated URLs or inferred qualifications. Review the
// provider page before changing a cost/access claim or extending review dates.
export const LEARNING_VERSION = 'skills-1';
export const RESOURCE_CHECKED = '2026-10-20';
export const RESOURCE_REVIEW_DUE = '2026-11-20T00:00:00.000Z';
export const resources = [
  ['python','CS50: Introduction to Programming with Python','Harvard','https://cs50.harvard.edu/python/','Course','Beginner; no previous programming required','Free OpenCourseWare; optional verified certificates are separate.','Build a small CSV cleaning script and explain its tests.'],
  ['sql','CS50: Introduction to Databases with SQL','Harvard','https://cs50.harvard.edu/sql/','Course','Start with tables and queries','Free OpenCourseWare; optional verified certificates are separate.','Create a small database, answer five questions with queries and document the results.'],
  ['web','Learn web development','MDN','https://developer.mozilla.org/en-US/docs/Learn_web_development','Tutorials','Beginner through core web skills','Free written tutorials; linked partner courses have separate terms.','Build an accessible page that works on a phone, with a small JavaScript interaction.'],
  ['react','Learn React: Quick Start','React','https://react.dev/learn','Tutorial','Some JavaScript and HTML knowledge','Freely accessible documentation.','Build a filterable list with clear loading, empty and error states.'],
  ['typescript','TypeScript Handbook','TypeScript','https://www.typescriptlang.org/docs/handbook/intro.html','Handbook','JavaScript knowledge first','Freely accessible documentation.','Add types and input validation to a small JavaScript project.'],
  ['go','A Tour of Go','Go','https://go.dev/tour/welcome/1','Interactive tutorial','Programming basics are helpful','Freely accessible tutorial.','Write and test a small command-line tool in Go.'],
  ['git','Pro Git','Git','https://git-scm.com/book/en/v2','Book','Beginner through advanced topics','Free online book.','Keep a practice project in version control and explain a branch and merge.'],
  ['docker','Get started with Docker','Docker','https://docs.docker.com/get-started/','Tutorials','Basic command-line and application knowledge','Documentation is free to read; check software licensing before installing.','Containerise a small practice app and document how to run it locally.'],
  ['kubernetes','Learn Kubernetes Basics','Kubernetes','https://kubernetes.io/docs/tutorials/kubernetes-basics/','Tutorial','Learn containers first','Documentation is free to read; hosted infrastructure may cost money.','Describe how to deploy, inspect and update a fictional service; use a local practice environment.'],
  ['aws','Overview of Amazon Web Services','Amazon Web Services','https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html','Reading guide','Introductory cloud concepts','Free documentation; using cloud services may incur charges.','Draw and explain an architecture for a fictional application without opening paid resources.'],
  ['powerbi','Power BI learning paths','Microsoft Learn','https://learn.microsoft.com/en-us/training/powerplatform/power-bi','Learning paths','Basic data and spreadsheet knowledge','Self-paced reading is accessible; software, instructor training and exams have separate terms.','Create a practice dashboard from public data and explain the measures and limitations.'],
  ['excel','Excel help and learning','Microsoft','https://support.microsoft.com/en-us/excel/','Tutorials','Start with spreadsheet basics','Free help materials; Excel software may need a licence.','Build a practice spreadsheet with formulas, checks and a clear summary.'],
  ['ml','Machine Learning Crash Course','Google','https://developers.google.com/machine-learning/crash-course','Course','Python, algebra and basic statistics','Freely accessible lessons; check prerequisites before starting.','Train a simple practice model and explain evaluation, leakage and limitations.'],
  ['project','Project management: the start of the project journey','Open University OpenLearn','https://www.open.edu/openlearn/money-business/leadership-management/project-management-the-start-the-project-journey/content-section-0','Course','Provider level: advanced; 35 hours','Free course; an account is needed for progress tracking and participation features.','Write a fictional project brief with scope, milestones, risks and stakeholders.'],
  ['communication','Effective communication in the workplace','Open University OpenLearn','https://www.open.edu/openlearn/money-business/effective-communication-the-workplace/content-section-0','Course','Workplace communication practice','Free course; optional account features have their own sign-in terms.','Write a clear project update and practise explaining a difficult decision.'],
].map(([id,title,provider,url,kind,startingPoint,access,project])=>({id,title,provider,url,kind,startingPoint,access,project,checked_at:RESOURCE_CHECKED,review_due_at:RESOURCE_REVIEW_DUE}));

const definitions = [
  ['python','Python','Data & software',/\bpython\b/i,'python'],
  ['sql','SQL','Data & software',/\bsql\b/i,'sql'],
  ['javascript','JavaScript','Data & software',/\bjavascript\b/i,'web'],
  ['html','HTML','Data & software',/\bhtml(?:5)?\b/i,'web'],
  ['css','CSS','Data & software',/\bcss(?:3)?\b/i,'web'],
  ['react','React','Data & software',/\bReact\b(?!\s+(?:quickly|to|with|calmly))|\breact\.js\b/,'react'],
  ['typescript','TypeScript','Data & software',/\btypescript\b/i,'typescript'],
  ['go','Go / Golang','Data & software',/\bgolang\b|\bGo (?:programming|language)\b|\bprogramming (?:in|with) Go\b/i,'go'],
  ['git','Git','Data & software',/\bGit\b|\bgit (?:version|repository|workflow)\b/,'git'],
  ['docker','Docker','Cloud & infrastructure',/\bdocker\b/i,'docker'],
  ['kubernetes','Kubernetes','Cloud & infrastructure',/\bkubernetes\b|\bk8s\b/i,'kubernetes'],
  ['aws','AWS','Cloud & infrastructure',/\bAWS\b|\bAmazon Web Services\b/i,'aws'],
  ['powerbi','Power BI','Data & software',/\bpower\s*bi\b/i,'powerbi'],
  ['excel','Excel','Business & communication',/\bExcel\b(?!\s+(?:at|in|as|within|when))|\bmicrosoft excel\b/,'excel'],
  ['ml','Machine learning','Data & software',/\bmachine learning\b/i,'ml'],
  ['project','Project management','Business & communication',/\bproject management\b/i,'project'],
  ['communication','Communication','Business & communication',/\bcommunication (?:skills|abilities)\b|\b(?:written|verbal|clear|effective|excellent|strong) (?:and (?:written|verbal) )?communication\b/i,'communication'],
];
export const skills = definitions.map(([id,label,group,,resource])=>({id,label,group,resource}));
const excluded = /\b(?:not (?:required|necessary|essential)|no .{0,65}(?:required|needed|necessary)|without .{0,65}(?:experience|knowledge)|(?:do not|don't|does not|doesn't|not) .{0,35}(?:require|need|use)|no longer|training (?:is )?provided|we (?:will |can )?teach|used to use)\b/i;

export function skillMentions(description) {
  if(typeof description!=='string')return [];
  // Preserve exact source text in each excerpt. These are mentions, never a
  // required/preferred classification or a claim about the applicant's gaps.
  const sentences=description.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).filter(s=>s.length<=2000&&!excluded.test(s));
  return definitions.flatMap(([id,label,group,pattern,resource])=>{
    const sentence=sentences.find(s=>pattern.test(s));
    if(!sentence)return [];
    const hit=sentence.match(pattern),index=hit.index;
    const words=[...sentence.matchAll(/\S+/g)];
    const at=Math.max(0,words.findIndex(w=>w.index+w[0].length>index));
    const start=Math.max(0,at-8),end=Math.min(words.length,start+24);
    const excerpt=sentence.slice(words[start].index,words[end-1].index+words[end-1][0].length);
    return [{id,label,group,resource,excerpt,shortened:start>0||end<words.length}];
  });
}
export function resourceCurrent(resource,now=Date.now()) {
  return Number.isFinite(now)&&Date.parse(resource.checked_at)<=now&&now<Date.parse(resource.review_due_at);
}

export function summariseSkills(jobs) {
  const unique=[...new Map(jobs.map(j=>[j.board_id+'\n'+j.apply_url,j])).values()];
  const employers=new Map(),found=new Map();let matched=0;
  for(const job of unique){
    employers.set(job.board_id,(employers.get(job.board_id)||0)+1);
    const mentions=skillMentions(job.description);if(mentions.length)matched++;
    for(const mention of mentions){
      const item=found.get(mention.id)||{...skills.find(s=>s.id===mention.id),jobs:0,employers:new Set(),examples:[]};
      item.jobs++;item.employers.add(job.board_id);
      // Examples favour different employer boards instead of one dominant feed.
      if(item.examples.length<3&&!item.examples.some(x=>x.board_id===job.board_id))item.examples.push({id:job.id,board_id:job.board_id,company:job.company,title:job.title,sponsorship:job.sponsorship,excerpt:mention.excerpt,shortened:mention.shortened});
      found.set(mention.id,item);
    }
  }
  return {jobs:unique.length,employers:employers.size,matched_jobs:matched,unmatched_jobs:unique.length-matched,
    largest_employer_jobs:Math.max(0,...employers.values()),
    skills:[...found.values()].map(s=>({...s,employers:s.employers.size})).sort((a,b)=>b.employers-a.employers||b.jobs-a.jobs||a.label.localeCompare(b.label))};
}
