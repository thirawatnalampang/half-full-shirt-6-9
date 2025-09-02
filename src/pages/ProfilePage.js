import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaUserCircle } from 'react-icons/fa';

const SERVER_URL = 'http://localhost:3000';

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  const [form, setForm] = useState({
    email: '',
    username: '',
    address: '',
    phone: '',
    profile_image: '',
    password: '',
    passwordConfirm: '',
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user && user.email) {
      fetchProfile(user.email);
    }
  }, [user]);

  async function fetchProfile(email) {
    try {
      const res = await fetch(`${SERVER_URL}/api/profile?email=${email}`);
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลโปรไฟล์ได้');
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        email: data.email || '',
        username: data.username || '',
        address: data.address || '',
        phone: data.phone || '',
        profile_image: data.profile_image || '',
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      let newVal = value.replace(/\D/g, '');
      if (newVal.length > 10) newVal = newVal.slice(0, 10);
      setForm(prev => ({ ...prev, [name]: newVal }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploading(true);
      const res = await fetch(`${SERVER_URL}/api/profile/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ');
      const data = await res.json();
      setForm(prev => ({ ...prev, profile_image: data.url }));
      alert('อัปโหลดรูปสำเร็จ');
    } catch (err) {
      alert(err.message);
      setForm(prev => ({ ...prev, profile_image: '' }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      alert('รหัสผ่านใหม่กับยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }
    try {
      const { passwordConfirm, ...rest } = form;

      if (!rest.email) {
        alert('ไม่พบอีเมลผู้ใช้');
        return;
      }

      const res = await fetch(`${SERVER_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });

      if (!res.ok) {
        let errorMsg = 'บันทึกข้อมูลไม่สำเร็จ';
        try {
          const errorData = await res.json();
          if (errorData.message) errorMsg = errorData.message;
        } catch {
          const errorText = await res.text();
          if (errorText) errorMsg = errorText;
        }
        throw new Error(errorMsg);
      }

      const updatedUser = await res.json();

      // ✅ คงรูปเดิมถ้า backend ไม่ส่ง profile_image มา
      setForm(prev => ({
        ...prev,
        username: updatedUser.username ?? prev.username,
        address: updatedUser.address ?? prev.address,
        phone: updatedUser.phone ?? prev.phone,
        profile_image: updatedUser.profile_image ?? prev.profile_image,
        password: '',
        passwordConfirm: '',
      }));

      // ✅ จุดแก้หลัก: merge user เดิม + คง role/isAdmin (กันปุ่ม Admin หาย)
      setUser(prev => ({
        ...prev,
        ...updatedUser,
        role: updatedUser.role ?? prev?.role,
        isAdmin: updatedUser.isAdmin ?? prev?.isAdmin,
        // กัน key สำคัญหายไปด้วย เช่น email / profile_image
        email: updatedUser.email ?? prev?.email,
        profile_image: updatedUser.profile_image ?? prev?.profile_image,
      }));

      alert('บันทึกข้อมูลสำเร็จ');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">แก้ไขโปรไฟล์</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Email (ไม่สามารถแก้ไขได้)</label>
          <input
            type="email"
            name="email"
            value={form.email}
            disabled
            className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Username</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Address</label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Phone</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            maxLength={10}
            pattern="\d{10}"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Profile Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="mb-2"
          />
          {form.profile_image ? (
            <img
              src={form.profile_image.startsWith('http') ? form.profile_image : SERVER_URL + form.profile_image}
              alt="Profile Preview"
              className="w-32 h-32 object-cover rounded-full"
            />
          ) : (
            <FaUserCircle className="w-32 h-32 text-gray-400" />
          )}
        </div>
        <div>
          <label className="block mb-1 font-medium">เปลี่ยนรหัสผ่านใหม่ (ถ้าต้องการ)</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="รหัสผ่านใหม่"
            className="w-full border border-gray-300 rounded px-3 py-2"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">ยืนยันรหัสผ่านใหม่</label>
          <input
            type="password"
            name="passwordConfirm"
            value={form.passwordConfirm}
            onChange={handleChange}
            placeholder="ยืนยันรหัสผ่านใหม่"
            className="w-full border border-gray-300 rounded px-3 py-2"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          className="bg-[#6b3e26] text-white py-2 px-4 rounded hover:bg-[#8a553d]"
          disabled={uploading}
        >
          บันทึกข้อมูล
        </button>
      </form>
    </div>
  );
}
