import React, { Component, Suspense, lazy } from 'react';
import { ArrowRight, ChevronRight, Cloud, X } from 'lucide-react';
import { useCareer, download } from './career-data';
import { JobDetail } from './job-detail';
import { Vacancies } from './vacancies';
import type { ReportFeedback } from './feedback';
import './career.css';

// Keep public vacancy pages and account status eager. Editing and preparation
// tools load only when a private workspace route is opened.
const CareerTools = lazy(() => import('./career').then(module => ({ default: module.CareerTools })));
type Go = (view: string) => void;

export class CareerToolsBoundary extends Component<{
  children: React.ReactNode; go: Go; backup: string;
}, { failed: boolean; showBackup: boolean }> {
  state = { failed: false, showBackup: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="career-panel" role="alert">
      <h1>Your application tools couldn’t open.</h1>
      <p>Export your workspace before reloading to keep a copy of any unsynced changes.</p>
      <div className="document-actions">
        <button className="secondary-button" onClick={() => this.setState({ showBackup: !this.state.showBackup })}>{this.state.showBackup ? 'Hide workspace backup' : 'View workspace backup'}</button>
        <button className="primary-button" onClick={() => window.location.reload()}>Reload tools</button>
        <button className="text-button" onClick={() => this.props.go('jobs')}>Back to roles</button>
      </div>
      {this.state.showBackup && <div>
        <p>This private backup includes your CV and applications. Download it, or copy the text into a .json file if your browser blocks downloads.</p>
        <textarea aria-label="Workspace backup JSON" readOnly rows={8} value={this.props.backup} />
        <button className="secondary-button" onClick={() => download(this.props.backup, 'sponsor-intel-career-backup.json', 'application/json')}>Download backup</button>
      </div>}
    </section>;
  }
}

export function CareerAccountLink({ go }: { go: Go }) {
  const { user, status } = useCareer();
  return <button className="career-account-link" onClick={() => go('account')}>
    <Cloud size={17} /><span><strong>{user?.name || 'Your private workspace'}</strong><small>{user ? status : 'Sign in to save across devices'}</small></span><ChevronRight size={15} />
  </button>;
}

export function CareerWorkspace({ mode, go, onReport }: { mode: string; go: Go; onReport: ReportFeedback }) {
  const c = useCareer();
  const roleId = mode.match(/^jobs\/([a-f0-9]{24})$/)?.[1];
  if (!c.ready && !['account', 'signin', 'signup', 'jobs'].includes(mode) && !roleId)
    return <div className="career career-panel"><h2>Opening your workspace…</h2><p>{c.error || 'Loading your saved work.'}</p>{c.error && <button className="secondary-button" onClick={() => void c.reload()}>Try again</button>}</div>;
  return <div className="career">
    <div className="career-status"><span><span className={'status-dot ' + (c.user ? 'online' : '')} />{c.status}</span><button onClick={() => go('account')}>{c.user ? 'Account & backup' : 'Sign in for cloud sync'}<ArrowRight size={13} /></button></div>
    {c.error && <div role="alert" className="career-error">{c.error}<button onClick={() => c.setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
    {roleId ? <JobDetail key={roleId} id={roleId} go={go} onReport={onReport} /> : mode === 'jobs' ? <Vacancies go={go} /> :
      <CareerToolsBoundary go={go} backup={JSON.stringify(c.data, null, 2)}>
        <Suspense fallback={<section className="career-panel" role="status" aria-live="polite"><h1>Opening your application tools…</h1><p>Your saved workspace will appear when the tools finish loading.</p></section>}>
          <CareerTools mode={mode} go={go} />
        </Suspense>
      </CareerToolsBoundary>}
  </div>;
}
