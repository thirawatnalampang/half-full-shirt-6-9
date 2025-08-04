const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;
const cors = require('cors');
const uploadPath = path.resolve(__dirname, 'uploads'); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json());
app.use(cors()); // เพิ่มบรรทัดนี้ *อนุญาตทุก origin (ในขั้นตอนทดสอบ)
app.use(bodyParser.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'clothing_store',  // ชื่อฐานข้อมูลที่ถูกต้อง
  password: '123456',
  port: 5432,
});

// ตรวจสอบการเชื่อมต่อ PostgreSQL
pool.connect()
  .then(client => {
    console.log('เชื่อมต่อ PostgreSQL สำเร็จ');
    client.release();
  })
  .catch(err => {
    console.error('เชื่อมต่อ PostgreSQL ไม่สำเร็จ:', err.stack);
  });

  
// สร้างโฟลเดอร์เก็บรูป ถ้ายังไม่มี
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ตั้งค่า multer เก็บไฟล์ในโฟลเดอร์ uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // เปลี่ยนชื่อไฟล์ให้ไม่ซ้ำ เช่น timestamp + ชื่อไฟล์เดิม
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage });

// API อัปโหลดรูปโปรไฟล์
app.post('/api/profile/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'ไม่มีไฟล์อัปโหลด' });
  }
  
  // URL สำหรับส่งกลับไป frontend (แก้ตามที่คุณ deploy server จริง)
  const fileUrl = `/uploads/${req.file.filename}`;
  
  res.json({ url: fileUrl });
});
// ✅ แก้ API สมัครสมาชิกให้รับเฉพาะ email + password
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  try {
    // ตรวจอีเมลซ้ำ
    const checkQuery = 'SELECT * FROM users WHERE email = $1';
    const checkResult = await pool.query(checkQuery, [email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
    }

    const role = 'user';
    const createdAt = new Date();

    const insertQuery = 'INSERT INTO users (email, password, role, created_at) VALUES ($1, $2, $3, $4) RETURNING *';
    const insertResult = await pool.query(insertQuery, [email, password, role, createdAt]);

    console.log(`User สมัครใหม่: ${email}`);
    res.status(201).json({ message: `สมัครสมาชิกสำเร็จ: ${email}`, user: insertResult.rows[0] });
  } catch (err) {
    console.error('Error in register:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// API นับจำนวนผู้สมัครทั้งหมด
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

/// เก็บ username ล่าสุดในตัวแปรนี้
let lastLoggedInUser = null;

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;  // เปลี่ยนจาก username เป็น email
  if (!email || !password) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  try {
    const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';  // ใช้ email แทน username
    const result = await pool.query(query, [email, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    lastLoggedInUser = email; // เก็บ email ล่าสุดที่ล็อกอิน
    console.log(`User เข้าสู่ระบบ: ${email}`);

    res.json({ message: `เข้าสู่ระบบสำเร็จ: ${email}`, user: result.rows[0] });
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// API ดึงชื่อ user ที่ล็อกอินล่าสุด (สำหรับ client)
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

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
    }

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
    // เช็ค username ซ้ำ (ยกเว้นตัวเอง)
    const checkUsernameQuery = 'SELECT * FROM users WHERE username = $1 AND email <> $2';
    const checkUsernameResult = await pool.query(checkUsernameQuery, [username, email]);
    if (checkUsernameResult.rows.length > 0) {
      return res.status(400).json({ message: 'ชื่อนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น' });
    }

    // คำสั่งอัปเดตเดิม
    let updateQuery;
    let params;

    if (password) {
      updateQuery = `
        UPDATE users SET
          username = $1,
          address = $2,
          phone = $3,
          profile_image = $4,
          password = $5
        WHERE email = $6
        RETURNING *`;
      params = [username, address, phone, profile_image, password, email];
    } else {
      updateQuery = `
        UPDATE users SET
          username = $1,
          address = $2,
          phone = $3,
          profile_image = $4
        WHERE email = $5
        RETURNING *`;
      params = [username, address, phone, profile_image, email];
    }

    const result = await pool.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลโปรไฟล์' });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
