require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== Config ======
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// serve static files
app.use('/uploads', express.static(uploadDir));
app.use(cors());
app.use(bodyParser.json());

// ====== DB Connect ======
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'clothing_store',
  password: process.env.PGPASSWORD || '123456',
  port: Number(process.env.PGPORT) || 5432,
});

pool.connect()
  .then(client => {
    console.log('เชื่อมต่อ PostgreSQL สำเร็จ');
    client.release();
  })
  .catch(err => {
    console.error('เชื่อมต่อ PostgreSQL ไม่สำเร็จ:', err.stack);
  });
/* ====== Upload ====== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

/* ====== Nodemailer (SSL 465 แบบเดิม แต่ปิด logger/debug) ====== */
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const MAIL_FROM = process.env.MAIL_FROM || MAIL_USER;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,                     // SSL
  auth: { user: MAIL_USER, pass: MAIL_PASS },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  logger: false,                    // ปิด log SMTP
  debug: false,                     // ปิด DEBUG SMTP
  tls: { ciphers: 'TLSv1.2' },
});

// อุ่นเครื่อง (บอกสั้น ๆ)
(async () => {
  try { await transporter.verify(); console.log('SMTP ready'); }
  catch (e) { console.error('SMTP verify failed:', e.message); }
})();

/* ====== OTP In-memory store ====== */
const otpStore = {};
const OTP_EXPIRE_MIN   = Number(process.env.OTP_EXPIRE_MIN || 10);
const OTP_EXPIRE_MS    = OTP_EXPIRE_MIN * 60 * 1000;

// ✅ คูลดาวน์ 60 นาทีตามที่ขอ
const OTP_COOLDOWN_MS  = 60 * 60 * 1000;

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const now = () => Date.now();
const iso = (t = Date.now()) => new Date(t).toISOString();
const cleanupOtp = (email) => { delete otpStore[email]; };

/* ====== อัปโหลดรูปโปรไฟล์ ====== */
app.post('/api/profile/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'ไม่มีไฟล์อัปโหลด' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

/* ====== ส่ง OTP (สมัครสมาชิก) ====== */
app.post('/api/send-otp', async (req, res) => {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ message: 'กรุณาส่งอีเมลให้ถูกต้อง' });
  }

  try {
    // 🔵 LOG #1: เริ่มกดส่ง
    console.log(`[OTP] request  ${email} at ${iso()}`);

    // อีเมลซ้ำในระบบหรือยัง
    const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน' });
    }

    // คูลดาวน์เฉพาะ “เคยส่งสำเร็จ”
    const rec = otpStore[email];
    if (rec && rec.delivered && rec.lastSentAt && (now() - rec.lastSentAt) < OTP_COOLDOWN_MS) {
      const leftMs = (rec.lastSentAt + OTP_COOLDOWN_MS) - now();
      const leftMin = Math.ceil(leftMs / 60000);
      return res.status(429).json({
        message: `ขอ OTP ได้อีกใน ${leftMin} นาที`,
        cooldownSeconds: Math.ceil(leftMs / 1000),
        nextAvailableAt: iso(now() + leftMs),
      });
    }

    // ออกโค้ดใหม่ทุกครั้ง
    const code = genOtp();
    otpStore[email] = { code, expireAt: now() + OTP_EXPIRE_MS, delivered: false, lastSentAt: 0 };

    // ส่งเมล (รอให้เสร็จ)
    await transporter.sendMail({
      from: MAIL_FROM, // ควรเป็นอีเมลเดียวกับ MAIL_USER
      to: email,
      subject: 'รหัสยืนยันการสมัครสมาชิก (OTP)',
      text: `รหัส OTP ของคุณคือ ${code} (หมดอายุภายใน ${OTP_EXPIRE_MIN} นาที)`,
      html: `
        <div style="font-family:system-ui,Arial,sans-serif;font-size:16px;color:#222">
          <p>รหัส OTP ของคุณคือ</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:2px">${code}</div>
          <p>รหัสหมดอายุภายใน <strong>${OTP_EXPIRE_MIN} นาที</strong></p>
        </div>
      `,
    });

    // มาร์กส่งสำเร็จ + เริ่มคูลดาวน์
    otpStore[email].delivered = true;
    otpStore[email].lastSentAt = now();

    // 🟢 LOG #2: ส่งเข้าเมลแล้ว
    console.log(`[OTP] delivered ${email} at ${iso(otpStore[email].lastSentAt)}`);

    // ปิดคอนเนคชันทันที (สไตล์เดิม)
    try { transporter.close(); } catch {}

    // ตอบให้ UI ขึ้นช่องกรอก OTP ทันที + แจ้งคูลดาวน์ 60 นาที + แจ้งเตือน "ส่งไปที่เมลแล้ว รอสักครู่รับ"
    return res.json({
      message: 'ส่ง OTP ไปที่อีเมลแล้ว กรุณารอสักครู่และตรวจสอบกล่องจดหมาย/สแปม',
      showOtpInput: true,
      cooldownSeconds: Math.ceil(OTP_COOLDOWN_MS / 1000), // 3600
      nextAvailableAt: iso(otpStore[email].lastSentAt + OTP_COOLDOWN_MS),
      hint: 'กรุณากรอก OTP ที่ได้รับทางอีเมล',
    });
  } catch (err) {
    console.error('send-otp error:', err?.message || err);
    if (email) cleanupOtp(email); // ไม่ให้คูลดาวน์หลอก
    return res.status(500).json({ message: 'ระบบส่งอีเมลล่าช้า โปรดลองใหม่อีกครั้ง' });
  }
});

/* ====== (ออปชัน) ตรวจสถานะ OTP ====== */
app.get('/api/otp-status', (req, res) => {
  const email = (req.query?.email ?? '').trim().toLowerCase();
  const rec = otpStore[email];
  if (!rec) return res.json({ exists: false });
  const remainingMs = Math.max(0, rec.expireAt - now());
  res.json({
    exists: true,
    delivered: !!rec.delivered,
    ttlMs: remainingMs,
  });
});


// ====== สมัครสมาชิก (ตรวจ OTP) ======
app.post('/api/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const { password, otp } = req.body || {};
    if (!email || !isValidEmail(email) || !password || !otp) {
      return res.status(400).json({ message: 'กรุณากรอก email, password และ otp ให้ครบและถูกต้อง' });
    }

    // กันสมัครซ้ำ
    const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [email]);
    if (exists.rowCount > 0) {
      cleanupOtp(email);
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบ' });
    }

    // ตรวจ OTP
    const rec = otpStore[email];
    if (!rec) return res.status(400).json({ message: 'ยังไม่ได้ส่ง OTP หรือ OTP หมดอายุ' });
    if (now() > rec.expireAt) { cleanupOtp(email); return res.status(400).json({ message: 'OTP หมดอายุ กรุณาขอรหัสใหม่' }); }
    if (String(otp) !== String(rec.code)) return res.status(400).json({ message: 'OTP ไม่ถูกต้อง' });

    // บันทึกผู้ใช้
    const hashed = await bcrypt.hash(password, 10);
    const role = 'user';
    const q = `
      INSERT INTO users (email, password, role, email_verified, created_at)
      VALUES ($1,$2,$3,$4,NOW())
      RETURNING email, role, email_verified, created_at
    `;
    const r = await pool.query(q, [email, hashed, role, true]);

    cleanupOtp(email);
    return res.status(201).json({ message: `สมัครสมาชิกสำเร็จ: ${email}`, user: r.rows[0] });
  } catch (err) {
    console.error('Error in register:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});
// ==================== นับจำนวนผู้ใช้ ====================
app.get('/api/users/count', async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const count = parseInt(countResult.rows[0].count, 10);
    res.json({ count });
  } catch (err) {
    console.error('Error in counting users:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการนับผู้ใช้' });
  }
});

// เก็บ user ล่าสุดที่ login
let lastLoggedInUser = null;

// ==================== ล็อกอิน (เช็กรหัสผ่าน + เช็กยืนยันอีเมล) ====================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  try {
    const query = 'SELECT * FROM users WHERE email=$1';
    const result = await pool.query(query, [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = result.rows[0];

    // ยังไม่ได้ยืนยันอีเมล
    if (user.email_verified === false) {
      return res.status(403).json({ message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' });
    }

    // === รองรับทั้ง hash และ plain (เช่น admin ที่เก็บ "12") ===
    let ok = false;
    const pass = String(user.password || '');

    const isHash = pass.startsWith('$2a$') || pass.startsWith('$2b$') || pass.startsWith('$2y$');
    if (isHash) {
      ok = await bcrypt.compare(password, pass);
    } else {
      ok = (password === pass);
    }

    if (!ok) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    // login สำเร็จ
    lastLoggedInUser = email;
    console.log(`User เข้าสู่ระบบ: ${email}`);

    // อย่าส่ง password กลับไป
    const { password: _ignored, ...safeUser } = user;
    res.json({ message: `เข้าสู่ระบบสำเร็จ: ${email}`, user: safeUser });
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});
app.get('/api/last-logged-in-user', (req, res) => {
  if (!lastLoggedInUser) return res.json({ message: 'ไม่มีผู้ใช้ล็อกอินล่าสุด' });
  res.json({ lastLoggedInUser });
});

// ==================== โปรไฟล์ ====================
app.get('/api/profile', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ message: 'กรุณาส่ง email มา' });

  try {
    const query = 'SELECT email, username, address, phone, profile_image FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์' });
  }
});

app.put('/api/profile', async (req, res) => {
  const { email, username, address, phone, profile_image, password } = req.body;
  if (!email) return res.status(400).json({ message: 'กรุณาส่ง email มา' });

  try {
    const checkUsernameQuery = 'SELECT 1 FROM users WHERE username=$1 AND email<>$2';
    const checkUsernameResult = await pool.query(checkUsernameQuery, [username, email]);
    if (checkUsernameResult.rows.length > 0) {
      return res.status(400).json({ message: 'ชื่อนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น' });
    }

    let updateQuery;
    let params;

    if (password) {
      // ถ้าจะอัปเดตรหัสผ่าน ให้แฮชใหม่
      const hashed = await bcrypt.hash(password, 10);
      updateQuery = `
        UPDATE users SET
          username=$1, address=$2, phone=$3, profile_image=$4, password=$5
        WHERE email=$6 RETURNING email, username, address, phone, profile_image
      `;
      params = [username, address, phone, profile_image, hashed, email];
    } else {
      updateQuery = `
        UPDATE users SET
          username=$1, address=$2, phone=$3, profile_image=$4
        WHERE email=$5 RETURNING email, username, address, phone, profile_image
      `;
      params = [username, address, phone, profile_image, email];
    }

    const result = await pool.query(updateQuery, params);
    if (result.rows.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลโปรไฟล์' });
  }
});

// ==================== CATEGORIES CRUD ====================
app.get('/api/admin/categories', async (req, res) => {
  try {
    const q = `SELECT id, name FROM categories ORDER BY id ASC`;
    const result = await pool.query(q);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /categories error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/categories', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'กรุณากรอกชื่อหมวดหมู่' });

  try {
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /categories error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== PRODUCTS CRUD ====================
app.get('/api/admin/products', async (req, res) => {
  try {
    const q = `
      SELECT id, name, price, stock, category_id, description, image, status, created_at, updated_at
      FROM products ORDER BY id DESC
    `;
    const result = await pool.query(q);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('GET /products error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/products', upload.single('image'), async (req, res) => {
  try {
    const { name, price, stock, category_id, description } = req.body;
    if (!name || String(name).trim() === '') {
      return res.status(400).json({ message: 'ชื่อสินค้าเป็นค่าว่างไม่ได้' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const q = `
      INSERT INTO products (name, price, stock, category_id, description, image, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,'active',NOW(),NOW())
      RETURNING *
    `;
    const params = [
      name,
      Number(price) || 0,
      Number(stock) || 0,
      category_id ? Number(category_id) : null,
      description || '',
      imagePath,
    ];
    const result = await pool.query(q, params);

    return res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('POST /products error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/products/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, stock, category_id, description, oldImage } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ message: 'ชื่อสินค้าเป็นค่าว่างไม่ได้' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : (oldImage || null);

    const q = `
      UPDATE products
      SET name=$1, price=$2, stock=$3, category_id=$4, description=$5, image=$6, updated_at=NOW()
      WHERE id=$7 RETURNING *
    `;
    const params = [
      name,
      Number(price) || 0,
      Number(stock) || 0,
      category_id ? Number(category_id) : null,
      description || '',
      imagePath,
      id,
    ];
    const result = await pool.query(q, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'ไม่พบสินค้า' });
    }

    return res.status(200).json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('PUT /products error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสินค้า' });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'รหัสสินค้าไม่ถูกต้อง' });

    const result = await pool.query('DELETE FROM products WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'ไม่พบสินค้า' });

    return res.status(200).json({ success: true, message: 'ลบสำเร็จ' });
  } catch (err) {
    console.error('DELETE /products error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/products/by-category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const q = `
      SELECT id, name, price, stock, description, image, category_id
      FROM products
      WHERE category_id = $1
      ORDER BY id DESC
    `;
    const result = await pool.query(q, [categoryId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("GET /products/by-category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.get('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `
      SELECT id, name, price, stock, description, image, category_id
      FROM products
      WHERE id = $1
    `;
    const result = await pool.query(q, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบสินค้า" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});



// ===== util =====
const crypto = require('crypto');

const SHIPPING_THRESHOLD = 1000;
const SHIPPING_FEE_STANDARD = 50;
const SHIPPING_FEE_EXPRESS = 80;

function genOrderCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `OD-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
/* ====================== PUBLIC: สร้างคำสั่งซื้อ ====================== */
app.post('/api/orders', async (req, res) => {
  const {
    userId, email,
    items = [],
    shippingMethod, paymentMethod,
    address = {}, note = ''
  } = req.body || {};

  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'ไม่มีรายการสินค้า' });
    }
    if (!shippingMethod || !paymentMethod) {
      return res.status(400).json({ message: 'กรุณาเลือกวิธีจัดส่งและวิธีชำระเงิน' });
    }

    const ids = [...new Set(items.map(i => Number(i.id)).filter(Boolean))];
    if (ids.length === 0) return res.status(400).json({ message: 'รายการสินค้าไม่ถูกต้อง' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // lock แถวสินค้า
      const prodRes = await client.query(
        `SELECT id, name, price, stock, image FROM products WHERE id = ANY($1) FOR UPDATE`,
        [ids]
      );
      const prodMap = new Map(prodRes.rows.map(r => [Number(r.id), r]));

      let subtotal = 0;
      let totalQty = 0;
      const orderItems = [];

      for (const it of items) {
        const pid = Number(it.id);
        const qty = Number(it.qty || 1);
        if (!pid || qty <= 0) throw new Error('ข้อมูลสินค้าไม่ถูกต้อง');

        const dbp = prodMap.get(pid);
        if (!dbp) throw new Error(`ไม่พบสินค้า id=${pid}`);
        if (Number(dbp.stock || 0) < qty) {
          throw new Error(`สต็อกไม่พอสำหรับ ${dbp.name} (คงเหลือ ${dbp.stock})`);
        }

        const unit = Number(dbp.price || 0);
        const line = unit * qty;
        subtotal += line;
        totalQty += qty;

        orderItems.push({
          product_id: pid,
          name: dbp.name,
          size: it.size ?? null,
          unit_price: unit,
          qty,
          line_total: line,
          image: dbp.image || null,
        });
      }

      // ค่าส่ง
      let shipping = 0;
      if (shippingMethod === 'express') shipping = SHIPPING_FEE_EXPRESS;
      else shipping = (subtotal === 0 || subtotal >= SHIPPING_THRESHOLD) ? 0 : SHIPPING_FEE_STANDARD;

      const total = subtotal + shipping;

      // กำหนดสถานะการจ่ายเงินเริ่มต้นตามวิธีชำระ
      const paymentStatus = (paymentMethod === 'cod') ? 'unpaid' : 'submitted';

      // insert order
      const orderCode = genOrderCode();
      const insertOrder = `
        INSERT INTO orders
          (order_code, user_id, email, full_name, phone, address_line, district, province, postcode,
           shipping_method, payment_method, payment_status,
           subtotal, shipping, total_price, total_qty, note, status, created_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,
           $10,$11,$12,
           $13,$14,$15,$16,$17,'pending', NOW())
        RETURNING id, order_code
      `;
      const paramsOrder = [
        orderCode,
        userId ?? null,
        email ?? null,
        address.fullName ?? null,
        address.phone ?? null,
        address.addressLine ?? null,
        address.district ?? null,
        address.province ?? null,
        address.postcode ?? null,
        shippingMethod,
        paymentMethod,
        paymentStatus,          // <<<<<<<<<< เพิ่มคอลัมน์นี้
        subtotal,
        shipping,
        total,
        totalQty,
        note || ''
      ];
      const ordRes = await client.query(insertOrder, paramsOrder);
      const orderId = ordRes.rows[0].id;

      // insert order_items
      const insertItem = `
        INSERT INTO order_items (
          order_id, product_id, name, size,
          unit_price, price_per_unit,
          quantity, line_total, image
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `;
      for (const oi of orderItems) {
        await client.query(insertItem, [
          orderId,
          oi.product_id,
          oi.name,
          oi.size,
          oi.unit_price,
          oi.unit_price,
          oi.qty,
          oi.line_total,
          oi.image
        ]);
      }

      // หักสต็อก
      for (const oi of orderItems) {
        await client.query(
          `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
          [oi.qty, oi.product_id]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({ orderId, orderCode });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('POST /api/orders error:', e);
      return res.status(400).json({ message: e.message || 'สร้างคำสั่งซื้อไม่สำเร็จ' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /api/orders fatal:', err);
    return res.status(500).json({ message: 'สร้างคำสั่งซื้อไม่สำเร็จ' });
  }
});

/* ====================== ADMIN: Orders ====================== */

// รายการออเดอร์ (สั้น) — รวมคอลัมน์ชำระเงิน
app.get("/api/admin/orders", async (req, res) => {
  try {
    const q = `
      SELECT id, order_code, full_name, email, total_price, status, created_at,
             payment_status, slip_image
      FROM orders
      ORDER BY created_at DESC
    `;
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (err) {
    console.error("GET /api/admin/orders error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// รายละเอียดออเดอร์ + รายการสินค้า  — รวมฟิลด์การชำระเงิน
app.get("/api/admin/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ordQ = `
  SELECT id, order_code, user_id, email,
         full_name, phone, address_line, district, province, postcode,
         shipping_method, payment_method,
         subtotal, shipping, total_price, total_qty, note,
         status, created_at,
         payment_status, paid_at, payment_amount, slip_image
  FROM orders
  WHERE id = $1
`;
    const ordR = await pool.query(ordQ, [id]);
    if (ordR.rowCount === 0) return res.status(404).json({ message: "ไม่พบออเดอร์" });

    const itemsQ = `
      SELECT id, product_id, name, size, unit_price, quantity, line_total, image
      FROM order_items WHERE order_id = $1
    `;
    const itemsR = await pool.query(itemsQ, [id]);

    res.json({ order: ordR.rows[0], items: itemsR.rows });
  } catch (err) {
    console.error("GET /api/admin/orders/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// เปลี่ยนสถานะออเดอร์
app.patch("/api/admin/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    // ✅ เพิ่ม ready_to_ship เข้า whitelist
    const allow = ["pending", "ready_to_ship", "paid", "shipped", "done", "cancelled"];
    if (!allow.includes(status)) return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });

    const r = await pool.query(
      `UPDATE orders SET status=$1 WHERE id=$2 RETURNING id, status`,
      [status, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "ไม่พบออเดอร์" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("PATCH /api/admin/orders/:id/status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// ลูกค้าอัปโหลดสลิป
app.post('/api/orders/:id/upload-slip', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { txid, amount } = req.body || {};
    const img = req.file ? `/uploads/${req.file.filename}` : null;
    if (!img) return res.status(400).json({ message: 'กรุณาแนบสลิป' });

    const q = `
      UPDATE orders
      SET slip_image=$1, payment_txid=$2, payment_amount=$3, payment_status='submitted'
      WHERE id=$4 RETURNING id, payment_status, slip_image, payment_amount, payment_txid
    `;
    const r = await pool.query(q, [img, txid || null, amount ? Number(amount) : null, id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'ไม่พบออเดอร์' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('upload-slip error', e);
    res.status(500).json({ message: 'อัปโหลดสลิปไม่สำเร็จ' });
  }
});

// แอดมินยืนยันรับเงิน
app.patch('/api/admin/orders/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const { txid, amount } = req.body || {};
    const q = `
      UPDATE orders
      SET payment_status='paid',
          paid_at=NOW(),
          payment_txid=COALESCE($1, payment_txid),
          payment_amount=COALESCE($2, payment_amount),
          status='ready_to_ship'      -- ✅ เด้งไป "รอจัดส่ง"
      WHERE id=$3
      RETURNING id, status, payment_status, paid_at, payment_amount, payment_txid
    `;
    const r = await pool.query(q, [txid || null, amount ? Number(amount) : null, id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'ไม่พบออเดอร์' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('mark-paid error', e);
    res.status(500).json({ message: 'ยืนยันรับเงินไม่สำเร็จ' });
  }
});

// แอดมินปฏิเสธสลิป
app.patch('/api/admin/orders/:id/reject-slip', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `
      UPDATE orders
      SET payment_status='rejected'
      WHERE id=$1
      RETURNING id, payment_status
    `;
    const r = await pool.query(q, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'ไม่พบออเดอร์' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('reject-slip error', e);
    res.status(500).json({ message: 'ปฏิเสธสลิปไม่สำเร็จ' });
  }
});

// PATCH /api/admin/orders/:id/cancel  body: { restock: true|false }
app.patch('/api/admin/orders/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { restock } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ตรวจสถานะก่อน
    const ord = await client.query(
      `SELECT id, status FROM orders WHERE id=$1 FOR UPDATE`, [id]
    );
    if (ord.rowCount === 0) {
      await client.query('ROLLBACK'); return res.status(404).json({ message: 'ไม่พบออเดอร์' });
    }
    const cur = ord.rows[0].status;
    if (['shipped','done'].includes(cur)) {
      await client.query('ROLLBACK'); return res.status(400).json({ message: 'ออเดอร์สถานะนี้ยกเลิกไม่ได้' });
    }

    // คืนสต็อกถ้าต้องการ
    if (restock) {
      const items = await client.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id=$1`, [id]
      );
      for (const it of items.rows) {
        await client.query(
          `UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id=$2`,
          [it.quantity, it.product_id]
        );
      }
    }

    const r = await client.query(
      `UPDATE orders SET status='cancelled' WHERE id=$1 RETURNING id, status`, [id]
    );
    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('cancel order error', e);
    res.status(500).json({ message: 'ยกเลิกออเดอร์ไม่สำเร็จ' });
  } finally {
    client.release();
  }
});

// ดึงออเดอร์ของ user
app.get("/api/my-orders", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "missing userId" });

    const q = `
      SELECT o.*, 
             json_agg(json_build_object(
               'id', oi.id,
               'name', oi.name,
               'size', oi.size,
               'quantity', oi.quantity,
               'unit_price', oi.unit_price,
               'line_total', oi.line_total,
               'image', oi.image
             )) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    const r = await pool.query(q, [userId]);
    res.json(r.rows);
  } catch (err) {
    console.error("GET /api/my-orders error:", err);
    res.status(500).json({ message: "server error" });
  }
});

// GET /api/my-orders?userId=123
app.get('/api/my-orders', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: 'missing userId' });

  try {
    const o = await pool.query(
      `SELECT id, order_code, created_at, status, total_price,
              payment_method, payment_status, slip_image, payment_amount
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const orderIds = o.rows.map(r => r.id);
    if (orderIds.length === 0) return res.json([]);

    const it = await pool.query(
      `SELECT id, order_id, product_id, name, size,
              unit_price, price_per_unit, quantity, line_total, image
       FROM order_items
       WHERE order_id = ANY($1)`,
      [orderIds]
    );

    const map = new Map(orderIds.map(id => [id, []]));
    for (const row of it.rows) map.get(row.order_id).push(row);

    const out = o.rows.map(ord => ({ ...ord, items: map.get(ord.id) || [] }));
    res.json(out);
  } catch (e) {
    console.error('GET /api/my-orders error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/orders/:id/cancel  body: { restock: true|false }
app.patch('/api/orders/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { restock } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ord = await client.query(
      `SELECT status FROM orders WHERE id=$1 FOR UPDATE`,
      [id]
    );
    if (ord.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'ไม่พบออเดอร์' });
    }
    const cur = ord.rows[0].status;
    if (!['pending','ready_to_ship'].includes(cur)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'ยกเลิกไม่ได้ในสถานะปัจจุบัน' });
    }

    if (restock) {
      const items = await client.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id=$1`,
        [id]
      );
      for (const it of items.rows) {
        await client.query(
          `UPDATE products SET stock = stock + $1 WHERE id = $2`,
          [it.quantity, it.product_id]
        );
      }
    }

    const r = await client.query(
      `UPDATE orders SET status='cancelled' WHERE id=$1 RETURNING id, status`,
      [id]
    );

    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('cancel error', e);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
