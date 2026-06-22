import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/dashboard/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        setError('Failed to fetch dashboard statistics.');
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
      setError('Server error. Please verify that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem', color: 'var(--text-muted)' }}>Loading clinic analytics...</div>;
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)' }}>
        <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
        <button onClick={fetchSummary} className="btn btn-secondary" style={{ marginTop: '1rem' }}>Retry</button>
      </div>
    );
  }

  const {
    totalPatients,
    totalVisits,
    totalCollected,
    totalOutstanding,
    costOfGoodsSold,
    netProfit,
    lowStockCount,
    recentVisits,
    recentBills
  } = summary;

  const isProfit = netProfit >= 0;

  return (
    <div>
      {/* Analytics Cards Grid */}
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        {/* Total Patients Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL PATIENTS</span>
            <span style={{ fontSize: '1.5rem' }}>👤</span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, margin: '0.75rem 0', color: 'var(--dark)' }}>{totalPatients}</h2>
          <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>Onboarded Patients</span>
        </div>

        {/* Total Visits Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL VISIT CONSULTATIONS</span>
            <span style={{ fontSize: '1.5rem' }}>🩺</span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, margin: '0.75rem 0', color: 'var(--dark)' }}>{totalVisits}</h2>
          <span className="badge badge-primary" style={{ alignSelf: 'flex-start' }}>Diagnoses Recorded</span>
        </div>

        {/* Low Stock Warning Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', marginBottom: 0, borderLeft: lowStockCount > 0 ? '4px solid var(--warning)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>LOW STOCK ITEMS</span>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, margin: '0.75rem 0', color: lowStockCount > 0 ? 'var(--warning)' : 'var(--dark)' }}>{lowStockCount}</h2>
          <span className={`badge ${lowStockCount > 0 ? 'badge-warning' : 'badge-success'}`} style={{ alignSelf: 'flex-start' }}>
            {lowStockCount > 0 ? 'Needs Attention' : 'All Stock Healthy'}
          </span>
        </div>
      </div>

      {/* Financial Summary Grid */}
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        {/* Revenue Collected Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>REVENUE COLLECTED</span>
            <span style={{ fontSize: '1.5rem' }}>💵</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.75rem 0', color: 'var(--success)' }}>
            Rs. {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>Paid Invoices</span>
        </div>

        {/* Expenses / Stock Cost Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>STOCK EXPENSES (COGS)</span>
            <span style={{ fontSize: '1.5rem' }}>📉</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.75rem 0', color: 'var(--danger)' }}>
            Rs. {costOfGoodsSold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className="badge badge-danger" style={{ alignSelf: 'flex-start' }}>Cost of Items Dispensed</span>
        </div>

        {/* Net Profit & Loss Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', marginBottom: 0, borderLeft: `4px solid ${isProfit ? 'var(--success)' : 'var(--danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>NET PROFIT / LOSS</span>
            <span style={{ fontSize: '1.5rem' }}>{isProfit ? '📈' : '📉'}</span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.75rem 0', color: isProfit ? 'var(--success)' : 'var(--danger)' }}>
            Rs. {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className={`badge ${isProfit ? 'badge-success' : 'badge-danger'}`} style={{ alignSelf: 'flex-start' }}>
            {isProfit ? 'Overall Profit' : 'Overall Loss'}
          </span>
        </div>
      </div>

      {/* Grid Layout for details */}
      <div className="grid-2">
        {/* Recent Consultations Panel */}
        <div className="card">
          <h3 className="card-title">🩺 Recent Consultations</h3>
          {recentVisits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentVisits.map(visit => (
                <div key={visit.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h4 style={{ color: 'var(--dark)', fontWeight: 600 }}>Diagnosis: {visit.diagnosis || 'General Checkup'}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Patient ID: {visit.patient_id} | Visit ID: {visit.id}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--light)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                    {visit.visit_date}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No recent consultations recorded.</p>
          )}
        </div>

        {/* Recent Transactions / Outstanding bills Panel */}
        <div className="card">
          <h3 className="card-title">💳 Recent Transactions & Bills</h3>
          {recentBills.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentBills.map(bill => (
                <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h4 style={{ color: 'var(--dark)', fontWeight: 600 }}>Invoice: {bill.id}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Patient ID: {bill.patient_id} | Method: {bill.payment_method.toUpperCase()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--dark)' }}>Rs. {bill.total_amount.toFixed(2)}</div>
                    <span className={`badge ${bill.payment_status === 'paid' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', marginTop: '0.25rem' }}>
                      {bill.payment_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No recent transactions recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}
