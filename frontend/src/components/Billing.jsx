import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '5000' ? 'http://localhost:5000' : '');

export default function Billing({ selectedPatient, selectedVisit, onSelectPatient, clearBillingContext, clinicProfile }) {
  // Resolve clinic details — use profile if available, else fall back to defaults
  const clinic = {
    name: clinicProfile?.clinic_name || 'Care & Cure Clinic',
    tagline: clinicProfile?.tagline || 'Advanced Healthcare & Wellness Centre',
    address: clinicProfile?.address || '123 Medical Plaza, Suite 401',
    city: clinicProfile?.city || 'Colombo 03',
    country: clinicProfile?.country || 'Sri Lanka',
    phone: clinicProfile?.phone || '+94 11 555 7890',
    email: clinicProfile?.email || 'info@careandcure.lk',
    footer_note: clinicProfile?.footer_note || 'Thank you for trusting us with your health!',
    disclaimer: clinicProfile?.disclaimer || 'This is a computer-generated invoice and does not require a physical signature.',
    reg_number: clinicProfile?.reg_number || '',
    logo: clinicProfile?.logo || ''
  };

  const [patients, setPatients] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [showAllPatients, setShowAllPatients] = useState(false);
  
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [bills, setBills] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('all');
  const [historyFilterDate, setHistoryFilterDate] = useState('');

  // Pay Now modal state (for settling existing unpaid bills)
  const [payNowBill, setPayNowBill] = useState(null); // the bill being settled
  const [payNowMethod, setPayNowMethod] = useState('cash');
  const [payNowLoading, setPayNowLoading] = useState(false);

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
    const defaultFee = clinicProfile && clinicProfile.consultation_fee !== undefined
      ? parseFloat(clinicProfile.consultation_fee) || 0.0
      : 1500.00;
    setCart([
      { id: 'custom_consult', name: 'Doctor Consultation Fee', qty: 1, price: defaultFee, type: 'service' }
    ]);
    setIsInsurance(false);
    setIsSplitPayment(false);
    setInsuranceAmount('');
    setSplitCashAmount('');
    setSplitCardAmount('');
  }, [selectedPatient, clinicProfile]);

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
        if (window.showToast) window.showToast(`Warning: ${matchedItem.name} is out of stock!`, 'danger');
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
        if (window.showToast) window.showToast('Please fill name and price for custom service.', 'warning');
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
      if (window.showToast) window.showToast('Please select an item from stock.', 'warning');
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

  const handleGenerateInvoice = () => {
    if (!selectedPatient) {
      if (window.showToast) window.showToast('Please select a patient first.', 'warning');
      return;
    }
    if (cart.length === 0) {
      if (window.showToast) window.showToast('Cart is empty.', 'warning');
      return;
    }

    const copay = getPatientCopay();

    // Verify split payment sums to total copay
    if (paymentStatus === 'paid' && isSplitPayment) {
      const cash = parseFloat(splitCashAmount) || 0;
      const card = parseFloat(splitCardAmount) || 0;
      if (Math.abs((cash + card) - copay) > 0.01) {
        if (window.showToast) {
          window.showToast(`Split payment details are incorrect. Cash + Card must equal patient copay: Rs. ${fmtAmt(copay)} (Current sum: Rs. ${fmtAmt(cash + card)})`, 'danger');
        }
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const executeGenerateInvoice = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    const total = calculateTotal();
    const copay = getPatientCopay();

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
        const defaultFee = clinicProfile && clinicProfile.consultation_fee !== undefined
          ? parseFloat(clinicProfile.consultation_fee) || 0.0
          : 1500.00;
        setCart([
          { id: 'custom_consult', name: 'Doctor Consultation Fee', qty: 1, price: defaultFee, type: 'service' }
        ]);
        fetchInventory(); // Refresh stock levels after deductions
        fetchBillingHistory(); // Refresh billing audit logs
        if (window.showToast) window.showToast('Invoice generated successfully!', 'success');
        setTimeout(() => {
          if (barcodeInputRef.current) barcodeInputRef.current.focus();
        }, 300);
      } else {
        const errData = await res.json();
        // 409 = duplicate payment blocked
        if (res.status === 409) {
          if (window.showToast) window.showToast(
            '🚫 ' + (errData.error || 'This invoice has already been paid. Duplicate payment blocked.'),
            'danger'
          );
        } else {
          if (window.showToast) window.showToast(errData.error || 'Failed to generate invoice.', 'danger');
        }
      }
    } catch (err) {
      console.error('Error generating invoice:', err);
      if (window.showToast) window.showToast('Server error generating bill. Please check backend connection.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add('print-only-receipt');
    window.print();
    document.body.classList.remove('print-only-receipt');
  };

  const handleExportBillingExcel = () => {
    if (filteredBills.length === 0) {
      if (window.showToast) window.showToast('No billing records to export.', 'warning');
      return;
    }

    const now = new Date();
    const reportDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const reportTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const filterLabel = historyFilterStatus === 'all' ? 'All Invoices'
      : historyFilterStatus === 'paid' ? 'Paid Invoices'
      : historyFilterStatus === 'unpaid' ? 'Unpaid / Outstanding'
      : 'Voided Invoices';

    const esc = (val) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = [];

    // ── CLINIC HEADER ─────────────────────────────────────────────────
    rows.push([`${clinic.name} — Billing & Sales Audit Report`]);
    rows.push([`Report Generated: ${reportDate} at ${reportTime}`]);
    rows.push([`Filter Applied: ${filterLabel}${historyFilterDate ? '  |  Date: ' + historyFilterDate : ''}${historySearch ? '  |  Search: "' + historySearch + '"' : ''}`]);
    rows.push([]);

    // ── SUMMARY STATISTICS ────────────────────────────────────────────
    rows.push(['SUMMARY']);
    rows.push(['Total Invoices (filtered)', filteredBills.length]);
    rows.push(['Total Revenue (Rs.)', historyStats.total.toFixed(2)]);
    rows.push(['Collected — Paid (Rs.)', historyStats.collected.toFixed(2)]);
    rows.push(['Outstanding — Unpaid (Rs.)', historyStats.outstanding.toFixed(2)]);
    rows.push([]);

    // ── INVOICE DETAIL TABLE ──────────────────────────────────────────
    rows.push([
      'Invoice ID',
      'Billing Date',
      'Patient Name',
      'Patient ID',
      'Contact',
      'Payment Status',
      'Payment Method',
      'Insurance Provider',
      'Insurance Amount (Rs.)',
      'Patient Copay (Rs.)',
      'Total Amount (Rs.)',
      'Invoice Status',
      'Items (Name x Qty @ Price)'
    ]);

    filteredBills.forEach(bill => {
      const patientName = getPatientName(bill.patient_id);
      const patientContact = getPatientPhone(bill.patient_id);
      const itemsSummary = Array.isArray(bill.items)
        ? bill.items.map(i => `${i.name} x${i.qty} @ Rs.${Number(i.price).toFixed(2)}`).join(' | ')
        : '';
      const status = bill.status === 'voided' ? 'VOIDED'
        : bill.payment_status === 'paid' ? 'PAID'
        : 'UNPAID';
      const method = bill.status === 'voided' ? '—'
        : bill.payment_method === 'split' ? `SPLIT (${bill.payment_method_split || ''})`
        : (bill.payment_method || '—').toUpperCase();

      rows.push([
        bill.id,
        bill.billing_date,
        patientName,
        bill.patient_id,
        patientContact,
        status,
        method,
        bill.insurance_provider || '—',
        bill.insurance_amount > 0 ? Number(bill.insurance_amount).toFixed(2) : '0.00',
        bill.copay_amount > 0 ? Number(bill.copay_amount).toFixed(2) : Number(bill.total_amount).toFixed(2),
        Number(bill.total_amount).toFixed(2),
        bill.status === 'voided' ? 'Voided' : 'Active',
        itemsSummary
      ]);
    });

    rows.push([]);
    rows.push(['--- End of Report ---']);

    // Build CSV with UTF-8 BOM for Excel
    const csv = '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `BillingReport_${historyFilterStatus}_${now.toISOString().slice(0,10)}.csv`;
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast(`Billing report exported: ${fileName}`, 'success');
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
        if (window.showToast) window.showToast('Invoice successfully voided. Quantities returned to inventory.', 'success');
        fetchBillingHistory();
        fetchInventory();
      } else {
        const err = await res.json();
        if (window.showToast) window.showToast(err.error || 'Failed to void invoice.', 'danger');
      }
    } catch (err) {
      console.error('Error voiding invoice:', err);
      if (window.showToast) window.showToast('Error voiding invoice. Please try again.', 'danger');
    }
  };

  const handlePayNow = async () => {
    if (!payNowBill) return;
    setPayNowLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/${payNowBill.id}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: payNowMethod })
      });
      const data = await res.json();
      if (res.ok) {
        if (window.showToast) window.showToast(`Invoice ${payNowBill.id} settled successfully via ${payNowMethod.toUpperCase()}!`, 'success');
        setPayNowBill(null);
        fetchBillingHistory();
      } else if (res.status === 409) {
        if (window.showToast) window.showToast('🚫 ' + (data.error || 'This bill is already paid.'), 'danger');
        setPayNowBill(null);
        fetchBillingHistory();
      } else {
        if (window.showToast) window.showToast(data.error || 'Failed to process payment.', 'danger');
      }
    } catch (err) {
      console.error('Error paying bill:', err);
      if (window.showToast) window.showToast('Server error. Please try again.', 'danger');
    } finally {
      setPayNowLoading(false);
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

  // Patients who have at least one active unpaid bill
  const unpaidPatientIds = new Set(
    bills
      .filter(b => b.payment_status === 'unpaid' && b.status !== 'voided')
      .map(b => b.patient_id)
  );

  // Unpaid bill summary per patient (count + total outstanding)
  const unpaidSummaryByPatient = bills.reduce((acc, b) => {
    if (b.payment_status === 'unpaid' && b.status !== 'voided') {
      if (!acc[b.patient_id]) acc[b.patient_id] = { count: 0, total: 0 };
      acc[b.patient_id].count += 1;
      acc[b.patient_id].total += b.total_amount;
    }
    return acc;
  }, {});

  const filteredPatients = patients.filter((p) => {
    const term = patientSearch.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      (p.contact && p.contact.toLowerCase().includes(term)) ||
      p.id.toLowerCase().includes(term);
    const matchesUnpaid = showAllPatients || unpaidPatientIds.has(p.id);
    return matchesSearch && matchesUnpaid;
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

  // Accounting number formatter — Rs. 1,25,432.50 style
  const fmtAmt = (num) =>
    Number(num).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                        <td>
                          {item.id === 'custom_consult' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rs.</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const newPrice = isNaN(val) ? 0.0 : val;
                                  setCart(prev => prev.map((c, i) => i === index ? { ...c, price: newPrice } : c));
                                }}
                                className="form-input"
                                style={{ width: '90px', padding: '0.2rem 0.4rem', margin: 0, fontSize: '0.9rem', textAlign: 'right' }}
                                min="0"
                                step="50"
                              />
                            </div>
                          ) : (
                            `Rs. ${fmtAmt(item.price)}`
                          )}
                        </td>
                        <td>{item.qty}</td>
                        <td style={{ fontWeight: 600 }}>Rs. {fmtAmt(item.qty * item.price)}</td>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>Select Patient for POS Billing</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {showAllPatients
                    ? `Showing all ${filteredPatients.length} patient(s)`
                    : `Showing ${filteredPatients.length} patient(s) with outstanding bills`
                  }
                </p>
              </div>
              <button
                onClick={() => setShowAllPatients(prev => !prev)}
                className={showAllPatients ? 'btn btn-secondary' : 'btn btn-primary'}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', whiteSpace: 'nowrap' }}
              >
                {showAllPatients ? '🔴 Unpaid Only' : '👥 Show All Patients'}
              </button>
            </div>

            {!showAllPatients && unpaidPatientIds.size === 0 && (
              <div style={{
                textAlign: 'center', padding: '2rem', background: 'var(--success-light)',
                borderRadius: 'var(--radius)', border: '1px solid var(--success)', marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <p style={{ color: 'var(--success)', fontWeight: 700, margin: 0 }}>All bills are settled!</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No outstanding unpaid invoices at this time.</p>
                <button onClick={() => setShowAllPatients(true)} className="btn btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                  Show All Patients
                </button>
              </div>
            )}

            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search by name, ID or telephone..."
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
                    <th>Contact</th>
                    <th>Outstanding Bills</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => {
                      const summary = unpaidSummaryByPatient[patient.id];
                      return (
                        <tr key={patient.id} style={summary ? { background: 'rgba(239,68,68,0.04)' } : {}}>
                          <td><span className="badge badge-primary">{patient.id}</span></td>
                          <td style={{ fontWeight: 600 }}>{patient.name}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{patient.contact || '—'}</td>
                          <td>
                            {summary ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                  fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 700,
                                  background: 'var(--danger-light)', padding: '0.2rem 0.5rem',
                                  borderRadius: '4px', border: '1px solid var(--danger)'
                                }}>
                                  ⚠️ {summary.count} Unpaid Bill{summary.count > 1 ? 's' : ''}
                                </span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}>
                                  Rs. {fmtAmt(summary.total)} due
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>✅ All Paid</span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => onSelectPatient(patient)}
                              className={summary ? 'btn btn-danger' : 'btn btn-primary'}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            >
                              {summary ? '💳 Collect' : 'New Bill'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {patientSearch
                          ? 'No matching patients found.'
                          : showAllPatients
                          ? 'No patients onboarded yet.'
                          : 'No patients with outstanding bills found.'}
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
          <span style={{ fontWeight: 600 }}>Rs. {fmtAmt(calculateSubtotal())}</span>
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
          <span style={{ fontWeight: 700, color: 'var(--dark)' }}>Rs. {fmtAmt(calculateTotal())}</span>
        </div>

        {isInsurance && (
          <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem', backgroundColor: 'var(--success-light)', padding: '0.5rem', borderRadius: '4px' }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>Patient Copay (Payable):</span>
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>Rs. {fmtAmt(getPatientCopay())}</span>
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
          <button
            onClick={handleExportBillingExcel}
            className="btn btn-success"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 18 15 15"/>
            </svg>
            Export Excel
          </button>
        </div>

        {/* Stats summary for filtered history */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }} className="stock-summary-container">

          {/* Filtered Bills count */}
          <div style={{ flex: 1, minWidth: '160px', padding: '0.75rem 1.1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--light)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Filtered Bills</span>
            <span style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--dark)', fontVariantNumeric: 'tabular-nums' }}>{filteredBills.length}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>invoices</span>
          </div>

          {/* Total Revenue */}
          <div style={{ flex: 1, minWidth: '160px', padding: '0.75rem 1.1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--light)', boxShadow: 'var(--shadow-sm)', borderLeft: '3px solid var(--primary)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Total Revenue</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Rs.</span>
              <span style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--dark)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtAmt(historyStats.total)}</span>
            </div>
          </div>

          {/* Collected (Paid) */}
          <div style={{ flex: 1, minWidth: '160px', padding: '0.75rem 1.1rem', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-light)', boxShadow: 'var(--shadow-sm)', borderLeft: '3px solid var(--success)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 700, display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>&#x2713; Collected (Paid)</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>Rs.</span>
              <span style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--success)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtAmt(historyStats.collected)}</span>
            </div>
          </div>

          {/* Outstanding (Unpaid) */}
          <div style={{ flex: 1, minWidth: '160px', padding: '0.75rem 1.1rem', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-light)', boxShadow: 'var(--shadow-sm)', borderLeft: '3px solid var(--danger)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700, display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>&#x26A0; Outstanding</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}>Rs.</span>
              <span style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--danger)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtAmt(historyStats.outstanding)}</span>
            </div>
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
                    <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Rs. </span>{fmtAmt(bill.total_amount)}
                      {bill.insurance_amount > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 500, marginTop: '0.15rem' }}>
                          Ins: &minus;Rs. {fmtAmt(bill.insurance_amount)}
                        </div>
                      )}
                    </td>
                    <td>
                      {bill.status === 'voided' ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Voided</span>
                      ) : bill.payment_status === 'paid' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.72rem', color: 'var(--success)', fontWeight: 700,
                            background: 'var(--success-light)', padding: '0.2rem 0.5rem',
                            borderRadius: '4px', border: '1px solid var(--success)'
                          }}>🔒 PAID</span>
                          <button
                            onClick={() => handleVoidInvoice(bill.id)}
                            className="btn btn-danger"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                          >
                            Void
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <button
                            onClick={() => { setPayNowBill(bill); setPayNowMethod('cash'); }}
                            className="btn btn-success"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                          >
                            💳 Pay Now
                          </button>
                          <button
                            onClick={() => handleVoidInvoice(bill.id)}
                            className="btn btn-danger"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                          >
                            Void
                          </button>
                        </div>
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

      {/* Transaction Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❓</div>
            <h3 style={{ color: 'var(--dark)', fontWeight: 800, marginBottom: '0.75rem', fontSize: '1.25rem' }}>Process Transaction?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              Are you sure you want to process this transaction? This will generate the invoice, record the collection, and update inventory stock.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowConfirmModal(false)} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.65rem', fontWeight: 600 }}
              >
                No, Cancel
              </button>
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  executeGenerateInvoice();
                }} 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.65rem', fontWeight: 700 }}
              >
                Yes, Process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Receipt Modal overlay */}
      {showReceipt && generatedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px', padding: '2rem' }}>
            <button onClick={() => setShowReceipt(false)} className="close-modal">&times;</button>

            {/* ── INVOICE PRINT AREA ───────────────────────────────────────── */}
            <div className="invoice-print-area" id="print-area">

              {/* CLINIC BRANDING HEADER */}
              <div className="invoice-brand-bar">
                <div className="invoice-brand-logo">
                  {clinic.logo ? (
                    <img src={clinic.logo} alt="Clinic Logo" style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '6px', background: '#fff', padding: '2px' }} />
                  ) : (
                    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="42" height="42" rx="10" fill="white" fillOpacity="0.18"/>
                      <rect x="17" y="7" width="8" height="28" rx="3" fill="white"/>
                      <rect x="7" y="17" width="28" height="8" rx="3" fill="white"/>
                    </svg>
                  )}
                  <div>
                    <div className="invoice-brand-name">{clinic.name}</div>
                    <div className="invoice-brand-tagline">{clinic.tagline}</div>
                  </div>
                </div>
                <div className="invoice-brand-meta">
                  <div className="invoice-brand-number">INVOICE</div>
                  <div className="invoice-brand-id">#{generatedInvoice.id}</div>
                </div>
              </div>

              {/* CLINIC INFO + INVOICE META ROW */}
              <div className="invoice-header" style={{ borderBottom: '2px solid #e8f5f2', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                <div className="clinic-info">
                  <p style={{ fontWeight: 700, color: '#1a2e2b', marginBottom: '0.25rem', fontSize: '0.9rem' }}>{clinic.name}</p>
                  <p>{clinic.address}</p>
                  <p>{clinic.city}, {clinic.country}</p>
                  <p>Tel: {clinic.phone}</p>
                  <p>Email: {clinic.email}</p>
                  {clinic.reg_number && <p style={{ fontSize: '0.78rem', color: '#6b8f88', marginTop: '0.2rem' }}>Reg: {clinic.reg_number}</p>}
                </div>
                <div className="invoice-title" style={{ textAlign: 'right' }}>
                  <table style={{ marginLeft: 'auto', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ color: '#6b8f88', paddingRight: '0.75rem', paddingBottom: '0.3rem' }}>Invoice No:</td>
                        <td style={{ fontWeight: 700, color: '#1a2e2b' }}>{generatedInvoice.id}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#6b8f88', paddingRight: '0.75rem', paddingBottom: '0.3rem' }}>Date:</td>
                        <td style={{ fontWeight: 600 }}>{generatedInvoice.billing_date}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#6b8f88', paddingRight: '0.75rem', paddingBottom: '0.3rem' }}>Visit ID:</td>
                        <td style={{ fontWeight: 600 }}>{generatedInvoice.visit_id || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#6b8f88', paddingRight: '0.75rem' }}>Status:</td>
                        <td>
                          <span style={{
                            fontWeight: 700, fontSize: '0.75rem', padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: generatedInvoice.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
                            color: generatedInvoice.payment_status === 'paid' ? '#16a34a' : '#dc2626'
                          }}>
                            {generatedInvoice.payment_status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PATIENT DETAILS */}
              <div style={{
                background: '#f0faf7', border: '1px solid #c6e8df', borderRadius: '8px',
                padding: '0.85rem 1.1rem', marginBottom: '1.5rem',
                display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b8f88', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Bill To — Patient</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a2e2b' }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: '0.83rem', color: '#6b8f88', marginTop: '0.15rem' }}>Patient ID: <strong style={{ color: '#1a2e2b' }}>{selectedPatient.id}</strong></div>
                  {selectedPatient.contact && <div style={{ fontSize: '0.83rem', color: '#6b8f88' }}>Contact: <strong style={{ color: '#1a2e2b' }}>{selectedPatient.contact}</strong></div>}
                  {selectedPatient.address && <div style={{ fontSize: '0.83rem', color: '#6b8f88' }}>Address: {selectedPatient.address}</div>}
                </div>
                {generatedInvoice.insurance_provider && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b8f88', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Insurance Claim</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a2e2b' }}>{generatedInvoice.insurance_provider}</div>
                    <div style={{ fontSize: '0.83rem', color: '#16a34a', fontWeight: 600 }}>Covered: Rs. {fmtAmt(generatedInvoice.insurance_amount)}</div>
                  </div>
                )}
              </div>

              {/* LINE ITEMS TABLE */}
              <table className="invoice-items-table">
                <thead>
                  <tr style={{ background: '#f0faf7' }}>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>Item / Service Description</th>
                    <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem' }}>Unit Price</th>
                    <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedInvoice.items.map((item, index) => (
                    <tr key={index} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fdfb' }}>
                      <td style={{ padding: '0.6rem 0.75rem', color: '#6b8f88', fontSize: '0.82rem' }}>{index + 1}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{item.name}</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{item.qty}</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: '0.72rem', color: '#6b8f88' }}>Rs. </span>{fmtAmt(item.price)}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: '0.72rem', color: '#6b8f88' }}>Rs. </span>{fmtAmt(item.qty * item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTALS SECTION */}
              <div className="invoice-summary">
                <div className="invoice-summary-box" style={{ width: '260px' }}>
                  <div className="summary-row">
                    <span style={{ color: '#6b8f88' }}>Subtotal:</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontSize: '0.72rem', color: '#6b8f88' }}>Rs. </span>
                      {fmtAmt(generatedInvoice.total_amount / (1 + (taxRate / 100)))}
                    </span>
                  </div>
                  {taxRate > 0 && (
                    <div className="summary-row">
                      <span style={{ color: '#6b8f88' }}>Tax ({taxRate}%):</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: '0.72rem', color: '#6b8f88' }}>Rs. </span>
                        {fmtAmt(generatedInvoice.total_amount - (generatedInvoice.total_amount / (1 + (taxRate / 100))))}
                      </span>
                    </div>
                  )}
                  {generatedInvoice.insurance_amount > 0 && (
                    <div className="summary-row" style={{ color: '#16a34a', fontWeight: 600 }}>
                      <span>Insurance ({generatedInvoice.insurance_provider}):</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        &minus;<span style={{ fontSize: '0.72rem' }}>Rs. </span>
                        {fmtAmt(generatedInvoice.insurance_amount)}
                      </span>
                    </div>
                  )}
                  <div className="summary-row total" style={{ background: '#f0faf7', padding: '0.6rem 0.75rem', borderRadius: '6px', marginTop: '0.25rem' }}>
                    <span>{generatedInvoice.insurance_amount > 0 ? 'Patient Copay:' : 'Grand Total:'}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontSize: '0.8rem' }}>Rs. </span>
                      {fmtAmt(generatedInvoice.insurance_amount > 0 ? generatedInvoice.copay_amount : generatedInvoice.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* PAYMENT STAMP + FOOTER */}
              <div style={{
                borderTop: '2px dashed #c6e8df', marginTop: '1.75rem', paddingTop: '1.5rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem'
              }}>
                {/* Left: stamp + method */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {generatedInvoice.payment_status === 'paid' ? (
                    <div className="paid-stamp">PAID</div>
                  ) : (
                    <div className="unpaid-stamp">UNPAID</div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#6b8f88' }}>
                    {generatedInvoice.payment_status === 'paid' ? (
                      <>Settled via <strong style={{ color: '#1a2e2b' }}>{generatedInvoice.payment_method.toUpperCase()}</strong>
                        {generatedInvoice.payment_method_split && (
                          <div style={{ marginTop: '0.2rem' }}>({generatedInvoice.payment_method_split.replace(/,/g, ', ')})</div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>Payment Due</span>
                    )}
                    {generatedInvoice.insurance_provider && (
                      <div style={{ marginTop: '0.2rem', color: '#0e7490', fontWeight: 600 }}>
                        Claim: {generatedInvoice.insurance_provider}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: footer note */}
                <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#6b8f88' }}>
                  <div style={{ fontWeight: 700, color: '#2d6a60', marginBottom: '0.2rem' }}>{clinic.name}</div>
                  <div>{clinic.address}, {clinic.city}, {clinic.country}</div>
                  <div>Tel: {clinic.phone} &nbsp;|&nbsp; {clinic.email}</div>
                  <div style={{ marginTop: '0.4rem', fontStyle: 'italic' }}>{clinic.footer_note}</div>
                </div>
              </div>

              {/* BOTTOM DISCLAIMER */}
              <div style={{
                marginTop: '1.25rem', padding: '0.6rem 0.75rem',
                background: '#f9fdfb', borderRadius: '6px',
                fontSize: '0.72rem', color: '#9ab5af', textAlign: 'center', border: '1px solid #e8f5f2'
              }}>
                {clinic.disclaimer}
              </div>
            </div>
            {/* ── END INVOICE PRINT AREA ───────────────────────────────────── */}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setShowReceipt(false)} className="btn btn-secondary">
                Close
              </button>
              <button onClick={handlePrint} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAY NOW MODAL ─────────────────────────────────────────────── */}
      {payNowBill && (
        <div className="modal-overlay" onClick={() => setPayNowBill(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <button onClick={() => setPayNowBill(null)} className="close-modal">&times;</button>
            <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>💳 Settle Outstanding Bill</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Invoice <strong>{payNowBill.id}</strong> is currently <span style={{ color: 'var(--danger)', fontWeight: 700 }}>UNPAID</span>.
              Select a payment method to settle it now.
            </p>

            <div style={{ background: 'var(--light)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Patient:</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{getPatientName(payNowBill.patient_id)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Invoice Date:</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{payNowBill.billing_date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Amount Due:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '1.1rem' }}>
                  Rs. {(payNowBill.copay_amount > 0 ? payNowBill.copay_amount : payNowBill.total_amount).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Payment Method</label>
              <select
                value={payNowMethod}
                onChange={(e) => setPayNowMethod(e.target.value)}
                className="form-select"
              >
                <option value="cash">💵 Cash Payment</option>
                <option value="card">💳 Card / POS Terminal</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setPayNowBill(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={handlePayNow}
                className="btn btn-success"
                style={{ flex: 2 }}
                disabled={payNowLoading}
              >
                {payNowLoading ? 'Processing...' : `✅ Confirm Payment (${payNowMethod.toUpperCase()})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
