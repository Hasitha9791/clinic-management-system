import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function Communications() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [waStatus, setWaStatus] = useState({ connected: false, hasQr: false });
  const [qrKey, setQrKey] = useState(0);

  useEffect(() => {
    fetchLogs();
    fetchWhatsAppStatus();
    
    // Poll WhatsApp status every 5 seconds to track link completion
    const interval = setInterval(fetchWhatsAppStatus, 5000);
    return () => clearInterval(interval);
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

  const fetchWhatsAppStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
        if (data.hasQr) {
          setQrKey(prev => prev + 1); // Refresh image by updating query key
        }
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* WhatsApp Web Automation Status Panel */}
      <div className="card" style={{ borderLeft: waStatus.connected ? '4px solid var(--success)' : '4px solid var(--danger)' }}>
        <h3 className="card-title" style={{ color: waStatus.connected ? 'var(--success)' : 'inherit' }}>
          {waStatus.connected ? '🟢 WhatsApp Web Automation Gateway (Connected)' : '🔴 WhatsApp Web Automation Gateway (Disconnected)'}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1', minWidth: '280px' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', lineHeight: '1.5', color: 'var(--text-muted)' }}>
              Ayu Health Suite runs an automated WhatsApp client. This allows sending clinic appointments, queue tokens, and checkout receipts directly to patients for <strong>100% free</strong>.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
              <strong>Connection Status:</strong>
              <span className={`badge ${waStatus.connected ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem', fontWeight: 'bold' }}>
                {waStatus.connected ? 'CONNECTED' : 'DISCONNECTED / LINK REQUIRED'}
              </span>
            </div>
            {!waStatus.connected && (
              <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: 'var(--warning)', fontWeight: 500 }}>
                ⚠️ Please scan the QR code to connect your clinic phone.
              </p>
            )}
          </div>

          {!waStatus.connected && waStatus.hasQr && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <img 
                src={`${API_URL}/api/whatsapp/qr?k=${qrKey}`} 
                alt="WhatsApp Web Link QR" 
                style={{ width: '160px', height: '160px', display: 'block', marginBottom: '0.4rem', imageRendering: 'pixelated' }} 
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--dark)', fontWeight: 600 }}>
                Scan with Linked Devices
              </span>
            </div>
          )}
        </div>
      </div>

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
  </div>
  );
}
