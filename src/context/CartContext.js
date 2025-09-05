// src/context/CartContext.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CartContext = createContext();

/* ---------- Utils ---------- */
const normId = (v) => String(v ?? '');                // บังคับ id เป็น string
const normSize = (v) => (v == null ? null : String(v)); // บังคับ size เป็น string หรือ null

function getStorageKey(user) {
  const uid = user?.id ?? user?.user_id ?? user?.email ?? 'guest';
  return `cart:${String(uid)}`;
}

function safeParse(json, fallback = []) {
  try { return json ? JSON.parse(json) : fallback; } catch { return fallback; }
}

// รวมตะกร้าตาม id+size แล้วบวก qty
function mergeCarts(a = [], b = []) {
  const map = new Map();
  [...a, ...b].forEach(it => {
    const id = normId(it.id);
    const size = normSize(it.size);
    const key = `${id}::${size ?? ''}`;
    const prev = map.get(key) || { ...it, id, size, qty: 0, price: Number(it.price || 0) };
    map.set(key, { ...prev, qty: (prev.qty || 0) + (Number(it.qty) || 1) });
  });
  return [...map.values()];
}

/* ---------- Provider ---------- */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const storageKey = useMemo(() => getStorageKey(user), [user]);

  const [cart, setCart] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    return safeParse(raw, []).map(it => ({
      ...it,
      id: normId(it.id),
      size: normSize(it.size),
      price: Number(it.price || 0),
      qty: Number(it.qty || 1),
    }));
  });

  const mergedOnceRef = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    const next = safeParse(raw, []).map(it => ({
      ...it,
      id: normId(it.id),
      size: normSize(it.size),
      price: Number(it.price || 0),
      qty: Number(it.qty || 1),
    }));

    // one-time merge: guest -> user
    if (!mergedOnceRef.current) {
      const prevKeyGuest = 'cart:guest';
      const rawGuest = localStorage.getItem(prevKeyGuest);
      const guestCart = safeParse(rawGuest, []).map(it => ({
        ...it,
        id: normId(it.id),
        size: normSize(it.size),
        price: Number(it.price || 0),
        qty: Number(it.qty || 1),
      }));
      if (user && guestCart.length > 0) {
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

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  /* ---------- Helpers for matching ---------- */
  const findIndexesById = (list, id) => {
    const nid = normId(id);
    const idxs = [];
    list.forEach((p, i) => { if (normId(p.id) === nid) idxs.push(i); });
    return idxs;
  };
  const findIndexByIdSize = (list, id, size) => {
    const nid = normId(id);
    const nsize = normSize(size);
    return list.findIndex(p => normId(p.id) === nid && normSize(p.size) === nsize);
  };

  /* ================= Mutations ================= */

  // เพิ่มของเข้าตะกร้า: รองรับ qty และแยกตาม size
  const addToCart = (item) => {
    const id = normId(item.id);
    const size = normSize(item.size);
    const qtyToAdd = Math.max(1, Number(item.qty || 1));
    const price = Number(item.price || 0);

    setCart(prev => {
      const idx = findIndexByIdSize(prev, id, size);
      if (idx === -1) {
        return [...prev, { ...item, id, size, price, qty: qtyToAdd }];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: Math.max(1, Number(copy[idx].qty || 1) + qtyToAdd) };
      return copy;
    });
  };

  // ลบ (ถ้ามี size ให้ลบเฉพาะแถวนั้น; ถ้าไม่ให้ และมีหลายแถวของ id เดียว → ลบทั้งหมดของ id นั้น)
  const removeFromCart = (id, size = null) => {
    const nid = normId(id);
    const nsize = normSize(size);

    setCart(prev => {
      if (nsize !== null) {
        return prev.filter(p => !(normId(p.id) === nid && normSize(p.size) === nsize));
      }
      // ไม่มี size
      const idxs = findIndexesById(prev, nid);
      if (idxs.length <= 1) {
        // มีแถวเดียว → ลบแถวนั้น
        return prev.filter(p => normId(p.id) !== nid);
      }
      // มีหลายไซซ์ → ลบทั้งหมดของ id นี้ (เพื่อให้ปุ่มไม่เงียบ)
      return prev.filter(p => normId(p.id) !== nid);
    });
  };

  // เซ็ตจำนวน: ถ้ามี size → เซ็ตตรงแถวนั้น; ถ้าไม่มีกับมีหลายไซซ์ → เซ็ตเฉพาะแถวแรกของ id; ถ้าเหลือ 0 → ลบทิ้ง
  const setQty = (id, size = null, qty) => {
    const nid = normId(id);
    const nsize = normSize(size);
    const nextQty = Math.max(0, Number(qty) || 0);

    setCart(prev => {
      const copy = [...prev];
      if (nsize !== null) {
        const idx = findIndexByIdSize(copy, nid, nsize);
        if (idx === -1) return prev; // ไม่พบ
        if (nextQty === 0) return copy.filter((_, i) => i !== idx);
        copy[idx] = { ...copy[idx], qty: nextQty };
        return copy;
      }

      // ไม่ระบุ size
      const idxs = findIndexesById(copy, nid);
      if (idxs.length === 0) return prev;         // ไม่พบ
      const target = idxs[0];                     // แก้ตัวแรกของ id
      if (nextQty === 0) return copy.filter((_, i) => i !== target);
      copy[target] = { ...copy[target], qty: nextQty };
      return copy;
    });
  };

  // เพิ่ม/ลดจำนวนแบบ step (ไม่ระบุ size ก็จัดการตัวแรกของ id)
  const increaseQty = (id, size = null, step = 1) => {
    const nid = normId(id);
    const nsize = normSize(size);
    setCart(prev => {
      const copy = [...prev];
      let idx = -1;
      if (nsize !== null) {
        idx = findIndexByIdSize(copy, nid, nsize);
      } else {
        const idxs = findIndexesById(copy, nid);
        idx = idxs[0] ?? -1;
      }
      if (idx === -1) return prev;
      copy[idx] = { ...copy[idx], qty: (Number(copy[idx].qty) || 1) + step };
      return copy;
    });
  };

  const decreaseQty = (id, size = null, step = 1) => {
    const nid = normId(id);
    const nsize = normSize(size);
    setCart(prev => {
      const copy = [...prev];
      let idx = -1;
      if (nsize !== null) {
        idx = findIndexByIdSize(copy, nid, nsize);
      } else {
        const idxs = findIndexesById(copy, nid);
        idx = idxs[0] ?? -1;
      }
      if (idx === -1) return prev;
      const next = Math.max(0, (Number(copy[idx].qty) || 1) - step);
      if (next === 0) return copy.filter((_, i) => i !== idx);
      copy[idx] = { ...copy[idx], qty: next };
      return copy;
    });
  };

  const clearCart = () => setCart([]);

  const totalQty = useMemo(
    () => cart.reduce((s, i) => s + (Number(i.qty) || 0), 0),
    [cart]
  );

  const totalPrice = useMemo(
    () => cart.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0),
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        setQty,
        increaseQty,
        decreaseQty,
        clearCart,
        totalQty,
        totalPrice
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
