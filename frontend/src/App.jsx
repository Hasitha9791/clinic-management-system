import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Onboarding from './components/Onboarding';
import Consultations from './components/Consultations';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import Appointments from './components/Appointments';
import Communications from './components/Communications';
import Users from './components/Users';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('clinic_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  
  // Floating Toast Notifications State
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const { message, type } = e.detail;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message, type }]);
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    window.addEventListener('show-toast', handleToastEvent);
    
    // Bind to window global object
    window.showToast = (message, type = 'success') => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
    };

    return () => {
      window.removeEventListener('show-toast', handleToastEvent);
      delete window.showToast;
    };
  }, []);

  const formatDateTime = (date) => {
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' | ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Set default tab on login based on allowed permissions
  useEffect(() => {
    if (user) {
      const allowed = Array.isArray(user.allowed_tabs) ? user.allowed_tabs : (
        user.role === 'admin' ? ['dashboard', 'onboarding', 'appointments', 'consultations', 'billing', 'inventory', 'communications', 'users'] : (
          user.role === 'doctor' ? ['dashboard', 'onboarding', 'consultations', 'communications'] : (
            user.role === 'receptionist' ? ['dashboard', 'onboarding', 'appointments', 'communications'] : (
              user.role === 'cashier' ? ['dashboard', 'billing', 'inventory', 'communications'] : ['dashboard']
            )
          )
        )
      );

      if (allowed.length > 0 && !allowed.includes(activeTab)) {
        setActiveTab(allowed[0]);
      }
    }
  }, [user]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('clinic_user', JSON.stringify(data));
        if (window.showToast) {
          window.showToast(`Welcome back, ${data.username.toUpperCase()}!`, 'success');
        }
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Invalid credentials.');
        if (window.showToast) {
          window.showToast(err.error || 'Invalid credentials.', 'danger');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Server error. Please verify the backend is running.');
      if (window.showToast) {
        window.showToast('Server error during login.', 'danger');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('clinic_user');
    setSelectedPatient(null);
    setSelectedVisit(null);
    if (window.showToast) {
      window.showToast('Signed out successfully.', 'info');
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setSelectedVisit(null);
    
    // Route based on role/tab capabilities
    if (isTabAllowed('consultations')) {
      setActiveTab('consultations');
    } else if (isTabAllowed('appointments')) {
      setActiveTab('appointments');
    }
  };

  const handleGoToBilling = (patient, visit) => {
    setSelectedPatient(patient);
    setSelectedVisit(visit);
    if (isTabAllowed('billing')) {
      setActiveTab('billing');
    }
  };

  const clearBillingContext = () => {
    setSelectedVisit(null);
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const selectTab = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false); // Close sidebar on mobile
  };

  // Helper to determine if a tab should be shown to the logged-in user
  const isTabAllowed = (tabName) => {
    if (!user) return false;
    
    if (Array.isArray(user.allowed_tabs)) {
      return user.allowed_tabs.includes(tabName);
    }
    
    // Fallback if allowed_tabs is missing (e.g. old session)
    const role = user.role;
    if (role === 'admin') return true;
    if (role === 'doctor') {
      return ['dashboard', 'onboarding', 'consultations', 'communications'].includes(tabName);
    }
    if (role === 'receptionist') {
      return ['dashboard', 'onboarding', 'appointments', 'communications'].includes(tabName);
    }
    if (role === 'cashier') {
      return ['dashboard', 'billing', 'inventory', 'communications'].includes(tabName);
    }
    
    return false;
  };

  // Login view if user not authenticated
  if (!user) {
    return (
      <div className="login-page-wrapper">
        {/* Left branding welcome side */}
        <div className="login-hero-side">
          <div className="login-hero-content">
            <h1 className="login-hero-title">Ayu Health Suite</h1>
            <p className="login-hero-tagline">
              Empowering healthcare providers with real-time electronic medical records (EMR), 
              intelligent inventory control, queue token routing, and secure billing operations.
            </p>
            
            <ul className="login-features-list">
              <li className="login-feature-item">
                <div className="login-feature-icon">🩺</div>
                <div className="login-feature-text">
                  <h3>Clinical Consultations & EMR</h3>
                  <p>Comprehensive patient charts, vitals history timeline, and digital prescription pathways.</p>
                </div>
              </li>
              <li className="login-feature-item">
                <div className="login-feature-icon">💳</div>
                <div className="login-feature-text">
                  <h3>Integrated POS & Split Billing</h3>
                  <p>Process invoice copayments, cash-card splits, and insurance claims with instant stock deductions.</p>
                </div>
              </li>
              <li className="login-feature-item">
                <div className="login-feature-icon">📦</div>
                <div className="login-feature-text">
                  <h3>Batch Inventory & Expiry Alerts</h3>
                  <p>Track medicine batches, buying/cost price analytics, and automated countdown warnings for short-expiry stock.</p>
                </div>
              </li>
              <li className="login-feature-item">
                <div className="login-feature-icon">📅</div>
                <div className="login-feature-text">
                  <h3>Token Queue & Scheduler</h3>
                  <p>Automate daily patient queue numbers, doctor availability timelines, and WhatsApp check-in token alerts.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Right interactive login form side */}
        <div className="login-form-side">
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem', border: 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <img src="/logo.jpeg" alt="Ayu Health Suite Logo" style={{ width: '145px', height: '145px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--primary-light)', boxShadow: 'var(--shadow-md)', marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--dark)', marginTop: '0.25rem', letterSpacing: '0.2px' }}>Ayu Health Suite</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, marginTop: '0.25rem' }}>Integrated Clinical Operations & Healthcare Portal</p>
            </div>

            {loginError && (
              <div className="badge badge-danger" style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: '4px', textAlign: 'center' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  placeholder="e.g. admin or doctor"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value.toLowerCase().trim() }))}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="e.g. admin123"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.95rem' }} disabled={loginLoading}>
                {loginLoading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar for Desktop & Mobile */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem', width: '100%', padding: '0.5rem 0' }}>
          <img src="/logo.jpeg" alt="Ayu Health Suite Logo" style={{ width: '95px', height: '95px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary-light)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
          <span className="logo-text" style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'center', letterSpacing: '0.5px' }}>Ayu Health Suite</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          <ul className="nav-links">
            {isTabAllowed('dashboard') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('dashboard')} 
                  className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                  Dashboard
                </button>
              </li>
            )}
            {isTabAllowed('onboarding') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('onboarding')} 
                  className={`nav-button ${activeTab === 'onboarding' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="17" y1="11" x2="23" y2="11"></line></svg>
                  Onboard Patient
                </button>
              </li>
            )}
            {isTabAllowed('appointments') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('appointments')} 
                  className={`nav-button ${activeTab === 'appointments' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Appointments & Queue
                </button>
              </li>
            )}
            {isTabAllowed('consultations') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('consultations')} 
                  className={`nav-button ${activeTab === 'consultations' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                  Consultations
                </button>
              </li>
            )}
            {isTabAllowed('billing') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('billing')} 
                  className={`nav-button ${activeTab === 'billing' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                  POS & Billing
                </button>
              </li>
            )}
            {isTabAllowed('inventory') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('inventory')} 
                  className={`nav-button ${activeTab === 'inventory' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                  Stock Inventory
                </button>
              </li>
            )}
            {isTabAllowed('communications') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('communications')} 
                  className={`nav-button ${activeTab === 'communications' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Communications
                </button>
              </li>
            )}
            {isTabAllowed('users') && (
              <li className="nav-item">
                <button 
                  onClick={() => selectTab('users')} 
                  className={`nav-button ${activeTab === 'users' ? 'active' : ''}`}
                >
                  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Users & Permissions
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Selected Patient Status in Sidebar footer */}
        {selectedPatient && (
          <div style={{ marginTop: 'auto', marginBottom: '1rem', padding: '0.85rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
            <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700, marginBottom: '0.25rem' }}>Active Patient</p>
            <p style={{ color: '#fff', fontWeight: 600 }}>{selectedPatient.name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>ID: {selectedPatient.id}</p>
            <button 
              onClick={() => { setSelectedPatient(null); setSelectedVisit(null); }} 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.72rem', marginTop: '0.5rem', backgroundColor: 'transparent', color: '#ff6b6b', borderColor: '#ff6b6b' }}
            >
              Clear Active
            </button>
          </div>
        )}

        {/* User profile & Logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>👤</span>
            <div>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', lineHeight: '1.2' }}>{user.username.toUpperCase()}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'capitalize' }}>Role: {user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-danger" 
            style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.82rem', marginTop: '0.25rem', backgroundColor: '#e53e3e' }}
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Header (only visible on mobile screens) */}
      <main className="main-content">
        <header className="header-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={toggleSidebar} className="menu-toggle" aria-label="Toggle Navigation Menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Clinic Analytics Dashboard'}
              {activeTab === 'onboarding' && 'Patient Onboarding'}
              {activeTab === 'appointments' && 'Appointments & Queue Tokens'}
              {activeTab === 'consultations' && 'Doctor Consultations & Diagnosis'}
              {activeTab === 'billing' && 'Clinic POS & Billing'}
              {activeTab === 'inventory' && 'Medical Items & Equipment Stock'}
              {activeTab === 'communications' && 'Communications Log'}
              {activeTab === 'users' && 'Users & Permissions'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="current-date">
              📅 {formatDateTime(currentDateTime)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--white)', border: '1px solid var(--border)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem' }}>
              <span style={{ fontSize: '1rem' }}>👤</span>
              <span style={{ fontWeight: 600, color: 'var(--dark)' }}>{user.username}</span>
              <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', textTransform: 'uppercase' }}>{user.role}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Views */}
        {activeTab === 'dashboard' && (
          <Dashboard />
        )}
        
        {activeTab === 'onboarding' && (
          <Onboarding onPatientSelect={handlePatientSelect} />
        )}

        {activeTab === 'appointments' && (
          <Appointments 
            onSelectPatient={setSelectedPatient} 
            onGoToConsultation={handlePatientSelect} 
          />
        )}
        
        {activeTab === 'consultations' && (
          <Consultations 
            selectedPatient={selectedPatient} 
            onSelectPatient={setSelectedPatient} 
            onGoToBilling={handleGoToBilling} 
          />
        )}
        
        {activeTab === 'billing' && (
          <Billing 
            selectedPatient={selectedPatient} 
            selectedVisit={selectedVisit} 
            onSelectPatient={setSelectedPatient}
            clearBillingContext={clearBillingContext}
          />
        )}
        
        {activeTab === 'inventory' && (
          <Inventory />
        )}

        {activeTab === 'communications' && (
          <Communications />
        )}

        {activeTab === 'users' && (
          <Users />
        )}
      </main>

      {/* Floating Toast Notification Feed */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            <span style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center' }}>
              {toast.type === 'success' && '✅'}
              {toast.type === 'danger' && '❌'}
              {toast.type === 'warning' && '⚠️'}
              {toast.type === 'info' && 'ℹ️'}
            </span>
            <div style={{ flex: 1, paddingRight: '0.5rem' }}>{toast.message}</div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
