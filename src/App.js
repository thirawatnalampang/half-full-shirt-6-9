import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Category from './pages/Category';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';           // ใช้เป็น “หน้าตะกร้า”
import Header from './components/Navbar';
import LoginForm from './pages/LoginForm';
import RegisterForm from './pages/RegisterForm';
import ProfilePage from './pages/ProfilePage';
import './App.css';

function App() {
  const [cart, setCart] = useState([]);

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home cart={cart} setCart={setCart} />} />
        <Route path="/category/:categoryName" element={<Category cart={cart} setCart={setCart} />} />
        <Route path="/product/:productId" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart cart={cart} />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      {/* ไม่มี <Cart /> ลอยล่างขวาแล้ว */}
    </>
  );
}

export default App;
