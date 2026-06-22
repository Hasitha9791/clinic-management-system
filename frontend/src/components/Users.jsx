import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

const SYSTEM_TABS = [
  { id: 'dashboard', label: '📊 Dashboard Summary' },
  { id: 'onboarding', label: '👤 Patient Onboarding' },
  { id: 'appointments', label: '📅 Appointments & Queue' },
  { id: 'consultations', label: '🩺 Doctor Consultations' },
  { id: 'billing', label: '💳 POS & Billing Cart' },
  { id: 'inventory', label: '📦 Stock Inventory' },
  { id: 'communications', label: '💬 Communications Log' },
  { id: 'users', label: '🔧 Users & Permissions' }
];

const DEFAULT_ROLE_TABS = {
  admin: ['dashboard', 'onboarding', 'appointments', 'consultations', 'billing', 'inventory', 'communications', 'users'],
  doctor: ['dashboard', 'onboarding', 'consultations', 'communications'],
  receptionist: ['dashboard', 'onboarding', 'appointments', 'communications'],
  cashier: ['dashboard', 'billing', 'inventory', 'communications'],
  custom: ['dashboard']
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'custom',
    allowed_tabs: ['dashboard']
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
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
    if (!formData.username || !formData.password) {
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
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `System user "${formData.username}" created successfully!` });
        setFormData({
          username: '',
          password: '',
          role: 'custom',
          allowed_tabs: ['dashboard']
        });
        fetchUsers();
      } else {
        const err = await res.json();
        setMessage({ type: 'danger', text: err.error || 'Failed to create user.' });
      }
    } catch (err) {
      console.error('Error adding user:', err);
      setMessage({ type: 'danger', text: 'Server error creating user.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (username === 'admin') {
      alert('Cannot delete master admin user.');
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
        alert(`User ${username} deleted.`);
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  return (
    <div className="grid-sidebar-layout">
      {/* Create User Form */}
      <div className="card">
        <h3 className="card-title">Add System User & Set Access</h3>
        
        {message.text && (
          <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input
              type="text"
              placeholder="e.g. nurse_jane"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().trim() }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={loading}>
            {loading ? 'Creating...' : 'Create System User'}
          </button>
        </form>
      </div>

      {/* Users List Card */}
      <div className="card">
        <h3 className="card-title">Active System Users</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Registered staff accounts, their default roles, and their custom screen credentials.
        </p>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Allowed Screens</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map(u => (
                  <tr key={u.username}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--dark)' }}>{u.username}</span>
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{u.role}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '250px' }}>
                        {(Array.isArray(u.allowed_tabs) ? u.allowed_tabs : []).map(tabId => {
                          const matchingTab = SYSTEM_TABS.find(t => t.id === tabId);
                          return (
                            <span 
                              key={tabId} 
                              className="badge" 
                              style={{ 
                                fontSize: '0.68rem', 
                                padding: '0.1rem 0.35rem', 
                                backgroundColor: tabId === 'users' ? 'var(--warning-light)' : 'var(--light)',
                                color: tabId === 'users' ? 'var(--warning)' : 'var(--text-muted)',
                                border: '1px solid var(--border)'
                              }}
                            >
                              {matchingTab ? matchingTab.label.split(' ').slice(1).join(' ') : tabId}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      {u.username !== 'admin' ? (
                        <button
                          onClick={() => handleDeleteUser(u.username)}
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                        >
                          Delete
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Master User</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No system users loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
