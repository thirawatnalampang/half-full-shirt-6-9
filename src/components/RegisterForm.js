import React, { useState } from 'react';

function RegisterForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const handleRegister = (e) => {
    e.preventDefault(); // ป้องกันรีเฟรชหน้า

    if (!username.trim() || !password || !email.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email }),
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.message); });
        }
        return res.json();
      })
      .then(data => {
        alert(data.message);  // เช่น "สมัครสมาชิกสำเร็จ"
        // คุณอาจจะเคลียร์ฟอร์มหรือ redirect ไป login ที่นี่ได้
        setUsername('');
        setPassword('');
        setEmail('');
      })
      .catch(err => {
        alert('สมัครสมาชิกไม่สำเร็จ: ' + err.message);
      });
  };

  return (
    <form
      onSubmit={handleRegister}
      style={{
        maxWidth: '320px',
        margin: '40px auto',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#fff',
      }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#6b3e26' }}>สมัครสมาชิก</h2>

      <label htmlFor="username" style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
        ชื่อผู้ใช้
      </label>
      <input
        id="username"
        type="text"
        placeholder="กรอกชื่อผู้ใช้"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: '16px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          fontSize: '14px',
        }}
      />

      <label htmlFor="password" style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
        รหัสผ่าน
      </label>
      <input
        id="password"
        type="password"
        placeholder="กรอกรหัสผ่าน"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: '16px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          fontSize: '14px',
        }}
      />

      <label htmlFor="email" style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
        อีเมล
      </label>
      <input
        id="email"
        type="email"
        placeholder="กรอกอีเมล"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: '20px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          fontSize: '14px',
        }}
      />

      <button
        type="submit"
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#6b3e26',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '16px',
          cursor: 'pointer',
          transition: 'background-color 0.3s',
        }}
        onMouseEnter={e => (e.target.style.backgroundColor = '#8a553d')}
        onMouseLeave={e => (e.target.style.backgroundColor = '#6b3e26')}
      >
        สมัครสมาชิก
      </button>
    </form>
  );
}

export default RegisterForm;
