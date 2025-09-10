// src/components/ProductCard.jsx
import React, { useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

const API_BASE = 'http://localhost:3000';

export default function ProductCard({ product }) {
  const { addToCart, cart = [] } = useCart();

  const [added, setAdded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [limitHit, setLimitHit] = useState(false);

  /* ---------- รวม “อก/ยาว” ---------- */
  const measureVariants = useMemo(() => {
    if (!product) return [];
    const out = [];

    const mvDirect = Array.isArray(product?.measure_variants || product?.measureVariants)
      ? (product.measure_variants || product.measureVariants)
      : (() => {
          try {
            return product?.measure_variants || product?.measureVariants
              ? JSON.parse(product.measure_variants || product.measureVariants)
              : [];
          } catch { return []; }
        })();

    for (const v of mvDirect) {
      const chest = Number(v?.chest_cm ?? v?.chest ?? NaN);
      const length = Number(v?.length_cm ?? v?.length ?? NaN);
      const stock  = Number(v?.stock ?? 0);
      if (Number.isFinite(chest) && Number.isFinite(length)) {
        out.push({ key: `c${chest}-l${length}`, chest, length, stock, meta: { source: 'measure_variants' }});
      }
    }

    const fromVariants = Array.isArray(product?.variants) ? product.variants : [];
    for (const v of fromVariants) {
      const chest = Number(v?.chest_cm ?? v?.chest ?? NaN);
      const length = Number(v?.length_cm ?? v?.length ?? NaN);
      if (Number.isFinite(chest) && Number.isFinite(length)) {
        out.push({ key: `c${chest}-l${length}`, chest, length, stock: Number(v?.stock ?? 0), meta: { source: 'variants', id: v?.id ?? null }});
      }
    }

    const sizeChart = product?.sizeChart && typeof product.sizeChart === 'object' ? product.sizeChart : null;
    const stockBySize = product?.stockBySize && typeof product.stockBySize === 'object' ? product.stockBySize : null;
    if (sizeChart) {
      const agg = new Map();
      for (const sz of Object.keys(sizeChart)) {
        const m = sizeChart[sz] || {};
        const chest = Number(m?.chest ?? m?.chest_cm ?? NaN);
        const length = Number(m?.length ?? m?.length_cm ?? NaN);
        if (!Number.isFinite(chest) || !Number.isFinite(length)) continue;
        const stock = stockBySize ? Number(stockBySize[sz] ?? 0) : 0;
        const key = `c${chest}-l${length}`;
        agg.set(key, (agg.get(key) || 0) + stock);
      }
      for (const [key, stock] of agg.entries()) {
        if (!out.some(x => x.key === key)) {
          const [cStr, lStr] = key.replace(/^c/, '').split('-l');
          out.push({ key, chest: Number(cStr), length: Number(lStr), stock: Number(stock || 0), meta: { source: 'sizeChart' }});
        }
      }
    }

    const best = new Map();
    for (const v of out) {
      const prev = best.get(v.key);
      if (!prev || Number(v.stock) > Number(prev.stock)) best.set(v.key, v);
    }
    return Array.from(best.values()).sort((a, b) => a.chest !== b.chest ? a.chest - b.chest : a.length - b.length);
  }, [product]);

  /* ---------- หักจำนวนที่อยู่ในตะกร้า ---------- */
  const inCartByKey = useMemo(() => {
    const map = {};
    cart.filter(it => it.id === product?.id).forEach(it => {
      const k = it.variantKey || (it.measures ? `c${Number(it.measures.chest_cm)}-l${Number(it.measures.length_cm)}` : '');
      if (!k) return;
      map[k] = (map[k] || 0) + Number(it.qty || 1);
    });
    return map;
  }, [cart, product]);

  const stockLeftByKey = useMemo(() => {
    const map = {};
    for (const v of measureVariants) {
      const used = Number(inCartByKey[v.key] || 0);
      map[v.key] = Math.max(0, Number(v.stock || 0) - used);
    }
    return map;
  }, [measureVariants, inCartByKey]);

  const anyLeft = measureVariants.some(v => stockLeftByKey[v.key] > 0);
  const firstAvailableKey = useMemo(() => {
    for (const m of measureVariants) if (Number(stockLeftByKey[m.key] || 0) > 0) return m.key;
    return null;
  }, [measureVariants, stockLeftByKey]);

  /* ---------- Actions ---------- */
  const handleOpen = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!anyLeft) return;
    setShowPicker(true);
    const k = firstAvailableKey;
    if (k) setSelectedKey(k);
  };

  const leftSelected = selectedKey ? Number(stockLeftByKey[selectedKey] || 0) : 0;
  const confirmDisabled = !selectedKey || leftSelected <= 0;

  const handleConfirm = () => {
    if (confirmDisabled) {
      setLimitHit(true);
      setTimeout(() => setLimitHit(false), 900);
      return;
    }
    const chosen = measureVariants.find(m => m.key === selectedKey);

    // ★ ข้อความขนาดที่ต้องโชว์ในตะกร้า
    const sizeLabel = chosen ? `อก ${chosen.chest}″ / ยาว ${chosen.length}″ นิ้ว` : null;

    addToCart({
      id: product.id,
      name: product.name,
      image: product.image
        ? (product.image.startsWith('http') ? product.image : `${API_BASE}${product.image}`)
        : '/assets/placeholder.png',
      price: Number(product.price || 0),
      qty: 1,
      size: sizeLabel, // ★ ส่งไปที่ตะกร้า
      measures: chosen ? { chest_cm: chosen.chest, length_cm: chosen.length } : null,
      variantKey: selectedKey,
      maxStock: chosen ? Number(chosen.stock || 0) : undefined,
    });

    setShowPicker(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
    setSelectedKey(null);
  };

  /* ---------- UI ---------- */
  const addBtnDisabled = !anyLeft;

  return (
    <div className="group relative rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
      {/* Badge */}
      <div className="absolute left-3 top-3 z-10">
        {product.category && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-black/80 text-white">
            {product.category}
          </span>
        )}
      </div>

      {/* รูป */}
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative">
          <img
            src={
              product.image
                ? (product.image.startsWith('http') ? product.image : `${API_BASE}${product.image}`)
                : '/assets/placeholder.png'
            }
            alt={product.name}
            className={`w-full aspect-[4/3] object-cover ${addBtnDisabled ? 'opacity-60' : ''}`}
            loading="lazy"
          />
          <div className="absolute bottom-3 right-3 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-sm font-semibold">
            {(Number(product.price) || 0).toLocaleString()} บาท
          </div>
          {addBtnDisabled && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="rounded-xl bg-black/80 text-white px-4 py-2 text-sm font-semibold">
                สินค้าหมด
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* เนื้อหา */}
      <div className="p-4">
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-black">{product.name}</h3>
        </Link>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpen}
            disabled={addBtnDisabled}
            aria-disabled={addBtnDisabled ? 'true' : 'false'}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
              addBtnDisabled
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed pointer-events-none'
                : 'bg-black text-white hover:bg-gray-800 active:scale-[0.99]'
            }`}
          >
            {addBtnDisabled ? 'สินค้าหมด' : 'เพิ่มลงตะกร้า'}
          </button>

          <Link
            to={`/product/${product.id}`}
            className="rounded-xl border border-gray-300 py-2.5 px-3 text-sm hover:bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            ดูรายละเอียด
          </Link>
        </div>
      </div>

      {/* Toast */}
      <div
        aria-live="polite"
        className={`pointer-events-none absolute top-3 right-3 transition-all ${
          added ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <div className="rounded-lg bg-black/85 text-white px-3 py-1.5 text-sm shadow-lg">
          ✅ เพิ่มลงตะกร้าแล้ว
        </div>
      </div>

      {/* Modal เลือก อก/ยาว */}
      {showPicker && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold">เลือกขนาด (อก/ยาว)</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {measureVariants.length === 0 ? (
                <span className="text-sm text-gray-500">ยังไม่มีข้อมูล “อก/ยาว” สำหรับสินค้านี้</span>
              ) : (
                measureVariants.map((m) => {
                  const left = Number(stockLeftByKey[m.key] || 0);
                  const active = selectedKey === m.key;
                  const canPick = left > 0;
                  const label = `อก ${m.chest}″ / ยาว ${m.length}″ นิ้ว`; // ★ ใส่ “นิ้ว”
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => canPick && setSelectedKey(m.key)}
                      disabled={!canPick}
                      className={[
                        'relative px-3 py-1.5 rounded-lg border text-sm transition',
                        active
                          ? 'bg-black text-white border-black'
                          : canPick
                          ? 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed',
                      ].join(' ')}
                      title={`เหลือ ${left} ชิ้น`}
                      aria-pressed={active ? 'true' : 'false'}
                    >
                      {label}
                      <span
                        className={`ml-2 text-[11px] font-medium ${
                          left === 0 ? 'text-red-600' : left <= 5 ? 'text-orange-500' : 'text-emerald-600'
                        }`}
                      >
                        เหลือ {left}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex gap-2 items-start">
              <button
                onClick={() => setShowPicker(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <div className="flex-1">
                <button
                  onClick={handleConfirm}
                  disabled={confirmDisabled}
                  className={`w-full rounded-xl py-2.5 text-sm text-white transition ${
                    !confirmDisabled ? 'bg-black hover:bg-gray-800' : 'bg-gray-300 cursor-not-allowed'
                  } ${limitHit ? 'animate-pulse' : ''}`}
                >
                  {!selectedKey ? 'เลือกขนาดก่อน' : leftSelected <= 0 ? 'ครบลิมิตแล้ว' : 'ยืนยันเพิ่มลงตะกร้า'}
                </button>
                {selectedKey && leftSelected <= 0 && (
                  <p className="mt-2 text-xs text-red-600 font-medium">
                    รายการนี้ในตะกร้าครบลิมิตตามสต็อกแล้ว
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
