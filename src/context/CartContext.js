// src/context/CartContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CartContext = createContext();

/* ---------- Utils (HARDENED) ---------- */
const normId   = (v) => String(v ?? '');
const normSize = (v) => (v == null ? null : String(v));
const normKey  = (v) => (v == null ? null : String(v)); // สำหรับ variantKey (เช่น c25-l24)

const toNumFinite = (v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const clampQty = (qty, maxStock) => {
  const max = Number.isFinite(maxStock) ? Math.max(0, Number(maxStock)) : Infinity;
  return Math.max(1, Math.min(Number(qty) || 1, max));
};

// parse แล้วคืนค่าเป็น Array เสมอ (ถ้าเป็น object จะดึง values)
const safeParseArr = (json) => {
  try {
    const data = json ? JSON.parse(json) : [];
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return Object.values(data);
    return [];
  } catch {
    return [];
  }
};

const isFiniteNum = (n) => Number.isFinite(Number(n));

/** คีย์เอกลักษณ์ของ item ในตะกร้า: id + (variantKey || size) */
const cartKeyOf = (it) => {
  const id = normId(it?.id);
  const vk = normKey(it?.variantKey);
  const sz = normSize(it?.size);
  return `${id}::${vk ?? sz ?? ''}`;
};

const readCart = (key) => {
  const raw = localStorage.getItem(key);
  const arr = safeParseArr(raw);
  return arr
    .map((it) => {
      const qty = Number(it?.qty || 1);
      const parsedMax = toNumFinite(it?.maxStock); // null -> undefined
      return {
        ...it,
        id: normId(it?.id),
        size: normSize(it?.size),
        variantKey: normKey(it?.variantKey),
        // measures เก็บตามที่มา (อาจเป็น {chest_cm, length_cm}) ไม่บังคับแปลง
        measures: it?.measures ?? null,
        price: Number(it?.price || 0),
        qty,
        maxStock: parsedMax ?? Infinity,
      };
    })
    // 🔒 ทิ้งรายการที่ไม่สมบูรณ์
    .filter((it) => it.id !== '' && isFiniteNum(it.price) && isFiniteNum(it.qty) && it.qty > 0);
};

const writeCart = (key, arr) => {
  // บันทึกเป็น array เสมอ
  const out = Array.isArray(arr) ? arr : (arr && typeof arr === 'object' ? Object.values(arr) : []);
  localStorage.setItem(key, JSON.stringify(out));
};

const mergeCarts = (a = [], b = []) => {
  const map = new Map();
  [...a, ...b].forEach((it) => {
    const id = normId(it?.id);
    if (!id) return; // ⛔ กัน id ว่างไม่ให้รวมเข้าไป
    const k = cartKeyOf(it);
    const prev = map.get(k) || { ...it, id, qty: 0, price: Number(it.price || 0) };
    map.set(k, { ...prev, qty: (prev.qty || 0) + (Number(it.qty) || 1) });
  });
  return [...map.values()];
};

/* ---------- Provider ---------- */
export function CartProvider({ children }) {
  const { user } = useAuth();

  // ให้ userKey ต่อเมื่อมี id/user_id/email เท่านั้น
  const userKey = useMemo(() => {
    const ukey = user?.id ?? user?.user_id ?? user?.email;
    return ukey ? String(ukey) : null;
  }, [user]);

  // เริ่มจาก guest; จะถูก hydrate/merge ภายหลัง
  const [cart, setCart] = useState(() => readCart('cart:guest'));

  // กัน writer เขียนก่อน hydrate เสร็จ
  const [hydrated, setHydrated] = useState(false);

  // จำคีย์ก่อนหน้า และกัน merge ซ้ำ
  const lastUserKeyRef = useRef(userKey);
  const mergedForKeyRef = useRef(null);

  useEffect(() => {
    const prevKey = lastUserKeyRef.current; // null = guest เดิม
    const currKey = userKey;                // null = guest ใหม่

    setHydrated(false);

    // 1) guest → user (ล็อกอิน)
    if (prevKey === null && currKey !== null) {
      const userCartStored  = readCart(`cart:${currKey}`);
      const guestCartStored = readCart('cart:guest');
      const merged = mergeCarts(userCartStored, guestCartStored);

      writeCart(`cart:${currKey}`, merged);
      localStorage.removeItem('cart:guest'); // ✅ กันบวกซ้ำ

      mergedForKeyRef.current = currKey;
      setCart(merged);
      lastUserKeyRef.current = currKey;
      setHydrated(true);
      return;
    }

    // 2) user → guest (ล็อกเอาต์)
    if (prevKey !== null && currKey === null) {
      writeCart('cart:guest', []);
      setCart([]);
      lastUserKeyRef.current = null;
      mergedForKeyRef.current = null;
      setHydrated(true);
      return;
    }

    // 3) สลับบัญชี userA → userB
    if (prevKey !== null && currKey !== null && prevKey !== currKey) {
      const newUserCart = readCart(`cart:${currKey}`);
      writeCart(`cart:${currKey}`, newUserCart);
      localStorage.removeItem('cart:guest');

      mergedForKeyRef.current = currKey;
      setCart(newUserCart);
      lastUserKeyRef.current = currKey;
      setHydrated(true);
      return;
    }

    // 4) คีย์ไม่เปลี่ยน
    if (currKey === null) {
      setCart(readCart('cart:guest'));
    } else {
      if (mergedForKeyRef.current !== currKey) {
        const userCartStored  = readCart(`cart:${currKey}`);
        const guestCartStored = readCart('cart:guest');
        const merged = mergeCarts(userCartStored, guestCartStored);
        writeCart(`cart:${currKey}`, merged);
        localStorage.removeItem('cart:guest');

        mergedForKeyRef.current = currKey;
        setCart(merged);
      } else {
        setCart(readCart(`cart:${currKey}`));
      }
    }

    lastUserKeyRef.current = currKey;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  // เขียน state ลง storage ตามคีย์ปัจจุบันเสมอ (หลัง hydrate เท่านั้น)
  useEffect(() => {
    if (!hydrated) return;
    const key = userKey ? `cart:${userKey}` : 'cart:guest';
    writeCart(key, cart);
  }, [cart, userKey, hydrated]);

  /* ---------- Helpers ---------- */
  const findIndexByIdKey = (list, id, variantKey, size) => {
    const nid = normId(id);
    const nvk = normKey(variantKey);
    const nsz = normSize(size);
    return list.findIndex(p =>
      normId(p.id) === nid &&
      (normKey(p.variantKey) ?? null) === (nvk ?? null) &&
      (normSize(p.size)      ?? null) === (nsz ?? null)
    );
  };

  /* ================= Mutations ================= */
  const addToCart = (item) => {
    const id   = normId(item.id);
    const size = normSize(item.size);
    const vKey = normKey(item.variantKey);
    const price = Number(item.price);
    const qtyToAdd = Math.max(1, Number(item.qty) || 1);
    const incomingMax = toNumFinite(item.maxStock);

    if (!id) { console.warn('addToCart: missing id', item); return; }
    if (!Number.isFinite(price)) { console.warn('addToCart: invalid price', item); return; }

    setCart(prev => {
      const idx = findIndexByIdKey(prev, id, vKey, size);
      if (idx === -1) {
        const initMax = incomingMax ?? Infinity;
        return [
          ...prev,
          {
            ...item,
            id,
            size,
            variantKey: vKey,
            price,
            qty: clampQty(qtyToAdd, initMax),
            maxStock: initMax,
          }
        ];
      }
      const copy = [...prev];
      const old = copy[idx];

      const newMax = Number.isFinite(incomingMax)
        ? incomingMax
        : (Number.isFinite(old.maxStock) ? old.maxStock : Infinity);

      if ((Number(old.qty) || 0) >= newMax) {
        copy[idx] = { ...old, maxStock: newMax };
        return copy;
      }

      const nextQty = clampQty((Number(old.qty) || 0) + qtyToAdd, newMax);
      copy[idx] = {
        ...old,
        qty: nextQty,
        maxStock: newMax,
        price,
        size,
        variantKey: vKey,
        measures: item.measures ?? old.measures ?? null,
      };
      return copy;
    });
  };

  const removeFromCart = (id, size = null, variantKey = null) => {
    const nid  = normId(id);
    const nsz  = normSize(size);
    const nvk  = normKey(variantKey);
    setCart(prev => {
      return prev.filter(p =>
        !(normId(p.id) === nid &&
          (normSize(p.size)      ?? null) === (nsz ?? null) &&
          (normKey(p.variantKey) ?? null) === (nvk ?? null))
      );
    });
  };

  const setQty = (id, size = null, qty, variantKey = null) => {
    const nid = normId(id);
    const nsz = normSize(size);
    const nvk = normKey(variantKey);
    setCart(prev => {
      const copy = [...prev];
      const idx = findIndexByIdKey(copy, nid, nvk, nsz);
      if (idx === -1) return prev;
      const nextQty = Math.max(0, Number(qty) || 0);
      if (nextQty === 0) return copy.filter((_, i) => i !== idx);
      const max = copy[idx].maxStock;
      copy[idx] = { ...copy[idx], qty: clampQty(nextQty, max) };
      return copy;
    });
  };

  const increaseQty = (id, size = null, step = 1, variantKey = null) => {
    const nid = normId(id);
    const nsz = normSize(size);
    const nvk = normKey(variantKey);
    setCart(prev => {
      const copy = [...prev];
      const idx = findIndexByIdKey(copy, nid, nvk, nsz);
      if (idx === -1) return prev;
      const max = copy[idx].maxStock;
      copy[idx] = { ...copy[idx], qty: clampQty((copy[idx].qty || 1) + step, max) };
      return copy;
    });
  };

  const decreaseQty = (id, size = null, step = 1, variantKey = null) => {
    const nid = normId(id);
    const nsz = normSize(size);
    const nvk = normKey(variantKey);
    setCart(prev => {
      const copy = [...prev];
      const idx = findIndexByIdKey(copy, nid, nvk, nsz);
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
  const totalPrice = useMemo(
    () => cart.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0),
    [cart]
  );

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
