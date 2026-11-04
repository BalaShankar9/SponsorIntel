import React,{Component,lazy,Suspense} from 'react';
const Explorer=lazy(()=>import('./learning-ui').then(m=>({default:m.LearningExplorer})));
const Role=lazy(()=>import('./learning-ui').then(m=>({default:m.RoleLearning})));
class LearningBoundary extends Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p role="status">Learning resources could not load. Reload the page to try again.</p>:this.props.children;}
}
export function LearningPage(){return <section>
  <header className="page-title"><p className="eyebrow">FROM THE ADVERT TO YOUR NEXT SKILL</p><h1>Learn with a direction.</h1><p>Explore skills mentioned in current sponsorship adverts, find a learning resource, then build something you can show.</p></header>
  <LearningBoundary><Suspense fallback={<p role="status">Checking the current skills snapshot…</p>}><Explorer/></Suspense></LearningBoundary>
  <section className="career-panel" style={{marginTop:24}}><h2>How to use this</h2><ol><li>Choose a target role and read its requirements in full.</li><li>Pick one skill you want to practise. Start with the resource's prerequisites.</li><li>Complete a small practice project and explain what you learned.</li><li>Add only completed, truthful work to your CV. Use the learning-plan tab in Application Studio for your own notes.</li></ol><p>These are selected-advert mentions, not a UK labour-market survey or proof that a skill is essential. A course does not guarantee a job, sponsorship or professional registration. Healthcare, teaching and other regulated roles may require specific qualifications and registration.</p><a className="text-button" href="/jobs?sponsorship=mentioned">Read current sponsorship adverts →</a></section>
</section>;}
export function JobLearning({description}:{description:string}){return <LearningBoundary><Suspense fallback={<section className="role-panel"><h2>Skills to build for similar roles</h2><p>Loading learning resources…</p></section>}><Role description={description}/></Suspense></LearningBoundary>;}
