import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function DrugTemplates() {
  const [templates, setTemplates] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mode: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState('list');
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  // Form states
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateItems, setTemplateItems] = useState([]);

  // Item selector states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchInventory();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/drug-templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      if (window.showToast) window.showToast('Failed to fetch templates.', 'danger');
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const handleOpenCreate = () => {
    setTemplateName('');
    setTemplateDesc('');
    setTemplateItems([]);
    setEditingTemplateId(null);
    setViewMode('create');
    resetItemSelectors();
  };

  const handleOpenEdit = (template) => {
    setTemplateName(template.name);
    setTemplateDesc(template.description || '');
    setTemplateItems([...template.items]);
    setEditingTemplateId(template.id);
    setViewMode('edit');
    resetItemSelectors();
  };

  const resetItemSelectors = () => {
    setSelectedItemId('');
    setItemQty(1);
    setCustomName('');
    setCustomPrice('');
  };

  const handleAddItem = () => {
    if (selectedItemId === 'custom') {
      if (!customName.trim() || !customPrice) {
        if (window.showToast) window.showToast('Please fill out service name and price.', 'warning');
        return;
      }
      const newItem = {
        id: 'custom_' + Date.now(),
        name: customName.trim(),
        qty: parseInt(itemQty) || 1,
        price: parseFloat(customPrice) || 0.0,
        type: 'service'
      };
      setTemplateItems(prev => [...prev, newItem]);
      resetItemSelectors();
      return;
    }

    const matched = inventory.find(i => i.id === selectedItemId);
    if (!matched) {
      if (window.showToast) window.showToast('Please select a valid item.', 'warning');
      return;
    }

    // Check if already exists in template
    if (templateItems.some(item => item.id === matched.id)) {
      if (window.showToast) window.showToast('Item is already in this template.', 'warning');
      return;
    }

    const newItem = {
      id: matched.id,
      name: matched.name,
      qty: parseInt(itemQty) || 1,
      price: matched.price,
      type: matched.type
    };

    setTemplateItems(prev => [...prev, newItem]);
    resetItemSelectors();
  };

  const handleRemoveItem = (index) => {
    setTemplateItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) {
      if (window.showToast) window.showToast('Template/Diagnosis name is required.', 'warning');
      return;
    }
    if (templateItems.length === 0) {
      if (window.showToast) window.showToast('Add at least one drug or service to the template.', 'warning');
      return;
    }

    setLoading(true);
    const payload = {
      name: templateName.trim(),
      description: templateDesc.trim(),
      items: templateItems
    };

    try {
      const url = editingTemplateId 
        ? `${API_URL}/api/drug-templates/${editingTemplateId}`
        : `${API_URL}/api/drug-templates`;
      
      const method = editingTemplateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const msg = editingTemplateId 
          ? 'Template updated successfully!' 
          : 'Template created successfully!';
        if (window.showToast) window.showToast(msg, 'success');
        setViewMode('list');
        fetchTemplates();
      } else {
        const err = await res.json();
        if (window.showToast) window.showToast(err.error || 'Failed to save template.', 'danger');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      if (window.showToast) window.showToast('Server error saving template.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/drug-templates/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (window.showToast) window.showToast('Template deleted successfully.', 'success');
        fetchTemplates();
      } else {
        if (window.showToast) window.showToast('Failed to delete template.', 'danger');
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      if (window.showToast) window.showToast('Server error deleting template.', 'danger');
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const fmtAmt = (num) =>
    Number(num).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {viewMode === 'list' ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ color: 'var(--dark)' }}>Diagnosis templates list</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Setup predefined prescription packages to load during customer checkout.</p>
            </div>
            <button onClick={handleOpenCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ➕ Create New Template
            </button>
          </div>

          {/* Search bar */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search templates by diagnosis name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💊</div>
              <h3>No Drug Templates Found</h3>
              <p>Get started by creating a new template for a diagnosis.</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {filteredTemplates.map(tpl => (
                <div key={tpl.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--light-bg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge badge-primary" style={{ marginBottom: '0.25rem' }}>ID: {tpl.id}</span>
                      <h3 style={{ margin: 0, color: 'var(--dark)', fontWeight: 700 }}>{tpl.name}</h3>
                    </div>
                  </div>
                  
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flexGrow: 1, minHeight: '40px' }}>
                    {tpl.description || 'No description provided.'}
                  </p>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>
                      📦 {tpl.items?.length || 0} Preset Item(s)
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleOpenEdit(tpl)} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(tpl.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#e53e3e' }}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ color: 'var(--dark)' }}>{viewMode === 'create' ? 'Create New Template' : 'Edit Template'}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Define the preset drug items and services for a specific diagnosis.</p>
            </div>
            <button type="button" onClick={() => setViewMode('list')} className="btn btn-secondary">
              Back to List
            </button>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Diagnosis Name / Template Title <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. Flu & Fever, Dengue Care"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Template Description</label>
              <input
                type="text"
                placeholder="Brief guidelines or notes about this prescription package..."
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Add Item Zone */}
          <div style={{ 
            backgroundColor: 'rgba(13, 148, 136, 0.05)', 
            border: '1px solid var(--border)', 
            padding: '1.25rem', 
            borderRadius: 'var(--radius)', 
            marginBottom: '1.5rem' 
          }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.75rem' }}>Add Item to Template</h3>
            <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 80px auto', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Pharmacy Medicine / Service</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="form-select"
                  style={{ margin: 0 }}
                >
                  <option value="">-- Choose Stock Item / Service --</option>
                  <option value="custom">Custom Non-Stock Charge</option>
                  <optgroup label="Pharmacy Stock (Drugs)">
                    {inventory.filter(i => i.type === 'drug').map(i => (
                      <option key={i.id} value={i.id}>{i.name} (Rs. {fmtAmt(i.price)} / {i.unit}) [Stock: {i.qty}]</option>
                    ))}
                  </optgroup>
                  <optgroup label="Clinical Equipment / Consumables">
                    {inventory.filter(i => i.type === 'equipment').map(i => (
                      <option key={i.id} value={i.id}>{i.name} (Rs. {fmtAmt(i.price)} / {i.unit}) [Stock: {i.qty}]</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {selectedItemId === 'custom' ? (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Service/Drug Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Injection fee"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="form-input"
                      style={{ margin: 0 }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Price (Rs.)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="form-input"
                      style={{ margin: 0 }}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </>
              ) : null}

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Default Qty</label>
                <input
                  type="number"
                  value={itemQty}
                  onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="form-input"
                  style={{ margin: 0 }}
                  min="1"
                />
              </div>

              <button type="button" onClick={handleAddItem} className="btn btn-secondary" style={{ height: '42px', margin: 0 }}>
                ➕ Add Item
              </button>
            </div>
          </div>

          {/* Preset list table */}
          <h3 style={{ fontSize: '1.05rem', color: 'var(--dark)', marginBottom: '0.75rem', fontWeight: 600 }}>Template Preset Items</h3>
          {templateItems.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              No items added to this template yet. Use the select form above to add items.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Item ID</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Item Description</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', width: '100px' }}>Default Qty</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', width: '150px' }}>Price (Rs.)</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', width: '180px' }}>Total Price (Rs.)</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', width: '80px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {templateItems.map((item, index) => (
                    <tr key={item.id + '_' + index} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-secondary" style={{ textTransform: 'uppercase' }}>{item.id}</span>
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setTemplateItems(prev => prev.map((it, idx) => idx === index ? { ...it, qty: val } : it));
                          }}
                          className="form-input"
                          style={{ width: '80px', margin: '0 auto', textAlign: 'center', padding: '0.25rem' }}
                          min="1"
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {item.id.startsWith('custom_') ? (
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0.0);
                              setTemplateItems(prev => prev.map((it, idx) => idx === index ? { ...it, price: val } : it));
                            }}
                            className="form-input"
                            style={{ width: '120px', marginLeft: 'auto', textAlign: 'right', padding: '0.25rem' }}
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          fmtAmt(item.price)
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                        {fmtAmt(item.price * item.qty)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button type="button" onClick={() => handleRemoveItem(index)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: '#ff6b6b', borderColor: '#ff6b6b' }} title="Remove Item">
                          ✕ Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: 700 }}>
                    <td colSpan="4" style={{ padding: '0.75rem', textAlign: 'right' }}>Template Summary Total:</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)', fontSize: '1.05rem' }}>
                      {fmtAmt(templateItems.reduce((sum, item) => sum + (item.qty * item.price), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setViewMode('list')} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : '💾 Save Template'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
