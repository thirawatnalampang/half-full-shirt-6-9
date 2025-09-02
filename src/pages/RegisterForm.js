import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();

  // ตรวจสอบรูปแบบอีเมล
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 1) ส่ง OTP ไปที่อีเมล
  const sendOtp = async () => {
    if (!validateEmail(form.email)) {
      alert("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert("OTP ถูกส่งไปที่อีเมลแล้ว");
      setOtpSent(true);
    } catch (err) {
      alert("ส่ง OTP ไม่สำเร็จ: " + err.message);
    }
  };

  // 2) สมัครสมาชิกพร้อม OTP
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password || !otp) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert(data.message);
      navigate("/login");
    } catch (err) {
      alert("สมัครไม่สำเร็จ: " + err.message);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#fdfaf7]">
      {/* รูปภาพด้านซ้าย */}
      <div className="hidden md:block relative">
        <img src="/assets/image/bg.png" alt="Vintage Shirts" className="w-full h-full object-cover" />
      </div>

      {/* ฟอร์มด้านขวา */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
            REGISTER
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:ring-2 focus:ring-[#6b3e26]"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:ring-2 focus:ring-[#6b3e26]"
              />
            </div>

            {/* ปุ่มส่ง OTP */}
            {!otpSent && (
              <button
                type="button"
                onClick={sendOtp}
                className="w-full bg-[#6b3e26] text-white py-2 rounded-lg font-semibold hover:bg-[#8a553d]"
              >
                ส่ง OTP ไปอีเมล
              </button>
            )}

            {/* OTP */}
            {otpSent && (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="กรอก OTP"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:ring-2 focus:ring-[#6b3e26]"
                />
              </div>
            )}

            {/* ปุ่มสมัคร */}
            <button
              type="submit"
              className="w-full bg-[#6b3e26] hover:bg-[#8a553d] text-white py-2 rounded-lg font-semibold transition"
            >
              สมัครสมาชิก
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            มีบัญชีแล้ว?{" "}
            <Link to="/login" className="underline text-[#6b3e26] hover:text-[#8a553d]">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
