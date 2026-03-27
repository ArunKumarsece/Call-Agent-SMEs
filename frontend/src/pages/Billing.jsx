import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../api';

const PLANS = [
  {
    id: 'free', name: 'Starter', price: '₹0', period: '/mo',
    calls: 100, agents: 1, kb: 1,
    features: ['100 calls / month', '1 AI voice agent', '1 knowledge base', 'Basic analytics'],
  },
  {
    id: 'pro', name: 'Growth', price: '₹2,999', period: '/mo',
    calls: 500, agents: 5, kb: 5,
    features: ['500 calls / month', '5 AI voice agents', '5 knowledge bases', 'Advanced analytics', 'Priority support'],
    popular: true,
  },
  {
    id: 'enterprise', name: 'Business', price: '₹7,999', period: '/mo',
    calls: 2000, agents: 20, kb: 999,
    features: ['2,000 calls / month', '20 AI voice agents', 'Unlimited knowledge bases', 'Full analytics suite', 'Dedicated support', 'Custom integrations'],
  },
];

const INVOICES = [
  { month: 'March 2026', amount: '₹2,999', status: 'paid' },
  { month: 'February 2026', amount: '₹2,999', status: 'paid' },
];

export default function Billing() {
  const { company } = useAuth();
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    analyticsAPI.dashboard(30).then(setUsage).catch(() => {});
  }, []);

  const currentPlan = PLANS.find(p => p.id === company?.plan) || PLANS[0];
  const callUsage   = usage?.total_calls || 0;
  const usagePct    = currentPlan.calls ? Math.min(100, Math.round(callUsage / currentPlan.calls * 100)) : 0;
  const usageColor  = usagePct > 85 ? 'var(--danger)' : usagePct > 60 ? 'var(--warning)' : 'var(--accent)';

  return (
    <div style={{ animation: 'pageEnter .4s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Manage your subscription, usage, and invoices.</p>
        </div>
        <button className="btn btn-primary">Upgrade Plan</button>
      </div>

      {/* Current usage */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))', display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Current Plan</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-.04em', marginTop: 4 }}>
            {currentPlan.name}
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {currentPlan.price}<span style={{ fontSize: '0.72rem' }}>{currentPlan.period}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Call usage (30 days)</span>
            <span style={{ fontSize: '0.78rem', color: usageColor, fontWeight: 700 }}>{callUsage} / {currentPlan.calls}</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${usagePct}%`,
              background: `linear-gradient(90deg, var(--accent), ${usageColor})`,
              borderRadius: 'var(--r-pill)',
              transition: 'width 1s ease',
            }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{usagePct}% of monthly limit used</div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-3" style={{ marginBottom: 'var(--space-xl)' }}>
        {PLANS.map((plan, i) => (
          <div key={plan.id} className={`plan-card ${plan.popular ? 'popular' : ''}`}
            style={{ animation: `slideUp .4s ease-out ${i * 80}ms both` }}>
            {plan.popular && <div className="plan-popular-badge">Most popular</div>}

            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                {plan.name}
              </div>
              <div className="plan-price">
                {plan.price}<span>{plan.period}</span>
              </div>
            </div>

            <div className="plan-features">
              {plan.features.map(f => (
                <div key={f} className="plan-feature">{f}</div>
              ))}
            </div>

            <button
              className={plan.id === currentPlan.id ? 'btn btn-secondary' : plan.popular ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ width: '100%' }}
              disabled={plan.id === currentPlan.id}
            >
              {plan.id === currentPlan.id ? 'Current plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Invoices</div>
            <div className="card-subtitle">Download monthly billing statements.</div>
          </div>
          <button className="btn btn-ghost btn-sm">Export all</button>
        </div>

        {INVOICES.map(inv => (
          <div key={inv.month} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text-primary)' }}>{inv.month}</div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>{inv.amount}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="status-pill status-completed">{inv.status}</span>
              <button className="btn btn-secondary btn-sm">Download</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
