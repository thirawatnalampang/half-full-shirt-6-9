import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CartContext = createContext();

/* ---------- Utils ---------- */
const normId = (v) => String(v ?? '');
const normSize = (v) => (v == null ? null : String(v));
const clampQty = (qty, maxStock) => {
  const max = Number.isFinite(maxStock) ? Math.max(0, Number(maxStock)) : Infinity;
  return Math.max(1, Math.min(Number(qty) || 1, max));
};
const getStorageKey = (user) => `cart:${String(user?.id ?? user?.user_id ?? user?.email ?? 'guest')}`;
const safeParse = (json, fb = []) => { try { return json ? JSON.parse(json) : fb; } catch { return fb; } };

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
    return safeParse(raw, []).map(it => {
      const qty = Number(it.qty || 1);
      const parsedMax = Number.isFinite(it.maxStock) ? Number(it.maxStock) : undefined;
      return {
        ...it,
        id: normId(it.id),
        size: normSize(it.size),
        price: Number(it.price || 0),
        qty,
        // ★ ถ้าไม่มี maxStock เดิม ให้ล็อกไว้เท่ากับ qty ปัจจุบัน
        maxStock: parsedMax ?? qty,
      };
    });
  });

  const mergedOnceRef = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    const next = safeParse(raw, []).map(it => {
      const qty = Number(it.qty || 1);
      const parsedMax = Number.isFinite(it.maxStock) ? Number(it.maxStock) : undefined;
      return {
        ...it,
        id: normId(it.id),
        size: normSize(it.size),
        price: Number(it.price || 0),
        qty,
        // ★ migration เช่นเดียวกันตอนรีโหลด
        maxStock: parsedMax ?? qty,
      };
    });

    // one-time merge: guest -> user
    if (!mergedOnceRef.current) {
      const rawGuest = localStorage.getItem('cart:guest');
      const guestCart = safeParse(rawGuest, []).map(it => {
        const qty = Number(it.qty || 1);
        const parsedMax = Number.isFinite(it.maxStock) ? Number(it.maxStock) : undefined;
        return {
          ...it,
          id: normId(it.id),
          size: normSize(it.size),
          price: Number(it.price || 0),
          qty,
          // ★ migration สำหรับ guest
          maxStock: parsedMax ?? qty,
        };
      });
      if (user && guestCart.length > 0) {
        const merged = mergeCarts(next, guestCart);
        localStorage.setItem(storageKey, JSON.stringify(merged));
        localStorage.removeItem('cart:guest');
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

  /* ---------- Helpers ---------- */
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

  const addToCart = (item) => {
    const id = normId(item.id);
    const size = normSize(item.size);
    const price = Number(item.price || 0);
    const qtyToAdd = Math.max(1, Number(item.qty || 1));
    const incomingMax = Number.isFinite(item.maxStock) ? Number(item.maxStock) : undefined;

    setCart(prev => {
      const idx = findIndexByIdSize(prev, id, size);
      if (idx === -1) {
        // ★ ถ้าไม่ส่ง maxStock มา ให้ตั้งลิมิตอย่างน้อยเป็น qtyToAdd (กันไม่ให้โตจาก 1 แบบไร้ลิมิต)
        const initMax = incomingMax ?? qtyToAdd;
        return [...prev, { ...item, id, size, price, qty: clampQty(qtyToAdd, initMax), maxStock: initMax }];
      }
      const copy = [...prev];
      const old = copy[idx];

      // ★ newMax: ใช้ค่าที่ส่งมา ถ้าไม่ส่งมาและของเดิมก็ไม่มี ให้ล็อกไว้เท่ากับ qty ปัจจุบัน
      const newMax = Number.isFinite(incomingMax)
        ? incomingMax
        : (Number.isFinite(old.maxStock) ? old.maxStock : Math.max(1, Number(old.qty) || 1));

      // ★ ถ้าถึงลิมิตแล้ว ไม่เพิ่มซ้ำ
      if ((Number(old.qty) || 0) >= newMax) {
        copy[idx] = { ...old, maxStock: newMax };
        return copy;
      }

      const nextQty = clampQty((Number(old.qty) || 0) + qtyToAdd, newMax);
      copy[idx] = { ...old, qty: nextQty, maxStock: newMax };
      return copy;
    });
  };

  const removeFromCart = (id, size = null) => {
    const nid = normId(id);
    const nsize = normSize(size);
    setCart(prev => {
      if (nsize !== null) return prev.filter(p => !(normId(p.id) === nid && normSize(p.size) === nsize));
      return prev.filter(p => normId(p.id) !== nid);
    });
  };

  const setQty = (id, size = null, qty) => {
    const nid = normId(id);
    const nsize = normSize(size);
    setCart(prev => {
      const copy = [...prev];
      const idx = nsize !== null ? findIndexByIdSize(copy, nid, nsize) : findIndexesById(copy, nid)[0] ?? -1;
      if (idx === -1) return prev;
      const nextQty = Math.max(0, Number(qty) || 0);
      if (nextQty === 0) return copy.filter((_, i) => i !== idx);
      const max = copy[idx].maxStock;
      copy[idx] = { ...copy[idx], qty: clampQty(nextQty, max) };
      return copy;
    });
  };

  const increaseQty = (id, size = null, step = 1) => {
    const nid = normId(id);
    const nsize = normSize(size);
    setCart(prev => {
      const copy = [...prev];
      const idx = nsize !== null ? findIndexByIdSize(copy, nid, nsize) : findIndexesById(copy, nid)[0] ?? -1;
      if (idx === -1) return prev;
      const max = copy[idx].maxStock;
      copy[idx] = { ...copy[idx], qty: clampQty((copy[idx].qty || 1) + step, max) };
      return copy;
    });
  };

  const decreaseQty = (id, size = null, step = 1) => {
    const nid = normId(id);
    const nsize = normSize(size);
    setCart(prev => {
      const copy = [...prev];
      const idx = nsize !== null ? findIndexByIdSize(copy, nid, nsize) : findIndexesById(copy, nid)[0] ?? -1;
      if (idx === -1) return prev;
      const next = Math.max(0, (Number(copy[idx].qty) || 1) - step);
      if (next === 0) return copy.filter((_, i) => i !== idx);
      const max = copy[idx].maxStock;
      copy[idx] = { ...copy[idx], qty: clampQty(next, max) };
      return copy;
    });
  };

  const clearCart = () => setCart([]);

  const totalQty = useMemo(() => cart.reduce((s, i) => s + (Number(i.qty) || 0), 0), [cart]);
  const totalPrice = useMemo(() => cart.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0), [cart]);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      setQty,
      increaseQty,
      decreaseQty,
      clearCart,
      totalQty,
      totalPrice,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
