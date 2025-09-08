// src/components/Navbar.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaUserCircle, FaUsers, FaHome, FaShoppingCart, FaListAlt, FaSearch, FaTimes,
} from 'react-icons/fa';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000';

function ensureURL(u) {
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${API_BASE}${path}`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarSrc, setAvatarSrc] = useState('');

  // หน้าไหนไม่ต้องแสดง search
  const HIDE_SEARCH_ROUTES = useMemo(
    () => [/^\/login$/, /^\/register$/, /^\/profile$/, /^\/cart(\/.*)?$/, /^\/orders(\/.*)?$/, /^\/admin(\/.*)?$/],
    []
  );
  const showSearchUI = useMemo(
    () => !HIDE_SEARCH_ROUTES.some((re) => re.test(location.pathname)),
    [location.pathname, HIDE_SEARCH_ROUTES]
  );

  // โหลด avatar
  useEffect(() => {
    const raw = user?.profile_image ? ensureURL(user.profile_image) : (user?.profile_image_url || '');
    if (raw) {
      const sep = raw.includes('?') ? '&' : '?';
      setAvatarSrc(`${raw}${sep}v=${Date.now()}`);
    } else setAvatarSrc('');
  }, [user?.profile_image, user?.profile_image_url]);

  // ปิด search บนมือถือเมื่อเปลี่ยนหน้า
  useEffect(() => {
    setShowMobileSearch(false);
  }, [location.pathname]);

  // ถ้า logout ให้รีเซ็ตช่องค้นหา
  useEffect(() => {
    if (!user) setSearchQuery('');
  }, [user]);

  const handleLogout = () => {
    logout();
    setSearchQuery('');
    navigate('/login');
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) navigate(`/search?query=${encodeURIComponent(q)}`);
  };

  return (
    <>
      {/* Desktop / Tablet ใหญ่ */}
      <nav className="hidden md:block bg-[#6b3e26] text-white py-4 px-6 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center gap-6">
          {/* Logo */}
          <h1
            className="text-2xl font-bold tracking-wide cursor-pointer shrink-0"
            onClick={() => navigate('/')}
          >
            KP VINTAGE
          </h1>

          {/* ช่องค้นหา/ตัวถ่วง */}
          <div className="flex-1 max-w-xl">
            {showSearchUI ? (
              <div className="flex bg-white rounded-xl px-3 py-2">
                <input
                  type="text"
                  className="flex-1 bg-transparent text-black outline-none"
                  placeholder="ค้นหาสินค้า..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="ml-2 px-3 py-1 bg-[#6b3e26] text-white rounded-lg"
                >
                  ค้นหา
                </button>
              </div>
            ) : (
              <>
                {/* spacer ความสูงเท่ากล่องค้นหา */}
                <div className="h-10" />
              </>
            )}
          </div>

          {/* เมนูขวา */}
          <div className="flex items-center space-x-6 text-sm sm:text-base font-medium">
            <Link to="/" className="hover:underline hover:text-yellow-200 transition">หน้าแรก</Link>
            <Link to="/cart" className="hover:underline hover:text-yellow-200 transition">ตะกร้า</Link>
            <Link to="/orders" className="hover:underline hover:text-yellow-200 transition">คำสั่งซื้อของฉัน</Link>

            {user?.role === 'admin' && (
              <Link to="/admin" className="flex items-center space-x-2 hover:underline hover:text-yellow-200 transition">
                <FaUsers size={18} /><span>Admin</span>
              </Link>
            )}

            {user ? (
              <div className="flex items-center space-x-4">
                <Link to="/profile" className="flex items-center space-x-2 hover:underline hover:text-yellow-200 transition">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Profile" className="w-6 h-6 rounded-full object-cover border border-white/30" />
                  ) : (
                    <FaUserCircle size={24} />
                  )}
                  <span>สวัสดี, {user.username || user.email}</span>
                </Link>
                <button onClick={handleLogout} className="hover:underline hover:text-yellow-200 transition">
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <Link to="/login" className="hover:underline hover:text-yellow-200 transition">เข้าสู่ระบบ</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile / Tablet เล็ก */}
      <nav className="md:hidden bg-[#6b3e26] text-white shadow-md sticky top-0 z-50">
        <div className="h-14 px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>
            KP VINTAGE
          </h1>

          {showSearchUI ? (
            <button
              onClick={() => setShowMobileSearch(v => !v)}
              className="p-2 rounded hover:bg-white/10"
            >
              {showMobileSearch ? <FaTimes /> : <FaSearch />}
            </button>
          ) : (
            <>
              {/* spacer ขนาดปุ่ม */}
              <div className="w-9 h-9" />
            </>
          )}
        </div>

        {showSearchUI && (
          <div
            className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
              showMobileSearch ? 'max-h-20' : 'max-h-0'
            }`}
          >
            <div className="px-4 pb-3">
              <div className="flex bg-white rounded-xl px-3 py-2">
                <input
                  type="text"
                  className="flex-1 bg-transparent text-black outline-none"
                  placeholder="ค้นหาสินค้า..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button onClick={handleSearch} className="ml-2 px-3 py-1 bg-[#6b3e26] text-white rounded-lg">
                  ค้นหา
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-[#6b3e26] text-white z-50">
        <div className="grid grid-cols-4">
          <TabLink to="/" label="หน้าแรก" icon={<FaHome />} active={location.pathname === '/'} />
          <TabLink to="/cart" label="ตะกร้า" icon={<FaShoppingCart />} active={location.pathname.startsWith('/cart')} />
          <TabLink to="/orders" label="คำสั่งซื้อ" icon={<FaListAlt />} active={location.pathname.startsWith('/orders')} />
          <TabLink
            to={user ? '/profile' : '/login'}
            label="ฉัน"
            icon={<FaUserCircle />}
            active={location.pathname.startsWith('/profile') || location.pathname.startsWith('/login')}
          />
        </div>
      </div>
      <div className="md:hidden h-14" />
    </>
  );
}

function TabLink({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center py-2 text-xs ${
        active ? 'text-yellow-200' : 'text-white'
      }`}
    >
      <div className="text-lg">{icon}</div>
      <span>{label}</span>
    </Link>
  );
}
