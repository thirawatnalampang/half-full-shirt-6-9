import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const navigate = useNavigate();

  // ฟังก์ชันตรวจสอบรูปแบบอีเมลแบบง่าย ๆ
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    if (!validateEmail(form.email)) {
      alert('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      alert(data.message);
      navigate('/login');
    } catch (err) {
      alert('สมัครไม่สำเร็จ: ' + err.message);
    }
  };

  return (
  <div className="min-h-screen grid md:grid-cols-2 bg-[#fdfaf7]">
      {/* ฝั่งซ้าย: รูปภาพ */}
      <div className="hidden md:block relative">
        <img
          src="/assets/image/bg.png"
          alt="Vintage Shirts"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-6 left-6 text-white text-2xl font-bold drop-shadow-md">
          
        </div>
      </div>

      {/* ฝั่งขวา: ฟอร์มสมัคร */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
            REGISTER
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
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
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6b3e26]"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-[#6b3e26] hover:bg-[#8a553d] text-white py-2 rounded-lg font-semibold transition"
            >
              สมัครสมาชิก
            </button>
          </form>

          {/* Link ไป Login */}
          <p className="text-center text-sm text-gray-600 mt-6">
            มีบัญชีแล้ว?{' '}
            <Link to="/login" className="underline text-[#6b3e26] hover:text-[#8a553d]">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}