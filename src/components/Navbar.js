import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUserCircle, FaUsers } from 'react-icons/fa';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-[#6b3e26] text-white py-4 px-6 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        {/* Logo / ชื่อร้าน */}
        <h1
          className="text-2xl font-bold tracking-wide cursor-pointer"
          onClick={() => navigate('/')}
        >
          KP VINTAGE
        </h1>

        {/* เมนูด้านขวา */}
        <div className="flex items-center space-x-6 text-sm sm:text-base font-medium">
          <Link to="/" className="hover:underline hover:text-yellow-200 transition">
            หน้าแรก
          </Link>
          <Link to="/cart" className="hover:underline hover:text-yellow-200 transition">
            ตะกร้า
          </Link>

          {/* แสดงเฉพาะเมื่อเป็นแอดมิน */}
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="flex items-center space-x-2 hover:underline hover:text-yellow-200 transition"
            >
              <FaUsers size={18} />
              <span>Admin</span>
            </Link>
          )}

          {/* User / Login-Logout */}
          {user ? (
            <div className="flex items-center space-x-4">
              <Link
                to="/profile"
                className="flex items-center space-x-2 hover:underline hover:text-yellow-200 transition"
              >
                {user.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt="Profile"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <FaUserCircle size={24} />
                )}
                <span>สวัสดี, {user.username}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="hover:underline hover:text-yellow-200 transition"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <Link to="/login" className="hover:underline hover:text-yellow-200 transition">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
