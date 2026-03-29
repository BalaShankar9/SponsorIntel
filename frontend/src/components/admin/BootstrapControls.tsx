'use client';

import { useState } from 'react';
import { Play, Database, Briefcase, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export function BootstrapControls() {
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [profilesResult, setProfilesResult] = useState<{ success: boolean; message: string } | null>(null);
  const [jobsResult, setJobsResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleBootstrapProfiles = async () => {
    setProfilesLoading(true);
    setProfilesResult(null);
    try {
      const res = await api.post<{ message: string }>('/api/v1/admin/bootstrap/profiles');
      setProfilesResult({ success: true, message: res.message || 'Bootstrap started' });
    } catch (err) {
      setProfilesResult({ success: false, message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleGatherJobs = async () => {
    setJobsLoading(true);
    setJobsResult(null);
    try {
      const res = await api.post<{ message: string }>('/api/v1/admin/bootstrap/gather-jobs');
      setJobsResult({ success: true, message: res.message || 'Job gathering started' });
    } catch (err) {
      setJobsResult({ success: false, message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setJobsLoading(false);
    }
  };

  return (
    <div className="border border-s3 bg-s1 p-3 space-y-3">
      <h3 className="font-data text-[10px] font-bold uppercase tracking-widest text-cyan">
        DATA BOOTSTRAP
      </h3>
      <p className="font-data text-[9px] text-dim">
        Kick off full data gathering across all 123,000+ sponsors
      </p>

      <div className="space-y-2">
        {/* Bootstrap Profiles */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBootstrapProfiles}
            disabled={profilesLoading}
            className="flex items-center gap-1.5 bg-cyan/20 border border-cyan/30 px-3 py-1.5 font-data text-[10px] font-bold uppercase text-cyan transition-colors hover:bg-cyan/30 disabled:opacity-50"
          >
            {profilesLoading ? <Loader2 size={10} className="animate-spin" /> : <Database size={10} />}
            BOOTSTRAP PROFILES
          </button>
          <span className="font-data text-[8px] text-dim">
            Elena&apos;s team discovers websites, LinkedIn, careers pages
          </span>
        </div>
        {profilesResult && (
          <div className={`flex items-center gap-2 px-2 py-1 font-data text-[10px] ${profilesResult.success ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
            {profilesResult.success ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
            {profilesResult.message}
          </div>
        )}

        {/* Gather Jobs */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleGatherJobs}
            disabled={jobsLoading}
            className="flex items-center gap-1.5 bg-purple/20 border border-purple/30 px-3 py-1.5 font-data text-[10px] font-bold uppercase text-purple transition-colors hover:bg-purple/30 disabled:opacity-50"
          >
            {jobsLoading ? <Loader2 size={10} className="animate-spin" /> : <Briefcase size={10} />}
            GATHER ALL JOBS
          </button>
          <span className="font-data text-[8px] text-dim">
            Scan every sponsor&apos;s career page for job listings
          </span>
        </div>
        {jobsResult && (
          <div className={`flex items-center gap-2 px-2 py-1 font-data text-[10px] ${jobsResult.success ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
            {jobsResult.success ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
            {jobsResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
