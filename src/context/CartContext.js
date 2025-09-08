import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CartContext = createContext();

/* ---------- Utils (HARDENED) ---------- */
const normId = (v) => String(v ?? '');
const normSize = (v) => (v == null ? null : String(v));

const toNumFinite = (v) => {
  // อย่าตีความ null/undefined/'' เป็น 0
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
    const id = normId(it.id);
    if (!id) return; // ⛔ กัน id ว่างไม่ให้รวมเข้าไป
    const size = normSize(it.size);
    const key = `${id}::${size ?? ''}`;
    const prev = map.get(key) || { ...it, id, size, qty: 0, price: Number(it.price || 0) };
    map.set(key, { ...prev, qty: (prev.qty || 0) + (Number(it.qty) || 1) });
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

    // เริ่มรอบใหม่: ปิด writer ไว้ก่อน
    setHydrated(false);

    // 1) guest → user (ล็อกอิน)
    if (prevKey === null && currKey !== null) {
      const userCartStored  = readCart(`cart:${currKey}`);
      const guestCartStored = readCart('cart:guest');
      const merged = mergeCarts(userCartStored, guestCartStored);

      writeCart(`cart:${currKey}`, merged);
      // ✅ สำคัญ: ล้าง guest ทันที กันบวกซ้ำรอบถัดไป
      localStorage.removeItem('cart:guest');

      mergedForKeyRef.current = currKey;
      setCart(merged);
      lastUserKeyRef.current = currKey;
      setHydrated(true);
      return;
    }

    // 2) user → guest (ล็อกเอาต์)
    if (prevKey !== null && currKey === null) {
      // ✅ เคลียร์ guest cart ให้ว่าง เพื่อไม่เอามา merge รอบเข้าใหม่
      writeCart('cart:guest', []);
      setCart([]);
      lastUserKeyRef.current = null;
      mergedForKeyRef.current = null;
      setHydrated(true);
      return;
    }

    // 3) สลับบัญชี userA → userB
    if (prevKey !== null && currKey !== null && prevKey !== currKey) {
      // โหลดของ userB โดยไม่ merge กับ guest เพื่อกันรั่ว/ซ้ำ
      const newUserCart = readCart(`cart:${currKey}`);
      writeCart(`cart:${currKey}`, newUserCart);
      // กันกรณี guest ค้างจากก่อนหน้า
      localStorage.removeItem('cart:guest');

      mergedForKeyRef.current = currKey;
      setCart(newUserCart);
      lastUserKeyRef.current = currKey;
      setHydrated(true);
      return;
    }

    // 4) คีย์ไม่เปลี่ยน
    if (currKey === null) {
      // guest: sync จาก storage
      setCart(readCart('cart:guest'));
    } else {
      if (mergedForKeyRef.current !== currKey) {
        // เข้าสู่หน้าแรกหลัง login: รวม storage ครั้งเดียวเพื่อความชัวร์
        const userCartStored  = readCart(`cart:${currKey}`);
        const guestCartStored = readCart('cart:guest');
        const merged = mergeCarts(userCartStored, guestCartStored);
        writeCart(`cart:${currKey}`, merged);
        // ✅ ล้าง guest หลัง merge เพื่อกันบวกซ้ำ
        localStorage.removeItem('cart:guest');

        mergedForKeyRef.current = currKey;
        setCart(merged);
      } else {
        // sync user cart จาก storage
        setCart(readCart(`cart:${currKey}`));
      }
    }

    lastUserKeyRef.current = currKey;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  // เขียน state ลง storage ตามคีย์ปัจจุบันเสมอ (แต่เฉพาะหลัง hydrate)
  useEffect(() => {
    if (!hydrated) return; // ป้องกัน “เขียนทับเป็น []” ตอน userKey เพิ่งเปลี่ยน
    const key = userKey ? `cart:${userKey}` : 'cart:guest';
    writeCart(key, cart);
  }, [cart, userKey, hydrated]);

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
    const price = Number(item.price);
    const qtyToAdd = Math.max(1, Number(item.qty) || 1);
    const incomingMax = toNumFinite(item.maxStock);

    // ⛔ ป้องกันของเสียตั้งแต่ต้นทาง
    if (!id) { console.warn('addToCart: missing id', item); return; }
    if (!Number.isFinite(price)) { console.warn('addToCart: invalid price', item); return; }

    setCart(prev => {
      const idx = findIndexByIdSize(prev, id, size);
      if (idx === -1) {
        const initMax = incomingMax ?? Infinity;
        return [...prev, { ...item, id, size, price, qty: clampQty(qtyToAdd, initMax), maxStock: initMax }];
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
      copy[idx] = { ...old, qty: nextQty, maxStock: newMax, price };
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
