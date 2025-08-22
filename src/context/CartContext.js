// src/context/CartContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // ✅ รวมชิ้นเดิมด้วย id และตั้ง qty เริ่มต้น
  const addToCart = (item) => {
    setCart((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id);
      if (idx === -1) return [...prev, { ...item, qty: 1 }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: (copy[idx].qty || 1) + 1 };
      return copy;
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const setQty = (id, qty) => {
    setCart((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, qty: Math.max(1, qty) } : p))
        .filter((p) => p.qty > 0)
    );
  };

  const clearCart = () => setCart([]);

  const totalQty = cart.reduce((s, i) => s + (i.qty || 0), 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, setQty, clearCart, totalQty }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
