const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper function to generate unique IDs
function generateId(prefix) {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${num}`;
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

    // Trigger simulated booking alert SMS
    try {
      const patient = await db.getPatientById(patient_id);
      const contactPhone = patient ? patient.contact : '';
      if (contactPhone) {
        const commMsg = `Dear ${patient.name}, your appointment with ${newAppt.doctor_name} is scheduled on ${appointment_date} (${time_slot}). Your Queue Token is #${savedAppt.token_number}.`;
        const newComm = {
          id: generateId('COM'),
          patient_id,
          phone: contactPhone,
          type: 'SMS',
          message: commMsg,
          status: 'Delivered',
          sent_date: new Date().toISOString().replace('T', ' ').substr(0, 19)
        };
        await db.createCommunicationLog(newComm);
        console.log(`[SIMULATED SMS SENT TO ${contactPhone}]: "${commMsg}"`);
      }
    } catch (e) {
      console.warn("Booking simulated alert failed:", e.message);
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
          const commMsg = `Dear ${patient.name}, you have checked in successfully. Your current token queue number is #${updatedAppt.token_number}. Please wait for your turn.`;
          const newComm = {
            id: generateId('COM'),
            patient_id: updatedAppt.patient_id,
            phone: contactPhone,
            type: 'WhatsApp',
            message: commMsg,
            status: 'Sent',
            sent_date: new Date().toISOString().replace('T', ' ').substr(0, 19)
          };
          await db.createCommunicationLog(newComm);
          console.log(`[SIMULATED WHATSAPP SENT TO ${contactPhone}]: "${commMsg}"`);
        }
      } catch (e) {
        console.warn("Queue checkin simulated alert failed:", e.message);
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
      status: 'paid'
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

    // Trigger simulated invoice billing notification
    try {
      const patient = await db.getPatientById(patient_id);
      const contactPhone = patient ? patient.contact : '';
      if (contactPhone) {
        const commMsg = `Dear ${patient.name}, invoice ${newBill.id} for Rs. ${newBill.total_amount.toFixed(2)} has been generated. Payment Status: ${newBill.payment_status.toUpperCase()}. Thank you!`;
        const newComm = {
          id: generateId('COM'),
          patient_id,
          phone: contactPhone,
          type: 'SMS',
          message: commMsg,
          status: 'Delivered',
          sent_date: new Date().toISOString().replace('T', ' ').substr(0, 19)
        };
        await db.createCommunicationLog(newComm);
        console.log(`[SIMULATED SMS SENT TO ${contactPhone}]: "${commMsg}"`);
      }
    } catch (commErr) {
      console.warn("Simulated communication log failed:", commErr.message);
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

// Start Server
app.listen(PORT, () => {
  console.log(`Clinic Backend running on port ${PORT}`);
});
