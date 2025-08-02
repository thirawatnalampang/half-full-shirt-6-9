const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

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

// API สมัครสมาชิก
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  try {
    // เช็คว่ามี username หรือ email ซ้ำไหม
    const checkQuery = 'SELECT * FROM users WHERE username = $1 OR email = $2';
    const checkResult = await pool.query(checkQuery, [username, email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้แล้ว' });
    }

    const role = 'user';
    const createdAt = new Date();

    const insertQuery = 'INSERT INTO users (username, password, email, role, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *';
    const insertResult = await pool.query(insertQuery, [username, password, email, role, createdAt]);

    console.log(`User ใหม่สมัคร: ${username} (${email})`);

    res.status(201).json({ message: `สมัครสมาชิกสำเร็จ: ${username}`, user: insertResult.rows[0] });
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
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  try {
    const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
    const result = await pool.query(query, [username, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    lastLoggedInUser = username; // เก็บชื่อผู้ใช้ล่าสุดที่ล็อกอิน
    console.log(`User เข้าสู่ระบบ: ${username}`);

    res.json({ message: `เข้าสู่ระบบสำเร็จ: ${username}`, user: result.rows[0] });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
