const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

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
  user: 'postgres',
  host: 'localhost',
  database: 'clothing_store', // ชื่อ DB
  password: '123456',
  port: 5432,
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
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage });

// ==================== PROFILE API ====================
app.post('/api/profile/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'ไม่มีไฟล์อัปโหลด' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// สมัครสมาชิก
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  try {
    const checkQuery = 'SELECT * FROM users WHERE email = $1';
    const checkResult = await pool.query(checkQuery, [email]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
    }

    const role = 'user';
    const createdAt = new Date();
    const insertQuery = `
      INSERT INTO users (email, password, role, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const insertResult = await pool.query(insertQuery, [email, password, role, createdAt]);

    console.log(`User สมัครใหม่: ${email}`);
    res.status(201).json({ message: `สมัครสมาชิกสำเร็จ: ${email}`, user: insertResult.rows[0] });
  } catch (err) {
    console.error('Error in register:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// นับจำนวนผู้ใช้
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

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  try {
    const query = 'SELECT * FROM users WHERE email=$1 AND password=$2';
    const result = await pool.query(query, [email, password]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    lastLoggedInUser = email;
    console.log(`User เข้าสู่ระบบ: ${email}`);
    res.json({ message: `เข้าสู่ระบบสำเร็จ: ${email}`, user: result.rows[0] });
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

app.get('/api/last-logged-in-user', (req, res) => {
  if (!lastLoggedInUser) {
    return res.json({ message: 'ไม่มีผู้ใช้ล็อกอินล่าสุด' });
  }
  res.json({ lastLoggedInUser });
});

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
    const checkUsernameQuery = 'SELECT * FROM users WHERE username=$1 AND email<>$2';
    const checkUsernameResult = await pool.query(checkUsernameQuery, [username, email]);
    if (checkUsernameResult.rows.length > 0) {
      return res.status(400).json({ message: 'ชื่อนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น' });
    }

    let updateQuery;
    let params;
    if (password) {
      updateQuery = `
        UPDATE users SET
          username=$1, address=$2, phone=$3, profile_image=$4, password=$5
        WHERE email=$6 RETURNING *
      `;
      params = [username, address, phone, profile_image, password, email];
    } else {
      updateQuery = `
        UPDATE users SET
          username=$1, address=$2, phone=$3, profile_image=$4
        WHERE email=$5 RETURNING *
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

// GET /api/admin/products
app.get('/api/admin/products', async (req, res) => {
  try {
    const q = `SELECT id, name, price, stock, category_id, description, image, status, created_at, updated_at
               FROM products ORDER BY id DESC`;
    const result = await pool.query(q);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('GET /products error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/products (รองรับไฟล์ใหม่)
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

// PUT /api/admin/products/:id (รองรับไฟล์ใหม่หรือ oldImage)
app.put('/api/admin/products/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, stock, category_id, description, oldImage } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ message: 'ชื่อสินค้าเป็นค่าว่างไม่ได้' });
    }

    const imagePath = req.file
      ? `/uploads/${req.file.filename}`
      : oldImage || null;

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

// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'รหัสสินค้าไม่ถูกต้อง' });

    const result = await pool.query('DELETE FROM products WHERE id=$1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'ไม่พบสินค้า' });
    }

    return res.status(200).json({ success: true, message: 'ลบสำเร็จ' });
  } catch (err) {
    console.error('DELETE /products error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ✅ GET /api/products/by-category/:categoryId
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

// ✅ GET /api/admin/products/:id
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
