import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

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
    spo2: '',
    next_clinic_date: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [showBillingPrompt, setShowBillingPrompt] = useState(false);
  const [savedVisitForBilling, setSavedVisitForBilling] = useState(null);

  // Structured Prescription states
  const [prescriptions, setPrescriptions] = useState([]);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', duration: '', qty: '', source: 'clinic' });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory`);
      if (res.ok) {
        const data = await res.json();
        // Filter out drugs in clinic stock
        setInventoryItems(data.filter(item => item.type === 'drug'));
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const handleMedNameChange = (e) => {
    const value = e.target.value;
    setNewMed(prev => ({ ...prev, name: value }));
    
    if (value.trim().length > 1) {
      const filtered = inventoryItems.filter(item => 
        item.name.toLowerCase().includes(value.toLowerCase())
      );
      setSearchSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (item) => {
    setNewMed({
      name: item.name,
      dosage: '',
      duration: '',
      qty: '',
      source: 'clinic' // Default to clinic since it is in stock
    });
    setShowSuggestions(false);
  };

  const addMedication = () => {
    if (!newMed.name.trim()) return;
    setPrescriptions(prev => [...prev, { ...newMed, qty: parseInt(newMed.qty) || 0 }]);
    setNewMed({ name: '', dosage: '', duration: '', qty: '', source: 'clinic' });
  };

  const removeMedication = (index) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index));
  };

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
      const errMsg = 'Please select a patient first.';
      setMessage({ type: 'danger', text: errMsg });
      if (window.showToast) window.showToast(errMsg, 'warning');
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let treatmentValue = formData.treatment;
      if (prescriptions.length > 0) {
        treatmentValue = JSON.stringify({
          medications: prescriptions,
          additional_instructions: formData.treatment
        });
      }

      const res = await fetch(`${API_URL}/api/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          ...formData,
          treatment: treatmentValue
        })
      });

      if (res.ok) {
        const savedVisit = await res.json();
        const successMsg = 'Consultation recorded successfully!';
        setMessage({ type: 'success', text: successMsg });
        if (window.showToast) {
          window.showToast(successMsg, 'success');
          if (savedVisit.schema_drift_warning) {
            setTimeout(() => {
              window.showToast(savedVisit.schema_drift_warning, 'warning');
            }, 1000);
          }
        }
        setFormData({
          symptoms: '',
          diagnosis: '',
          treatment: '',
          doctor_notes: '',
          bp: '',
          pulse: '',
          temp: '',
          weight: '',
          spo2: '',
          next_clinic_date: ''
        });
        setPrescriptions([]);
        fetchVisitHistory(selectedPatient.id);
        
        // Save to state to trigger the custom Billing Confirmation Modal
        setSavedVisitForBilling(savedVisit);
        setShowBillingPrompt(true);
      } else {
        const errData = await res.json();
        const errMsg = errData.error || 'Failed to save visit details.';
        setMessage({ type: 'danger', text: errMsg });
        if (window.showToast) window.showToast(errMsg, 'danger');
      }
    } catch (err) {
      console.error('Error recording visit:', err);
      const errMsg = 'Server error. Please check backend connection.';
      setMessage({ type: 'danger', text: errMsg });
      if (window.showToast) window.showToast(errMsg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPrescription = (visit, medications, instructions) => {
    const printWindow = window.open('', '_blank');
    const clinicName = "Ayu Health Suite Clinical Portal";
    
    const clinicDispensed = medications.filter(m => m.source === 'clinic');
    const outsideDispensed = medications.filter(m => m.source === 'outside');

    let clinicDispensedHtml = '';
    if (clinicDispensed.length > 0) {
      let rows = '';
      clinicDispensed.forEach(m => {
        rows += `
          <tr>
            <td style="font-weight: 700;">${m.name}</td>
            <td>${m.dosage || '-'}</td>
            <td>${m.duration || '-'}</td>
            <td>${m.qty || '-'}</td>
          </tr>
        `;
      });
      clinicDispensedHtml = `
        <div class="section-title">🏥 Dispensed by Clinic Pharmacy</div>
        <table>
          <thead>
            <tr>
              <th>Drug Name</th>
              <th>Dosage / Instructions</th>
              <th>Duration</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    let outsideDispensedHtml = '';
    if (outsideDispensed.length > 0) {
      let rows = '';
      outsideDispensed.forEach(m => {
        rows += `
          <tr>
            <td style="font-weight: 700;">${m.name}</td>
            <td>${m.dosage || '-'}</td>
            <td>${m.duration || '-'}</td>
            <td>${m.qty || '-'}</td>
          </tr>
        `;
      });
      outsideDispensedHtml = `
        <div class="section-title">💊 Purchase from Outside Pharmacy</div>
        <table>
          <thead>
            <tr>
              <th>Drug Name</th>
              <th>Dosage / Instructions</th>
              <th>Duration</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    let instructionsHtml = '';
    if (instructions) {
      instructionsHtml = `
        <div class="instructions">
          <strong>Additional Instructions / Tests:</strong><br/>
          ${instructions.replace(/\n/g, '<br/>')}
        </div>
      `;
    }

    const patientAgeText = selectedPatient.age ? `${selectedPatient.age} yrs` : 'N/A';

    printWindow.document.write(`
      <html>
        <head>
          <title>Prescription - ${selectedPatient.name}</title>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; color: #333; padding: 40px; margin: 0; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #0fbf7b; padding-bottom: 20px; margin-bottom: 30px; }
            .clinic-title { font-size: 24px; font-weight: 800; color: #0fbf7b; margin: 0; }
            .clinic-sub { font-size: 12px; color: #666; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 1px; }
            .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e5e7eb; font-size: 14px; }
            .patient-info div { margin-bottom: 5px; }
            .rx-title { font-size: 20px; font-weight: 800; margin-bottom: 20px; color: #111827; }
            .section-title { font-size: 14px; font-weight: 700; color: #374151; margin-top: 25px; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
            th { background-color: #f3f4f6; color: #374151; font-weight: 700; text-align: left; padding: 10px; border: 1px solid #e5e7eb; }
            td { padding: 10px; border: 1px solid #e5e7eb; }
            .instructions { background-color: #f3f4f6; padding: 15px; border-radius: 6px; border-left: 4px solid #0fbf7b; margin-top: 30px; font-size: 14px; }
            .footer { margin-top: 60px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #666; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="clinic-title">${clinicName}</h1>
            <p class="clinic-sub">Medical Prescription Slip</p>
          </div>
          
          <div class="patient-info">
            <div><strong>Patient Name:</strong> ${selectedPatient.name}</div>
            <div><strong>Date:</strong> ${visit.visit_date}</div>
            <div><strong>Patient ID:</strong> ${selectedPatient.id}</div>
            <div><strong>Diagnosis:</strong> ${visit.diagnosis || 'General Consultation'}</div>
            <div><strong>Age / Gender:</strong> ${patientAgeText} / ${selectedPatient.gender}</div>
            <div><strong>Visit ID:</strong> ${visit.id}</div>
          </div>
          
          <div class="rx-title">Rx (Prescription)</div>
          
          ${clinicDispensedHtml}
          ${outsideDispensedHtml}
          ${instructionsHtml}
          
          <div style="margin-top: 80px; display: flex; justify-content: flex-end; font-size: 14px;">
            <div style="text-align: right;">
              <p>_______________________</p>
              <p style="font-weight: 700; color: #111827; margin: 5px 0 0 0;">Doctor Signature & Seal</p>
            </div>
          </div>
          
          <div class="footer">
            Powered by Ayu Health Suite · Clinic Management System
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderTreatment = (treatmentStr, visit) => {
    if (!treatmentStr) return 'Not recorded';
    
    try {
      if (treatmentStr.startsWith('{') || treatmentStr.startsWith('[')) {
        const parsed = JSON.parse(treatmentStr);
        let medications = [];
        let instructions = '';
        
        if (Array.isArray(parsed)) {
          medications = parsed;
        } else if (parsed && typeof parsed === 'object') {
          medications = parsed.medications || [];
          instructions = parsed.additional_instructions || '';
        }
        
        if (medications.length === 0) {
          return instructions || 'Not recorded';
        }
        
        return (
          <div style={{ marginTop: '0.25rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginTop: '0.25rem', border: '1px solid var(--border)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--light)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Drug</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Dose</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Duration</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Qty</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700 }}>{m.name}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{m.dosage}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{m.duration}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>{m.qty || '-'}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>
                      <span className={`badge ${m.source === 'clinic' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
                        {m.source === 'clinic' ? 'Clinic' : 'Outside'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {instructions && (
              <p style={{ fontSize: '0.82rem', marginTop: '0.5rem', color: 'var(--text-dark)' }}>
                <strong>Instructions / Tests:</strong> {instructions}
              </p>
            )}
            <button 
              type="button" 
              onClick={() => handlePrintPrescription(visit, medications, instructions)}
              className="btn btn-secondary" 
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print Prescription
            </button>
          </div>
        );
      }
    } catch (e) {
      // Parse failed, fall back to plain text
    }
    
    return treatmentStr;
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

              {/* Structured Prescription Builder */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  Prescription Builder (Structured EMR)
                </label>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) 1.2fr 1fr 0.8fr 1.5fr auto', gap: '0.5rem', alignItems: 'end', marginBottom: '0.75rem', position: 'relative' }}>
                  {/* Drug Search Input with Autocomplete */}
                  <div style={{ position: 'relative' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Drug Name</label>
                    <input
                      type="text"
                      value={newMed.name}
                      onChange={handleMedNameChange}
                      placeholder="Search or type drug..."
                      className="form-input"
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                    {showSuggestions && searchSuggestions.length > 0 && (
                      <ul className="suggestions-list" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 100,
                        maxHeight: '160px',
                        overflowY: 'auto',
                        listStyle: 'none',
                        padding: 0,
                        margin: 0
                      }}>
                        {searchSuggestions.map(item => (
                          <li 
                            key={item.id} 
                            onClick={() => selectSuggestion(item)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              borderBottom: '1px solid #f0f0f0',
                              display: 'flex',
                              justifyContent: 'space-between'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--light)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                          >
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                              In Stock: {item.qty}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Dosage */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Dosage</label>
                    <input
                      type="text"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed(prev => ({ ...prev, dosage: e.target.value }))}
                      placeholder="e.g. 1-0-1"
                      className="form-input"
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Duration</label>
                    <input
                      type="text"
                      value={newMed.duration}
                      onChange={(e) => setNewMed(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g. 5 days"
                      className="form-input"
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Qty</label>
                    <input
                      type="number"
                      value={newMed.qty}
                      onChange={(e) => setNewMed(prev => ({ ...prev, qty: e.target.value }))}
                      placeholder="15"
                      className="form-input"
                      style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      min="1"
                    />
                  </div>

                  {/* Source Dropdown */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Dispense From</label>
                    <select
                      value={newMed.source}
                      onChange={(e) => setNewMed(prev => ({ ...prev, source: e.target.value }))}
                      className="form-input"
                      style={{ padding: '0.42rem', fontSize: '0.85rem' }}
                    >
                      <option value="clinic">Clinic Pharmacy</option>
                      <option value="outside">Outside Pharmacy</option>
                    </select>
                  </div>

                  {/* Add Button */}
                  <div>
                    <button 
                      type="button" 
                      onClick={addMedication} 
                      className="btn btn-primary" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', width: '100%' }}
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* List of Added Medications */}
                {prescriptions.length > 0 && (
                  <div style={{ marginTop: '0.75rem', backgroundColor: 'var(--light)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.35rem 0.5rem' }}>Drug Name</th>
                          <th style={{ padding: '0.35rem 0.5rem' }}>Dosage</th>
                          <th style={{ padding: '0.35rem 0.5rem' }}>Duration</th>
                          <th style={{ padding: '0.35rem 0.5rem' }}>Qty</th>
                          <th style={{ padding: '0.35rem 0.5rem' }}>Source</th>
                          <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptions.map((med, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700 }}>{med.name}</td>
                            <td style={{ padding: '0.4rem 0.5rem' }}>{med.dosage}</td>
                            <td style={{ padding: '0.4rem 0.5rem' }}>{med.duration}</td>
                            <td style={{ padding: '0.4rem 0.5rem' }}>{med.qty || '-'}</td>
                            <td style={{ padding: '0.4rem 0.5rem' }}>
                              <span className={`badge ${med.source === 'clinic' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
                                {med.source === 'clinic' ? '🏥 Clinic' : '💊 Outside'}
                              </span>
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                              <button type="button" onClick={() => removeMedication(idx)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: 0 }}>
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Additional Treatment Instructions / Medical Tests</label>
                <textarea
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleInputChange}
                  placeholder="E.g. Avoid cold drinks, check FBC in 3 days, etc. (printed on prescription)"
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

              {/* Next Clinic Date (Follow-Up) */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Next Clinic Date (Follow-Up)
                </label>
                <input
                  type="date"
                  name="next_clinic_date"
                  value={formData.next_clinic_date}
                  onChange={handleInputChange}
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                  style={{ maxWidth: '220px' }}
                />
                {formData.next_clinic_date && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.3rem' }}>
                    📅 Follow-up scheduled for {new Date(formData.next_clinic_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.3rem' }}>
                      <span className="history-date">{visit.visit_date} (ID: {visit.id})</span>
                      {visit.next_clinic_date && (
                        <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--primary)', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '50px', whiteSpace: 'nowrap' }}>
                          📅 Follow-up: {new Date(visit.next_clinic_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
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
                    <div style={{ fontSize: '0.88rem', margin: '0.25rem 0' }}>
                      <strong>Treatment / Prescription:</strong>
                      <div style={{ paddingLeft: '0.5rem' }}>{renderTreatment(visit.treatment, visit)}</div>
                    </div>
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

      {/* Billing Redirect Confirmation Modal */}
      {showBillingPrompt && savedVisitForBilling && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '2.25rem 2rem', textAlign: 'center', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📄</div>
            <h3 style={{ color: 'var(--dark)', fontWeight: 800, marginBottom: '0.75rem', fontSize: '1.25rem' }}>Generate Bill?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              Consultation recorded successfully. Would you like to generate the bill for this visit now?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  setShowBillingPrompt(false);
                  setSavedVisitForBilling(null);
                }} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.65rem', fontWeight: 600 }}
              >
                No, Later
              </button>
              <button 
                onClick={() => {
                  setShowBillingPrompt(false);
                  const visit = savedVisitForBilling;
                  setSavedVisitForBilling(null);
                  onGoToBilling(selectedPatient, visit);
                }} 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.65rem', fontWeight: 700 }}
              >
                Yes, Bill Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
