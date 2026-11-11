import React,{Component,lazy,Suspense} from 'react';
const Hub=lazy(()=>import('./founder-ui').then(m=>({default:m.FounderHub})));
class FounderBoundary extends Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<section className="career-panel" role="alert"><h2>The founder tools could not load</h2><p>Reload to try again. Check the current <a href="https://www.gov.uk/innovator-founder-visa" target="_blank" rel="noopener noreferrer">official guidance</a> before making a decision.</p></section>:this.props.children;}
}
export function FounderPage(){return <section className="founder-page">
  <header className="page-title"><p className="eyebrow">BUILD THE BUSINESS. PREPARE THE EVIDENCE.</p><h1>Your Innovator Founder journey.</h1><p>A practical workspace for the idea, the business case and the steps ahead. Explore the route, find relevant support and build a preparation pack you can keep.</p></header>
  <FounderBoundary><Suspense fallback={<section className="career-panel" role="status"><h2>From first idea to a clear next step</h2><p>Opening your journey, evidence workbook, fee illustration and support directory…</p><p>General information and preparation tools. Endorsement and visa decisions are separate; no outcome is guaranteed.</p><a href="https://www.gov.uk/innovator-founder-visa" target="_blank" rel="noopener noreferrer">Read the official route guidance</a></section>}><Hub/></Suspense></FounderBoundary>
</section>;}
