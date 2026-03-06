'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { api } from '@/lib/api';
import { Tabs } from '@/components/ui/Tabs';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { User, CreditCard, Bell, Save, Crown } from 'lucide-react';
import Link from 'next/link';

const settingsTabs = [
  { id: 'profile', label: 'Profile', icon: <User size={14} /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard size={14} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
];

const digestOptions = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isPro = useAuthStore((s) => s.isPro);
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Notification state
  const [digestFreq, setDigestFreq] = useState('daily');
  const [alertRatingChanges, setAlertRatingChanges] = useState(true);
  const [alertNewSponsors, setAlertNewSponsors] = useState(true);
  const [alertNewJobs, setAlertNewJobs] = useState(true);
  const [alertRiskFlags, setAlertRiskFlags] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const body: Record<string, string> = { name };
      if (currentPassword && newPassword) {
        body.current_password = currentPassword;
        body.new_password = newPassword;
      }
      await api.put('/api/v1/auth/profile', body);
      setProfileMsg('Profile updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setProfileMsg('Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleNotifSave = async () => {
    setNotifSaving(true);
    try {
      await api.put('/api/v1/auth/notifications', {
        digest_frequency: digestFreq,
        alert_rating_changes: alertRatingChanges,
        alert_new_sponsors: alertNewSponsors,
        alert_new_jobs: alertNewJobs,
        alert_risk_flags: alertRiskFlags,
      });
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
    } finally {
      setNotifSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">Settings</h1>
        <p className="text-sm text-dim">Manage your account preferences</p>
      </div>

      <Tabs tabs={settingsTabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="max-w-2xl">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Email"
                value={user?.email || ''}
                disabled
                className="cursor-not-allowed opacity-60"
              />

              <div className="border-t border-border pt-4">
                <p className="mb-3 text-sm font-medium text-text">Change Password</p>
                <div className="space-y-3">
                  <Input
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
              </div>

              {profileMsg && (
                <p className={`text-xs ${profileMsg.includes('success') ? 'text-green' : 'text-red'}`}>
                  {profileMsg}
                </p>
              )}

              <Button onClick={handleProfileSave} disabled={profileSaving}>
                <Save size={14} /> Save Changes
              </Button>
            </div>
          </Card>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold capitalize text-text">
                      {user?.plan || 'free'}
                    </p>
                    {isPro && (
                      <Badge variant="blue">
                        <Crown size={10} className="mr-1" /> Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-dim">
                    {isPro
                      ? 'Full access to all Pro features'
                      : 'Upgrade to unlock Trends, Compare, Tracker, and more'}
                  </p>
                </div>
                {!isPro && (
                  <Link href="/pricing">
                    <Button>
                      <Crown size={14} /> Upgrade
                    </Button>
                  </Link>
                )}
                {isPro && (
                  <Button variant="ghost" size="sm">
                    Manage Subscription
                  </Button>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage This Month</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {[
                  { label: 'API Requests', used: 1247, limit: isPro ? 'Unlimited' : '500' },
                  { label: 'Searches', used: 89, limit: isPro ? 'Unlimited' : '100' },
                  { label: 'CSV Exports', used: 3, limit: isPro ? 'Unlimited' : '0' },
                  { label: 'Notes', used: 12, limit: isPro ? 'Unlimited' : '10' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-dim">{item.label}</span>
                    <span className="text-sm text-text">
                      {item.used.toLocaleString()} / {item.limit}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <Card>
            <CardHeader>
              <CardTitle>Email Preferences</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <Select
                label="Digest Frequency"
                options={digestOptions}
                value={digestFreq}
                onChange={(e) => setDigestFreq(e.target.value)}
              />

              <div>
                <p className="mb-2 text-xs font-medium text-dim">Alert Types</p>
                <div className="space-y-2">
                  {[
                    { label: 'Rating Changes', checked: alertRatingChanges, onChange: setAlertRatingChanges },
                    { label: 'New Sponsors', checked: alertNewSponsors, onChange: setAlertNewSponsors },
                    { label: 'New Job Matches', checked: alertNewJobs, onChange: setAlertNewJobs },
                    { label: 'Risk Flags', checked: alertRiskFlags, onChange: setAlertRiskFlags },
                  ].map((item) => (
                    <label key={item.label} className="flex items-center gap-2 text-sm text-dim">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.onChange(e.target.checked)}
                        className="rounded accent-accent"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleNotifSave} disabled={notifSaving}>
                <Save size={14} /> Save Preferences
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
