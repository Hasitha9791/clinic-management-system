import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Consultations({ selectedPatient, onSelectPatient, onGoToBilling }) {
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [visits, setVisits] = useState([]);
  const [formData, setFormData] = useState({
    symptoms: '',
    diagnosis: '',
    treatment: '',
    doctor_notes: '',
    bp: '',
    pulse: '',
    temp: '',
    weight: '',
    spo2: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Fetch all patients for selection list if none is selected
  useEffect(() => {
    if (!selectedPatient) {
      fetchPatients();
    } else {
      fetchVisitHistory(selectedPatient.id);
    }
  }, [selectedPatient]);

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

  const fetchVisitHistory = async (patientId) => {
    try {
      const res = await fetch(`${API_URL}/api/visits?patientId=${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setVisits(data);
      }
    } catch (err) {
      console.error('Error fetching visit history:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      setMessage({ type: 'danger', text: 'Please select a patient first.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_URL}/api/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          ...formData
        })
      });

      if (res.ok) {
        const savedVisit = await res.json();
        setMessage({ type: 'success', text: 'Consultation recorded successfully!' });
        setFormData({
          symptoms: '',
          diagnosis: '',
          treatment: '',
          doctor_notes: '',
          bp: '',
          pulse: '',
          temp: '',
          weight: '',
          spo2: ''
        });
        fetchVisitHistory(selectedPatient.id);
        
        // Show option to immediately proceed to billing for this visit
        if (window.confirm("Consultation recorded. Would you like to generate the bill for this visit now?")) {
          onGoToBilling(selectedPatient, savedVisit);
        }
      } else {
        const errData = await res.json();
        setMessage({ type: 'danger', text: errData.error || 'Failed to save visit details.' });
      }
    } catch (err) {
      console.error('Error recording visit:', err);
      setMessage({ type: 'danger', text: 'Server error. Please check backend connection.' });
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const term = patientSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.contact && p.contact.toLowerCase().includes(term)) ||
      p.id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="grid-sidebar-layout">
      {/* Visit Record Form */}
      <div className="card">
        {selectedPatient ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: '0.25rem' }}>Patient Selected</span>
                <h2 style={{ color: 'var(--dark)' }}>{selectedPatient.name}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  ID: {selectedPatient.id} | Age: {selectedPatient.age ? `${selectedPatient.age} yrs` : 'N/A'} | Gender: {selectedPatient.gender}
                </p>
              </div>
              <button onClick={() => onSelectPatient(null)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Change Patient
              </button>
            </div>

            {selectedPatient.medical_history && (
              <div style={{ backgroundColor: 'var(--danger-light)', borderLeft: '3px solid var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
                <strong>Alerts / Medical History:</strong> {selectedPatient.medical_history}
              </div>
            )}

            {message.text && (
              <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <h3 className="card-title">New Consultation Entry</h3>
              
              <div className="form-group">
                <label className="form-label">Symptoms / Presenting Complaints</label>
                <textarea
                  name="symptoms"
                  value={formData.symptoms}
                  onChange={handleInputChange}
                  placeholder="Describe patient symptoms..."
                  className="form-textarea"
                />
              </div>

              {/* Vitals Log Fields */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--dark)', marginBottom: '0.75rem' }}>EMR Vitals Recording</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>BP</label>
                    <input
                      type="text"
                      name="bp"
                      value={formData.bp}
                      onChange={handleInputChange}
                      placeholder="120/80"
                      className="form-input"
                      style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>Pulse (bpm)</label>
                    <input
                      type="number"
                      name="pulse"
                      value={formData.pulse}
                      onChange={handleInputChange}
                      placeholder="72"
                      className="form-input"
                      style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>Temp (°C)</label>
                    <input
                      type="number"
                      name="temp"
                      value={formData.temp}
                      onChange={handleInputChange}
                      placeholder="36.5"
                      className="form-input"
                      style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                      step="0.1"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>Weight (kg)</label>
                    <input
                      type="number"
                      name="weight"
                      value={formData.weight}
                      onChange={handleInputChange}
                      placeholder="70"
                      className="form-input"
                      style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                      step="0.1"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>SpO2 (%)</label>
                    <input
                      type="number"
                      name="spo2"
                      value={formData.spo2}
                      onChange={handleInputChange}
                      placeholder="98"
                      className="form-input"
                      style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Diagnosis</label>
                <input
                  type="text"
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleInputChange}
                  placeholder="e.g. Acute Bronchitis, Essential Hypertension"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Treatment / Prescribed Medications</label>
                <textarea
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleInputChange}
                  placeholder="Prescribe medications, dosage, duration, or medical tests..."
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Doctor's Notes (Private/Internal)</label>
                <textarea
                  name="doctor_notes"
                  value={formData.doctor_notes}
                  onChange={handleInputChange}
                  placeholder="Any additional clinical findings or private notes..."
                  className="form-textarea"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Saving...' : 'Record Visit & Diagnosis'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h3 className="card-title">Select Patient for Consultation</h3>
            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search patient by name or telephone..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="form-input search-input"
              />
            </div>
            
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <tr key={patient.id}>
                        <td><span className="badge badge-primary">{patient.id}</span></td>
                        <td style={{ fontWeight: 600 }}>{patient.name}</td>
                        <td>
                          <button
                            onClick={() => onSelectPatient(patient)}
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No patients found. Please onboard them first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Visit History Sidebar */}
      <div className="card">
        <h3 className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Clinical History
        </h3>

        {selectedPatient ? (
          <div>
            {visits.length > 0 ? (
              <div style={{ maxHeight: '650px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {visits.map((visit) => (
                  <div key={visit.id} className="history-item">
                    <span className="history-date">{visit.visit_date} (ID: {visit.id})</span>
                    <h4 className="history-diag">Diagnosis: {visit.diagnosis || 'None'}</h4>
                    
                    {/* Vitals values display */}
                    {(visit.bp || visit.pulse || visit.temp || visit.weight || visit.spo2) && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.4rem 0', fontSize: '0.78rem', backgroundColor: 'var(--light)', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        {visit.bp && <span>🔴 BP: {visit.bp}</span>}
                        {visit.pulse && <span>💓 HR: {visit.pulse} bpm</span>}
                        {visit.temp && <span>🌡️ Temp: {visit.temp} °C</span>}
                        {visit.weight && <span>⚖️ Weight: {visit.weight} kg</span>}
                        {visit.spo2 && <span>🫁 SpO2: {visit.spo2}%</span>}
                      </div>
                    )}
                    
                    <p style={{ fontSize: '0.88rem', margin: '0.25rem 0' }}>
                      <strong>Symptoms:</strong> {visit.symptoms || 'Not recorded'}
                    </p>
                    <p style={{ fontSize: '0.88rem', margin: '0.25rem 0' }}>
                      <strong>Treatment:</strong> {visit.treatment || 'Not recorded'}
                    </p>
                    {visit.doctor_notes && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: '0.25rem' }}>
                        *Notes: {visit.doctor_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No previous visits recorded for this patient.</p>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select a patient to view their medical/visit history.</p>
        )}
      </div>
    </div>
  );
}
