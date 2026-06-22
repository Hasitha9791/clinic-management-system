let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  console.warn('Warning: sqlite3 module failed to load. Local SQLite fallback will be unavailable:', err.message);
}

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let dbType = 'sqlite';
let supabase = null;
let sqliteDb = null;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  dbType = 'supabase';
  console.log('Connected to Supabase database.');
} else {
  if (!sqlite3) {
    console.error('CRITICAL ERROR: No Supabase credentials found, and sqlite3 module is unavailable.');
    process.exit(1);
  }
  console.log('No Supabase credentials found. Falling back to local SQLite database.');
  const dbPath = path.join(__dirname, 'clinic.db');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log('Connected to local SQLite database.');
      initSQLiteSchema();
    }
  });
}

function initSQLiteSchema() {
  sqliteDb.serialize(() => {
    // Users table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'doctor', 'receptionist', 'cashier', 'custom')),
        allowed_tabs TEXT
      )
    `);

    // Run migration check for allowed_tabs column on users
    sqliteDb.run("ALTER TABLE users ADD COLUMN allowed_tabs TEXT", (err) => {});

    // Seed default users if empty
    sqliteDb.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
      if (!err && row.count === 0) {
        const defaultUsers = [
          ['admin', hashPassword('admin123'), 'admin', JSON.stringify(["dashboard", "onboarding", "appointments", "consultations", "billing", "inventory", "communications", "users"])],
          ['doctor', hashPassword('doctor123'), 'doctor', JSON.stringify(["dashboard", "onboarding", "consultations", "communications"])],
          ['receptionist', hashPassword('receptionist123'), 'receptionist', JSON.stringify(["dashboard", "onboarding", "appointments", "communications"])],
          ['cashier', hashPassword('cashier123'), 'cashier', JSON.stringify(["dashboard", "billing", "inventory", "communications"])]
        ];
        const stmt = sqliteDb.prepare("INSERT INTO users (username, password, role, allowed_tabs) VALUES (?, ?, ?, ?)");
        defaultUsers.forEach(u => stmt.run(u));
        stmt.finalize();
        console.log('Seeded default users with roles.');
      }
    });

    // Patients table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        contact TEXT,
        address TEXT,
        onboarding_date TEXT,
        medical_history TEXT
      )
    `);

    // Visits table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS visits (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        visit_date TEXT,
        symptoms TEXT,
        diagnosis TEXT,
        treatment TEXT,
        doctor_notes TEXT,
        bp TEXT,
        pulse INTEGER,
        temp REAL,
        weight REAL,
        spo2 INTEGER,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )
    `);
    
    // Migrations to add vitals columns if visits table was already created
    sqliteDb.run("ALTER TABLE visits ADD COLUMN bp TEXT", (err) => {});
    sqliteDb.run("ALTER TABLE visits ADD COLUMN pulse INTEGER", (err) => {});
    sqliteDb.run("ALTER TABLE visits ADD COLUMN temp REAL", (err) => {});
    sqliteDb.run("ALTER TABLE visits ADD COLUMN weight REAL", (err) => {});
    sqliteDb.run("ALTER TABLE visits ADD COLUMN spo2 INTEGER", (err) => {});

    // Appointments table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        doctor_name TEXT,
        appointment_date TEXT,
        time_slot TEXT,
        token_number INTEGER,
        status TEXT CHECK(status IN ('Scheduled', 'Checked-in', 'In Consultation', 'Completed', 'Cancelled')),
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )
    `);

    // Inventory table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('drug', 'equipment')),
        qty INTEGER DEFAULT 0,
        min_qty INTEGER DEFAULT 0,
        unit TEXT,
        price REAL DEFAULT 0.0,
        cost_price REAL DEFAULT 0.0,
        barcode TEXT
      )
    `);
    sqliteDb.run("ALTER TABLE inventory ADD COLUMN barcode TEXT", (err) => {});

    // Inventory Batches table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
        id TEXT PRIMARY KEY,
        item_id TEXT,
        batch_number TEXT NOT NULL,
        qty INTEGER DEFAULT 0,
        expiry_date TEXT, -- YYYY-MM-DD
        cost_price REAL DEFAULT 0.0,
        FOREIGN KEY(item_id) REFERENCES inventory(id)
      )
    `);

    // Billing table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS billing (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        visit_id TEXT,
        items TEXT, -- JSON string of items
        total_amount REAL,
        payment_status TEXT CHECK(payment_status IN ('paid', 'unpaid')),
        payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'none')),
        billing_date TEXT,
        insurance_provider TEXT,
        insurance_amount REAL DEFAULT 0.0,
        copay_amount REAL DEFAULT 0.0,
        payment_method_split TEXT,
        status TEXT DEFAULT 'paid' CHECK(status IN ('paid', 'unpaid', 'voided')),
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(visit_id) REFERENCES visits(id)
      )
    `);
    
    // Migrations to add billing columns
    sqliteDb.run("ALTER TABLE billing ADD COLUMN insurance_provider TEXT", (err) => {});
    sqliteDb.run("ALTER TABLE billing ADD COLUMN insurance_amount REAL DEFAULT 0.0", (err) => {});
    sqliteDb.run("ALTER TABLE billing ADD COLUMN copay_amount REAL DEFAULT 0.0", (err) => {});
    sqliteDb.run("ALTER TABLE billing ADD COLUMN payment_method_split TEXT", (err) => {});
    sqliteDb.run("ALTER TABLE billing ADD COLUMN status TEXT DEFAULT 'paid'", (err) => {});

    // Communications Log table
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS communications_log (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        phone TEXT,
        type TEXT CHECK(type IN ('SMS', 'WhatsApp')),
        message TEXT,
        status TEXT,
        sent_date TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )
    `);

    // Seed inventory with initial items if empty
    sqliteDb.get("SELECT COUNT(*) as count FROM inventory", [], (err, row) => {
      if (!err && row.count === 0) {
        const seedData = [
          ['Paracetamol 500mg', 'drug', 500, 50, 'tablets', 2.00, 0.80, '8901234500018'],
          ['Amoxicillin 250mg', 'drug', 200, 30, 'capsules', 15.00, 6.00, '8901234500025'],
          ['Ibuprofen 400mg', 'drug', 300, 40, 'tablets', 4.00, 1.50, '8901234500032'],
          ['Cetirizine 10mg', 'drug', 150, 20, 'tablets', 3.00, 1.00, '8901234500049'],
          ['Disposable Syringes 5ml', 'equipment', 100, 20, 'pieces', 25.00, 10.00, '8901234500056'],
          ['Sterile Gauze Pads', 'equipment', 80, 15, 'packs', 50.00, 20.00, '8901234500063'],
          ['Digital Thermometer', 'equipment', 5, 2, 'pieces', 850.00, 450.00, '8901234500070'],
          ['Blood Pressure Monitor', 'equipment', 3, 1, 'pieces', 4500.00, 2500.00, '8901234500087']
        ];
        const stmt = sqliteDb.prepare("INSERT INTO inventory (id, name, type, qty, min_qty, unit, price, cost_price, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        seedData.forEach((item, index) => {
          const id = 'inv_' + (index + 1);
          stmt.run([id, ...item]);
        });
        stmt.finalize();
        console.log('Seeded initial inventory items.');

        // Seed initial batches for drugs
        const seedBatches = [
          ['bat_1', 'inv_1', 'BAT-206', 300, '2027-12-31', 0.80],
          ['bat_2', 'inv_1', 'BAT-304', 200, '2028-06-30', 0.80],
          ['bat_3', 'inv_2', 'BAT-502', 200, '2026-11-30', 6.00],
          ['bat_4', 'inv_3', 'BAT-711', 300, '2027-04-15', 1.50],
          ['bat_5', 'inv_4', 'BAT-908', 150, '2028-01-10', 1.00]
        ];
        const batchStmt = sqliteDb.prepare("INSERT INTO inventory_batches (id, item_id, batch_number, qty, expiry_date, cost_price) VALUES (?, ?, ?, ?, ?, ?)");
        seedBatches.forEach(b => batchStmt.run(b));
        batchStmt.finalize();
        console.log('Seeded initial inventory batches.');
      }
    });
  });
}

const dbHelpers = {
  dbType,
  hashPassword,

  // Users Auth
  getUser: (username) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('users').select('*').eq('username', username).single()
          .then(({ data, error }) => {
            if (error) resolve(null);
            else resolve(data);
          });
      } else {
        sqliteDb.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
          if (err) reject(err);
          else if (row) {
            resolve({
              ...row,
              allowed_tabs: JSON.parse(row.allowed_tabs || '[]')
            });
          } else {
            resolve(null);
          }
        });
      }
    });
  },

  getUsers: () => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('users').select('username, role, allowed_tabs').order('username', { ascending: true })
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.all("SELECT username, role, allowed_tabs FROM users ORDER BY username ASC", [], (err, rows) => {
          if (err) reject(err);
          else {
            const parsed = rows.map(r => ({
              ...r,
              allowed_tabs: JSON.parse(r.allowed_tabs || '[]')
            }));
            resolve(parsed);
          }
        });
      }
    });
  },

  createUser: (user) => {
    return new Promise((resolve, reject) => {
      const { username, password, role, allowed_tabs } = user;
      const allowedTabsStr = JSON.stringify(allowed_tabs);
      if (dbType === 'supabase') {
        supabase.from('users').insert([{ username, password, role, allowed_tabs: allowedTabsStr }]).select().single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.run(
          "INSERT INTO users (username, password, role, allowed_tabs) VALUES (?, ?, ?, ?)",
          [username, password, role, allowedTabsStr],
          function(err) {
            if (err) reject(err);
            else resolve(user);
          }
        );
      }
    });
  },

  deleteUser: (username) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('users').delete().eq('username', username)
          .then(({ error }) => {
            if (error) reject(error);
            else resolve(true);
          });
      } else {
        sqliteDb.run("DELETE FROM users WHERE username = ?", [username], function(err) {
          if (err) reject(err);
          else resolve(true);
        });
      }
    });
  },

  // Patients
  getPatients: () => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('patients').select('*').order('onboarding_date', { ascending: false })
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.all("SELECT * FROM patients ORDER BY onboarding_date DESC", [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }
    });
  },

  getPatientById: (id) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('patients').select('*').eq('id', id).single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.get("SELECT * FROM patients WHERE id = ?", [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }
    });
  },

  createPatient: (patient) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('patients').insert([patient]).select().single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        const { id, name, age, gender, contact, address, onboarding_date, medical_history } = patient;
        sqliteDb.run(
          "INSERT INTO patients (id, name, age, gender, contact, address, onboarding_date, medical_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [id, name, age, gender, contact, address, onboarding_date, medical_history],
          function(err) {
            if (err) reject(err);
            else resolve(patient);
          }
        );
      }
    });
  },

  // Visits (Clinical)
  getVisits: (patientId = null) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        let query = supabase.from('visits').select('*').order('visit_date', { ascending: false });
        if (patientId) query = query.eq('patient_id', patientId);
        query.then(({ data, error }) => {
          if (error) reject(error);
          else resolve(data);
        });
      } else {
        let query = "SELECT * FROM visits";
        let params = [];
        if (patientId) {
          query += " WHERE patient_id = ?";
          params.push(patientId);
        }
        query += " ORDER BY visit_date DESC";
        sqliteDb.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }
    });
  },

  createVisit: (visit) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('visits').insert([visit]).select().single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        const { id, patient_id, visit_date, symptoms, diagnosis, treatment, doctor_notes, bp, pulse, temp, weight, spo2 } = visit;
        sqliteDb.run(
          "INSERT INTO visits (id, patient_id, visit_date, symptoms, diagnosis, treatment, doctor_notes, bp, pulse, temp, weight, spo2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id, patient_id, visit_date, symptoms, diagnosis, treatment, doctor_notes, bp || null, pulse || null, temp || null, weight || null, spo2 || null],
          function(err) {
            if (err) reject(err);
            else resolve(visit);
          }
        );
      }
    });
  },

  // Appointments (Scheduling / Queue)
  getAppointments: (date) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('appointments').select('*').eq('appointment_date', date).order('token_number', { ascending: true })
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.all("SELECT * FROM appointments WHERE appointment_date = ? ORDER BY token_number ASC", [date], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }
    });
  },

  createAppointment: (appt) => {
    return new Promise((resolve, reject) => {
      const getNextToken = () => {
        return new Promise((resToken) => {
          sqliteDb.get("SELECT MAX(token_number) as maxToken FROM appointments WHERE appointment_date = ?", [appt.appointment_date], (err, row) => {
            const nextToken = (row && row.maxToken) ? row.maxToken + 1 : 1;
            resToken(nextToken);
          });
        });
      };

      if (dbType === 'supabase') {
        // Simple token computation
        supabase.from('appointments').select('token_number').eq('appointment_date', appt.appointment_date)
          .then(({ data }) => {
            const nextToken = data && data.length ? Math.max(...data.map(d => d.token_number)) + 1 : 1;
            const fullAppt = { ...appt, token_number: nextToken };
            supabase.from('appointments').insert([fullAppt]).select().single()
              .then(({ data: saved, error }) => {
                if (error) reject(error);
                else resolve(saved);
              });
          });
      } else {
        getNextToken().then((token) => {
          const fullAppt = { ...appt, token_number: token };
          const { id, patient_id, doctor_name, appointment_date, time_slot, token_number, status } = fullAppt;
          sqliteDb.run(
            "INSERT INTO appointments (id, patient_id, doctor_name, appointment_date, time_slot, token_number, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [id, patient_id, doctor_name, appointment_date, time_slot, token_number, status],
            function(err) {
              if (err) reject(err);
              else resolve(fullAppt);
            }
          );
        });
      }
    });
  },

  updateAppointmentStatus: (id, status) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('appointments').update({ status }).eq('id', id).select().single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.run("UPDATE appointments SET status = ? WHERE id = ?", [status, id], function(err) {
          if (err) reject(err);
          else {
            sqliteDb.get("SELECT * FROM appointments WHERE id = ?", [id], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          }
        });
      }
    });
  },

  // Inventory
  getInventory: () => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('inventory').select('*').order('name', { ascending: true })
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.all("SELECT * FROM inventory ORDER BY name ASC", [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }
    });
  },

  updateInventoryStock: (id, qtyChange) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('inventory').select('qty').eq('id', id).single()
          .then(({ data, error }) => {
            if (error) return reject(error);
            const newQty = (data.qty || 0) + qtyChange;
            supabase.from('inventory').update({ qty: newQty }).eq('id', id).select().single()
              .then(({ data: updatedData, error: updateErr }) => {
                if (updateErr) reject(updateErr);
                else resolve(updatedData);
              });
          });
      } else {
        sqliteDb.run(
          "UPDATE inventory SET qty = qty + ? WHERE id = ?",
          [qtyChange, id],
          function(err) {
            if (err) reject(err);
            else {
              sqliteDb.get("SELECT * FROM inventory WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            }
          }
        );
      }
    });
  },

  addInventoryItem: (item) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('inventory').insert([item]).select().single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        const { id, name, type, qty, min_qty, unit, price, cost_price, barcode } = item;
        sqliteDb.run(
          "INSERT INTO inventory (id, name, type, qty, min_qty, unit, price, cost_price, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id, name, type, qty || 0, min_qty || 0, unit, price || 0.0, cost_price || 0.0, barcode || null],
          function(err) {
            if (err) reject(err);
            else resolve(item);
          }
        );
      }
    });
  },

  // Inventory Batches
  getInventoryBatches: (itemId) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('inventory_batches').select('*').eq('item_id', itemId).order('expiry_date', { ascending: true })
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data || []);
          });
      } else {
        sqliteDb.all("SELECT * FROM inventory_batches WHERE item_id = ? ORDER BY expiry_date ASC", [itemId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      }
    });
  },

  addInventoryBatch: (batch) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('inventory_batches').insert([batch]).select().single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else {
              // Update general stock qty for inventory
              dbHelpers.updateInventoryStock(batch.item_id, batch.qty)
                .then(() => resolve(data))
                .catch(reject);
            }
          });
      } else {
        const { id, item_id, batch_number, qty, expiry_date, cost_price } = batch;
        sqliteDb.run(
          "INSERT INTO inventory_batches (id, item_id, batch_number, qty, expiry_date, cost_price) VALUES (?, ?, ?, ?, ?, ?)",
          [id, item_id, batch_number, qty, expiry_date, cost_price],
          function(err) {
            if (err) reject(err);
            else {
              dbHelpers.updateInventoryStock(item_id, qty)
                .then(() => resolve(batch))
                .catch(reject);
            }
          }
        );
      }
    });
  },

  deductStockFromBatches: (itemId, qtyToDeduct) => {
    return new Promise((resolve, reject) => {
      // FEFO Batch stock deduction helper
      dbHelpers.getInventoryBatches(itemId).then((batches) => {
        let remaining = qtyToDeduct;
        let updatePromises = [];
        
        for (const batch of batches) {
          if (remaining <= 0) break;
          if (batch.qty <= 0) continue;

          const toDeduct = Math.min(batch.qty, remaining);
          remaining -= toDeduct;

          const promise = new Promise((resUpdate, rejUpdate) => {
            sqliteDb.run("UPDATE inventory_batches SET qty = qty - ? WHERE id = ?", [toDeduct, batch.id], (err) => {
              if (err) rejUpdate(err);
              else resUpdate();
            });
          });
          updatePromises.push(promise);
        }

        Promise.all(updatePromises)
          .then(() => resolve())
          .catch(reject);
      }).catch(reject);
    });
  },

  // Billing
  getBilling: () => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('billing').select('*').order('billing_date', { ascending: false })
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        sqliteDb.all("SELECT * FROM billing ORDER BY billing_date DESC", [], (err, rows) => {
          if (err) reject(err);
          else {
            const parsed = rows.map(r => ({
              ...r,
              items: JSON.parse(r.items || '[]')
            }));
            resolve(parsed);
          }
        });
      }
    });
  },

  createBilling: (bill) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'supabase') {
        supabase.from('billing').insert([bill]).select().single()
          .then(({ data, error }) => {
            if (error) reject(error);
            else resolve(data);
          });
      } else {
        const { id, patient_id, visit_id, items, total_amount, payment_status, payment_method, billing_date, insurance_provider, insurance_amount, copay_amount, payment_method_split, status } = bill;
        const itemsStr = JSON.stringify(items);
        sqliteDb.run(
          "INSERT INTO billing (id, patient_id, visit_id, items, total_amount, payment_status, payment_method, billing_date, insurance_provider, insurance_amount, copay_amount, payment_method_split, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id, patient_id, visit_id, itemsStr, total_amount, payment_status, payment_method, billing_date, insurance_provider || null, insurance_amount || 0.0, copay_amount || 0.0, payment_method_split || null, status || 'paid'],
          function(err) {
            if (err) reject(err);
            else resolve(bill);
          }
        );
      }
    });
  },

  voidBilling: (id) => {
    return new Promise((resolve, reject) => {
      // Find billing record
      sqliteDb.get("SELECT * FROM billing WHERE id = ?", [id], (err, bill) => {
        if (err) return reject(err);
        if (!bill) return reject(new Error('Invoice not found'));
        if (bill.status === 'voided') return reject(new Error('Invoice is already voided'));

        // Parse items
        const items = JSON.parse(bill.items || '[]');

        // Set status to voided
        sqliteDb.run("UPDATE billing SET status = 'voided' WHERE id = ?", [id], async (err) => {
          if (err) return reject(err);

          // Restore stock values
          for (const item of items) {
            if (item.id && item.id.startsWith('inv_')) {
              try {
                // Restore main stock level
                await dbHelpers.updateInventoryStock(item.id, parseInt(item.qty));
                
                // Add qty back to the oldest batch
                sqliteDb.get("SELECT id FROM inventory_batches WHERE item_id = ? ORDER BY expiry_date ASC LIMIT 1", [item.id], (err, batch) => {
                  if (!err && batch) {
                    sqliteDb.run("UPDATE inventory_batches SET qty = qty + ? WHERE id = ?", [parseInt(item.qty), batch.id]);
                  }
                });
              } catch (stockErr) {
                console.warn(`Could not restore stock for item ${item.id}:`, stockErr.message);
              }
            }
          }
          resolve({ id, status: 'voided' });
        });
      });
    });
  },

  // Communications Log
  getCommunicationsLog: (patientId = null) => {
    return new Promise((resolve, reject) => {
      let query = "SELECT * FROM communications_log";
      let params = [];
      if (patientId) {
        query += " WHERE patient_id = ?";
        params.push(patientId);
      }
      query += " ORDER BY sent_date DESC";
      sqliteDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  createCommunicationLog: (log) => {
    return new Promise((resolve, reject) => {
      const { id, patient_id, phone, type, message, status, sent_date } = log;
      sqliteDb.run(
        "INSERT INTO communications_log (id, patient_id, phone, type, message, status, sent_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, patient_id, phone, type, message, status, sent_date],
        function(err) {
          if (err) reject(err);
          else resolve(log);
        }
      );
    });
  },

  getDashboardSummary: async () => {
    try {
      const patients = await dbHelpers.getPatients();
      const visits = await dbHelpers.getVisits();
      const billing = await dbHelpers.getBilling();
      const inventory = await dbHelpers.getInventory();

      const totalPatients = patients.length;
      const totalVisits = visits.length;

      let totalCollected = 0;
      let totalOutstanding = 0;
      let costOfGoodsSold = 0;

      const itemCostMap = {};
      inventory.forEach(item => {
        itemCostMap[item.id] = item.cost_price || 0;
      });

      billing.forEach(bill => {
        // Skip voided bills from dashboard analytics
        if (bill.status === 'voided') return;

        const items = bill.items || [];
        
        if (bill.payment_status === 'paid') {
          totalCollected += bill.total_amount;
        } else {
          totalOutstanding += bill.total_amount;
        }

        if (Array.isArray(items)) {
          items.forEach(item => {
            const cost = itemCostMap[item.id] || 0;
            costOfGoodsSold += (cost * (item.qty || 0));
          });
        }
      });

      const netProfit = totalCollected - costOfGoodsSold;
      const lowStockCount = inventory.filter(item => item.qty <= item.min_qty).length;

      return {
        totalPatients,
        totalVisits,
        totalCollected,
        totalOutstanding,
        costOfGoodsSold,
        netProfit,
        lowStockCount,
        recentVisits: visits.slice(0, 5),
        recentBills: billing.filter(b => b.status !== 'voided').slice(0, 5)
      };
    } catch (error) {
      console.error('Error computing dashboard summary:', error);
      throw error;
    }
  }
};

module.exports = dbHelpers;
