import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function Communications() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/communications`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      } else {
        setError('Failed to fetch communications log.');
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Server error loading communications.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>Simulated Communications Audit Trail</h3>
        <button onClick={fetchLogs} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
          🔄 Refresh Log
        </button>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        This audit trail tracks SMS and WhatsApp reminders dispatched automatically by the backend system (e.g. appointment booking, token check-ins, invoice generation).
      </p>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</div>
      ) : error ? (
        <div className="badge badge-danger" style={{ width: '100%', padding: '1rem', borderRadius: '4px' }}>{error}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Recipient Phone</th>
                <th>Simulated Message Content</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{log.sent_date}</td>
                    <td>
                      <span className={`badge ${log.type === 'SMS' ? 'badge-primary' : 'badge-success'}`}>
                        {log.type === 'SMS' ? '💬 SMS' : '🟢 WhatsApp'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.phone}</td>
                    <td style={{ fontSize: '0.9rem', maxWidth: '350px', lineHeight: '1.4' }}>
                      {log.message}
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ fontWeight: 700 }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No communication logs found yet. Book appointments or generate POS bills to trigger simulated alerts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
