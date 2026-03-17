import { useEffect, useState } from 'react';
import { analyticsAPI } from '../api';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#94a3b8'];

export default function Analytics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => { load(); }, []);

    async function load() {
        try {
            setLoading(true);
            const res = await analyticsAPI.dashboard(30);
            setData(res);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        return <div className="toast toast-error">{error}</div>;
    }

    const sentimentData = Object.entries(data.sentiment_distribution || {}).map(([name, value]) => ({ name, value }));
    const statusData = Object.entries(data.status_distribution || {}).map(([name, value]) => ({ name, value }));

    return (
        <div style={{ animation: 'pageEnter 0.5s ease-out' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Analytics</h1>
                    <p className="page-subtitle">Track call volume, sentiment, and agent performance.</p>
                </div>
                <button className="btn btn-secondary" onClick={load}>Refresh</button>
            </div>

            <div className="dashboard-metrics">
                {[
                    { label: 'Total Calls', value: data.total_calls },
                    { label: 'Total Minutes', value: data.total_duration_min },
                    { label: 'Avg Duration', value: `${Math.round(data.avg_duration_sec)}s` },
                ].map((m) => (
                    <div key={m.label} className="metric-card">
                        <span className="metric-label">{m.label}</span>
                        <span className="metric-value">{m.value}</span>
                    </div>
                ))}
            </div>

            <div className="analytics-grid">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Calls Over Time</div>
                            <div className="card-subtitle">Daily call count (last 30 days)</div>
                        </div>
                    </div>
                    <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.calls_by_day || []}>
                                <XAxis dataKey="date" tick={{ fill: '#8b95a8', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#8b95a8', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#171c28', border: '1px solid rgba(255,255,255,0.08)' }} />
                                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Calls by Agent</div>
                            <div className="card-subtitle">Performance distribution across agents</div>
                        </div>
                    </div>
                    <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.calls_by_agent || []}>
                                <XAxis dataKey="agent_name" tick={{ fill: '#8b95a8', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#8b95a8', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#171c28', border: '1px solid rgba(255,255,255,0.08)' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Sentiment</div>
                            <div className="card-subtitle">Caller sentiment mix</div>
                        </div>
                    </div>
                    <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={90}>
                                    {sentimentData.map((entry, index) => (
                                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#171c28', border: '1px solid rgba(255,255,255,0.08)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Call Status</div>
                            <div className="card-subtitle">Completion and escalation rate</div>
                        </div>
                    </div>
                    <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90}>
                                    {statusData.map((entry, index) => (
                                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#171c28', border: '1px solid rgba(255,255,255,0.08)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
