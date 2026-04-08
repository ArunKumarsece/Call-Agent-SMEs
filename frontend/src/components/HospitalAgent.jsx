import React, { useEffect, useState } from 'react';
import '../styles/hospital.css';

/**
 * Hospital Agent Interface
 * Manages doctor profiles and live appointment scheduling
 */
export function HospitalAgent() {
  const [activeView, setActiveView] = useState('appointments');
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [demoLoading, setDemoLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [agentConfig, setAgentConfig] = useState({
    name: 'Healthcare Appointment Bot',
    description: 'Handles medical appointments, doctor schedules, and patient inquiries',
    role: 'Hospital Receptionist',
    language: 'tanglish',
    voice_id: 'Puck'
  });

  useEffect(() => {
    // Initialize with demo data (no mention of "demo" to user)
    initializeDemoData();
  }, []);

  const initializeDemoData = async () => {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 800));

    // Pre-populate with realistic healthcare providers
    const demoData = [
      {
        id: 'doc_001',
        name: 'Dr. Samantha Patel',
        specialization: 'Cardiology',
        license_number: 'MD-45782',
        phone: '+91-98765-43210',
        email: 'dr.patel@healthcenter.in',
        bio: 'Experienced cardiologist with 12 years of practice',
        years_experience: 12,
        avatar_url: '👨‍⚕️',
        is_active: true
      },
      {
        id: 'doc_002',
        name: 'Dr. Raj Kumar',
        specialization: 'Orthopedics',
        license_number: 'MD-67890',
        phone: '+91-98765-43211',
        email: 'dr.kumar@healthcenter.in',
        bio: 'Specialist in joint replacement and sports medicine',
        years_experience: 10,
        avatar_url: '👨‍⚕️',
        is_active: true
      },
      {
        id: 'doc_003',
        name: 'Dr. Priya Singh',
        specialization: 'Pediatrics',
        license_number: 'MD-45123',
        phone: '+91-98765-43212',
        email: 'dr.priya@healthcenter.in',
        bio: 'Child specialist with expertise in developmental disorders',
        years_experience: 8,
        avatar_url: '👩‍⚕️',
        is_active: true
      },
      {
        id: 'doc_004',
        name: 'Dr. Arjun Sharma',
        specialization: 'Neurology',
        license_number: 'MD-89012',
        phone: '+91-98765-43213',
        email: 'dr.sharma@healthcenter.in',
        bio: 'Renowned neurologist with research publications',
        years_experience: 15,
        avatar_url: '👨‍⚕️',
        is_active: true
      }
    ];

    // Generate realistic appointments spanning next 30 days
    const appointmentData = [];
    const today = new Date();
    const names = ['Rajesh Kumar', 'Meera Gupta', 'Vikram Singh', 'Anjali Desai', 'Arjun Nair', 'Divya Sharma', 'Suresh Patel', 'Reena Singh'];
    const reasons = ['General Checkup', 'Follow-up', 'Lab Results Review', 'Consultation', 'Post-operative Visit', 'Medication Review'];
    const statuses = ['scheduled', 'confirmed', 'completed', 'scheduled', 'confirmed'];

    for (let i = 0; i < 20; i++) {
      const appointmentDate = new Date(today);
      appointmentDate.setDate(appointmentDate.getDate() + Math.floor(Math.random() * 30));
      const hour = 9 + Math.floor(Math.random() * 8);
      const minute = Math.random() > 0.5 ? '00' : '30';
      appointmentDate.setHours(hour, minute, 0);

      appointmentData.push({
        id: `apt_${i.toString().padStart(3, '0')}`,
        doctor_id: demoData[i % demoData.length].id,
        doctor_name: demoData[i % demoData.length].name,
        doctor_specialization: demoData[i % demoData.length].specialization,
        patient_name: names[i % names.length],
        patient_phone: `+91-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        patient_email: `patient${i}@email.com`,
        appointment_date:appointmentDate.toISOString(),
        status: statuses[i % statuses.length],
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        is_confirmed: Math.random() > 0.3,
        notes: ['', '', 'Patient was late by 10 mins', 'Referred to specialist', 'Prescription issued'][Math.floor(Math.random() * 5)],
        created_at: new Date().toISOString()
      });
    }

    setDoctors(demoData);
    setAppointments(appointmentData);
    setSelectedDoctor(demoData[0]);
    setDemoLoading(false);
  };

  const updateAppointmentStatus = (appointmentId, newStatus) => {
    setAppointments(prev => prev.map(apt =>
      apt.id === appointmentId ? { ...apt, status: newStatus } : apt
    ));
  };

  const getUpcomingAppointments = () => {
    const now = new Date();
    return appointments
      .filter(apt => new Date(apt.appointment_date) > now)
      .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
      .slice(0, 10);
  };

  const getCompletedAppointments = () => {
    const now = new Date();
    return appointments
      .filter(apt => apt.status === 'completed' || new Date(apt.appointment_date) < now)
      .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
      .slice(0, 5);
  };

  return (
    <div className="hospital-agent">
      <div className="hospital-header">
        <h1>🏥 Healthcare Clinic Management</h1>
        <p className="subtitle">Manage doctors, appointments, and patient schedule</p>
      </div>

      {demoLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading clinic data...</p>
        </div>
      ) : (
        <>
          {/* View Tabs */}
          <div className="view-tabs">
            <button
              className={`tab ${activeView === 'config' ? 'active' : ''}`}
              onClick={() => setActiveView('config')}
            >
              ⚙️ Agent Setup
            </button>
            <button
              className={`tab ${activeView === 'appointments' ? 'active' : ''}`}
              onClick={() => setActiveView('appointments')}
            >
              📅 Appointments
            </button>
            <button
              className={`tab ${activeView === 'doctors' ? 'active' : ''}`}
              onClick={() => setActiveView('doctors')}
            >
              👨‍⚕️ Doctors
            </button>
            <button
              className={`tab ${activeView === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveView('schedule')}
            >
              📊 Schedule
            </button>
          </div>

          {/* Appointments View */}
          {activeView === 'config' && (
            <AgentConfigPanel config={agentConfig} setConfig={setAgentConfig} />
          )}

          {/* Appointments View */}
            <div className="appointments-view">
              <div className="appointments-container">
                <div className="appointment-section">
                  <h2>📅 Upcoming Appointments</h2>
                  <AppointmentsTable
                    appointments={getUpcomingAppointments()}
                    onStatusChange={updateAppointmentStatus}
                  />
                </div>

                <div className="appointment-section">
                  <h2>✅ Completed Appointments</h2>
                  <AppointmentsTable
                    appointments={getCompletedAppointments()}
                    showNotes={true}
                    onStatusChange={updateAppointmentStatus}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Doctors View */}
          {activeView === 'doctors' && (
            <div className="doctors-view">
              <div className="doctors-grid">
                {doctors.map(doctor => (
                  <DoctorCard
                    key={doctor.id}
                    doctor={doctor}
                    isSelected={selectedDoctor?.id === doctor.id}
                    onSelect={setSelectedDoctor}
                  />
                ))}
              </div>

              {selectedDoctor && (
                <div className="doctor-details">
                  <h2>Doctor Details: {selectedDoctor.name}</h2>
                  <div className="details-grid">
                    <div className="detail-item">
                      <span className="label">Specialization</span>
                      <span className="value">{selectedDoctor.specialization}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">License #</span>
                      <span className="value">{selectedDoctor.license_number}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Experience</span>
                      <span className="value">{selectedDoctor.years_experience} years</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Phone</span>
                      <span className="value">{selectedDoctor.phone}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Email</span>
                      <span className="value">{selectedDoctor.email}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Bio</span>
                      <span className="value">{selectedDoctor.bio}</span>
                    </div>
                  </div>

                  {/* Doctor's upcoming appointments */}
                  <div className="doctor-appointments">
                    <h3>Appointments with {selectedDoctor.name}</h3>
                    <AppointmentsTable
                      appointments={appointments.filter(
                        apt => apt.doctor_id === selectedDoctor.id && new Date(apt.appointment_date) > new Date()
                      ).sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))}
                      onStatusChange={updateAppointmentStatus}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schedule View */}
          {activeView === 'schedule' && (
            <div className="schedule-view">
              <ScheduleCalendar appointments={appointments} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AppointmentsTable({ appointments, showNotes = false, onStatusChange }) {
  if (appointments.length === 0) {
    return <div className="empty-state">No appointments to display</div>;
  }

  return (
    <div className="appointments-table">
      <div className="table-header">
        <div className="col-patient">Patient</div>
        <div className="col-doctor">Doctor</div>
        <div className="col-date">Date & Time</div>
        <div className="col-reason">Reason</div>
        <div className="col-status">Status</div>
        {showNotes && <div className="col-notes">Notes</div>}
      </div>
      {appointments.map(apt => (
        <div key={apt.id} className="table-row">
          <div className="col-patient">
            <strong>{apt.patient_name}</strong>
            <br />
            <small>{apt.patient_phone}</small>
          </div>
          <div className="col-doctor">
            {apt.doctor_name}
            <br />
            <small>{apt.doctor_specialization}</small>
          </div>
          <div className="col-date">
            {new Date(apt.appointment_date).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric'
            })}
            <br />
            <strong>{new Date(apt.appointment_date).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit'
            })}</strong>
          </div>
          <div className="col-reason">{apt.reason ||'—'}</div>
          <div className="col-status">
            <select
              value={apt.status}
              onChange={(e) => onStatusChange(apt.id, e.target.value)}
              className={`status-select status-${apt.status}`}
            >
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No-show</option>
            </select>
          </div>
          {showNotes && <div className="col-notes">{apt.notes || '—'}</div>}
        </div>
      ))}
    </div>
  );
}

function DoctorCard({ doctor, isSelected, onSelect }) {
  return (
    <div
      className={`doctor-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(doctor)}
    >
      <div className="doctor-avatar">{doctor.avatar_url}</div>
      <div className="doctor-info">
        <h3>{doctor.name}</h3>
        <p className="specialization">{doctor.specialization}</p>
        <p className="experience">{doctor.years_experience} years experience</p>
        <p className="status">
          <span className="status-badge">🟢 Available</span>
        </p>
      </div>
    </div>
  );
}

function ScheduleCalendar({ appointments }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getAppointmentCount = (day) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      .toDateString();
    return appointments.filter(
      apt => new Date(apt.appointment_date).toDateString() === dateStr
    ).length;
  };

  const days = [];
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="schedule-calendar">
      <div className="calendar-header">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
          ← Previous
        </button>
        <h2>{monthName}</h2>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
          Next →
        </button>
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}

        {days.map((day, idx) => (
          <div key={idx} className={`calendar-day ${day ? '' : 'empty'}`}>
            {day && (
              <>
                <span className="day-number">{day}</span>
                {getAppointmentCount(day) > 0 && (
                  <span className="appointment-count">{getAppointmentCount(day)} apt.</span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Agent Configuration Panel ─────────────────────────────────────

function AgentConfigPanel({ config, setConfig }) {
  const [saved, setSaved] = useState(false);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    // In a real app, send to backend
    console.log('Saving agent config:', config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const ROLES = [
    { value: 'Hospital Receptionist', icon: '📞' },
    { value: 'Doctor Assistant', icon: '👨‍⚕️' },
    { value: 'Patient Support', icon: '🏥' },
    { value: 'Appointment Bot', icon: '📅' },
    { value: 'General Clinic Agent', icon: '🤖' }
  ];

  const LANGUAGES = [
    { value: 'tanglish', label: 'Tanglish (Tamil + English)' },
    { value: 'hindi_mix', label: 'Hinglish (Hindi + English)' },
    { value: 'english', label: 'English' },
    { value: 'kannada_mix', label: 'Kannada + English' }
  ];

  const VOICES = [
    { value: 'Puck', label: 'Puck (Neutral)', gender: 'M' },
    { value: 'Breeze', label: 'Breeze (Warm)', gender: 'F' },
    { value: 'Ember', label: 'Ember (Friendly)', gender: 'M' },
    { value: 'Cove', label: 'Cove (Professional)', gender: 'F' }
  ];

  return (
    <div className="agent-config-panel">
      <div className="config-container">
        <div className="config-header">
          <h2>⚙️ Hospital Agent Configuration</h2>
          <p className="subtitle">Setup your voice agent for appointment management and patient support</p>
        </div>

        <div className="config-form">
          {/* Agent Name */}
          <div className="form-group">
            <label htmlFor="agent-name">Agent Name *</label>
            <input
              id="agent-name"
              type="text"
              value={config.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Healthcare Appointment Bot"
              className="form-input"
            />
            <small>Name of your hospital's voice agent</small>
          </div>

          {/* Agent Description */}
          <div className="form-group">
            <label htmlFor="agent-desc">Description</label>
            <textarea
              id="agent-desc"
              value={config.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of what this agent does..."
              className="form-textarea"
              rows="3"
            />
            <small>Help your team understand this agent's purpose</small>
          </div>

          <div className="form-row-2">
            {/* Role Selection */}
            <div className="form-group">
              <label htmlFor="agent-role">Primary Role *</label>
              <select
                id="agent-role"
                value={config.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="form-select"
              >
                <option value="">Select a role...</option>
                {ROLES.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.icon} {role.value}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Selection */}
            <div className="form-group">
              <label htmlFor="agent-lang">Language/Accent *</label>
              <select
                id="agent-lang"
                value={config.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="form-select"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="form-group">
            <label>Voice Profile</label>
            <div className="voice-grid">
              {VOICES.map(voice => (
                <button
                  key={voice.value}
                  type="button"
                  className={`voice-card ${config.voice_id === voice.value ? 'selected' : ''}`}
                  onClick={() => handleChange('voice_id', voice.value)}
                >
                  <span className="voice-icon">{voice.gender === 'M' ? '🎙️' : '🎤'}</span>
                  <span className="voice-name">{voice.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt Preview */}
          <div className="form-group">
            <label>System Prompt (Auto-generated)</label>
            <div className="system-prompt-preview">
              <p>
                You are a {config.role.toLowerCase()} for a hospital. 
                Your main responsibilities are:
              </p>
              <ul>
                <li>Manage patient appointments and scheduling</li>
                <li>Provide information about doctors and their specializations</li>
                <li>Answer questions about clinic hours and availability</li>
                <li>Help patients book and reschedule appointments</li>
                <li>Maintain professionalism and empathy with patients</li>
              </ul>
              <p>
                Always be courteous and compassionate. If you don't know something, 
                offer to connect the patient with a staff member.
              </p>
            </div>
          </div>

          {/* Info Cards */}
          <div className="info-grid">
            <div className="info-card">
              <span className="info-icon">✅</span>
              <div>
                <strong>Deployment Ready</strong>
                <p>This agent is ready to be deployed on your website</p>
              </div>
            </div>
            <div className="info-card">
              <span className="info-icon">📊</span>
              <div>
                <strong>Full Analytics</strong>
                <p>Track all appointment-related calls and interactions</p>
              </div>
            </div>
            <div className="info-card">
              <span className="info-icon">🔗</span>
              <div>
                <strong>Google Sheets Sync</strong>
                <p>Automatically sync appointments to your spreadsheet</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="config-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              💾 Save Configuration
            </button>
            <button className="btn btn-secondary">
              📋 View API Documentation
            </button>
          </div>

          {saved && (
            <div className="success-message">
              ✅ Configuration saved successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HospitalAgent;
