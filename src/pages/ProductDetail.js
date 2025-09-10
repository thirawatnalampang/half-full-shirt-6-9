// src/pages/ProductDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

const API_BASE = "http://localhost:3000";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [added, setAdded] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [qty, setQty] = useState(1);

  // โหลดสินค้า
  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(`${API_BASE}/api/admin/products/${productId}`);
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error("Error loading product:", err);
      }
    }
    loadProduct();
  }, [productId]);

  /** ---------------- Normalizers: อก/ยาว + stock ---------------- */
  const measureVariants = useMemo(() => {
    if (!product) return [];
    let mv = product?.measure_variants ?? product?.measureVariants ?? null;
    if (typeof mv === "string") {
      try { mv = JSON.parse(mv); } catch { mv = null; }
    }
    const out = [];
    if (Array.isArray(mv)) {
      for (const v of mv) {
        // ✅ รองรับ chest_in/length_in (นิ้ว) และ fallback ไป cm/คีย์เก่า
        const chest  = Number(v?.chest_in  ?? v?.chest_cm  ?? v?.chest  ?? NaN);
        const length = Number(v?.length_in ?? v?.length_cm ?? v?.length ?? NaN);
        const stock  = Number(v?.stock ?? 0);
        if (Number.isFinite(chest) && Number.isFinite(length)) {
          const key = `c${chest}-l${length}`;
          out.push({ key, chest, length, stock });
        }
      }
    }
    // รวม key ซ้ำ ให้เหลือสต็อกมากสุดในชุดเดียว
    const best = new Map();
    for (const v of out) {
      const prev = best.get(v.key);
      if (!prev || Number(v.stock) > Number(prev.stock)) best.set(v.key, v);
    }
    return Array.from(best.values()).sort((a, b) =>
      a.chest !== b.chest ? a.chest - b.chest : a.length - b.length
    );
  }, [product]);

  // เลือก default เป็นตัวแรกที่มีสต็อก
  useEffect(() => {
    if (!selectedKey && measureVariants.length > 0) {
      const firstInStock = measureVariants.find(m => Number(m.stock) > 0);
      if (firstInStock) setSelectedKey(firstInStock.key);
    }
  }, [measureVariants, selectedKey]);

  const stockByKey = useMemo(() => {
    const o = {};
    for (const v of measureVariants) o[v.key] = Number(v.stock ?? 0);
    return o;
  }, [measureVariants]);

  const totalStock = useMemo(() => {
    if (measureVariants.length > 0) {
      return measureVariants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
    }
    const ps = Number(product?.stock);
    return Number.isFinite(ps) ? ps : undefined;
  }, [measureVariants, product]);

  const isAllOut = totalStock === 0;
  const hasStockForKey = (k) => Number(stockByKey[k] || 0) > 0;

  const maxQty = useMemo(() => {
    if (selectedKey && Object.keys(stockByKey).length > 0)
      return Math.max(0, Number(stockByKey[selectedKey] || 0));
    if (Number.isFinite(totalStock)) return Math.max(0, totalStock);
    return 99;
  }, [selectedKey, stockByKey, totalStock]);

  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), Math.max(1, maxQty)));
  }, [maxQty]);

  const handleAdd = () => {
    if (!product || isAllOut || !selectedKey || !hasStockForKey(selectedKey)) return;
    const chosen = measureVariants.find((m) => m.key === selectedKey);

    // แสดง/เก็บเป็นนิ้ว (ใช้ ″ อย่างเดียว เลี่ยง "นิ้ว นิ้ว")
    const sizeLabel = chosen ? `อก ${chosen.chest}″ / ยาว ${chosen.length}″` : null;

    addToCart({
      id: product.id,
      name: product.name,
      image: product.image ? `${API_BASE}${product.image}` : "/assets/placeholder.png",
      price: product.price,
      qty,
      size: sizeLabel,
      // ✅ เก็บ measures เป็นนิ้ว (ให้ตรงกับ backend ใหม่)
      measures: chosen ? { chest_in: chosen.chest, length_in: chosen.length } : null,
      variantKey: selectedKey,
      // แนะนำให้ใส่ maxStock ด้วย เพื่อให้ Cart จำกัดจำนวนตามสต็อกตัวเลือก
      maxStock: chosen ? Number(chosen.stock || 0) : Number(product?.stock || 0),
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  if (!product) {
    return <p className="p-6 text-center">กำลังโหลดสินค้า...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* ซ้าย: รูปสินค้า */}
      <div>
        <div className="relative">
          <img
            src={product.image ? `${API_BASE}${product.image}` : "/assets/placeholder.png"}
            alt={product.name}
            className={`w-full rounded-xl border border-gray-300 object-cover ${isAllOut ? "opacity-60" : ""}`}
          />
          {isAllOut && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-xl bg-black/80 text-white px-4 py-2 text-sm font-semibold">
                สินค้าหมด
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ขวา: รายละเอียด */}
      <div>
        <button onClick={() => navigate(-1)} className="mb-6 text-purple-600 hover:underline">
          ← กลับไป
        </button>

        <h1 className="text-3xl font-bold mb-3">{product.name}</h1>
        <p className="text-xl text-red-600 font-semibold mb-4">
          ราคา {Number(product.price || 0).toLocaleString()} บาท
        </p>
        <p className="text-gray-700 mb-6 leading-relaxed">
          {product.description || "ไม่มีรายละเอียดสินค้า"}
        </p>

        {/* เลือก อก/ยาว */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">เลือกขนาด (อก/ยาว) นิ้ว:</h3>
          {measureVariants.length === 0 ? (
            <p className="text-sm text-gray-500">ยังไม่มีข้อมูล “อก/ยาว” สำหรับสินค้านี้</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {measureVariants.map((m) => {
                const active = selectedKey === m.key;
                const inStock = hasStockForKey(m.key);
                const label = `อก ${m.chest}″ / ยาว ${m.length}″`;
                return (
                  <button
                    key={m.key}
                    onClick={() => inStock && setSelectedKey(m.key)}
                    disabled={!inStock}
                    className={[
                      "px-3 py-2 border rounded-lg transition text-sm",
                      active ? "bg-black text-white border-black" : "",
                      inStock && !active
                        ? "bg-white text-gray-700 hover:bg-gray-100"
                        : !inStock
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : ""
                    ].join(" ")}
                    title={inStock ? `เหลือ ${m.stock} ชิ้น` : "หมด"}
                  >
                    {label} {!inStock && "(หมด)"}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">จำนวน:</h3>
          <div className="inline-flex items-center rounded-xl border border-gray-300 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={isAllOut || maxQty <= 0}
              className={[
                "w-9 h-9 flex items-center justify-center text-base font-bold leading-none",
                "hover:bg-gray-50 active:scale-95 transition",
                isAllOut || maxQty <= 0 ? "text-gray-400 cursor-not-allowed" : "text-gray-800"
              ].join(" ")}
              aria-label="ลดจำนวน"
            >
              −
            </button>
            <span className="px-3 text-base font-medium tabular-nums select-none">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(q + 1, maxQty))}
              disabled={isAllOut || qty >= maxQty}
              className={[
                "w-9 h-9 flex items-center justify-center text-base font-bold leading-none",
                "hover:bg-gray-50 active:scale-95 transition",
                isAllOut || qty >= maxQty ? "text-gray-400 cursor-not-allowed" : "text-gray-800"
              ].join(" ")}
              aria-label="เพิ่มจำนวน"
              title={Number.isFinite(maxQty) ? `เหลือ ${maxQty} ชิ้น` : undefined}
            >
              +
            </button>
          </div>
          {selectedKey && Number.isFinite(maxQty) && (
            <p
              className={[
                "mt-2 text-sm font-semibold",
                maxQty === 0 ? "text-red-600" : maxQty <= 5 ? "text-orange-500" : "text-emerald-600",
              ].join(" ")}
            >
              เหลือ {maxQty} ชิ้น
            </p>
          )}
        </div>

        {/* ปุ่มเพิ่มตะกร้า */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={isAllOut || !selectedKey}
          className={`w-full font-medium py-3 px-6 rounded-lg shadow transition
            ${isAllOut || !selectedKey
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-black hover:bg-gray-800 text-white"}`}
        >
          {isAllOut ? "สินค้าหมด" : !selectedKey ? "เลือก อก/ยาว ก่อน" : "เพิ่มไปตะกร้า"}
        </button>

        {/* Toast */}
        <div
          className={`fixed top-5 right-5 transition-all ${
            added ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
          aria-live="polite"
        >
          <div className="rounded-lg bg-black/85 text-white px-3 py-2 text-sm shadow-lg">
            ✅ เพิ่มลงตะกร้าแล้ว
          </div>
        </div>
      </div>
    </div>
  );
}
