// backend/reset-admin-pass.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'clothing_store',
  password: '123456',   // <- เปลี่ยนเป็นรหัสจริงของคุณ
  port: 5432,
});

async function resetAdmin() {
  const plain = '12'; // ✅ รหัสผ่านใหม่ที่คุณต้องการ
  const hash = await bcrypt.hash(plain, 10);

  await pool.query(
    'UPDATE users SET password = $1 WHERE username = $2',
    [hash, 'admin']
  );

  console.log('✔ เปลี่ยนรหัสผ่าน admin แล้ว (hash เก็บใน DB)');
  console.log('   รหัสผ่านใหม่ (plaintext):', plain);

  await pool.end();
}

resetAdmin().catch(console.error);
