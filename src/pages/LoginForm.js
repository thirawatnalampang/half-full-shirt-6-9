import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SERVER_URL = 'http://localhost:3000';

export default function LoginPage() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ถ้า ProtectedRoute ส่ง state มาแบบ { from: location }
  const fromPath = location.state?.from?.pathname || '/';

  // ✅ ถ้า “ล็อกอินแล้ว” และยังอยู่หน้า Login → เด้งออกทันที (กันอาการ Navbar ไปก่อนหน้า)
  useEffect(() => {
    if (user) {
      navigate(fromPath, { replace: true });
    }
  }, [user, fromPath, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      alert('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${SERVER_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Login failed');

      // ✅ กันกรณี backend ไม่ส่ง role มา
      const safeUser = { role: 'user', ...data.user };

      // อัปเดต context -> Navbar จะอัปเดตตาม (แต่เราจะ navigate ทับทันที)
      login(safeUser);

      // ✅ เด้งไปหน้าเดิม หรือหน้าแรก โดย replace เพื่อไม่ให้ย้อนกลับมาหน้า login ด้วยปุ่ม back
      navigate(fromPath, { replace: true });
    } catch (err) {
      alert('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#fdfaf7]">
      <div className="hidden md:block">
        <img src="/assets/image/bg.png" alt="Vintage Clothes" className="w-full h-full object-cover" />
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">SIGN IN</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" id="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6b3e26]"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password" id="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6b3e26]"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              className="w-full bg-[#6b3e26] hover:bg-[#8a553d] disabled:opacity-60 text-white py-2 rounded-lg font-semibold transition"
            >
              {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
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
