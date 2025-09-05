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

// ====== Multer Storage ======
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// ====== Nodemailer (Mail Transport) ======
const transporter = nodemailer.createTransport({
  service: 'gmail', // ใช้ Gmail; ถ้าใช้ SMTP อื่นเปลี่ยนเป็น host/port/secure/auth ตามผู้ให้บริการ
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ====== OTP Store (in-memory) ======
// โครงสร้าง: { [email]: { code, expireAt: number(ms), lastSentAt: number(ms) } }
const otpStore = {};
const OTP_EXPIRE_MIN = Number(process.env.OTP_EXPIRE_MIN || 10);
const OTP_EXPIRE_MS = OTP_EXPIRE_MIN * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000; // ส่งซ้ำได้ทุก 60 วิ

function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 หลัก
}
function now() {
  return Date.now();
}
function cleanupOtp(email) {
  delete otpStore[email];
}

// ==================== PROFILE API ====================
app.post('/api/profile/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'ไม่มีไฟล์อัปโหลด' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});
// ช่วยตรวจอีเมลฝั่งเซิร์ฟเวอร์ด้วย (กันกรณีข้าม frontend)
const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

// ==================== OTP: ส่งรหัสไปอีเมล (สมัครสมาชิก) ====================
app.post('/api/send-otp', async (req, res) => {
  try {
    const rawEmail = (req.body?.email ?? '').trim();
    const email = rawEmail.toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'กรุณาส่งอีเมลให้ถูกต้อง' });
    }

    // ❗ เช็กอีเมลซ้ำก่อนส่ง OTP
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน' });
    }

    // กันสแปม: cooldown 60 วิ (หรือใช้ค่าคงที่ของคุณ)
    const record = otpStore[email];
    if (record && record.lastSentAt && (now() - record.lastSentAt) < OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_COOLDOWN_MS - (now() - record.lastSentAt)) / 1000);
      return res.status(429).json({ message: `โปรดรอ ${waitSec} วินาที แล้วลองส่งใหม่อีกครั้ง` });
    }

    // สร้าง/อัปเดต OTP (ส่งใหม่ให้ทับของเก่า)
    const code = genOtp(); // เช่น 6 หลัก
    otpStore[email] = {
      code,
      expireAt: now() + OTP_EXPIRE_MS,  // เช่น 10 นาที
      lastSentAt: now(),
    };

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: email,
      subject: 'รหัสยืนยันการสมัครสมาชิก (OTP)',
      text: `รหัส OTP ของคุณคือ ${code} (หมดอายุภายใน ${OTP_EXPIRE_MIN} นาที)`,
      html: `
        <div style="font-family:system-ui,Arial,sans-serif;font-size:16px;color:#222">
          <p>รหัส OTP ของคุณคือ</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:2px">${code}</div>
          <p>รหัสจะหมดอายุภายใน <strong>${OTP_EXPIRE_MIN} นาที</strong></p>
        </div>
      `,
    });

    return res.json({ message: 'ส่ง OTP ไปที่อีเมลแล้ว' });
  } catch (err) {
    console.error('send-otp error:', err);
    return res.status(500).json({ message: 'ส่ง OTP ไม่สำเร็จ' });
  }
});

// ==================== สมัครสมาชิก (ตรวจอีเมลซ้ำ + ตรวจ OTP + แฮชพาส) ====================
app.post('/api/register', async (req, res) => {
  try {
    const rawEmail = (req.body?.email ?? '').trim();
    const email = rawEmail.toLowerCase();
    const { password, otp } = req.body || {};

    if (!email || !isValidEmail(email) || !password || !otp) {
      return res.status(400).json({ message: 'กรุณากรอก email, password และ otp ให้ครบและถูกต้อง' });
    }

    // ✅ เช็กอีเมลซ้ำก่อน (กัน race และตอบสถานะที่เหมาะสม)
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      // ล้าง OTP เฉพาะกรณีที่คุณต้องการ (ไม่จำเป็นก็ได้)
      cleanupOtp(email);
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบ' });
    }

    // ตรวจ OTP
    const record = otpStore[email];
    if (!record) {
      return res.status(400).json({ message: 'ยังไม่ได้ส่ง OTP หรือ OTP หมดอายุ' });
    }
    if (now() > record.expireAt) {
      cleanupOtp(email);
      return res.status(400).json({ message: 'OTP หมดอายุ กรุณาขอรหัสใหม่' });
    }
    if (String(otp) !== String(record.code)) {
      return res.status(400).json({ message: 'OTP ไม่ถูกต้อง' });
    }

    // แฮชรหัสผ่าน
    const hashed = await bcrypt.hash(password, 10);

    // บันทึกผู้ใช้ (email_verified = true เพราะยืนยันด้วย OTP แล้ว)
    const role = 'user';
    const insertQuery = `
      INSERT INTO users (email, password, role, email_verified, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING email, role, email_verified, created_at
    `;
    const insertResult = await pool.query(insertQuery, [email, hashed, role, true]);

    // ล้าง OTP (ใช้แล้วทิ้ง)
    cleanupOtp(email);

    console.log(`User สมัครใหม่: ${email}`);
    return res.status(201).json({ message: `สมัครสมาชิกสำเร็จ: ${email}`, user: insertResult.rows[0] });
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

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
