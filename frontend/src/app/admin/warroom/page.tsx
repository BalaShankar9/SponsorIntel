'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';

interface DivisionStatus {
  name: string;
  squads: number;
  lastMission: string;
  status: 'operational' | 'degraded' | 'offline';
  missions24h: number;
}

const DIVISIONS: DivisionStatus[] = [
  { name: 'Acquisition', squads: 1, lastMission: '', status: 'operational', missions24h: 0 },
  { name: 'Intelligence', squads: 4, lastMission: '', status: 'operational', missions24h: 0 },
  { name: 'Quality', squads: 2, lastMission: '', status: 'operational', missions24h: 0 },
  { name: 'Operations', squads: 2, lastMission: '', status: 'operational', missions24h: 0 },
  { name: 'Research', squads: 2, lastMission: '', status: 'operational', missions24h: 0 },
];

export default function WarRoomPage() {
  const [divisions, setDivisions] = useState(DIVISIONS);
  const [missions, setMissions] = useState<any[]>([]);
  const [llmSpend, setLlmSpend] = useState(0);
  const [totalMissions, setTotalMissions] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        // Recent missions
        const { data: missionData } = await supabase
          .from('army_missions')
          .select('*')
          .order('completed_at', { ascending: false })
          .limit(20);
        setMissions(missionData || []);
        setTotalMissions(missionData?.length || 0);

        // LLM spend
        const { data: costData } = await supabase
          .from('army_routing_history')
          .select('cost_usd')
          .limit(1000);
        const totalCost = (costData || []).reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0);
        setLlmSpend(totalCost);
      } catch {
        // Tables may not exist yet
      }
    }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = (s: string) => s === 'operational' ? 'text-green' : s === 'degraded' ? 'text-amber' : 'text-red';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">AEGIS WAR ROOM</h1>
          <p className="text-[10px] font-data text-dim">Agent Army Command & Control</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-data text-dim">LLM SPEND TODAY</div>
            <div className="text-sm font-data text-amber">${llmSpend.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-data text-dim">MISSIONS (24H)</div>
            <div className="text-sm font-data text-cyan">{totalMissions}</div>
          </div>
        </div>
      </div>

      {/* Division Grid */}
      <div className="grid grid-cols-5 gap-2">
        {divisions.map((div) => (
          <Card key={div.name} padding className="text-center">
            <div className={`text-[10px] font-data font-bold tracking-wider ${statusColor(div.status)}`}>
              {div.status.toUpperCase()}
            </div>
            <div className="text-xs font-semibold mt-1">{div.name}</div>
            <div className="text-[10px] font-data text-dim mt-1">{div.squads} squads</div>
          </Card>
        ))}
      </div>

      {/* Mission Feed */}
      <Card padding>
        <CardHeader>
          <CardTitle>LIVE MISSION FEED</CardTitle>
        </CardHeader>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {missions.length === 0 ? (
            <p className="text-xs text-dim">No missions recorded yet. Army infrastructure tables may need to be created in Supabase.</p>
          ) : (
            missions.map((m: any, i: number) => (
              <div key={m.id || i} className="flex items-center justify-between text-[10px] font-data py-1 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <span className={m.status === 'success' ? 'text-green' : m.status === 'failed' ? 'text-red' : 'text-amber'}>
                    {m.status === 'success' ? '✓' : m.status === 'failed' ? '✗' : '◌'}
                  </span>
                  <span className="text-dim">{m.agent_id}</span>
                  <span className="text-text">{m.mission_type}</span>
                </div>
                <div className="flex items-center gap-3">
                  {m.duration_ms && <span className="text-dim">{m.duration_ms}ms</span>}
                  {m.llm_cost_usd > 0 && <span className="text-amber">${m.llm_cost_usd.toFixed(4)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Report Generation */}
      <Card padding>
        <CardHeader>
          <CardTitle>EXECUTIVE REPORTS</CardTitle>
        </CardHeader>
        <p className="text-xs text-dim mb-3">Auto-generated weekly reports available for download. PDF format.</p>
        <button className="bg-amber/10 text-amber border border-amber/20 px-4 py-2 rounded text-xs font-data hover:bg-amber/20 transition-colors">
          Generate Report Now
        </button>
      </Card>
    </div>
  );
}
