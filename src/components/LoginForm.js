import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.message); });
        }
        return res.json();
      })
      .then(data => {
        alert(data.message);

        // สมมติ server ส่ง user data กลับมา เช่น data.user
        login(data.user);

        navigate('/');
      })
      .catch(err => {
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
      });
  };

  return (
    <div>
      <form
        onSubmit={handleLogin}
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
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#6b3e26' }}>เข้าสู่ระบบ</h2>

        <label htmlFor="username" style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
          ชื่อผู้ใช้
        </label>
        <input
          id="username"
          type="text"
          placeholder="กรอกชื่อผู้ใช้"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
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
          style={{ width: '100%', padding: '8px 12px', marginBottom: '20px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
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
            marginBottom: '12px',
          }}
          onMouseEnter={e => (e.target.style.backgroundColor = '#8a553d')}
          onMouseLeave={e => (e.target.style.backgroundColor = '#6b3e26')}
        >
          เข้าสู่ระบบ
        </button>

        <p style={{ textAlign: 'center', fontSize: '14px' }}>
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" style={{ color: '#6b3e26', textDecoration: 'underline' }}>
            สมัครสมาชิก
          </Link>
        </p>
      </form>
    </div>
  );
}

export default LoginForm;
