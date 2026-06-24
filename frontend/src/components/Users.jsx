import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

const SYSTEM_TABS = [
  { id: 'dashboard', label: '📊 Dashboard Summary' },
  { id: 'onboarding', label: '👤 Patient Onboarding' },
  { id: 'appointments', label: '📅 Appointments & Queue' },
  { id: 'consultations', label: '🩺 Doctor Consultations' },
  { id: 'follow-ups', label: '📆 Follow-Up Schedule' },
  { id: 'billing', label: '💳 POS & Billing Cart' },
  { id: 'inventory', label: '📦 Stock Inventory' },
  { id: 'drug-templates', label: '💊 Drug Templates' },
  { id: 'communications', label: '💬 Communications Log' },
  { id: 'users', label: '🔧 Users & Permissions' },
  { id: 'clinic-profile', label: '⚙️ Clinic Profile Settings' }
];

const DEFAULT_ROLE_TABS = {
  admin: ['dashboard', 'onboarding', 'appointments', 'consultations', 'follow-ups', 'billing', 'inventory', 'drug-templates', 'communications', 'users', 'clinic-profile'],
  doctor: ['dashboard', 'onboarding', 'consultations', 'follow-ups', 'drug-templates', 'communications'],
  receptionist: ['dashboard', 'onboarding', 'appointments', 'communications'],
  cashier: ['dashboard', 'billing', 'inventory', 'communications'],
  custom: ['dashboard']
};

const getShortTabLabel = (tabId) => {
  const matchingTab = SYSTEM_TABS.find(t => t.id === tabId);
  if (!matchingTab) return tabId;
  switch (tabId) {
    case 'dashboard': return '📊 Dashboard';
    case 'onboarding': return '👤 Onboarding';
    case 'appointments': return '📅 Queue';
    case 'consultations': return '🩺 Consults';
    case 'follow-ups': return '📆 Follow-Ups';
    case 'billing': return '💳 Billing';
    case 'inventory': return '📦 Inventory';
    case 'drug-templates': return '💊 Templates';
    case 'communications': return '💬 Messages';
    case 'users': return '🔧 Users';
    case 'clinic-profile': return '⚙️ Profile';
    default: return matchingTab.label;
  }
};

const getAvatarBg = (role) => {
  switch (role) {
    case 'admin': return 'linear-gradient(135deg, hsl(350, 75%, 55%), hsl(0, 75%, 45%))';
    case 'doctor': return 'linear-gradient(135deg, var(--primary), var(--secondary))';
    case 'receptionist': return 'linear-gradient(135deg, hsl(38, 90%, 55%), hsl(25, 95%, 45%))';
    case 'cashier': return 'linear-gradient(135deg, hsl(260, 60%, 55%), hsl(240, 65%, 45%))';
    default: return 'linear-gradient(135deg, hsl(180, 12%, 50%), hsl(180, 12%, 38%))';
  }
};

const getRoleBadgeStyle = (role) => {
  switch (role) {
    case 'admin':
      return { backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid hsl(0, 75%, 90%)', textTransform: 'uppercase' };
    case 'doctor':
      return { backgroundColor: 'var(--success-light)', color: 'var(--success)', border: '1px solid hsl(145, 45%, 88%)', textTransform: 'uppercase' };
    case 'receptionist':
      return { backgroundColor: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid hsl(38, 90%, 90%)', textTransform: 'uppercase' };
    case 'cashier':
      return { backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid hsl(172, 40%, 88%)', textTransform: 'uppercase' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid var(--border)', textTransform: 'uppercase' };
  }
};

const getTabPillStyle = (tabId) => {
  switch (tabId) {
    case 'users':
    case 'clinic-profile':
      return { 
        backgroundColor: 'var(--danger-light)', 
        color: 'var(--danger)', 
        borderColor: 'hsl(0, 75%, 90%)',
        fontWeight: 600
      };
    case 'billing':
    case 'inventory':
      return { 
        backgroundColor: 'var(--primary-light)', 
        color: 'var(--primary)', 
        borderColor: 'hsl(172, 40%, 88%)',
        fontWeight: 600
      };
    case 'consultations':
      return { 
        backgroundColor: 'var(--success-light)', 
        color: 'var(--success)', 
        borderColor: 'hsl(145, 45%, 88%)',
        fontWeight: 600
      };
    default:
      return { 
        backgroundColor: 'var(--light)', 
        color: 'var(--text-muted)', 
        borderColor: 'var(--border)' 
      };
  }
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [isEditingUser, setIsEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'custom',
    allowed_tabs: ['dashboard']
  });

  const [doctors, setDoctors] = useState([]);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    specialty: 'General Practice',
    contact: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchDoctors();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${API_URL}/api/doctors`);
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const handleRoleChange = (role) => {
    setFormData(prev => ({
      ...prev,
      role,
      allowed_tabs: DEFAULT_ROLE_TABS[role] || ['dashboard']
    }));
  };

  const handleCheckboxChange = (tabId, checked) => {
    setFormData(prev => {
      let updatedTabs = [...prev.allowed_tabs];
      if (checked) {
        if (!updatedTabs.includes(tabId)) {
          updatedTabs.push(tabId);
        }
      } else {
        updatedTabs = updatedTabs.filter(id => id !== tabId);
      }
      return { ...prev, allowed_tabs: updatedTabs };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || (!isEditingUser && !formData.password)) {
      setMessage({ type: 'danger', text: 'Username and Password are required.' });
      return;
    }
    if (formData.allowed_tabs.length === 0) {
      setMessage({ type: 'danger', text: 'Please authorize access to at least one screen.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const url = isEditingUser 
        ? `${API_URL}/api/users/${isEditingUser}`
        : `${API_URL}/api/users`;
      
      const method = isEditingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const successMsg = isEditingUser
          ? `System user "${formData.username}" updated successfully!`
          : `System user "${formData.username}" created successfully!`;
        setMessage({ type: 'success', text: successMsg });
        if (window.showToast) window.showToast(successMsg, 'success');
        setFormData({
          username: '',
          password: '',
          role: 'custom',
          allowed_tabs: ['dashboard']
        });
        setIsEditingUser(null);
        fetchUsers();
      } else {
        const err = await res.json();
        const errMsg = err.error || `Failed to ${isEditingUser ? 'update' : 'create'} user.`;
        setMessage({ type: 'danger', text: errMsg });
        if (window.showToast) window.showToast(errMsg, 'danger');
      }
    } catch (err) {
      console.error(`Error ${isEditingUser ? 'updating' : 'adding'} user:`, err);
      const errMsg = `Server error ${isEditingUser ? 'updating' : 'creating'} user.`;
      setMessage({ type: 'danger', text: errMsg });
      if (window.showToast) window.showToast(errMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (username === 'admin') {
      if (window.showToast) window.showToast('Cannot delete master admin user.', 'danger');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user "${username}"? They will lose all access immediately.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/users/${username}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (window.showToast) window.showToast(`User "${username}" deleted successfully.`, 'success');
        fetchUsers();
      } else {
        const err = await res.json();
        if (window.showToast) window.showToast(err.error || 'Failed to delete user.', 'danger');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      if (window.showToast) window.showToast('Error deleting user. Please try again.', 'danger');
    }
  };

  const handleEditUser = (user) => {
    setIsEditingUser(user.username);
    setFormData({
      username: user.username,
      password: '', // blank by default
      role: user.role,
      allowed_tabs: user.allowed_tabs || []
    });
    setMessage({ type: '', text: '' });
    
    const formCard = document.querySelector('form');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setIsEditingUser(null);
    setFormData({
      username: '',
      password: '',
      role: 'custom',
      allowed_tabs: ['dashboard']
    });
    setMessage({ type: '', text: '' });
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!doctorForm.name || !doctorForm.specialty) {
      if (window.showToast) window.showToast('Doctor name and specialty are required.', 'danger');
      return;
    }

    setDoctorLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doctorForm)
      });

      if (res.ok) {
        const successMsg = `Doctor "${doctorForm.name}" added to registry successfully!`;
        if (window.showToast) window.showToast(successMsg, 'success');
        setDoctorForm({ name: '', specialty: 'General Practice', contact: '' });
        fetchDoctors();
      } else {
        const err = await res.json();
        if (window.showToast) window.showToast(err.error || 'Failed to add doctor.', 'danger');
      }
    } catch (err) {
      console.error('Error adding doctor:', err);
      if (window.showToast) window.showToast('Server error adding doctor.', 'danger');
    } finally {
      setDoctorLoading(false);
    }
  };

  const handleDeleteDoctor = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the registry?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/doctors/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (window.showToast) window.showToast(`Doctor "${name}" removed successfully.`, 'success');
        fetchDoctors();
      } else {
        const err = await res.json();
        if (window.showToast) window.showToast(err.error || 'Failed to remove doctor.', 'danger');
      }
    } catch (err) {
      console.error('Error deleting doctor:', err);
      if (window.showToast) window.showToast('Error removing doctor.', 'danger');
    }
  };

  return (
    <div className="grid-sidebar-layout">
      {/* Left Column: Registry Tables (Occupies 2fr) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Users List Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>👥 Active System Users</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Registered staff accounts, their default roles, and their custom screen credentials.
          </p>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr style={{ background: 'var(--light)' }}>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Staff User</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Authorized Portal Tabs</th>
                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>System Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map(u => (
                    <tr key={u.username} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          {/* Staff Avatar with dynamic color and role initials */}
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: getAvatarBg(u.role),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            textTransform: 'uppercase',
                            border: '1.5px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                            flexShrink: 0
                          }}>
                            {u.username.slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--dark)', fontSize: '0.88rem', lineHeight: '1.2' }}>{u.username}</div>
                            <div style={{ marginTop: '0.15rem' }}>
                              <span className="badge" style={{ ...getRoleBadgeStyle(u.role), fontSize: '0.6rem', padding: '0.02rem 0.35rem', borderRadius: '4px' }}>
                                {u.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '100%' }}>
                          {(Array.isArray(u.allowed_tabs) ? u.allowed_tabs : []).map(tabId => (
                            <span 
                              key={tabId} 
                              className="badge" 
                              style={{ 
                                fontSize: '0.68rem', 
                                padding: '0.12rem 0.45rem', 
                                border: '1px solid',
                                ...getTabPillStyle(tabId)
                              }}
                            >
                              {getShortTabLabel(tabId)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditUser(u)}
                            className="btn"
                            style={{ 
                              padding: '0.3rem 0.5rem', 
                              fontSize: '0.75rem',
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              border: '1px solid hsl(172, 40%, 88%)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              transition: 'var(--transition)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--primary)';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                              e.currentTarget.style.color = 'var(--primary)';
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                          </button>

                          {u.username !== 'admin' ? (
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              className="btn"
                              style={{ 
                                padding: '0.3rem 0.5rem', 
                                fontSize: '0.75rem',
                                backgroundColor: 'var(--danger-light)',
                                color: 'var(--danger)',
                                border: '1px solid hsl(0, 75%, 90%)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                transition: 'var(--transition)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--danger)';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--danger-light)';
                                e.currentTarget.style.color = 'var(--danger)';
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                              Delete
                            </button>
                          ) : (
                            <span style={{ 
                              fontSize: '0.72rem', 
                              color: 'var(--success)', 
                              fontWeight: 700, 
                              backgroundColor: 'var(--success-light)', 
                              padding: '0.2rem 0.45rem', 
                              borderRadius: '4px',
                              border: '1px solid hsl(145, 45%, 88%)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}>
                              🛡️ Master
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                      No system users loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Doctors List Card */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Doctors & Specialists Registry</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            List of medical professionals eligible to see patients and manage consultation slots.
          </p>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr style={{ background: 'var(--light)' }}>
                  <th style={{ padding: '0.6rem 0.8rem' }}>ID</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Doctor Name</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Specialty</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>Contact</th>
                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {doctors.length > 0 ? (
                  doctors.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span className="badge badge-primary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}>{d.id}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--dark)', fontSize: '0.88rem' }}>{d.name}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span className="badge" style={{ backgroundColor: 'var(--light)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}>{d.specialty}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{d.contact || 'N/A'}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteDoctor(d.id, d.name)}
                          className="btn btn-danger"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                      No doctors registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Admin Forms (Occupies 1fr) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Create/Edit User Form */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>
            {isEditingUser ? `✏️ Edit User: ${isEditingUser}` : '👥 Add System User & Set Access'}
          </h3>
          
          {message.text && (
            <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Username *</label>
              <input
                type="text"
                placeholder="e.g. nurse_jane"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().trim() }))}
                className="form-input"
                required
                disabled={isEditingUser !== null}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">
                {isEditingUser ? 'New Password (Leave blank to keep current)' : 'Password *'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showUserPassword ? "text" : "password"}
                  placeholder={isEditingUser ? "•••••••• (unchanged)" : "••••••••"}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="form-input"
                  style={{ paddingRight: '2.75rem' }}
                  required={!isEditingUser}
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword(!showUserPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                  title={showUserPassword ? "Hide password" : "Show password"}
                >
                  {showUserPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">System Role Template *</label>
              <select
                value={formData.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="form-select"
              >
                <option value="custom">👤 Custom Access (Configured Below)</option>
                <option value="admin">🔧 Administrator Template</option>
                <option value="doctor">🩺 Doctor Template</option>
                <option value="receptionist">👤 Receptionist Template</option>
                <option value="cashier">💳 Cashier Template</option>
              </select>
            </div>

            {/* Tab Screen Permissions Checkboxes */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Authorize Screen Access Permissions</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {SYSTEM_TABS.map(tab => (
                  <div key={tab.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id={`permission_${tab.id}`}
                      checked={formData.allowed_tabs.includes(tab.id)}
                      onChange={(e) => handleCheckboxChange(tab.id, e.target.checked)}
                      disabled={formData.role === 'admin'} // Admin has all tabs locked
                    />
                    <label 
                      htmlFor={`permission_${tab.id}`} 
                      style={{ fontSize: '0.9rem', cursor: formData.role === 'admin' ? 'default' : 'pointer', color: formData.role === 'admin' ? 'var(--text-muted)' : 'var(--text)' }}
                    >
                      {tab.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              {isEditingUser && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit} 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              )}
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 2 }} 
                disabled={loading}
              >
                {loading 
                  ? (isEditingUser ? 'Saving...' : 'Creating...') 
                  : (isEditingUser ? 'Save Changes' : 'Create System User')
                }
              </button>
            </div>
          </form>
        </div>

        {/* Create Doctor Form */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Add Doctor / Consultant</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Register a clinical doctor and their specialty to make them available in the queue and appointment manager.
          </p>

          <form onSubmit={handleAddDoctor}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Doctor Name *</label>
              <input
                type="text"
                placeholder="e.g. Dr. Arthur Miller"
                value={doctorForm.name}
                onChange={(e) => setDoctorForm(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Specialty / Department *</label>
              <input
                type="text"
                placeholder="e.g. Pediatrics, Cardiology, General Practice"
                value={doctorForm.specialty}
                onChange={(e) => setDoctorForm(prev => ({ ...prev, specialty: e.target.value }))}
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Contact Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. +94 77 123 4567"
                value={doctorForm.contact}
                onChange={(e) => setDoctorForm(prev => ({ ...prev, contact: e.target.value }))}
                className="form-input"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={doctorLoading}>
              {doctorLoading ? 'Adding...' : 'Add Doctor to Registry'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
