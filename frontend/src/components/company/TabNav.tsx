'use client';

import { Building2, Briefcase, Users, PoundSterling, MessageSquare, Newspaper, Clock } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';

const tabs = [
  { id: 'overview', label: 'Overview', icon: <Building2 size={14} /> },
  { id: 'jobs', label: 'Jobs', icon: <Briefcase size={14} /> },
  { id: 'people', label: 'People', icon: <Users size={14} /> },
  { id: 'financials', label: 'Financials', icon: <PoundSterling size={14} /> },
  { id: 'reviews', label: 'Reviews', icon: <MessageSquare size={14} /> },
  { id: 'news', label: 'News', icon: <Newspaper size={14} /> },
  { id: 'timeline', label: 'Timeline', icon: <Clock size={14} /> },
];

interface TabNavProps {
  activeTab: string;
  onChange: (tab: string) => void;
}

export function TabNav({ activeTab, onChange }: TabNavProps) {
  return <Tabs tabs={tabs} activeTab={activeTab} onChange={onChange} />;
}
