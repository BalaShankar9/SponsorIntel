'use client';

import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProGate } from '@/components/ui/ProGate';
import { useAuthStore } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import type { CompanyProfile } from '@/types';

interface FinancialsTabProps {
  profile: CompanyProfile | null;
}

export function FinancialsTab({ profile }: FinancialsTabProps) {
  const { isPro } = useAuthStore();

  const content = (
    <div className="space-y-4">
      {/* Revenue & Workforce */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Workforce</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-dim">Revenue Band</p>
            <p className="text-sm font-medium text-text">{profile?.estimated_revenue_band || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-dim">Employees</p>
            <p className="text-sm font-medium text-text">{profile?.employee_count_estimate?.toLocaleString() || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-dim">6m Growth</p>
            <p className="flex items-center gap-1 text-sm font-medium">
              {profile?.employee_growth_6m != null ? (
                <>
                  {profile.employee_growth_6m >= 0 ? (
                    <TrendingUp size={14} className="text-green" />
                  ) : (
                    <TrendingDown size={14} className="text-red" />
                  )}
                  <span className={profile.employee_growth_6m >= 0 ? 'text-green' : 'text-red'}>
                    {(profile.employee_growth_6m * 100).toFixed(1)}%
                  </span>
                </>
              ) : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-dim">12m Growth</p>
            <p className="flex items-center gap-1 text-sm font-medium">
              {profile?.employee_growth_12m != null ? (
                <>
                  {profile.employee_growth_12m >= 0 ? (
                    <TrendingUp size={14} className="text-green" />
                  ) : (
                    <TrendingDown size={14} className="text-red" />
                  )}
                  <span className={profile.employee_growth_12m >= 0 ? 'text-green' : 'text-red'}>
                    {(profile.employee_growth_12m * 100).toFixed(1)}%
                  </span>
                </>
              ) : '--'}
            </p>
          </div>
        </div>
      </Card>

      {/* Credit & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Credit & Compliance</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-dim">Credit Risk Score</p>
            <p className="text-sm font-medium text-text">{profile?.credit_risk_score ?? '--'}</p>
          </div>
          <div>
            <p className="text-xs text-dim">Charges</p>
            <p className="flex items-center gap-1 text-sm">
              {profile?.has_charges ? (
                <><AlertTriangle size={14} className="text-orange" /> <span className="text-orange">{profile.charge_count} charge(s)</span></>
              ) : (
                <><CheckCircle size={14} className="text-green" /> <span className="text-green">None</span></>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-dim">Insolvency</p>
            <p className="flex items-center gap-1 text-sm">
              {profile?.has_insolvency_history ? (
                <><AlertTriangle size={14} className="text-red" /> <span className="text-red">Yes</span></>
              ) : (
                <><CheckCircle size={14} className="text-green" /> <span className="text-green">No</span></>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-dim">CCJs</p>
            <p className="flex items-center gap-1 text-sm">
              {profile?.has_ccjs ? (
                <><AlertTriangle size={14} className="text-red" /> <span className="text-red">Yes</span></>
              ) : (
                <><CheckCircle size={14} className="text-green" /> <span className="text-green">No</span></>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Filing Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Filing Status</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-dim">Last Accounts</p>
            <p className="text-sm text-text">{formatDate(profile?.last_accounts_date ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-dim">Next Accounts Due</p>
            <p className="flex items-center gap-1 text-sm">
              {formatDate(profile?.next_accounts_due ?? null)}
              {profile?.accounts_overdue && (
                <Badge variant="red">Overdue</Badge>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-dim">Confirmation Statement</p>
            <p className="flex items-center gap-1 text-sm">
              {profile?.confirmation_statement_overdue ? (
                <Badge variant="red">Overdue</Badge>
              ) : (
                <Badge variant="green">Current</Badge>
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <ProGate isAllowed={isPro} feature="Financial analysis">
      {content}
    </ProGate>
  );
}
