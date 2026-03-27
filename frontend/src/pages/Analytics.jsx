import { useEffect, useState } from 'react';
import { analyticsAPI } from '../api';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

const PALETTE = ['#7c6dfa', '#22d3a0', '#fbbf24', '#f43f5e', '#38bdf8', '#a78bfa'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: '0.82rem',
    }}>
      {label && <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await analyticsAPI.dashboard(30);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="loading-container">
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Loading analytics…</span>
    </div>
  );

  if (error || !data) return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Analytics</h1></div>
        <button className="btn btn-secondary" onClick={load}>↺ Retry</button>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h2 className="empty-state-title">No data yet</h2>
        <p className="empty-state-text">{error || 'Make or simulate some calls to see analytics here.'}</p>
        <button className="btn btn-primary" onClick={load}>Refresh</button>
      </div>
    </div>
  );

  const sentimentData = Object.entries(data.sentiment_distribution || {}).map(([name, value]) => ({ name, value }));
  const statusData    = Object.entries(data.status_distribution || {}).map(([name, value]) => ({ name, value }));

  const STATS = [
    { label: 'Total Calls',   value: data.total_calls,                         icon: '📞' },
    { label: 'Total Minutes', value: data.total_duration_min,                   icon: '⏱️' },
    { label: 'Avg Duration',  value: `${Math.round(data.avg_duration_sec || 0)}s`, icon: '📊' },
  ];

  return (
    <div style={{ animation: 'pageEnter .4s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Call volume, sentiment trends, and agent performance — last 30 days.</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7a6 6 0 1 0 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1 1v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Refresh
        </button>
      </div>

      {/* Stat row */}
      <div className="dashboard-metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-xl)' }}>
        {STATS.map((s, i) => (
          <div key={s.label} className="metric-card" style={{ animation: `slideUp .4s ease-out ${i * 80}ms both` }}>
            <div className="metric-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {s.icon}
            </div>
            <span className="metric-label">{s.label}</span>
            <span className="metric-value">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="analytics-grid">
        {/* Calls over time */}
        <div className="card" style={{ animation: 'slideUp .5s ease-out both' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Calls Over Time</div>
              <div className="card-subtitle">Daily call volume — last 30 days</div>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.calls_by_day || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" stroke="#7c6dfa" strokeWidth={2.5}
                  dot={false} activeDot={{ r: 5, fill: '#7c6dfa' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calls by agent */}
        <div className="card" style={{ animation: 'slideUp .55s ease-out 60ms both' }}>
          <div className="card-header">
            <div>
              <div className="card-title">By Agent</div>
              <div className="card-subtitle">Distribution across agents</div>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.calls_by_agent || []} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="agent_name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#7c6dfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment */}
        <div className="card" style={{ animation: 'slideUp .6s ease-out 120ms both' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Sentiment Mix</div>
              <div className="card-subtitle">Overall caller mood distribution</div>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name"
                  outerRadius={85} innerRadius={40} paddingAngle={3}>
                  {sentimentData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status */}
        <div className="card" style={{ animation: 'slideUp .65s ease-out 180ms both' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Call Status</div>
              <div className="card-subtitle">Completion vs escalation rate</div>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name"
                  outerRadius={85} innerRadius={40} paddingAngle={3}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
