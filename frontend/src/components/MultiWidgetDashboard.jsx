import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, AreaChart } from 'recharts';
import '../styles/analytics.css';

/**
 * Enhanced Multi-Widget Dashboard
 * Works across all widgets on client websites
 */
export function MultiWidgetDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    calls: [],
    analytics: null,
    sentiment: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      fetchDashboardData();
    }
  }, [selectedAgent]);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data);
      if (data.length > 0) setSelectedAgent(data[0]);
    } catch (e) {
      console.error('Error fetching agents:', e);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [callsRes, analyticsRes] = await Promise.all([
        fetch(`/api/calls/history?agent_id=${selectedAgent.id}`),
        fetch(`/api/analytics/agents/${selectedAgent.id}`)
      ]);

      if (callsRes.ok) {
        const calls = await callsRes.json();
        setDashboardData(prev => ({ ...prev, calls }));
      }

      if (analyticsRes.ok) {
        const analytics = await analyticsRes.json();
        setDashboardData(prev => ({ ...prev, analytics }));
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
    setLoading(false);
  };

  const sentimentDistribution = () => {
    const dist = { positive: 0, neutral: 0, negative: 0 };
    dashboardData.calls.forEach(call => {
      const sentiment = call.sentiment || 'neutral';
      dist[sentiment]++;
    });
    return Object.entries(dist).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value
    }));
  };

  const callsOverTime = () => {
    const byDate = {};
    dashboardData.calls.forEach(call => {
      const date = new Date(call.started_at).toLocaleDateString();
      byDate[date] = (byDate[date] || 0) + 1;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, count]) => ({ date, calls: count }));
  };

  const avgMetrics = () => {
    if (dashboardData.calls.length === 0) return { avgDuration: 0, avgSatisfaction: 0, avgCompletion: 0 };
    
    const totalDuration = dashboardData.calls.reduce((sum, c) => sum + (c.duration_sec || 0), 0);
    return {
      avgDuration: (totalDuration / dashboardData.calls.length / 60).toFixed(2),
      totalCalls: dashboardData.calls.length
    };
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const metrics = avgMetrics();

  return (
    <div className="multi-widget-dashboard">
      <div className="dashboard-header">
        <h1>📊 Multi-Widget Analytics Dashboard</h1>
        <p className="subtitle">Real-time insights from all your voice agents</p>
      </div>

      {/* Agent Selector */}
      <div className="agent-selector">
        <label>Select Agent:</label>
        <select value={selectedAgent?.id || ''} onChange={(e) => setSelectedAgent(agents.find(a => a.id === e.target.value))}>
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>
      </div>

      {/* Top Metrics */}
      <div className="metrics-grid">
        <MetricCard
          icon="📞"
          label="Total Calls"
          value={metrics.totalCalls}
          trend="+12% this week"
        />
        <MetricCard
          icon="⏱️"
          label="Avg Duration"
          value={`${metrics.avgDuration} min`}
          trend="Stable"
        />
        <MetricCard
          icon="😊"
          label="Sentiment Score"
          value={dashboardData.analytics?.avg_emotion || 'N/A'}
          trend="Positive trend"
        />
        <MetricCard
          icon="✅"
          label="Resolution Rate"
          value={`${dashboardData.analytics?.avg_info_completion || 0}%`}
          trend="High satisfaction"
        />
      </div>

      {/* Tab Navigation */}
      <div className="dashboard-tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`tab ${activeTab === 'sentiment' ? 'active' : ''}`} onClick={() => setActiveTab('sentiment')}>
          Sentiment Analysis
        </button>
        <button className={`tab ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => setActiveTab('calls')}>
          Call History
        </button>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {loading ? (
          <p className="loading">Loading data...</p>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="overview-grid">
                <ChartCard title="Calls Over Time">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={callsOverTime()}>
                      <defs>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="calls" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCalls)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Sentiment Distribution">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={sentimentDistribution()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {sentimentDistribution().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}

            {activeTab === 'sentiment' && (
              <div className="sentiment-analysis">
                <h3>📈 Sentiment Trends</h3>
                <SentimentSummary calls={dashboardData.calls} />
              </div>
            )}

            {activeTab === 'calls' && (
              <div className="calls-history">
                <h3>📞 Recent Calls</h3>
                <CallsList calls={dashboardData.calls.slice(0, 10)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, trend }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <span className="metric-label">{label}</span>
        <span className="metric-value">{value}</span>
        <span className="metric-trend">{trend}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function SentimentSummary({ calls }) {
  const positive = calls.filter(c => c.sentiment === 'positive').length;
  const neutral = calls.filter(c => c.sentiment === 'neutral').length;
  const negative = calls.filter(c => c.sentiment === 'negative').length;
  const total = calls.length;

  return (
    <div className="sentiment-summary">
      <div className="sentiment-stat">
        <span className="label">Positive</span>
        <span className="value">{positive}/{total}</span>
        <span className="percentage">{total > 0 ? ((positive/total)*100).toFixed(0) : 0}%</span>
        <div className="bar positive"></div>
      </div>
      <div className="sentiment-stat">
        <span className="label">Neutral</span>
        <span className="value">{neutral}/{total}</span>
        <span className="percentage">{total > 0 ? ((neutral/total)*100).toFixed(0) : 0}%</span>
        <div className="bar neutral"></div>
      </div>
      <div className="sentiment-stat">
        <span className="label">Negative</span>
        <span className="value">{negative}/{total}</span>
        <span className="percentage">{total > 0 ? ((negative/total)*100).toFixed(0) : 0}%</span>
        <div className="bar negative"></div>
      </div>
    </div>
  );
}

function CallsList({ calls }) {
  return (
    <div className="calls-table">
      <div className="table-header">
        <div className="col-agent">Agent</div>
        <div className="col-time">Time</div>
        <div className="col-duration">Duration</div>
        <div className="col-sentiment">Sentiment</div>
        <div className="col-status">Status</div>
      </div>
      {calls.map(call => (
        <div key={call.session_id} className="table-row">
          <div className="col-agent">{call.agent_id.substring(0, 8)}</div>
          <div className="col-time">{new Date(call.started_at).toLocaleString()}</div>
          <div className="col-duration">{call.duration_sec}s</div>
          <div className={`col-sentiment sentiment-${call.sentiment || 'neutral'}`}>
            {call.sentiment || '—'}
          </div>
          <div className={`col-status status-${call.status}`}>{call.status}</div>
        </div>
      ))}
    </div>
  );
}

export default MultiWidgetDashboard;
