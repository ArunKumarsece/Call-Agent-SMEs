import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/analytics.css';

/**
 * CallHistory Component — Display list of recorded calls with metadata
 */
export function CallHistory({ agentId }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  useEffect(() => {
    fetchCallHistory();
  }, [agentId]);

  const fetchCallHistory = async () => {
    setLoading(true);
    try {
      const url = agentId 
        ? `/api/calls/history?agent_id=${agentId}`
        : '/api/calls/history';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch call history');
      const data = await res.json();
      setCalls(data);
    } catch (e) {
      console.error('Error fetching call history:', e);
    }
    setLoading(false);
  };

  return (
    <div className="call-history">
      <h2>📞 Call History</h2>
      {loading ? (
        <p>Loading...</p>
      ) : calls.length === 0 ? (
        <p className="empty-state">No calls recorded yet</p>
      ) : (
        <div className="calls-list">
          {calls.map(call => (
            <div
              key={call.session_id}
              className={`call-item ${selectedCall?.session_id === call.session_id ? 'selected' : ''}`}
              onClick={() => setSelectedCall(call)}
            >
              <div className="call-header">
                <span className="agent-name">Agent: {call.agent_id.substring(0, 8)}</span>
                <span className="call-time">{new Date(call.started_at).toLocaleString()}</span>
              </div>
              <div className="call-meta">
                <span className={`status ${call.status}`}>{call.status}</span>
                <span className="duration">⏱️ {call.duration_sec}s</span>
                <span className={`sentiment ${call.sentiment || 'neutral'}`}>
                  {call.sentiment ? `❤️ ${call.sentiment}` : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCall && (
        <CallDetail session={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}


/**
 * CallDetail Component — Show full transcript and analysis
 */
function CallDetail({ session, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetails();
  }, [session.session_id]);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/calls/${session.session_id}/analysis`);
      if (!res.ok) throw new Error('Failed to fetch analysis');
      const data = await res.json();
      setAnalysis(data);

      // Extract transcript from session (if available)
      setTranscript(session.transcript_lines || 0);
    } catch (e) {
      console.error('Error fetching details:', e);
    }
    setLoading(false);
  };

  return (
    <div className="call-detail-modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>✕</button>

        {loading ? (
          <p>Loading analysis...</p>
        ) : analysis ? (
          <>
            <h3>{`Call Analysis — ${new Date(session.started_at).toLocaleString()}`}</h3>

            {/* Key Metrics */}
            <div className="metrics-grid">
              <div className="metric">
                <label>Satisfaction</label>
                <div className="meter">
                  <div 
                    className="meter-fill"
                    style={{ width: `${analysis.user_satisfaction}%` }}
                  />
                </div>
                <span>{analysis.user_satisfaction}%</span>
              </div>
              <div className="metric">
                <label>Info Completion</label>
                <div className="meter">
                  <div 
                    className="meter-fill"
                    style={{ width: `${analysis.info_completion}%` }}
                  />
                </div>
                <span>{analysis.info_completion}%</span>
              </div>
              <div className="metric">
                <label>Sentiment</label>
                <span className={`sentiment-label ${analysis.overall_emotion}`}>
                  {analysis.overall_emotion.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Emotion Timeline */}
            {analysis.emotion_timeline?.length > 0 && (
              <div className="emotion-timeline">
                <h4>Emotion Timeline</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analysis.emotion_timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="turn_number" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="confidence" 
                      stroke="#8884d8"
                      name="Confidence"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Key Intents */}
            {analysis.key_intents?.length > 0 && (
              <div className="intents">
                <h4>Key Intents</h4>
                <div className="intent-tags">
                  {analysis.key_intents.map((intent, i) => (
                    <span key={i} className="intent-tag">{intent}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {analysis.summary && (
              <div className="summary">
                <h4>Summary</h4>
                <p>{analysis.summary}</p>
              </div>
            )}
          </>
        ) : (
          <p>No analysis available yet</p>
        )}
      </div>
    </div>
  );
}


/**
 * AgentAnalytics Component — Aggregate metrics for an agent
 */
export function AgentAnalytics({ agentId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [agentId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calls/agent/${agentId}/analytics`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      console.error('Error fetching analytics:', e);
    }
    setLoading(false);
  };

  if (loading) return <div className="analytics-loading">Loading...</div>;

  return (
    <div className="agent-analytics">
      <h2>📊 Agent Analytics</h2>

      {analytics ? (
        <div>
          {/* Summary Cards */}
          <div className="summary-cards">
            <Card 
              title="Total Calls"
              value={analytics.total_calls}
              icon="📞"
            />
            <Card 
              title="Avg Satisfaction"
              value={`${analytics.avg_satisfaction}%`}
              icon="😊"
            />
            <Card 
              title="Info Completion"
              value={`${analytics.avg_info_completion}%`}
              icon="✅"
            />
            <Card 
              title="Avg Sentiment"
              value={analytics.avg_emotion}
              icon="❤️"
            />
          </div>

          {/* Top Intents Chart */}
          {analytics.top_intents?.length > 0 && (
            <div className="chart-container">
              <h3>Top Intents</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.top_intents}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="intent" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <p className="empty-state">No data available</p>
      )}
    </div>
  );
}


/**
 * Summary Card Component
 */
function Card({ title, value, icon }) {
  return (
    <div className="card">
      <span className="icon">{icon}</span>
      <div>
        <h4>{title}</h4>
        <p className="value">{value}</p>
      </div>
    </div>
  );
}


export default { CallHistory, AgentAnalytics };
