// src/context/CartContext.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext'; // << ใช้ id ผู้ใช้จากที่นี่

const CartContext = createContext();

function getStorageKey(user) {
  // เลือกตัวระบุผู้ใช้ที่เชื่อถือได้
  const uid = user?.id ?? user?.user_id ?? user?.email ?? 'guest';
  return `cart:${uid}`;
}

function safeParse(json, fallback = []) {
  try { return json ? JSON.parse(json) : fallback; } catch { return fallback; }
}

function mergeCarts(a = [], b = []) {
  // รวมรายการตาม id แล้วบวก qty
  const map = new Map();
  [...a, ...b].forEach(it => {
    const id = it.id;
    const prev = map.get(id) || { ...it, qty: 0 };
    map.set(id, { ...prev, qty: (prev.qty || 0) + (it.qty || 1) });
  });
  return [...map.values()];
}

export function CartProvider({ children }) {
  const { user } = useAuth();

  // คีย์ปัจจุบันตามผู้ใช้
  const storageKey = useMemo(() => getStorageKey(user), [user]);

  // โหลดตะกร้าจากคีย์ของผู้ใช้คนนั้น
  const [cart, setCart] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    return safeParse(raw, []);
  });

  // ป้องกัน merge ซ้ำเมื่อเปลี่ยนจาก guest -> user
  const mergedOnceRef = useRef(false);

  // เมื่อผู้ใช้เปลี่ยนคน ให้โหลดตะกร้าของคนนั้น
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    const next = safeParse(raw, []);

    // กรณีเพิ่งล็อกอินจาก guest: รวมตะกร้าเดิม (cart ของ state ณ ตอนนั้น)
    // เข้ากับตะกร้าของผู้ใช้คนใหม่ 1 ครั้ง แล้วเคลียร์ของ guest
    if (!mergedOnceRef.current) {
      const prevKeyGuest = 'cart:guest';
      const rawGuest = localStorage.getItem(prevKeyGuest);
      const guestCart = safeParse(rawGuest, []);
      if ((user && guestCart.length > 0)) {
        const merged = mergeCarts(next, guestCart);
        localStorage.setItem(storageKey, JSON.stringify(merged));
        localStorage.removeItem(prevKeyGuest);
        mergedOnceRef.current = true;
        setCart(merged);
        return;
      }
    }

    setCart(next);
  }, [storageKey, user]);

  // บันทึก cart ของผู้ใช้คนนั้นๆ
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  // ===== Mutations =====
  const addToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(p => p.id === item.id);
      if (idx === -1) return [...prev, { ...item, qty: 1 }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: (copy[idx].qty || 1) + 1 };
      return copy;
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(p => p.id !== id));
  };

  const setQty = (id, qty) => {
    setCart(prev =>
      prev
        .map(p => (p.id === id ? { ...p, qty: Math.max(0, Number(qty) || 0) } : p))
        .filter(p => (p.qty || 0) > 0)
    );
  };

  const clearCart = () => setCart([]);

  const totalQty = useMemo(
    () => cart.reduce((s, i) => s + (i.qty || 0), 0),
    [cart]
  );

  const totalPrice = useMemo(
    () => cart.reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 1), 0),
    [cart]
  );

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, setQty, clearCart, totalQty, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
