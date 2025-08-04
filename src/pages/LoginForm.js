import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');      // เปลี่ยนเป็น email
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      alert('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),  // ส่ง email แทน username
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert(data.message);
      login(data.user);
      navigate('/');
    } catch (err) {
      alert('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
    }
  };

  return (
<div className="min-h-screen grid md:grid-cols-2 bg-[#fdfaf7]">
  {/* ฝั่งซ้าย: รูปภาพเสื้อ */}
  <div className="hidden md:block">
    <img
      src="/assets/image/bg.png" // เปลี่ยนเป็นภาพใหม่ที่ไม่มีโลโก้ซ้อน
      alt="Vintage Clothes"
      className="w-full h-full object-cover"
    />
  </div>

  {/* ฝั่งขวา: ฟอร์มล็อกอิน */}
  <div className="flex items-center justify-center px-6 py-12">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
        SIGN IN
      </h2>

      <form onSubmit={handleLogin} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6b3e26]"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6b3e26]"
          />
        </div>

        {/* ปุ่ม Login */}
        <button
          type="submit"
          className="w-full bg-[#6b3e26] hover:bg-[#8a553d] text-white py-2 rounded-lg font-semibold transition"
        >
          เข้าสู่ระบบ
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        ไม่มีบัญชี{' '}
        <Link to="/register" className="underline text-[#6b3e26] hover:text-[#8a553d]">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  </div>
</div>
  );
}