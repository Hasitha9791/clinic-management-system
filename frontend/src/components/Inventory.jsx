import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'drug',
    qty: '',
    min_qty: '',
    unit: 'tablets',
    price: '',
    cost_price: '',
    barcode: ''
  });
  
  // Quick stock edit panel
  const [stockEdit, setStockEdit] = useState({ id: null, change: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Batches state
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [batchesMap, setBatchesMap] = useState({});
  const [batchFormData, setBatchFormData] = useState({
    batch_number: '',
    qty: '',
    expiry_date: '',
    cost_price: ''
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
        
        // Pre-fetch batches for all items
        data.forEach(item => {
          fetchItemBatches(item.id);
        });
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const fetchItemBatches = async (itemId) => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/${itemId}/batches`);
      if (res.ok) {
        const data = await res.json();
        setBatchesMap(prev => ({ ...prev, [itemId]: data }));
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      setMessage({ type: 'danger', text: 'Please fill out all required fields.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_URL}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Inventory item added successfully!' });
        setFormData({
          name: '',
          type: 'drug',
          qty: '',
          min_qty: '',
          unit: 'tablets',
          price: '',
          cost_price: '',
          barcode: ''
        });
        fetchInventory();
      } else {
        const errData = await res.json();
        setMessage({ type: 'danger', text: errData.error || 'Failed to add item.' });
      }
    } catch (err) {
      console.error('Error adding item:', err);
      setMessage({ type: 'danger', text: 'Server error. Please check connection.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStockUpdateSubmit = async (id) => {
    const changeVal = parseInt(stockEdit.change);
    if (isNaN(changeVal) || changeVal === 0) {
      alert('Please enter a valid non-zero number.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/inventory/${id}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtyChange: changeVal })
      });

      if (res.ok) {
        setStockEdit({ id: null, change: '' });
        fetchInventory();
      } else {
        alert('Failed to update stock.');
      }
    } catch (err) {
      console.error('Error updating stock:', err);
    }
  };

  // Add a batch to inventory item
  const handleAddBatchSubmit = async (itemId) => {
    const { batch_number, qty, expiry_date, cost_price } = batchFormData;
    if (!batch_number || !qty || !expiry_date) {
      alert('Batch number, Quantity, and Expiry Date are required.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/inventory/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          batch_number,
          qty: parseInt(qty),
          expiry_date,
          cost_price: parseFloat(cost_price) || 0.0
        })
      });

      if (res.ok) {
        setBatchFormData({
          batch_number: '',
          qty: '',
          expiry_date: '',
          cost_price: ''
        });
        fetchItemBatches(itemId);
        fetchInventory(); // Refresh overall item stock counts
        alert('Stock batch added successfully!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add batch.');
      }
    } catch (err) {
      console.error('Error adding batch:', err);
    }
  };

  // Find low stock items
  const lowStockItems = inventory.filter(item => item.qty <= item.min_qty);

  const filteredInventory = inventory.filter(item => {
    const term = search.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(term) || item.id.toLowerCase().includes(term);
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const calculateStockStats = () => {
    let totalCost = 0;
    let totalSelling = 0;
    inventory.forEach(item => {
      totalCost += (item.cost_price || 0) * (item.qty || 0);
      totalSelling += (item.price || 0) * (item.qty || 0);
    });
    return {
      totalCost,
      totalSelling,
      expectedProfit: totalSelling - totalCost
    };
  };

  const { totalCost, totalSelling, expectedProfit } = calculateStockStats();

  const handlePrint = () => {
    document.body.classList.add('print-only-stock-report');
    window.print();
    document.body.classList.remove('print-only-stock-report');
  };

  // Helper to compute batch expiry status badge
  const getBatchExpiryBadge = (expiryDate) => {
    if (!expiryDate) return <span className="badge badge-secondary">NO EXPIRY</span>;
    
    const diffTime = new Date(expiryDate) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <span className="badge badge-danger">EXPIRED</span>;
    } else if (diffDays <= 90) {
      return <span className="badge badge-warning">EXPIRING IN {diffDays} DAYS</span>;
    } else {
      return <span className="badge badge-success">HEALTHY</span>;
    }
  };

  return (
    <div className="grid-sidebar-layout">
      {/* Stock Listing */}
      <div className="card stock-report-card">
        <h3 className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
          Current Clinic Inventory
        </h3>

        {/* Low stock banner */}
        {lowStockItems.length > 0 && (
          <div className="stock-alert-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <div>
              <strong>Low Stock Warning:</strong> The following items need urgent replenishment: {lowStockItems.map(i => i.name).join(', ')}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }} className="stock-summary-container">
          <div style={{ flex: 1, minWidth: '150px', padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--light)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>STOCK ASSET COST</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1.1rem' }}>Rs. {totalCost.toFixed(2)}</span>
          </div>
          <div style={{ flex: 1, minWidth: '150px', padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--light)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>POTENTIAL REVENUE</span>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1.1rem' }}>Rs. {totalSelling.toFixed(2)}</span>
          </div>
          <div style={{ flex: 1, minWidth: '150px', padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-light)', borderLeft: '3px solid var(--success)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, display: 'block' }}>EXPECTED MARGIN</span>
            <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.1rem' }}>Rs. {expectedProfit.toFixed(2)}</span>
          </div>
        </div>

        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search stock item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input search-input"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-select"
            style={{ width: '180px' }}
          >
            <option value="all">All Items</option>
            <option value="drug">Drugs / Pharmacy</option>
            <option value="equipment">Equipment / Supplies</option>
          </select>
          <button onClick={handlePrint} className="btn btn-secondary">
            🖨️ Print Stock Report
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Price (Selling)</th>
                <th>Available Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length > 0 ? (
                filteredInventory.map((item) => {
                  const isLow = item.qty <= item.min_qty;
                  const itemBatches = batchesMap[item.id] || [];
                  const isExpanded = expandedItemId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td>
                          <span className="badge badge-primary">{item.id}</span>
                          {item.barcode && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                              [{item.barcode}]
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td>
                          {item.type === 'drug' ? (
                            <span className="badge badge-success">Drug</span>
                          ) : (
                            <span className="badge badge-warning">Equipment</span>
                          )}
                        </td>
                        <td>Rs. {item.price.toFixed(2)} / {item.unit.replace(/s$/, '')}</td>
                        <td>
                          <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`} style={{ fontWeight: 700 }}>
                            {item.qty} {item.unit} {isLow && ' (Low)'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              onClick={() => {
                                setExpandedItemId(isExpanded ? null : item.id);
                                fetchItemBatches(item.id);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                            >
                              📦 Batches ({itemBatches.length})
                            </button>
                            
                            {stockEdit.id === item.id ? (
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  placeholder="+/-"
                                  value={stockEdit.change}
                                  onChange={(e) => setStockEdit(prev => ({ ...prev, change: e.target.value }))}
                                  className="form-input"
                                  style={{ width: '60px', padding: '0.35rem', margin: 0 }}
                                />
                                <button onClick={() => handleStockUpdateSubmit(item.id)} className="btn btn-success" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                                  Save
                                </button>
                                <button onClick={() => setStockEdit({ id: null, change: '' })} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                                  &times;
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setStockEdit({ id: item.id, change: '' })} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
                                Adjust Qty
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Batches View */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" style={{ backgroundColor: 'var(--light)', padding: '1.5rem', borderLeft: '3px solid var(--primary)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                              
                              {/* Batches List */}
                              <div>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--dark)' }}>Active Batches (FEFO Tracking)</h4>
                                {itemBatches.length > 0 ? (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Batch #</th>
                                        <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem' }}>Qty</th>
                                        <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem' }}>Cost Price</th>
                                        <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem' }}>Expiry Date</th>
                                        <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem' }}>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {itemBatches.map(b => (
                                        <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{b.batch_number}</td>
                                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{b.qty}</td>
                                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Rs. {b.cost_price.toFixed(2)}</td>
                                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>{b.expiry_date || 'N/A'}</td>
                                          <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>{getBatchExpiryBadge(b.expiry_date)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No batch tracking logged for this item yet. Use the form to record the first batch.</p>
                                )}
                              </div>

                              {/* Add Batch Form */}
                              <div style={{ backgroundColor: 'var(--white)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--dark)' }}>Add New Stock Batch</h4>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                  <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Batch Number *</label>
                                  <input
                                    type="text"
                                    value={batchFormData.batch_number}
                                    onChange={(e) => setBatchFormData(prev => ({ ...prev, batch_number: e.target.value }))}
                                    placeholder="e.g. BAT-402"
                                    className="form-input"
                                    style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                                  />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Quantity *</label>
                                    <input
                                      type="number"
                                      value={batchFormData.qty}
                                      onChange={(e) => setBatchFormData(prev => ({ ...prev, qty: e.target.value }))}
                                      placeholder="100"
                                      className="form-input"
                                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                                      min="1"
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Cost Price (Rs.)</label>
                                    <input
                                      type="number"
                                      value={batchFormData.cost_price}
                                      onChange={(e) => setBatchFormData(prev => ({ ...prev, cost_price: e.target.value }))}
                                      placeholder="Cost per unit"
                                      className="form-input"
                                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                  <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>Expiry Date *</label>
                                  <input
                                    type="date"
                                    value={batchFormData.expiry_date}
                                    onChange={(e) => setBatchFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                                    className="form-input"
                                    style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddBatchSubmit(item.id)}
                                  className="btn btn-primary"
                                  style={{ padding: '0.4rem', width: '100%', fontSize: '0.8rem' }}
                                >
                                  Save Stock Batch
                                </button>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No inventory records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboarding / Add Item Form */}
      <div className="card">
        <h3 className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          Record New Stock Asset
        </h3>

        {message.text && (
          <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Item / Drug Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g. Paracetamol 500mg"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Barcode (Scan or Type)</label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleInputChange}
              placeholder="e.g. 8901234500018"
              className="form-input"
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Item Category *</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="drug">💊 Pharmacy Drug / Medicine</option>
                <option value="equipment">🩺 Clinical Equipment / Supply</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Measurement Unit</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                placeholder="e.g. tablets, vials, packs"
                className="form-input"
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Initial Quantity *</label>
              <input
                type="number"
                name="qty"
                value={formData.qty}
                onChange={handleInputChange}
                placeholder="0"
                className="form-input"
                required
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Low Stock Reorder Limit *</label>
              <input
                type="number"
                name="min_qty"
                value={formData.min_qty}
                onChange={handleInputChange}
                placeholder="e.g. 50"
                className="form-input"
                required
                min="0"
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Cost Price (Rs. Buying Cost) *</label>
              <input
                type="number"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleInputChange}
                placeholder="0.00"
                className="form-input"
                required
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Selling Price (Rs.) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="0.00"
                className="form-input"
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Adding Asset...' : 'Save Stock Asset'}
          </button>
        </form>
      </div>

    </div>
  );
}
