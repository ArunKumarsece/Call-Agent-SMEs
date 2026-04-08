import React, { useState } from 'react';
import MultiWidgetDashboard from '../components/MultiWidgetDashboard';
import HospitalAgent from '../components/HospitalAgent';
import '../styles/integration.css';

/**
 * Integration Page - Showcases Multi-Widget Dashboard and Hospital Agent
 */
export function IntegrationPage() {
  const [activeModule, setActiveModule] = useState('dashboard');

  return (
    <div className="integration-page">
      {/* Navigation Sidebar */}
      <div className="integration-nav">
        <div className="nav-header">
          <h2>🚀 Platform Modules</h2>
        </div>
        <nav className="module-list">
          <button
            className={`module-btn ${activeModule === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveModule('dashboard')}
          >
            <span className="icon">📊</span>
            Multi-Widget Dashboard
            <span className="badge">NEW</span>
          </button>
          <button
            className={`module-btn ${activeModule === 'hospital' ? 'active' : ''}`}
            onClick={() => setActiveModule('hospital')}
          >
            <span className="icon">🏥</span>
            Hospital Management
            <span className="badge">NEW</span>
          </button>
        </nav>

        <div className="nav-features">
          <h3>✨ Features Enabled</h3>
          <ul>
            <li>✅ Multi-Agent Analytics</li>
            <li>✅ Real-time Sentiment Analysis</li>
            <li>✅ Live Call Summarization</li>
            <li>✅ Doctor Management</li>
            <li>✅ Appointment Scheduling</li>
            <li>✅ Live Spreadsheet View</li>
            <li>✅ Calendar Integration</li>
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="integration-content">
        {activeModule === 'dashboard' && (
          <div className="module-content">
            <MultiWidgetDashboard />
          </div>
        )}

        {activeModule === 'hospital' && (
          <div className="module-content">
            <HospitalAgent />
          </div>
        )}
      </div>
    </div>
  );
}

export default IntegrationPage;
