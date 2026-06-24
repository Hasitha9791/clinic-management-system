import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function FollowUp({ onGoToConsultation }) {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/follow-ups`);
      if (res.ok) {
        const data = await res.json();
        setFollowUps(data);
      } else {
        console.error('Failed to fetch follow-ups');
      }
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      if (window.showToast) window.showToast("No follow-up records found to export.", "warning");
      return;
    }

    try {
      const headers = [
        'Patient ID',
        'Patient Name',
        'Contact Number',
        'Follow-Up Date',
        'Status',
        'Days Left/Overdue',
        'Last Visit Date',
        'Diagnosis',
        'Treatment/Prescription'
      ];

      const rows = filtered.map(fu => {
        const status = getStatus(fu.next_clinic_date);
        const daysLabel = getDaysLabel(fu.next_clinic_date);
        return [
          fu.patient_id,
          fu.patient_name,
          fu.patient_contact,
          fu.next_clinic_date,
          status.toUpperCase(),
          daysLabel,
          fu.visit_date,
          fu.diagnosis,
          fu.treatment
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Clinic_Follow_Up_Schedule_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.showToast) window.showToast("Follow-up schedule exported successfully.", "success");
    } catch (err) {
      console.error("Export error:", err);
      if (window.showToast) window.showToast("Failed to export follow-up schedule.", "danger");
    }
  };

  const getStatus = (dateStr) => {
    if (!dateStr) return 'unknown';
    if (dateStr < today) return 'overdue';
    if (dateStr === today) return 'today';
    return 'upcoming';
  };

  const getDaysLabel = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.round((new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return '1 day ago';
    if (diff < 0) return `${Math.abs(diff)} days ago`;
    return `In ${diff} day${diff !== 1 ? 's' : ''}`;
  };

  const statusBadge = (status) => {
    const styles = {
      overdue: { bg: '#fff0f0', color: '#c0392b', border: '#f5c6cb', icon: '🔴', label: 'Overdue' },
      today: { bg: '#fffbea', color: '#b7770d', border: '#ffeaa7', icon: '🟡', label: 'Due Today' },
      upcoming: { bg: '#eafaf1', color: '#1e8449', border: '#c3e6cb', icon: '🟢', label: 'Upcoming' },
    };
    const s = styles[status] || { bg: '#f4f4f4', color: '#666', border: '#ddd', icon: '⚪', label: 'Unknown' };
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
        borderRadius: '50px', padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 700,
        whiteSpace: 'nowrap'
      }}>
        {s.icon} {s.label}
      </span>
    );
  };

  const filtered = followUps.filter(fu => {
    const search = searchTerm.toLowerCase();
    const matchName = (fu.patient_name || '').toLowerCase().includes(search);
    const matchId = (fu.patient_id || '').toLowerCase().includes(search);
    const matchDiag = (fu.diagnosis || '').toLowerCase().includes(search);
    const matchSearch = !search || matchName || matchId || matchDiag;
    const status = getStatus(fu.next_clinic_date);
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Counts
  const counts = {
    overdue: followUps.filter(f => getStatus(f.next_clinic_date) === 'overdue').length,
    today: followUps.filter(f => getStatus(f.next_clinic_date) === 'today').length,
    upcoming: followUps.filter(f => getStatus(f.next_clinic_date) === 'upcoming').length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--dark)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>
          📅 Follow-Up Schedule
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
          Track patients who need a follow-up clinic visit — set during Doctor Consultations.
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #fff0f0 0%, #ffe0e0 100%)', borderRadius: '12px', padding: '1.1rem 1.25rem', borderLeft: '4px solid #e74c3c', boxShadow: '0 2px 8px rgba(231,76,60,0.1)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c0392b' }}>{counts.overdue}</div>
          <div style={{ fontSize: '0.8rem', color: '#a93226', fontWeight: 600 }}>🔴 Overdue</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fffbea 0%, #fef9e7 100%)', borderRadius: '12px', padding: '1.1rem 1.25rem', borderLeft: '4px solid #f39c12', boxShadow: '0 2px 8px rgba(243,156,18,0.1)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b7770d' }}>{counts.today}</div>
          <div style={{ fontSize: '0.8rem', color: '#9a7d0a', fontWeight: 600 }}>🟡 Due Today</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #eafaf1 0%, #d5f5e3 100%)', borderRadius: '12px', padding: '1.1rem 1.25rem', borderLeft: '4px solid #27ae60', boxShadow: '0 2px 8px rgba(39,174,96,0.1)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e8449' }}>{counts.upcoming}</div>
          <div style={{ fontSize: '0.8rem', color: '#1a6b38', fontWeight: 600 }}>🟢 Upcoming</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%)', borderRadius: '12px', padding: '1.1rem 1.25rem', borderLeft: '4px solid var(--primary)', boxShadow: '0 2px 8px rgba(99,102,241,0.1)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{followUps.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>📊 Total Scheduled</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by patient name, ID, or diagnosis..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="form-input search-input"
            style={{ flex: '1', minWidth: '200px', maxWidth: '380px' }}
          />

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['all', 'overdue', 'today', 'upcoming'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '50px',
                  border: `1.5px solid ${statusFilter === s ? 'var(--primary)' : 'var(--border)'}`,
                  background: statusFilter === s ? 'var(--primary)' : 'transparent',
                  color: statusFilter === s ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textTransform: 'capitalize'
                }}
              >
                {s === 'all' ? '📋 All' : s === 'overdue' ? '🔴 Overdue' : s === 'today' ? '🟡 Today' : '🟢 Upcoming'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button
              onClick={handleExportExcel}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Excel Download
            </button>
            <button
              onClick={fetchFollowUps}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            Loading follow-up schedule...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📅</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--dark)' }}>No Follow-Ups Found</h3>
            <p style={{ fontSize: '0.9rem' }}>
              {followUps.length === 0
                ? 'No follow-up dates have been scheduled yet. Set a "Next Clinic Date" when recording a consultation.'
                : 'No records match your current filter. Try adjusting the search or status filter.'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Follow-Up Date</th>
                  <th>Status</th>
                  <th>Days</th>
                  <th>Visit Date</th>
                  <th>Diagnosis</th>
                  <th>Treatment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(fu => {
                  const status = getStatus(fu.next_clinic_date);
                  const rowBg = status === 'overdue' ? 'rgba(231,76,60,0.04)' : status === 'today' ? 'rgba(243,156,18,0.06)' : 'transparent';
                  return (
                    <tr key={fu.id} style={{ backgroundColor: rowBg }}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--dark)' }}>{fu.patient_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fu.patient_id}</div>
                        {fu.patient_contact && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {fu.patient_contact}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--dark)' }}>
                          {new Date(fu.next_clinic_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(fu.next_clinic_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}
                        </div>
                      </td>
                      <td>{statusBadge(status)}</td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          color: status === 'overdue' ? '#c0392b' : status === 'today' ? '#b7770d' : '#1e8449'
                        }}>
                          {getDaysLabel(fu.next_clinic_date)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fu.visit_date}</td>
                      <td style={{ fontSize: '0.85rem', maxWidth: '160px' }}>
                        <span title={fu.diagnosis}>
                          {fu.diagnosis ? (fu.diagnosis.length > 40 ? fu.diagnosis.substring(0, 40) + '…' : fu.diagnosis) : <em style={{ color: 'var(--text-muted)' }}>None</em>}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '140px' }}>
                        <span title={fu.treatment}>
                          {fu.treatment ? (fu.treatment.length > 35 ? fu.treatment.substring(0, 35) + '…' : fu.treatment) : '—'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            const patient = {
                              id: fu.patient_id,
                              name: fu.patient_name,
                              contact: fu.patient_contact,
                              age: fu.patient_age,
                              gender: fu.patient_gender,
                            };
                            onGoToConsultation(patient);
                          }}
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 700 }}
                          title={`Start consultation for ${fu.patient_name}`}
                        >
                          🩺 Consult
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'right' }}>
          Showing {filtered.length} of {followUps.length} follow-up record{followUps.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
