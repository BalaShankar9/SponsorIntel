'use client';

import { AlertTriangle, CheckCircle, ShieldCheck, ShieldAlert, FileWarning, CreditCard } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { CompanyProfile } from '@/types';

interface FinancialsTabProps {
  profile: CompanyProfile | null;
}

function FlagCard({
  label,
  value,
  danger,
  icon,
  detail,
}: {
  label: string;
  value: boolean | null;
  danger: boolean;
  icon: React.ReactNode;
  detail?: string | null;
}) {
  if (value === null || value === undefined) return null;
  const isRisk = value && danger;
  return (
    <div className={cn(
      'border p-3 transition-colors',
      isRisk
        ? 'border-red/30 bg-red/5'
        : 'border-border bg-s1'
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(isRisk ? 'text-red' : 'text-green')}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-data text-[11px] text-dim">{label}</p>
          <p className={cn(
            'font-data text-[13px] font-bold',
            isRisk ? 'text-red' : value ? 'text-amber' : 'text-green'
          )}>
            {value ? 'YES' : 'NO'}
          </p>
          {detail && (
            <p className="font-data text-[10px] text-muted mt-0.5">{detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreditRiskGauge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="border border-border bg-s1 p-4">
        <p className="font-data text-[11px] text-dim uppercase tracking-wider">Credit Risk Score</p>
        <p className="mt-2 font-data text-2xl text-muted">--</p>
      </div>
    );
  }

  const color = score >= 70 ? '#00d4aa' : score >= 40 ? '#f5a623' : '#ff4757';
  const label = score >= 70 ? 'LOW RISK' : score >= 40 ? 'MODERATE RISK' : 'HIGH RISK';

  return (
    <div className="border border-border bg-s1 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-data text-[11px] text-dim uppercase tracking-wider">Credit Risk Score</p>
          <p className="font-data text-[10px] mt-0.5" style={{ color }}>{label}</p>
        </div>
        <div className="text-right">
          <span className="font-data text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="font-data text-[11px] text-muted">/100</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-2 w-full bg-s3 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      {/* Scale labels */}
      <div className="flex justify-between mt-1">
        <span className="font-data text-[8px] text-red">HIGH RISK</span>
        <span className="font-data text-[8px] text-amber">MODERATE</span>
        <span className="font-data text-[8px] text-green">LOW RISK</span>
      </div>
    </div>
  );
}

export function FinancialsTab({ profile }: FinancialsTabProps) {
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center border border-border bg-s1">
        <div className="text-center">
          <CreditCard size={24} className="mx-auto text-muted mb-2" />
          <p className="font-data text-[11px] text-dim uppercase tracking-wider">No Financial Data</p>
          <p className="mt-1 text-[10px] text-muted">Company profile has not been enriched yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Credit Risk Score - prominent */}
      <CreditRiskGauge score={profile.credit_risk_score} />

      {/* Risk Flags Grid */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <FlagCard
          label="Insolvency History"
          value={profile.has_insolvency_history}
          danger={true}
          icon={profile.has_insolvency_history ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
        />
        <FlagCard
          label="County Court Judgements"
          value={profile.has_ccjs}
          danger={true}
          icon={profile.has_ccjs ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
        />
        <FlagCard
          label="Has Charges"
          value={profile.has_charges}
          danger={false}
          icon={profile.has_charges ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          detail={profile.charge_count !== null ? `${profile.charge_count} charge(s) registered` : null}
        />
        <FlagCard
          label="Accounts Overdue"
          value={profile.accounts_overdue}
          danger={true}
          icon={profile.accounts_overdue ? <FileWarning size={16} /> : <CheckCircle size={16} />}
        />
        <FlagCard
          label="Confirmation Stmt Overdue"
          value={profile.confirmation_statement_overdue}
          danger={true}
          icon={profile.confirmation_statement_overdue ? <FileWarning size={16} /> : <CheckCircle size={16} />}
        />
      </div>

      {/* Filing Details */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="border border-border bg-s1 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber mb-2">Account Dates</h4>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[11px] text-dim">Last Accounts Filed</span>
              <span className="font-data text-[11px] text-text">{formatDate(profile.last_accounts_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-dim">Next Accounts Due</span>
              <span className={cn(
                'font-data text-[11px]',
                profile.accounts_overdue ? 'text-red font-bold' : 'text-text'
              )}>
                {formatDate(profile.next_accounts_due)}
                {profile.accounts_overdue && ' (OVERDUE)'}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-border bg-s1 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber mb-2">Revenue & Size</h4>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[11px] text-dim">Revenue Band</span>
              <span className="font-data text-[11px] text-text">{profile.estimated_revenue_band ?? '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-dim">Employees (est.)</span>
              <span className="font-data text-[11px] text-text">{profile.employee_count_estimate?.toLocaleString() ?? '--'}</span>
            </div>
            {profile.charge_count !== null && (
              <div className="flex justify-between">
                <span className="text-[11px] text-dim">Total Charges</span>
                <span className="font-data text-[11px] text-text">{profile.charge_count}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legitimacy Score */}
      {profile.legitimacy_score !== null && (
        <div className="border border-border bg-s1 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-data text-[11px] text-dim uppercase tracking-wider">Legitimacy Score</p>
              <p className="font-data text-[10px] text-muted mt-0.5">
                Composite assessment of company legitimacy
              </p>
            </div>
            <span
              className="font-data text-2xl font-bold"
              style={{ color: profile.legitimacy_score >= 70 ? '#00d4aa' : profile.legitimacy_score >= 40 ? '#f5a623' : '#ff4757' }}
            >
              {profile.legitimacy_score}
            </span>
          </div>
          <div className="h-1.5 w-full bg-s3 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${profile.legitimacy_score}%`,
                backgroundColor: profile.legitimacy_score >= 70 ? '#00d4aa' : profile.legitimacy_score >= 40 ? '#f5a623' : '#ff4757',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
