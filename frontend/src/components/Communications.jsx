import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

// Format a date string to Sri Lanka Standard Time (Asia/Colombo, UTC+5:30)
const fmtSLT = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
    return new Intl.DateTimeFormat('en-LK', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return dateStr;
  }
};

export default function Communications() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [waStatus, setWaStatus] = useState({ connected: false, hasQr: false });
  const [qrKey, setQrKey] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConnect = async () => {
    try {
      if (window.showToast) window.showToast('Initiating WhatsApp connection...', 'info');
      const res = await fetch(`${API_URL}/api/whatsapp/connect`, { method: 'POST' });
      if (res.ok) {
        if (window.showToast) window.showToast('WhatsApp connection initialized. Checking status...', 'success');
        fetchWhatsAppStatus();
      } else {
        const err = await res.json();
        if (window.showToast) window.showToast(err.error || 'Failed to initialize connection.', 'danger');
      }
    } catch (err) {
      console.error('Error connecting:', err);
      if (window.showToast) window.showToast('Server error initializing connection.', 'danger');
    }
  };

  const triggerDisconnect = async () => {
    try {
      if (window.showToast) window.showToast('Disconnecting WhatsApp session...', 'info');
      const res = await fetch(`${API_URL}/api/whatsapp/disconnect`, { method: 'POST' });
      if (res.ok) {
        if (window.showToast) window.showToast('WhatsApp disconnected successfully. New QR code requested.', 'success');
        fetchWhatsAppStatus();
      } else {
        const err = await res.json();
        if (window.showToast) window.showToast(err.error || 'Failed to disconnect.', 'danger');
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
      if (window.showToast) window.showToast('Server error disconnecting session.', 'danger');
    }
  };

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
              <strong>Connection Status:</strong>
              <span className={`badge ${waStatus.connected ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem', fontWeight: 'bold' }}>
                {waStatus.connected ? 'CONNECTED' : 'DISCONNECTED / LINK REQUIRED'}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              {!waStatus.connected && (
                <button 
                  onClick={handleConnect} 
                  className="btn btn-success" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                >
                  🔌 Connect / Reconnect
                </button>
              )}
              <button 
                onClick={() => setShowConfirm(true)} 
                className="btn btn-danger" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              >
                ❌ Disconnect & Logout
              </button>
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

        {/* Custom Confirmation Modal for Disconnect */}
        {showConfirm && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content" style={{ maxWidth: '400px', padding: '1.8rem', textAlign: 'center', borderRadius: '12px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚨</div>
              <h3 style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '1.25rem', fontWeight: 800 }}>Disconnect WhatsApp?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                This will log out the active WhatsApp session and delete credentials. You will need to scan the QR code again to link your device.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowConfirm(false)} className="btn btn-secondary" style={{ flex: 1, margin: 0 }}>
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowConfirm(false);
                    triggerDisconnect();
                  }} 
                  className="btn btn-danger" 
                  style={{ flex: 1, margin: 0, fontWeight: 600 }}
                >
                  Yes, Disconnect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>Communications Audit Trail</h3>
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
                <th>Message Content</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fmtSLT(log.sent_date)}</td>
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
                      <span className={`badge ${log.status.toLowerCase() === 'failed' ? 'badge-danger' : 'badge-success'}`} style={{ fontWeight: 700 }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No communication logs found yet. Book appointments or generate POS bills to trigger WhatsApp alerts.
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
