// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000';
const AuthContext = createContext();

// ทำ URL รูปให้ใช้ได้เสมอ (รับได้ทั้ง full URL และ path)
function ensureURL(u) {
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  // กันกรณี path ไม่มี / นำหน้า
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${API_BASE}${path}`;
}

// แปลงข้อมูล user จาก backend/localStorage ให้เป็นฟอร์แมตเดียว
function normalizeUser(input) {
  if (!input) return null;
  const avatar =
    input.profile_image ||
    input.image ||
    input.avatar ||
    '';

  const role = input.role ?? input.role_name ?? 'user';
  return {
    id: input.id ?? input.user_id ?? null,
    email: input.email ?? '',
    username: input.username ?? input.name ?? '',
    role,
    isAdmin: Boolean(input.isAdmin ?? role === 'admin'),
    // เก็บทั้ง raw และ url ที่พร้อมใช้
    profile_image: avatar || '',
    profile_image_url: avatar ? ensureURL(avatar) : '',
    // ใส่ token/expiry ถ้ามี
    token: input.token ?? undefined,
  };
}

export function AuthProvider({ children }) {
  // โหลดจาก localStorage ครั้งแรก
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? normalizeUser(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });

  // sync ลง localStorage เสมอเมื่อ user เปลี่ยน
  useEffect(() => {
    try {
      if (user) localStorage.setItem('user', JSON.stringify(user));
      else localStorage.removeItem('user');
    } catch {}
  }, [user]);

  // login: แทนที่ object ทั้งก้อน (อย่า merge ตัวเก่า)
  const login = (userData) => setUser(normalizeUser(userData));

  // อัปเดตบางส่วน (เช่น เปลี่ยนชื่อ / อัปโหลดรูปใหม่)
  const updateUser = (partial) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...(partial || {}) };
      return normalizeUser(merged);
    });
  };

  const logout = () => setUser(null);

  // เผย helper สำหรับ Navbar
  const getAvatarUrl = (u = user) => (u?.profile_image_url || '');

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, updateUser, getAvatarUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
