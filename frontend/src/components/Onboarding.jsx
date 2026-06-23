import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function Onboarding({ onPatientSelect }) {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    contact: '',
    address: '',
    medical_history: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_URL}/api/patients`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      const errMsg = 'Patient name is required.';
      setMessage({ type: 'danger', text: errMsg });
      if (window.showToast) window.showToast(errMsg, 'warning');
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_URL}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const newPatient = await res.json();
        const successMsg = `Patient "${newPatient.name}" onboarded successfully!`;
        setMessage({ type: 'success', text: successMsg });
        if (window.showToast) window.showToast(successMsg, 'success');
        setFormData({
          name: '',
          age: '',
          gender: 'Male',
          contact: '',
          address: '',
          medical_history: ''
        });
        fetchPatients();
      } else {
        const errData = await res.json();
        const errMsg = errData.error || 'Failed to onboard patient.';
        setMessage({ type: 'danger', text: errMsg });
        if (window.showToast) window.showToast(errMsg, 'danger');
      }
    } catch (err) {
      console.error('Error onboarding patient:', err);
      const errMsg = 'Server error. Please check if backend is running.';
      setMessage({ type: 'danger', text: errMsg });
      if (window.showToast) window.showToast(errMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter((patient) => {
    const term = search.toLowerCase();
    return (
      patient.name.toLowerCase().includes(term) ||
      (patient.contact && patient.contact.toLowerCase().includes(term)) ||
      patient.id.toLowerCase().includes(term)
    );
  });

  const handleExportExcel = () => {
    if (patients.length === 0) {
      if (window.showToast) window.showToast("No patient records found to export.", "warning");
      return;
    }

    // Define CSV Headers
    const headers = ['Patient ID', 'Name', 'Age', 'Gender', 'Contact No', 'Address', 'Medical History/Alerts'];
    
    // Format rows (escape quotes, wrap in quotes)
    const rows = patients.map(p => [
      p.id,
      p.name,
      p.age || '',
      p.gender || '',
      p.contact || '',
      p.address ? p.address.replace(/"/g, '""') : '',
      p.medical_history ? p.medical_history.replace(/"/g, '""') : ''
    ]);

    // Build CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    // Create dynamic download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Ayu_Health_Suite_Patient_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) window.showToast("Patient directory exported successfully for Excel.", "success");
  };

  return (
    <div className="grid-sidebar-layout">
      {/* Onboarding Form */}
      <div className="card">
        <h3 className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
          Register New Patient
        </h3>

        {message.text && (
          <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g. John Doe"
              className="form-input"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                placeholder="e.g. 35"
                className="form-input"
                min="0"
                max="120"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Number</label>
            <input
              type="text"
              name="contact"
              value={formData.contact}
              onChange={handleInputChange}
              placeholder="e.g. +94 77 123 4567"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="e.g. 123 Main St, Colombo"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Medical History / Allergies</label>
            <textarea
              name="medical_history"
              value={formData.medical_history}
              onChange={handleInputChange}
              placeholder="e.g. Penicillin allergy, Hypertension history..."
              className="form-textarea"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Registering...' : 'Register Patient'}
          </button>
        </form>
      </div>

      {/* Patient Database View */}
      <div className="card patient-report-card">
        <h3 className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Patient Directory
        </h3>

        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search by name or telephone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input search-input"
          />
          <button onClick={handleExportExcel} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Excel Download
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Age/Gender</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <span className="badge badge-primary">{patient.id}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{patient.name}</td>
                    <td>{patient.age ? `${patient.age} yrs` : 'N/A'} / {patient.gender}</td>
                    <td>
                      <button
                        onClick={() => onPatientSelect(patient)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No patients found.
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
