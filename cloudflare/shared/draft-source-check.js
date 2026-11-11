// Local reading prompts, not a semantic validator. Never change or certify a draft.
export const DRAFT_CHECK_VERSION='source-reading-prompts-v1';
const rules=[
 {id:'availability',label:'Availability or start date',question:'Did you explicitly provide this availability? Check notice periods and any conditions before using it.',pattern:/\b(?:available\s+(?:to\s+(?:start|interview)|for\s+(?:(?:an?|immediate)\s+)?interviews?)|(?:can|ready to|able to)\s+(?:start|join)\s+immediately|immediately\s+available|start\s+immediately)\b/gi},
 {id:'absence',label:'A claim about missing experience',question:'Missing evidence does not mean you lack experience. Keep this claim only if you know it is true and want to state it.',pattern:/\b(?:I\s+(?:have\s+not\s+(?:performed|worked|used|managed|led|built|completed)|do\s+not\s+have\s+(?:(?:any|professional|prior|previous|direct)\s+){0,3}experience|have\s+no\s+(?:(?:professional|prior|previous|direct)\s+){0,3}experience)|no\s+(?:(?:professional|prior|previous|direct|commercial)\s+){0,3}experience|without\s+(?:any\s+)?experience)\b/gi},
 {id:'timeline',label:'Project, study or employment connection',question:'Does the source explicitly connect this work to that degree, employer or period? A nearby date alone does not establish the connection.',pattern:/\b(?:during\s+(?:(?:my|the)\s+)?(?:BA|BSc|MSc|MA|degree|studies|employment|time\s+at)|as\s+part\s+of\s+my\s+(?:BA|BSc|MSc|MA|degree|studies|role)|while\s+(?:studying|working)\s+(?:at|for|towards))\b/gi},
];
export function draftSourceChecks(text='',kind='cv'){
 const result={version:DRAFT_CHECK_VERSION,state:'checked',matches:[],total:0,limited:false,verified:false};
 if(!['cv','coverLetter'].includes(kind))return {...result,state:'not_applicable'};
 if(typeof text!=='string'||text.length>40000)return {...result,state:'too_long'};
 if(!text.trim())return {...result,state:'empty'};
 const hits=[];
 for(const rule of rules){
  const re=new RegExp(rule.pattern.source,rule.pattern.flags);
  for(const m of text.matchAll(re)){
   // Exact source offsets, bounded surrounding text. Display is plain React text.
   const start=Math.max(text.lastIndexOf('\n',m.index)+1,m.index-100);
   const newline=text.indexOf('\n',m.index+m[0].length);
   const end=Math.min(newline<0?text.length:newline,m.index+m[0].length+220);
   hits.push({id:rule.id,label:rule.label,question:rule.question,offset:m.index,length:m[0].length,excerpt:text.slice(start,end),excerpt_start:start,excerpt_end:end});
  }
 }
 hits.sort((a,b)=>a.offset-b.offset||a.id.localeCompare(b.id));
 return {...result,matches:hits.slice(0,24),total:hits.length,limited:hits.length>24};
}
