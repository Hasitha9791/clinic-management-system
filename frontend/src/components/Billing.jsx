import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function Billing({ selectedPatient, selectedVisit, onSelectPatient, clearBillingContext }) {
  const [patients, setPatients] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  
  // Cart items: Array of { id, name, qty, price, type }
  const [cart, setCart] = useState([]);
  const [currentItem, setCurrentItem] = useState({ id: '', qty: 1, customPrice: '', customName: '' });

  // Barcode scanner integration
  const barcodeInputRef = React.useRef(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMessage, setScanMessage] = useState({ type: '', text: '' });
  const [taxRate, setTaxRate] = useState(0); // 0% default for healthcare, configurable
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  
  // Advanced POS Options states
  const [isInsurance, setIsInsurance] = useState(false);
  const [insuranceProvider, setInsuranceProvider] = useState('SLIC');
  const [insuranceAmount, setInsuranceAmount] = useState('');
  
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitCardAmount, setSplitCardAmount] = useState('');

  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [bills, setBills] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('all');
  const [historyFilterDate, setHistoryFilterDate] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchBillingHistory();
    if (!selectedPatient) {
      fetchPatients();
    } else {
      // Auto-focus barcode scanner input
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }, 200);
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

  const fetchBillingHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/billing`);
      if (res.ok) {
        const data = await res.json();
        setBills(data);
      }
    } catch (err) {
      console.error('Error fetching billing history:', err);
    }
  };

  // Pre-populate cart with consultation fee by default
  useEffect(() => {
    setCart([
      { id: 'custom_consult', name: 'Doctor Consultation Fee', qty: 1, price: 1500.00, type: 'service' }
    ]);
    setIsInsurance(false);
    setIsSplitPayment(false);
    setInsuranceAmount('');
    setSplitCashAmount('');
    setSplitCardAmount('');
  }, [selectedPatient]);

  const handleBarcodeScanSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanCode = barcodeInput.trim();
    if (!cleanCode) return;

    // Search inventory for matching barcode
    const matchedItem = inventory.find(i => i.barcode === cleanCode);
    if (matchedItem) {
      // Play a premium scan beep sound!
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } catch (audioErr) {
        console.warn('Audio Context not allowed/supported yet:', audioErr.message);
      }

      // Check stock
      if (matchedItem.qty <= 0) {
        alert(`Warning: ${matchedItem.name} is out of stock!`);
      }

      // Add to cart or increment
      const existingIndex = cart.findIndex(c => c.id === matchedItem.id);
      if (existingIndex > -1) {
        const updatedCart = [...cart];
        updatedCart[existingIndex].qty += 1;
        setCart(updatedCart);
      } else {
        const newItem = {
          id: matchedItem.id,
          name: matchedItem.name,
          qty: 1,
          price: matchedItem.price,
          type: matchedItem.type,
          barcode: matchedItem.barcode
        };
        setCart(prev => [...prev, newItem]);
      }
      setScanMessage({ type: 'success', text: `Scanned: ${matchedItem.name}` });
      setTimeout(() => setScanMessage({ type: '', text: '' }), 3000);
    } else {
      // Play warning double beep!
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (freq, duration, delay) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
          gain.gain.setValueAtTime(0.05, audioCtx.currentTime + delay);
          osc.start(audioCtx.currentTime + delay);
          osc.stop(audioCtx.currentTime + delay + duration);
        };
        playBeep(220, 0.15, 0);
        playBeep(220, 0.15, 0.20);
      } catch (err) {}
      setScanMessage({ type: 'danger', text: `Barcode not recognized: "${cleanCode}"` });
      setTimeout(() => setScanMessage({ type: '', text: '' }), 5000);
    }

    setBarcodeInput('');
    // Focus back on input
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 50);
  };

  const handleAddItemToCart = () => {
    if (currentItem.id === 'custom') {
      if (!currentItem.customName || !currentItem.customPrice) {
        alert('Please fill name and price for custom service');
        return;
      }
      const newItem = {
        id: 'custom_' + Date.now(),
        name: currentItem.customName,
        qty: parseInt(currentItem.qty) || 1,
        price: parseFloat(currentItem.customPrice) || 0,
        type: 'service'
      };
      setCart(prev => [...prev, newItem]);
      setCurrentItem({ id: '', qty: 1, customPrice: '', customName: '' });
      setTimeout(() => {
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      }, 100);
      return;
    }

    const invItem = inventory.find(i => i.id === currentItem.id);
    if (!invItem) {
      alert('Please select an item from stock.');
      return;
    }

    if (invItem.qty < currentItem.qty) {
      if (!window.confirm(`Insufficient stock! Currently available: ${invItem.qty} ${invItem.unit}. Proceed anyway?`)) {
        return;
      }
    }

    // Check if item already exists in cart
    const existingIndex = cart.findIndex(c => c.id === invItem.id);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].qty += parseInt(currentItem.qty);
      setCart(updatedCart);
    } else {
      const newItem = {
        id: invItem.id,
        name: invItem.name,
        qty: parseInt(currentItem.qty) || 1,
        price: invItem.price,
        type: invItem.type,
        barcode: invItem.barcode
      };
      setCart(prev => [...prev, newItem]);
    }

    setCurrentItem({ id: '', qty: 1, customPrice: '', customName: '' });
    setTimeout(() => {
      if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, 100);
  };

  const handleRemoveFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.qty * item.price), 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    return sub + (sub * (taxRate / 100));
  };

  const getPatientCopay = () => {
    const total = calculateTotal();
    const ins = parseFloat(insuranceAmount) || 0;
    return Math.max(0, total - ins);
  };

  const handleGenerateInvoice = async () => {
    if (!selectedPatient) {
      alert('Please select a patient first.');
      return;
    }
    if (cart.length === 0) {
      alert('Cart is empty.');
      return;
    }

    const total = calculateTotal();
    const copay = getPatientCopay();

    // Verify split payment sums to total copay
    if (paymentStatus === 'paid' && isSplitPayment) {
      const cash = parseFloat(splitCashAmount) || 0;
      const card = parseFloat(splitCardAmount) || 0;
      if (Math.abs((cash + card) - copay) > 0.01) {
        alert(`Split payment details are incorrect. Cash + Card must equal patient copay: Rs. ${copay.toFixed(2)} (Current sum: Rs. ${(cash + card).toFixed(2)})`);
        return;
      }
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    const payload = {
      patient_id: selectedPatient.id,
      visit_id: selectedVisit ? selectedVisit.id : null,
      items: cart,
      total_amount: total,
      payment_status: paymentStatus,
      payment_method: paymentStatus === 'paid' ? (isSplitPayment ? 'split' : paymentMethod) : 'none',
      insurance_provider: isInsurance ? insuranceProvider : null,
      insurance_amount: isInsurance ? parseFloat(insuranceAmount) || 0.0 : 0.0,
      copay_amount: copay,
      payment_method_split: isSplitPayment ? `cash:${splitCashAmount},card:${splitCardAmount}` : null
    };

    try {
      const res = await fetch(`${API_URL}/api/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedInvoice(data);
        setShowReceipt(true);
        setCart([
          { id: 'custom_consult', name: 'Doctor Consultation Fee', qty: 1, price: 1500.00, type: 'service' }
        ]);
        fetchInventory(); // Refresh stock levels after deductions
        fetchBillingHistory(); // Refresh billing audit logs
        setTimeout(() => {
          if (barcodeInputRef.current) barcodeInputRef.current.focus();
        }, 300);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to generate invoice.');
      }
    } catch (err) {
      console.error('Error generating invoice:', err);
      alert('Server error generating bill. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add('print-only-receipt');
    window.print();
    document.body.classList.remove('print-only-receipt');
  };

  const handlePrintSalesReport = () => {
    document.body.classList.add('print-only-sales-report');
    window.print();
    document.body.classList.remove('print-only-sales-report');
  };

  const handleVoidInvoice = async (id) => {
    if (!window.confirm("Are you sure you want to void this invoice? This will restore all stock items and set its status to VOIDED. This action is audited and irreversible.")) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/billing/${id}/void`, {
        method: 'PUT'
      });
      if (res.ok) {
        alert('Invoice successfully voided. Quantities returned to inventory.');
        fetchBillingHistory();
        fetchInventory();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to void invoice.');
      }
    } catch (err) {
      console.error('Error voiding invoice:', err);
    }
  };

  const getPatientName = (patientId) => {
    const p = patients.find(pat => pat.id === patientId);
    return p ? p.name : patientId;
  };

  const getPatientPhone = (patientId) => {
    const p = patients.find(pat => pat.id === patientId);
    return p ? p.contact || '' : '';
  };

  const filteredPatients = patients.filter((p) => {
    const term = patientSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.contact && p.contact.toLowerCase().includes(term)) ||
      p.id.toLowerCase().includes(term)
    );
  });

  const filteredBills = bills.filter((bill) => {
    const term = historySearch.toLowerCase();
    const pName = getPatientName(bill.patient_id).toLowerCase();
    const pPhone = getPatientPhone(bill.patient_id);
    
    const matchesSearch = 
      bill.id.toLowerCase().includes(term) || 
      bill.patient_id.toLowerCase().includes(term) ||
      pName.includes(term) ||
      pPhone.includes(term);

    const matchesStatus = historyFilterStatus === 'all' || 
                          (historyFilterStatus === 'voided' && bill.status === 'voided') ||
                          (historyFilterStatus !== 'voided' && bill.status !== 'voided' && bill.payment_status === historyFilterStatus);
                          
    const matchesDate = !historyFilterDate || bill.billing_date === historyFilterDate;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const calculateHistoryStats = () => {
    let total = 0;
    let collected = 0;
    let outstanding = 0;
    
    filteredBills.forEach(bill => {
      if (bill.status === 'voided') return; // Skip voided bills
      
      total += bill.total_amount;
      if (bill.payment_status === 'paid') {
        collected += bill.total_amount;
      } else {
        outstanding += bill.total_amount;
      }
    });

    return { total, collected, outstanding };
  };

  const historyStats = calculateHistoryStats();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="grid-sidebar-layout">
      {/* POS Billing Screen */}
      <div className="card">
        {selectedPatient ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: '0.25rem' }}>Billing Patient</span>
                <h2 style={{ color: 'var(--dark)' }}>{selectedPatient.name}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  ID: {selectedPatient.id} | Contact: {selectedPatient.contact || 'N/A'}
                </p>
                {selectedVisit && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.25rem' }}>
                    Linked Visit ID: {selectedVisit.id}
                  </p>
                )}
              </div>
              <button onClick={() => { onSelectPatient(null); clearBillingContext(); }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Change Patient
              </button>
            </div>

            {/* Barcode Scanner Input Zone */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              backgroundColor: 'var(--light)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              border: '2px dashed var(--primary)',
              marginBottom: '1rem',
              position: 'relative'
            }}>
              <div style={{ fontSize: '1.8rem' }}>🏷️</div>
              <form onSubmit={handleBarcodeScanSubmit} style={{ flex: 1, display: 'flex', gap: '0.5rem', margin: 0 }}>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Focus here & scan barcode (or type EAN and press Enter)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.95rem', letterSpacing: '1px', fontWeight: 600, margin: 0 }}
                />
                <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  Scan / Enter
                </button>
              </form>
            </div>

            {/* Scan Simulation Controls */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              fontSize: '0.85rem',
              backgroundColor: 'rgba(14, 165, 233, 0.05)',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              marginBottom: '1.5rem',
              border: '1px solid var(--border)'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>🧪 Barcode Simulation:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setBarcodeInput(e.target.value);
                  }
                }}
                value={barcodeInput}
                className="form-select"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 'auto', minWidth: '180px', height: 'auto', margin: 0 }}
              >
                <option value="">-- Choose Stock Item --</option>
                {inventory.filter(i => i.barcode).map(i => (
                  <option key={i.id} value={i.barcode}>{i.name} ({i.barcode})</option>
                ))}
                <option value="9999999999999">Non-existent Barcode (Error Test)</option>
              </select>
              <button 
                type="button" 
                onClick={() => {
                  if (barcodeInput) {
                    handleBarcodeScanSubmit();
                  } else {
                    alert('Please select a stock item from simulation dropdown first.');
                  }
                }} 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                Simulate Scan
              </button>
            </div>

            {scanMessage.text && (
              <div className={`badge badge-${scanMessage.type}`} style={{
                width: '100%',
                padding: '0.6rem 1rem',
                marginBottom: '1.5rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)'
              }}>
                {scanMessage.type === 'success' ? '✅' : '⚠️'} {scanMessage.text}
              </div>
            )}

            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Add Service / Stock Item</h3>
              <div className="billing-item-row">
                <div style={{ flex: 2 }}>
                  <label className="form-label">Item / Stock Description</label>
                  <select
                    value={currentItem.id}
                    onChange={(e) => setCurrentItem(prev => ({ ...prev, id: e.target.value }))}
                    className="form-select"
                  >
                    <option value="">-- Choose Stock Item / Service --</option>
                    <option value="custom">Custom Non-Stock Charge</option>
                    <optgroup label="Pharmacy Stock (Drugs)">
                      {inventory.filter(i => i.type === 'drug').map(i => (
                        <option key={i.id} value={i.id}>{i.name} (Rs. {i.price.toFixed(2)} / {i.unit}) [Stock: {i.qty}]</option>
                      ))}
                    </optgroup>
                    <optgroup label="Clinical Equipment / Consumables">
                      {inventory.filter(i => i.type === 'equipment').map(i => (
                        <option key={i.id} value={i.id}>{i.name} (Rs. {i.price.toFixed(2)} / {i.unit}) [Stock: {i.qty}]</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {currentItem.id === 'custom' && (
                  <>
                    <div style={{ flex: 2 }}>
                      <label className="form-label">Service Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Lab Test Charge"
                        value={currentItem.customName || ''}
                        onChange={(e) => setCurrentItem(prev => ({ ...prev, customName: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Price (Rs.)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={currentItem.customPrice || ''}
                        onChange={(e) => setCurrentItem(prev => ({ ...prev, customPrice: e.target.value }))}
                        className="form-input"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </>
                )}

                <div style={{ width: '80px' }}>
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    value={currentItem.qty}
                    onChange={(e) => setCurrentItem(prev => ({ ...prev, qty: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="form-input"
                    min="1"
                  />
                </div>

                <button onClick={handleAddItemToCart} className="btn btn-secondary">
                  Add Item
                </button>
              </div>
            </div>

            {/* Cart Table */}
            <h3 className="card-title">Billing Cart / Invoice Details</h3>
            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Unit Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length > 0 ? (
                    cart.map((item, index) => (
                      <tr key={item.id + '_' + index}>
                        <td style={{ fontWeight: 500 }}>
                          {item.name}
                          {item.barcode && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: '0.5rem', backgroundColor: 'var(--light)', padding: '0.15rem 0.35rem', borderRadius: '3px' }}>
                              [{item.barcode}]
                            </span>
                          )}
                          {item.type === 'drug' && <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>Medication</span>}
                          {item.type === 'equipment' && <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>Supply</span>}
                        </td>
                        <td>Rs. {item.price.toFixed(2)}</td>
                        <td>{item.qty}</td>
                        <td style={{ fontWeight: 600 }}>Rs. {(item.qty * item.price).toFixed(2)}</td>
                        <td>
                          <button onClick={() => handleRemoveFromCart(index)} className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        Add items to construct invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="card-title">Select Patient for POS Billing</h3>
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

      {/* POS Payments Panel */}
      <div className="card" style={{ display: selectedPatient ? 'block' : 'none' }}>
        <h3 className="card-title">POS Summary & Payments</h3>

        <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
          <span style={{ fontWeight: 600 }}>Rs. {calculateSubtotal().toFixed(2)}</span>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Taxes/VAT (%):</span>
          <input
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
            style={{ width: '60px', padding: '0.25rem 0.5rem', textAlign: 'right', border: '1px solid var(--border)', borderRadius: '4px' }}
            min="0"
          />
        </div>

        {/* Insurance Split Billing */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              id="insuranceCheck"
              checked={isInsurance}
              onChange={(e) => {
                setIsInsurance(e.target.checked);
                if (!e.target.checked) setInsuranceAmount('');
              }}
            />
            <label htmlFor="insuranceCheck" style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Apply Insurance Claim</label>
          </div>

          {isInsurance && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Insurance Provider</label>
                <select
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  className="form-select"
                  style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                >
                  <option value="SLIC">SLIC (Sri Lanka Insurance)</option>
                  <option value="Allianz">Allianz Insurance</option>
                  <option value="Union Assurance">Union Assurance</option>
                  <option value="Ceylinco">Ceylinco Life</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Covered Amount (Rs.)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={insuranceAmount}
                  onChange={(e) => setInsuranceAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="form-input"
                  style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                  max={calculateTotal()}
                />
              </div>
            </div>
          )}
        </div>

        <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Grand Total:</span>
          <span style={{ fontWeight: 700, color: 'var(--dark)' }}>Rs. {calculateTotal().toFixed(2)}</span>
        </div>

        {isInsurance && (
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem', backgroundColor: 'var(--success-light)', padding: '0.5rem', borderRadius: '4px' }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>Patient Copay (Payable):</span>
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>Rs. {getPatientCopay().toFixed(2)}</span>
          </div>
        )}

        <div className="form-group" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
          <label className="form-label">Invoice Payment Status</label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="form-select"
          >
            <option value="paid">Paid (Close Invoice)</option>
            <option value="unpaid">Unpaid / Outstanding Bill</option>
          </select>
        </div>

        {paymentStatus === 'paid' && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                id="splitCheck"
                checked={isSplitPayment}
                onChange={(e) => {
                  setIsSplitPayment(e.target.checked);
                  if (e.target.checked) {
                    const copay = getPatientCopay();
                    setSplitCashAmount((copay * 0.5).toFixed(2));
                    setSplitCardAmount((copay * 0.5).toFixed(2));
                  } else {
                    setSplitCashAmount('');
                    setSplitCardAmount('');
                  }
                }}
              />
              <label htmlFor="splitCheck" style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Split Payment (Cash + Card)</label>
            </div>

            {isSplitPayment ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Cash Paid (Rs.)</label>
                  <input
                    type="number"
                    value={splitCashAmount}
                    onChange={(e) => {
                      const cash = Math.max(0, parseFloat(e.target.value) || 0);
                      setSplitCashAmount(e.target.value);
                      setSplitCardAmount(Math.max(0, getPatientCopay() - cash).toFixed(2));
                    }}
                    className="form-input"
                    style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Card Paid (Rs.)</label>
                  <input
                    type="number"
                    value={splitCardAmount}
                    onChange={(e) => {
                      const card = Math.max(0, parseFloat(e.target.value) || 0);
                      setSplitCardAmount(e.target.value);
                      setSplitCashAmount(Math.max(0, getPatientCopay() - card).toFixed(2));
                    }}
                    className="form-input"
                    style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Single Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-select"
                >
                  <option value="cash">💵 Cash Payment</option>
                  <option value="card">💳 Card / POS Terminal</option>
                </select>
              </div>
            )}
          </div>
        )}

        <button onClick={handleGenerateInvoice} className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', padding: '1rem' }} disabled={loading}>
          {loading ? 'Processing POS...' : 'Generate Bill & Receipt'}
        </button>
      </div> {/* Close POS Payments Panel */}
    </div> {/* Close grid-sidebar-layout */}

      {/* Billing History & Audit Report Card */}
      <div className="card sales-report-card">
        <h3 className="card-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Billing History & Audit Report
        </h3>
        
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search by Invoice ID or Patient Details..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="form-input search-input"
          />
          <select
            value={historyFilterStatus}
            onChange={(e) => setHistoryFilterStatus(e.target.value)}
            className="form-select"
            style={{ width: '150px' }}
          >
            <option value="all">All Invoices</option>
            <option value="paid">Paid Only</option>
            <option value="unpaid">Unpaid Only</option>
            <option value="voided">Voided Only</option>
          </select>
          <input
            type="date"
            value={historyFilterDate}
            onChange={(e) => setHistoryFilterDate(e.target.value)}
            className="form-input"
            style={{ width: '180px' }}
          />
          <button onClick={handlePrintSalesReport} className="btn btn-secondary">
            🖨️ Print Sales Report
          </button>
        </div>

        {/* Stats summary for filtered history */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }} className="stock-summary-container">
          <div style={{ flex: 1, minWidth: '150px', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--light)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>FILTERED BILLS</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--dark)' }}>{filteredBills.length} Invoices</span>
          </div>
          <div style={{ flex: 1, minWidth: '150px', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--light)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>TOTAL REVENUE</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--dark)' }}>Rs. {historyStats.total.toFixed(2)}</span>
          </div>
          <div style={{ flex: 1, minWidth: '150px', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-light)', borderLeft: '3px solid var(--success)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'block' }}>COLLECTED (PAID)</span>
            <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>Rs. {historyStats.collected.toFixed(2)}</span>
          </div>
          <div style={{ flex: 1, minWidth: '150px', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-light)', borderLeft: '3px solid var(--danger)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600, display: 'block' }}>OUTSTANDING</span>
            <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1rem' }}>Rs. {historyStats.outstanding.toFixed(2)}</span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Date</th>
                <th>Patient</th>
                <th>Payment Status</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length > 0 ? (
                filteredBills.map(bill => (
                  <tr key={bill.id} style={{ opacity: bill.status === 'voided' ? 0.6 : 1 }}>
                    <td><span className="badge badge-primary">{bill.id}</span></td>
                    <td>{bill.billing_date}</td>
                    <td style={{ fontWeight: 600 }}>{getPatientName(bill.patient_id)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({bill.patient_id})</span></td>
                    <td>
                      {bill.status === 'voided' ? (
                        <span className="badge badge-danger" style={{ textDecoration: 'line-through' }}>VOIDED</span>
                      ) : (
                        <span className={`badge ${bill.payment_status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                          {bill.payment_status.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td>
                      {bill.payment_method === 'split' ? (
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>SPLIT</span>
                      ) : (
                        bill.payment_method.toUpperCase()
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      Rs. {bill.total_amount.toFixed(2)}
                      {bill.insurance_amount > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 500 }}>
                          Ins: -Rs. {bill.insurance_amount.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td>
                      {bill.status !== 'voided' ? (
                        <button
                          onClick={() => handleVoidInvoice(bill.id)}
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Void
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Voided</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No transaction records found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Receipt Modal overlay */}
      {showReceipt && generatedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button onClick={() => setShowReceipt(false)} className="close-modal">&times;</button>
            
            <div className="invoice-print-area" id="print-area">
              <div className="invoice-header">
                <div className="clinic-info">
                  <h2>🏥 Care & Cure Clinic</h2>
                  <p>123 Medical Plaza, Suite 401</p>
                  <p>Colombo, Sri Lanka</p>
                  <p>Tel: +94 11 555 7890</p>
                </div>
                <div className="invoice-title">
                  <h1>INVOICE</h1>
                  <p>Invoice #: <strong>{generatedInvoice.id}</strong></p>
                  <p>Date: {generatedInvoice.billing_date}</p>
                </div>
              </div>

              <div className="invoice-bill-to">
                <h4>Patient Details:</h4>
                <p><strong>{selectedPatient.name}</strong></p>
                <p>ID: {selectedPatient.id}</p>
                {selectedPatient.contact && <p>Contact: {selectedPatient.contact}</p>}
                {selectedPatient.address && <p>Address: {selectedPatient.address}</p>}
              </div>

              <table className="invoice-items-table">
                <thead>
                  <tr>
                    <th>Item/Service Description</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedInvoice.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td style={{ textAlign: 'right' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {item.price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {(item.qty * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="invoice-summary">
                <div className="invoice-summary-box">
                  <div className="summary-row">
                    <span>Subtotal:</span>
                    <span>Rs. {(generatedInvoice.total_amount / (1 + (taxRate / 100))).toFixed(2)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="summary-row">
                      <span>Tax ({taxRate}%):</span>
                      <span>Rs. {(generatedInvoice.total_amount - (generatedInvoice.total_amount / (1 + (taxRate / 100)))).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="summary-row total">
                    <span>Grand Total:</span>
                    <span>Rs. {generatedInvoice.total_amount.toFixed(2)}</span>
                  </div>

                  {generatedInvoice.insurance_amount > 0 && (
                    <>
                      <div className="summary-row" style={{ color: 'var(--success)', fontWeight: 600 }}>
                        <span>Insurance Pay:</span>
                        <span>Rs. {generatedInvoice.insurance_amount.toFixed(2)}</span>
                      </div>
                      <div className="summary-row" style={{ borderTop: '1px solid var(--border)', fontWeight: 700 }}>
                        <span>Patient Copay:</span>
                        <span>Rs. {generatedInvoice.copay_amount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px dashed var(--border)', paddingTop: '1.5rem' }}>
                {generatedInvoice.payment_status === 'paid' ? (
                  <div>
                    <div className="paid-stamp">PAID</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Settled via {generatedInvoice.payment_method.toUpperCase()}
                      {generatedInvoice.payment_method_split && ` (${generatedInvoice.payment_method_split.replace(/,/g, ', ')})`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="unpaid-stamp">UNPAID</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.5rem' }}>
                      Payment Due
                    </p>
                  </div>
                )}
                
                {generatedInvoice.insurance_provider && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.25rem' }}>
                    Claim Provider: {generatedInvoice.insurance_provider.toUpperCase()}
                  </p>
                )}
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>Thank you for visiting Care & Cure Clinic!</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReceipt(false)} className="btn btn-secondary">
                Close
              </button>
              <button onClick={handlePrint} className="btn btn-success">
                🖨️ Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
