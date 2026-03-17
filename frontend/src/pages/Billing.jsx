import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../api';

const PLANS = [
    { id: 'free', name: 'Starter', price: '₹999/mo', calls: 100, agents: 1, kb: 1 },
    { id: 'pro', name: 'Growth', price: '₹2,999/mo', calls: 500, agents: 5, kb: 5 },
    { id: 'enterprise', name: 'Business', price: '₹7,999/mo', calls: 2000, agents: 20, kb: 'Unlimited' },
];

export default function Billing() {
    const { company } = useAuth();
    const [usage, setUsage] = useState(null);

    useEffect(() => { loadUsage(); }, []);

    async function loadUsage() {
        try {
            const data = await analyticsAPI.dashboard(30);
            setUsage(data);
        } catch {
            setUsage(null);
        }
    }

    const currentPlan = PLANS.find(p => p.id === company?.plan) || PLANS[0];
    const callUsage = usage?.total_calls || 0;
    const usagePct = currentPlan.calls ? Math.min(100, Math.round((callUsage / currentPlan.calls) * 100)) : 0;

    return (
        <div style={{ animation: 'pageEnter 0.5s ease-out' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Billing</h1>
                    <p className="page-subtitle">Manage your subscription, usage, and invoices.</p>
                </div>
                <button className="btn btn-primary">Upgrade Plan</button>
            </div>

            <div className="billing-hero">
                <div>
                    <div className="billing-label">Current plan</div>
                    <div className="billing-plan">{currentPlan.name}</div>
                    <div className="billing-price">{currentPlan.price}</div>
                </div>
                <div className="billing-usage">
                    <div className="billing-label">Call usage (30d)</div>
                    <div className="billing-progress">
                        <div className="billing-progress-bar" style={{ width: `${usagePct}%` }} />
                    </div>
                    <div className="billing-usage-meta">{callUsage} / {currentPlan.calls} calls</div>
                </div>
            </div>

            <div className="billing-grid">
                {PLANS.map((plan) => (
                    <div key={plan.id} className={`card billing-card ${plan.id === currentPlan.id ? 'active' : ''}`}>
                        <div className="card-title">{plan.name}</div>
                        <div className="billing-card-price">{plan.price}</div>
                        <ul className="billing-features">
                            <li>{plan.calls} calls / month</li>
                            <li>{plan.agents} agents</li>
                            <li>{plan.kb} knowledge bases</li>
                            <li>Analytics & call history</li>
                        </ul>
                        <button className="btn btn-secondary btn-sm">Select plan</button>
                    </div>
                ))}
            </div>

            <div className="card billing-invoices">
                <div className="card-header">
                    <div>
                        <div className="card-title">Invoices</div>
                        <div className="card-subtitle">Download monthly billing statements.</div>
                    </div>
                    <button className="btn btn-ghost btn-sm">Export</button>
                </div>
                <div className="billing-invoice-row">
                    <div>
                        <div className="billing-invoice-title">March 2026</div>
                        <div className="billing-invoice-meta">Paid · ₹2,999</div>
                    </div>
                    <button className="btn btn-secondary btn-sm">Download</button>
                </div>
                <div className="billing-invoice-row">
                    <div>
                        <div className="billing-invoice-title">February 2026</div>
                        <div className="billing-invoice-meta">Paid · ₹2,999</div>
                    </div>
                    <button className="btn btn-secondary btn-sm">Download</button>
                </div>
            </div>
        </div>
    );
}
