import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Appointments({ onSelectPatient, onGoToConsultation }) {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [patientSearch, setPatientSearch] = useState('');
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_name: 'Dr. Hasitha (General Practice)',
    time_slot: '09:00 AM - 10:00 AM'
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPatients();
    fetchAppointments();
  }, [selectedDate]);

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

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/appointments?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patient_id) {
      setMessage({ type: 'danger', text: 'Please select a patient.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: formData.patient_id,
          doctor_name: formData.doctor_name,
          appointment_date: selectedDate,
          time_slot: formData.time_slot
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Appointment booked successfully!' });
        setFormData(prev => ({ ...prev, patient_id: '' }));
        setPatientSearch('');
        fetchAppointments();
      } else {
        const errData = await res.json();
        setMessage({ type: 'danger', text: errData.error || 'Failed to book appointment.' });
      }
    } catch (err) {
      console.error('Error booking appointment:', err);
      setMessage({ type: 'danger', text: 'Server error booking appointment.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_URL}/api/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        fetchAppointments();
        
        // If status is checked-in and user wants to consult, route to consultations page
        if (status === 'Checked-in' && onGoToConsultation) {
          const updated = await res.json();
          const p = patients.find(pat => pat.id === updated.patient_id);
          if (p && window.confirm(`Patient ${p.name} has checked in. Go to consultations view now?`)) {
            onGoToConsultation(p);
          }
        }
      } else {
        alert('Failed to update status.');
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const getPatientName = (patientId) => {
    const p = patients.find(pat => pat.id === patientId);
    return p ? p.name : patientId;
  };

  const getPatientPhone = (patientId) => {
    const p = patients.find(pat => pat.id === patientId);
    return p ? p.contact || 'N/A' : 'N/A';
  };

  const filteredPatients = patients.filter(p => {
    const term = patientSearch.toLowerCase();
    return p.name.toLowerCase().includes(term) || (p.contact && p.contact.toLowerCase().includes(term));
  });

  return (
    <div className="grid-sidebar-layout">
      {/* Scheduler Form */}
      <div className="card">
        <h3 className="card-title">Book Patient Appointment</h3>
        
        {message.text && (
          <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Search Patient</label>
            <input
              type="text"
              placeholder="Type name or phone..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="form-input"
              style={{ marginBottom: '0.5rem' }}
            />
            
            {patientSearch && (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--white)', padding: '0.5rem' }}>
                {filteredPatients.length > 0 ? (
                  filteredPatients.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => {
                        setFormData(prev => ({ ...prev, patient_id: p.id }));
                        setPatientSearch(p.name);
                      }}
                      style={{ padding: '0.35rem 0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--light)', display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{p.contact || 'No contact'}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matching patients found.</div>
                )}
              </div>
            )}
          </div>

          {formData.patient_id && (
            <div className="badge badge-success" style={{ marginBottom: '1rem', width: '100%', justifyContent: 'center' }}>
              Selected Patient ID: {formData.patient_id}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Doctor / Consultant</label>
            <select
              value={formData.doctor_name}
              onChange={(e) => setFormData(prev => ({ ...prev, doctor_name: e.target.value }))}
              className="form-select"
            >
              <option value="Dr. Hasitha (General Practice)">Dr. Hasitha (General Practice)</option>
              <option value="Dr. Fernando (Pediatrics)">Dr. Fernando (Pediatrics)</option>
              <option value="Dr. Silva (Cardiology)">Dr. Silva (Cardiology)</option>
              <option value="Dr. Perera (Dermatology)">Dr. Perera (Dermatology)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Appointment Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Time Slot</label>
            <select
              value={formData.time_slot}
              onChange={(e) => setFormData(prev => ({ ...prev, time_slot: e.target.value }))}
              className="form-select"
            >
              <option value="09:00 AM - 10:00 AM">09:00 AM - 10:00 AM</option>
              <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
              <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM</option>
              <option value="04:00 PM - 05:00 PM">04:00 PM - 05:00 PM</option>
              <option value="05:00 PM - 06:00 PM">05:00 PM - 06:00 PM</option>
              <option value="06:00 PM - 07:00 PM">06:00 PM - 07:00 PM</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Booking...' : 'Book Queue Token'}
          </button>
        </form>
      </div>

      {/* Appointment Live Queue Dashboard */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>Live Token Queue Dashboard</h3>
          <span className="current-date" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>📅 {selectedDate}</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Time Slot</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length > 0 ? (
                appointments.map(appt => {
                  let statusBadge = 'badge-primary';
                  if (appt.status === 'Checked-in') statusBadge = 'badge-warning';
                  else if (appt.status === 'In Consultation') statusBadge = 'badge-primary'; // default blue
                  else if (appt.status === 'Completed') statusBadge = 'badge-success';
                  else if (appt.status === 'Cancelled') statusBadge = 'badge-danger';

                  return (
                    <tr key={appt.id}>
                      <td>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>#{appt.token_number}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{getPatientName(appt.patient_id)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {getPatientPhone(appt.patient_id)}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{appt.doctor_name}</td>
                      <td style={{ fontSize: '0.85rem' }}>{appt.time_slot}</td>
                      <td>
                        <span className={`badge ${statusBadge}`}>{appt.status.toUpperCase()}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {appt.status === 'Scheduled' && (
                            <>
                              <button 
                                onClick={() => handleUpdateStatus(appt.id, 'Checked-in')}
                                className="btn btn-success" 
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                Check-In
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(appt.id, 'Cancelled')}
                                className="btn btn-danger" 
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {appt.status === 'Checked-in' && (
                            <button 
                              onClick={() => {
                                handleUpdateStatus(appt.id, 'In Consultation');
                                onGoToConsultation(patients.find(p => p.id === appt.patient_id));
                              }}
                              className="btn btn-primary" 
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              Consult
                            </button>
                          )}
                          {appt.status === 'In Consultation' && (
                            <button 
                              onClick={() => handleUpdateStatus(appt.id, 'Completed')}
                              className="btn btn-secondary" 
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success)' }}
                            >
                              Complete
                            </button>
                          )}
                          {(appt.status === 'Completed' || appt.status === 'Cancelled') && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Action</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No queue tokens booked for this date.
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
