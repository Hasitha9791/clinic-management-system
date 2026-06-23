const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files from the React frontend build folder
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Helper function to generate unique IDs
function generateId(prefix) {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${num}`;
}

// WhatsApp Web Client Initialization
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT === '7860';
const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH || null;

const wwebClient = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '.wwebjs_auth')
  }),
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  puppeteer: {
    headless: isProduction ? true : false,
    executablePath: puppeteerExecutablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  }
});

const QRCode = require('qrcode');

let isWwebReady = false;
let qrText = null;

wwebClient.on('qr', (qr) => {
  isWwebReady = false;
  qrText = qr;

  console.log('\n--- WHATSAPP SCAN REQUIREMENT ---');
  console.log('Please scan the QR code below using your WhatsApp Linked Devices:');
  qrcode.generate(qr, { small: true });
  console.log('----------------------------------\n');

  // Generate PNG files of the QR code for easier scanning
  const qrPublicPath = path.join(__dirname, 'frontend/public/qr.png');
  const qrRootPath = path.join(__dirname, 'qr.png');
  const qrArtifactPath = 'C:/Users/Hasitha/.gemini/antigravity/brain/6e726681-e8f5-47c4-ba11-6ceaf568492f/qr.png';

  QRCode.toFile(qrPublicPath, qr, { margin: 2, scale: 8 }, (err) => {
    if (err) console.error('Error generating public/qr.png:', err.message);
  });

  QRCode.toFile(qrRootPath, qr, { margin: 2, scale: 8 }, (err) => {
    if (err) console.error('Error generating qr.png:', err.message);
  });

  QRCode.toFile(qrArtifactPath, qr, { margin: 2, scale: 8 }, (err) => {
    if (err) console.error('Error generating artifact/qr.png:', err.message);
  });
});

wwebClient.on('ready', () => {
  isWwebReady = true;
  qrText = null;
  console.log('WhatsApp Web Client is fully connected and ready!');

  // Clean up physical QR images when connected
  const qrPublicPath = path.join(__dirname, 'frontend/public/qr.png');
  const qrRootPath = path.join(__dirname, 'qr.png');
  try { if (fs.existsSync(qrPublicPath)) fs.unlinkSync(qrPublicPath); } catch (e) {}
  try { if (fs.existsSync(qrRootPath)) fs.unlinkSync(qrRootPath); } catch (e) {}
});

wwebClient.on('auth_failure', (msg) => {
  console.error('WhatsApp Web Authentication failure:', msg);
});

wwebClient.on('disconnected', (reason) => {
  isWwebReady = false;
  qrText = null;
  console.warn('WhatsApp Web Client was disconnected:', reason);
  // Attempt to re-initialize after a short delay to allow browser to exit and unlock files
  setTimeout(() => {
    try {
      console.log('Re-initializing WhatsApp Web Client...');
      wwebClient.initialize();
    } catch (err) {
      console.error('Failed to re-initialize WhatsApp client:', err.message);
    }
  }, 5000);
});

// Start the WhatsApp Client in the background
try {
  wwebClient.initialize();
} catch (err) {
  console.error('Error starting WhatsApp Web Client:', err.message);
}

// WhatsApp Web Status Endpoints
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    connected: isWwebReady,
    hasQr: !!qrText
  });
});

app.get('/api/whatsapp/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'qr.png');
  if (fs.existsSync(qrPath)) {
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(qrPath);
  } else {
    res.status(404).json({ error: 'QR Code not available. Device might already be connected.' });
  }
});

// ── ACCOUNTING NUMBER FORMATTER ─────────────────────────────────────────────
// Formats a number as Sri Lankan Rupees with comma separators and 2 decimals.
// Example: 15000 → "Rs. 15,000.00"
function fmtLKR(amount) {
  const num = parseFloat(amount) || 0;
  return 'Rs. ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── INVOICE PDF GENERATOR ────────────────────────────────────────────────────
// Generates a minimal invoice PDF in memory using Puppeteer and returns the
// base64-encoded content so it can be sent via whatsapp-web.js MessageMedia.
async function generateInvoicePDF(bill, patient) {
  const puppeteer = require('puppeteer-core');
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ||
                   (process.platform === 'linux' ? '/usr/bin/chromium' : undefined);

  const browser = await puppeteer.launch({
    executablePath: execPath || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // Build item rows
    const itemRows = (bill.items || []).map((item, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:6px 10px">${item.name}</td>
        <td style="padding:6px 10px;text-align:center">${item.qty}</td>
        <td style="padding:6px 10px;text-align:right">${fmtLKR(item.price)}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:600">${fmtLKR((parseFloat(item.price) || 0) * (parseInt(item.qty) || 1))}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #1a2e2b; font-size: 13px; }
  h1 { font-size: 22px; color: #0d9488; margin: 0 0 4px; }
  .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 20px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .meta td { padding: 2px 8px 2px 0; color: #374151; }
  .meta td:first-child { color: #6b7280; }
  table.items { width: 100%; border-collapse: collapse; margin: 16px 0; }
  table.items th { background: #0d9488; color: #fff; padding: 7px 10px; text-align: left; font-size: 12px; }
  table.items th:nth-child(2) { text-align: center; }
  table.items th:nth-child(3),table.items th:nth-child(4) { text-align: right; }
  .total-box { float: right; width: 260px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-top: 8px; }
  .total-box .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .total-box .grand { font-size: 15px; font-weight: 700; color: #0d9488; border-top: 2px solid #e5e7eb; padding-top: 6px; margin-top: 4px; }
  .badge { display:inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
           background: ${bill.payment_status === 'paid' ? '#dcfce7' : '#fee2e2'};
           color: ${bill.payment_status === 'paid' ? '#16a34a' : '#dc2626'}; }
  .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
</style></head><body>
<div class="header">
  <div>
    <h1>Clinic Invoice</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:700;color:#0d9488">${bill.id}</div>
    <div class="badge">${(bill.payment_status || 'unpaid').toUpperCase()}</div>
  </div>
</div>
<table class="meta"><tbody>
  <tr><td>Patient:</td><td><strong>${patient ? patient.name : '-'}</strong></td></tr>
  <tr><td>Contact:</td><td>${patient ? patient.contact : '-'}</td></tr>
  <tr><td>Date:</td><td>${bill.billing_date}</td></tr>
  ${bill.visit_id ? `<tr><td>Visit:</td><td>${bill.visit_id}</td></tr>` : ''}
  ${bill.payment_method && bill.payment_method !== 'none' ? `<tr><td>Payment:</td><td>${bill.payment_method}</td></tr>` : ''}
</tbody></table>
<table class="items">
  <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div class="total-box">
  <div class="row"><span>Subtotal:</span><span>${fmtLKR(bill.total_amount)}</span></div>
  ${bill.insurance_amount > 0 ? `<div class="row"><span>Insurance (${bill.insurance_provider}):</span><span>- ${fmtLKR(bill.insurance_amount)}</span></div>` : ''}
  <div class="row grand"><span>${bill.insurance_amount > 0 ? 'Patient Copay:' : 'Grand Total:'}</span>
    <span>${fmtLKR(bill.insurance_amount > 0 ? bill.copay_amount : bill.total_amount)}</span></div>
</div>
<div style="clear:both"></div>
<div class="footer">Thank you for choosing our clinic &bull; This is a computer-generated invoice</div>
</body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    return pdfBuffer.toString('base64');
  } finally {
    await browser.close();
  }
}

// Helper to send real automated WhatsApp messages
async function sendWhatsAppMessage(toPhone, bodyContent) {
  if (!toPhone) {
    console.warn('[WHATSAPP] No recipient number provided. Simulating send.');
    return { status: 'simulated', sid: null };
  }

  // Format to standard WhatsApp chat ID: country code followed by number (e.g. 94774947440)
  let formattedTo = toPhone.trim().replace(/[-\s()]/g, '');
  if (!formattedTo.startsWith('+')) {
    if (formattedTo.startsWith('0')) {
      formattedTo = '94' + formattedTo.substring(1);
    } else {
      formattedTo = '94' + formattedTo;
    }
  } else {
    formattedTo = formattedTo.substring(1); // remove '+'
  }

  const chatId = `${formattedTo}@c.us`;

  try {
    // Send the message using the wwebClient
    const msg = await wwebClient.sendMessage(chatId, bodyContent);
    console.log(`[WHATSAPP WEB SENT] Message sent to ${chatId}. Message ID: ${msg.id.id}`);
    return { status: 'sent', sid: msg.id.id };
  } catch (err) {
    console.error(`[WHATSAPP WEB ERROR] Failed to send to ${chatId}:`, err.message);
    throw err;
  }
}

// Helper to send a WhatsApp message with a PDF attachment
async function sendWhatsAppWithPDF(toPhone, bodyContent, pdfBase64, filename) {
  if (!toPhone) {
    console.warn('[WHATSAPP] No recipient number provided. Simulating send.');
    return { status: 'simulated', sid: null };
  }

  let formattedTo = toPhone.trim().replace(/[-\s()]/g, '');
  if (!formattedTo.startsWith('+')) {
    formattedTo = formattedTo.startsWith('0') ? '94' + formattedTo.substring(1) : '94' + formattedTo;
  } else {
    formattedTo = formattedTo.substring(1);
  }
  const chatId = `${formattedTo}@c.us`;

  try {
    // Send text message first
    await wwebClient.sendMessage(chatId, bodyContent);

    // Then send PDF as a document attachment
    const media = new MessageMedia('application/pdf', pdfBase64, filename || 'invoice.pdf');
    const msg = await wwebClient.sendMessage(chatId, media, { sendMediaAsDocument: true });
    console.log(`[WHATSAPP WEB SENT] Invoice PDF sent to ${chatId}. Message ID: ${msg.id.id}`);
    return { status: 'sent', sid: msg.id.id };
  } catch (err) {
    console.error(`[WHATSAPP WEB ERROR] Failed to send PDF to ${chatId}:`, err.message);
    throw err;
  }
}


// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: db.dbType });
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.getUser(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const hashedInput = db.hashPassword(password);
    if (hashedInput !== user.password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Success - return user info (omit password)
    res.json({
      username: user.username,
      role: user.role,
      allowed_tabs: user.allowed_tabs
    });
  } catch (error) {
    console.error('Error in login API:', error);
    res.status(500).json({ error: 'Authentication service error' });
  }
});

// Get Dashboard Summary
app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const summary = await db.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to generate dashboard summary' });
  }
});

// ==========================================
// CLINIC PROFILE ENDPOINTS
// ==========================================

app.get('/api/clinic-profile', async (req, res) => {
  try {
    const profile = await db.getClinicProfile();
    res.json(profile);
  } catch (error) {
    console.error('Error fetching clinic profile:', error);
    res.status(500).json({ error: 'Failed to fetch clinic profile' });
  }
});

app.put('/api/clinic-profile', async (req, res) => {
  try {
    const { clinic_name, tagline, address, city, country, phone, email, website, reg_number, footer_note, disclaimer, logo, consultation_fee } = req.body;
    if (!clinic_name || !phone) {
      return res.status(400).json({ error: 'Clinic name and phone number are required' });
    }
    const updated = await db.updateClinicProfile({ clinic_name, tagline, address, city, country, phone, email, website, reg_number, footer_note, disclaimer, logo, consultation_fee });
    res.json(updated);
  } catch (error) {
    console.error('Error updating clinic profile:', error);
    res.status(500).json({ error: 'Failed to update clinic profile' });
  }
});

// ==========================================
// PATIENTS ENDPOINTS
// ==========================================

app.get('/api/patients', async (req, res) => {
  try {
    const patients = await db.getPatients();
    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

app.get('/api/patients/:id', async (req, res) => {
  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { name, age, gender, contact, address, medical_history } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Patient name is required' });
    }

    const newPatient = {
      id: generateId('PAT'),
      name,
      age: age ? parseInt(age) : null,
      gender: gender || 'Other',
      contact: contact || '',
      address: address || '',
      onboarding_date: new Date().toISOString().split('T')[0],
      medical_history: medical_history || ''
    };

    const savedPatient = await db.createPatient(newPatient);
    res.status(201).json(savedPatient);
  } catch (error) {
    console.error('Error onboarding patient:', error);
    res.status(500).json({ error: 'Failed to onboard patient' });
  }
});

// ==========================================
// APPOINTMENTS & QUEUE ENDPOINTS
// ==========================================

// Get appointments for a date
app.get('/api/appointments', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const appts = await db.getAppointments(date);
    res.json(appts);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Create appointment (Queue Token)
app.post('/api/appointments', async (req, res) => {
  try {
    const { patient_id, doctor_name, appointment_date, time_slot } = req.body;
    if (!patient_id || !appointment_date) {
      return res.status(400).json({ error: 'patient_id and appointment_date are required' });
    }

    const newAppt = {
      id: generateId('APT'),
      patient_id,
      doctor_name: doctor_name || 'General Doctor',
      appointment_date,
      time_slot: time_slot || 'General Hours',
      status: 'Scheduled'
    };

    const savedAppt = await db.createAppointment(newAppt);

    // Trigger booking alert WhatsApp
    try {
      const patient = await db.getPatientById(patient_id);
      const contactPhone = patient ? patient.contact : '';
      if (contactPhone) {
        const commMsg = `Dear ${patient.name},\n\nYour appointment has been confirmed:\n\n🏥 *Doctor:* ${newAppt.doctor_name}\n📅 *Date:* ${appointment_date}\n⏰ *Time:* ${time_slot}\n🔢 *Queue Token:* #${savedAppt.token_number}\n\nPlease arrive 10 minutes early. Thank you!`;
        
        let sendStatus = 'Sent';
        try {
          const result = await sendWhatsAppMessage(contactPhone, commMsg);
          if (result.status === 'simulated') sendStatus = 'Sent';
        } catch (err) {
          sendStatus = 'Failed';
        }

        const newComm = {
          id: generateId('COM'),
          patient_id,
          phone: contactPhone,
          type: 'WhatsApp',
          message: commMsg,
          status: sendStatus,
          sent_date: new Date().toISOString().replace('T', ' ').substr(0, 19)
        };
        await db.createCommunicationLog(newComm);
      }
    } catch (e) {
      console.warn("Booking alert failed:", e.message);
    }

    res.status(201).json(savedAppt);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Update appointment status (Check-in, Complete, etc.)
app.put('/api/appointments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedAppt = await db.updateAppointmentStatus(req.params.id, status);

    // Send queue check-in alert
    if (status === 'Checked-in') {
      try {
        const patient = await db.getPatientById(updatedAppt.patient_id);
        const contactPhone = patient ? patient.contact : '';
        if (contactPhone) {
          const commMsg = `Dear ${patient.name},\n\n✅ *Check-in Confirmed!*\n\nYour queue token number is *#${updatedAppt.token_number}*. Please wait comfortably — we will call your number shortly.\n\nThank you for your patience! 🙏`;
          
          let sendStatus = 'Sent';
          try {
            const result = await sendWhatsAppMessage(contactPhone, commMsg);
            if (result.status === 'simulated') sendStatus = 'Sent';
          } catch (err) {
            sendStatus = 'Failed';
          }

          const newComm = {
            id: generateId('COM'),
            patient_id: updatedAppt.patient_id,
            phone: contactPhone,
            type: 'WhatsApp',
            message: commMsg,
            status: sendStatus,
            sent_date: new Date().toISOString().replace('T', ' ').substr(0, 19)
          };
          await db.createCommunicationLog(newComm);
        }
      } catch (e) {
        console.warn("Queue checkin alert failed:", e.message);
      }
    }

    res.json(updatedAppt);
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// ==========================================
// VISITS & DIAGNOSIS ENDPOINTS (EMR)
// ==========================================

app.get('/api/visits', async (req, res) => {
  try {
    const { patientId } = req.query;
    const visits = await db.getVisits(patientId);
    res.json(visits);
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

app.post('/api/visits', async (req, res) => {
  try {
    const { patient_id, symptoms, diagnosis, treatment, doctor_notes, bp, pulse, temp, weight, spo2 } = req.body;
    if (!patient_id) {
      return res.status(400).json({ error: 'patient_id is required' });
    }

    const newVisit = {
      id: generateId('VST'),
      patient_id,
      visit_date: new Date().toISOString().split('T')[0],
      symptoms: symptoms || '',
      diagnosis: diagnosis || '',
      treatment: treatment || '',
      doctor_notes: doctor_notes || '',
      bp: bp || '',
      pulse: pulse ? parseInt(pulse) : null,
      temp: temp ? parseFloat(temp) : null,
      weight: weight ? parseFloat(weight) : null,
      spo2: spo2 ? parseInt(spo2) : null
    };

    const savedVisit = await db.createVisit(newVisit);
    res.status(201).json(savedVisit);
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Failed to record visit/diagnosis' });
  }
});

// ==========================================
// INVENTORY & BATCH ENDPOINTS
// ==========================================

app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await db.getInventory();
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { name, type, qty, min_qty, unit, price, cost_price, barcode } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Item name and type are required' });
    }
    if (type !== 'drug' && type !== 'equipment') {
      return res.status(400).json({ error: "Type must be either 'drug' or 'equipment'" });
    }

    const newItem = {
      id: 'inv_' + Math.random().toString(36).substr(2, 9),
      name,
      type,
      qty: qty ? parseInt(qty) : 0,
      min_qty: min_qty ? parseInt(min_qty) : 0,
      unit: unit || 'pieces',
      price: price ? parseFloat(price) : 0.0,
      cost_price: cost_price ? parseFloat(cost_price) : 0.0,
      barcode: barcode || null
    };

    const savedItem = await db.addInventoryItem(newItem);
    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error adding inventory item:', error);
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

app.put('/api/inventory/:id/stock', async (req, res) => {
  try {
    const { qtyChange } = req.body;
    if (qtyChange === undefined || isNaN(qtyChange)) {
      return res.status(400).json({ error: 'Valid qtyChange value is required' });
    }

    const updatedItem = await db.updateInventoryStock(req.params.id, parseInt(qtyChange));
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating stock level:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

app.put('/api/inventory/:id/price', async (req, res) => {
  try {
    const { price } = req.body;
    if (price === undefined || isNaN(price) || parseFloat(price) < 0) {
      return res.status(400).json({ error: 'Valid positive price value is required' });
    }

    const updatedItem = await db.updateInventoryPrice(req.params.id, parseFloat(price));
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item price:', error);
    res.status(500).json({ error: 'Failed to update item price' });
  }
});

// Get batches for an inventory item
app.get('/api/inventory/:id/batches', async (req, res) => {
  try {
    const batches = await db.getInventoryBatches(req.params.id);
    res.json(batches);
  } catch (error) {
    console.error('Error fetching inventory batches:', error);
    res.status(500).json({ error: 'Failed to fetch item batches' });
  }
});

// Add stock batch
app.post('/api/inventory/batches', async (req, res) => {
  try {
    const { item_id, batch_number, qty, expiry_date, cost_price } = req.body;
    if (!item_id || !batch_number || !qty || !expiry_date) {
      return res.status(400).json({ error: 'item_id, batch_number, qty, and expiry_date are required' });
    }

    const newBatch = {
      id: 'bat_' + Math.random().toString(36).substr(2, 9),
      item_id,
      batch_number,
      qty: parseInt(qty),
      expiry_date,
      cost_price: cost_price ? parseFloat(cost_price) : 0.0
    };

    const savedBatch = await db.addInventoryBatch(newBatch);
    res.status(201).json(savedBatch);
  } catch (error) {
    console.error('Error adding stock batch:', error);
    res.status(500).json({ error: 'Failed to record stock batch' });
  }
});

// ==========================================
// BILLING / POS ENDPOINTS
// ==========================================

app.get('/api/billing', async (req, res) => {
  try {
    const billing = await db.getBilling();
    res.json(billing);
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: 'Failed to fetch billing records' });
  }
});

app.post('/api/billing', async (req, res) => {
  try {
    const { patient_id, visit_id, items, total_amount, payment_status, payment_method, insurance_provider, insurance_amount, copay_amount, payment_method_split } = req.body;
    if (!patient_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Patient ID and at least one item are required' });
    }

    // ── DUPLICATE PAYMENT GUARD ──────────────────────────────────────────────
    // If this invoice is being submitted as "paid", check whether there is
    // already an active (non-voided) PAID bill for the same visit.
    if (payment_status === 'paid' && visit_id) {
      try {
        const allBills = await db.getBilling();
        const existingPaid = allBills.find(
          b => b.visit_id === visit_id && b.payment_status === 'paid' && b.status !== 'voided'
        );
        if (existingPaid) {
          return res.status(409).json({
            error: `This visit already has a paid invoice (${existingPaid.id}). Void the existing invoice first, or use "Pay Now" on an existing unpaid bill.`
          });
        }
      } catch (checkErr) {
        console.warn('Could not perform duplicate payment check:', checkErr.message);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const newBill = {
      id: generateId('INV'),
      patient_id,
      visit_id: visit_id || null,
      items, // array of {id, name, qty, price}
      total_amount: parseFloat(total_amount),
      payment_status: payment_status || 'unpaid',
      payment_method: payment_method || 'none',
      billing_date: new Date().toISOString().split('T')[0],
      insurance_provider: insurance_provider || null,
      insurance_amount: insurance_amount ? parseFloat(insurance_amount) : 0.0,
      copay_amount: copay_amount ? parseFloat(copay_amount) : 0.0,
      payment_method_split: payment_method_split || null,
      status: 'paid'   // Supabase constraint: 'paid' | 'voided'. payment_status tracks paid/unpaid separately.
    };

    // Save billing record
    const savedBill = await db.createBilling(newBill);

    // Deduct quantities from inventory for any items that have an inventory ID
    for (const item of items) {
      if (item.id && item.id.startsWith('inv_')) {
        try {
          await db.updateInventoryStock(item.id, -parseInt(item.qty));
          await db.deductStockFromBatches(item.id, parseInt(item.qty));
        } catch (stockErr) {
          console.warn(`Could not deduct stock for item ${item.id}:`, stockErr.message);
        }
      }
    }

    // Trigger WhatsApp invoice billing notification (with PDF attachment)
    try {
      const patient = await db.getPatientById(patient_id);
      const contactPhone = patient ? patient.contact : '';
      if (contactPhone) {
        const itemSummary = (newBill.items || []).map(i =>
          `  • ${i.name} x${i.qty}  —  ${fmtLKR((parseFloat(i.price) || 0) * (parseInt(i.qty) || 1))}`
        ).join('\n');

        const commMsg =
`Dear ${patient.name},

🧾 *Invoice Generated*

*Invoice No:* ${newBill.id}
*Date:* ${newBill.billing_date}
*Status:* ${newBill.payment_status.toUpperCase()}

*Items:*
${itemSummary}

━━━━━━━━━━━━━━━━
${newBill.insurance_amount > 0 ? `Subtotal: ${fmtLKR(newBill.total_amount)}
Insurance (${newBill.insurance_provider}): - ${fmtLKR(newBill.insurance_amount)}
*Patient Copay: ${fmtLKR(newBill.copay_amount)}*` : `*Total Amount: ${fmtLKR(newBill.total_amount)}*`}
${newBill.payment_method && newBill.payment_method !== 'none' ? `Payment: ${newBill.payment_method}` : ''}

Thank you for choosing our clinic! 🏥`;

        let sendStatus = 'Sent';
        try {
          // Try to generate and attach PDF invoice
          let pdfBase64 = null;
          try {
            pdfBase64 = await generateInvoicePDF(newBill, patient);
          } catch (pdfErr) {
            console.warn('[INVOICE PDF] Could not generate PDF, sending text only:', pdfErr.message);
          }

          let result;
          if (pdfBase64) {
            result = await sendWhatsAppWithPDF(contactPhone, commMsg, pdfBase64, `Invoice-${newBill.id}.pdf`);
          } else {
            result = await sendWhatsAppMessage(contactPhone, commMsg);
          }
          if (result.status === 'simulated') sendStatus = 'Sent';
        } catch (err) {
          sendStatus = 'Failed';
        }

        const newComm = {
          id: generateId('COM'),
          patient_id,
          phone: contactPhone,
          type: 'WhatsApp',
          message: commMsg,
          status: sendStatus,
          sent_date: new Date().toISOString().replace('T', ' ').substr(0, 19)
        };
        await db.createCommunicationLog(newComm);
      }
    } catch (commErr) {
      console.warn("Communication log failed:", commErr.message);
    }

    res.status(201).json(savedBill);
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ error: 'Failed to generate bill' });
  }
});

// Void billing record and restore quantities
app.put('/api/billing/:id/void', async (req, res) => {
  try {
    const result = await db.voidBilling(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error voiding bill:', error);
    res.status(500).json({ error: error.message || 'Failed to void bill' });
  }
});

// Settle an existing UNPAID bill — prevents re-payment of already-paid invoices
app.put('/api/billing/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, payment_method_split } = req.body;

    // Fetch the bill first
    const bill = await db.getBillingById(id);

    // Guard: already paid?
    if (bill.payment_status === 'paid') {
      return res.status(409).json({
        error: `Invoice ${id} is already marked as PAID. Duplicate payment blocked.`
      });
    }

    // Guard: voided?
    if (bill.status === 'voided') {
      return res.status(409).json({
        error: `Invoice ${id} has been voided and cannot be paid.`
      });
    }

    const updated = await db.updateBillingPayment(id, payment_method || 'cash', payment_method_split || null);
    res.json(updated);
  } catch (error) {
    console.error('Error settling bill:', error);
    res.status(500).json({ error: error.message || 'Failed to process payment' });
  }
});


// ==========================================
// COMMUNICATIONS LOG ENDPOINTS
// ==========================================

app.get('/api/communications', async (req, res) => {
  try {
    const logs = await db.getCommunicationsLog(req.query.patientId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching communications log:', error);
    res.status(500).json({ error: 'Failed to fetch communication logs' });
  }
});

// ==========================================
// USER MANAGEMENT ENDPOINTS
// ==========================================

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users list' });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, allowed_tabs } = req.body;
    if (!username || !password || !role || !allowed_tabs) {
      return res.status(400).json({ error: 'All fields (username, password, role, allowed_tabs) are required' });
    }

    const existingUser = await db.getUser(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = {
      username,
      password: db.hashPassword(password),
      role,
      allowed_tabs
    };

    const savedUser = await db.createUser(newUser);
    res.status(201).json({
      username: savedUser.username,
      role: savedUser.role,
      allowed_tabs: savedUser.allowed_tabs
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create system user' });
  }
});

// Update user
app.put('/api/users/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const { password, role, allowed_tabs } = req.body;
    if (!role || !allowed_tabs || !Array.isArray(allowed_tabs) || allowed_tabs.length === 0) {
      return res.status(400).json({ error: 'Role and at least one allowed tab are required' });
    }

    const existingUser = await db.getUser(username);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = {
      role,
      allowed_tabs
    };

    if (password && password.trim() !== '') {
      userData.password = db.hashPassword(password);
    }

    const updatedUser = await db.updateUser(username, userData);
    res.json({
      username: updatedUser.username,
      role: updatedUser.role,
      allowed_tabs: updatedUser.allowed_tabs
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update system user' });
  }
});

// Delete user
app.delete('/api/users/:username', async (req, res) => {
  try {
    const username = req.params.username;
    if (username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete master admin user' });
    }
    await db.deleteUser(username);
    res.json({ message: `User ${username} deleted successfully` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==========================================
// DOCTORS & SPECIALISTS ENDPOINTS
// ==========================================

// Get all doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await db.getDoctors();
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors list' });
  }
});

// Create doctor
app.post('/api/doctors', async (req, res) => {
  try {
    const { name, specialty, contact } = req.body;
    if (!name || !specialty) {
      return res.status(400).json({ error: 'Doctor name and specialty are required' });
    }

    const newDoctor = {
      id: generateId('DOC'),
      name,
      specialty,
      contact: contact || '',
      status: 'Active'
    };

    const savedDoctor = await db.createDoctor(newDoctor);
    res.status(201).json(savedDoctor);
  } catch (error) {
    console.error('Error creating doctor:', error);
    if (error && error.code === 'PGRST205') {
      return res.status(400).json({ error: "The 'doctors' table does not exist in your Supabase database. Please create it using the SQL Editor on your Supabase dashboard." });
    }
    res.status(500).json({ error: 'Failed to add doctor to registry' });
  }
});

// Delete doctor
app.delete('/api/doctors/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await db.deleteDoctor(id);
    res.json({ message: `Doctor with ID ${id} deleted successfully` });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    if (error && error.code === 'PGRST205') {
      return res.status(400).json({ error: "The 'doctors' table does not exist in your Supabase database. Please create it using the SQL Editor on your Supabase dashboard." });
    }
    res.status(500).json({ error: 'Failed to delete doctor' });
  }
});

// Catch-all route to serve the React index.html for any frontend routes
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Clinic Backend running on port ${PORT}`);
});
