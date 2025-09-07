// src/pages/ProductDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const API_BASE = "http://localhost:3000";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [added, setAdded] = useState(false);
  const [size, setSize] = useState(null);
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

  // รวมไซส์
  const sizes = useMemo(() => {
    if (!product) return DEFAULT_SIZES;
    const fromProduct =
      product?.sizes ||
      product?.sizeOptions ||
      product?.options?.sizes ||
      (Array.isArray(product?.variants)
        ? product.variants.map((v) => v?.size).filter(Boolean)
        : []);
    const list = Array.from(new Set((fromProduct || []).filter(Boolean))).map(String);
    return list.length > 0 ? list : DEFAULT_SIZES;
  }, [product]);

  // stock ต่อไซส์
  const stockBySize = useMemo(() => {
    if (!product) return {};
    if (product?.stockBySize && typeof product.stockBySize === "object") {
      const out = {};
      for (const k of Object.keys(product.stockBySize)) {
        out[String(k)] = Number(product.stockBySize[k] ?? 0);
      }
      return out;
    }
    if (Array.isArray(product?.variants)) {
      const map = {};
      product.variants.forEach((v) => {
        if (!v?.size) return;
        const key = String(v.size);
        map[key] = (map[key] || 0) + Number(v?.stock ?? 0);
      });
      if (Object.keys(map).length > 0) return map;
    }
    return {};
  }, [product]);

  // stock รวม
  const totalStock = useMemo(() => {
    if (!product) return undefined;
    if (Object.keys(stockBySize).length > 0) {
      return Object.values(stockBySize).reduce((a, b) => a + Number(b || 0), 0);
    }
    if (typeof product?.stock === "number") return Number(product.stock);
    return undefined;
  }, [stockBySize, product]);

  const isAllOut = totalStock === 0;

  // check stock ของไซส์
  const hasStockFor = (s) => {
    if (Object.keys(stockBySize).length > 0) return Number(stockBySize[s] || 0) > 0;
    if (typeof totalStock === "number") return totalStock > 0;
    return true;
  };

  // จำนวนสูงสุด
  const maxQty = useMemo(() => {
    if (!size) return 99;
    if (Object.keys(stockBySize).length > 0) return Math.max(0, Number(stockBySize[size] || 0));
    if (typeof totalStock === "number") return Math.max(0, totalStock);
    return 99;
  }, [size, stockBySize, totalStock]);

  // limit qty ถ้าเกิน stock
  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), Math.max(1, maxQty)));
  }, [maxQty]);

  const handleAdd = () => {
    if (!product) return;
    if (isAllOut) return;
    if (!size) return;
    if (!hasStockFor(size)) return;

    addToCart({
      id: product.id,
      name: product.name,
      image: product.image ? `${API_BASE}${product.image}` : "/assets/placeholder.png",
      price: product.price,
      qty,
      size,
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

        {/* เลือกไซส์ */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Size:</h3>
          <div className="flex gap-2 flex-wrap">
            {sizes.map((s) => {
              const active = size === s;
              const inStock = hasStockFor(s);
              return (
                <button
                  key={s}
                  onClick={() => inStock && setSize(s)}
                  disabled={!inStock}
                  className={`px-4 py-2 border rounded-lg transition
                    ${active ? "bg-black text-white border-black" : ""}
                    ${
                      inStock && !active
                        ? "bg-white text-gray-700 hover:bg-gray-100"
                        : !inStock
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : ""
                    }`}
                >
                  {s} {!inStock && "(หมด)"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity (ปุ่มแบบกลุ่ม + เหลือ X ชิ้น) */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Quantity:</h3>

          {/* กล่องรวมปุ่ม */}
          <div
            className={[
              "inline-flex items-center rounded-xl border border-gray-300 bg-white",
              "shadow-sm overflow-hidden"
            ].join(" ")}
          >
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={isAllOut || maxQty <= 0}
              className={[
                "w-9 h-9 flex items-center justify-center",
                "text-base font-bold leading-none",
                "hover:bg-gray-50 active:scale-95 transition",
                isAllOut || maxQty <= 0
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-800"
              ].join(" ")}
              aria-label="ลดจำนวน"
            >
              −
            </button>

            <span className="px-3 text-base font-medium tabular-nums select-none">
              {qty}
            </span>

            <button
              onClick={() => setQty((q) => Math.min(q + 1, maxQty))}
              disabled={isAllOut || qty >= maxQty}
              className={[
                "w-9 h-9 flex items-center justify-center",
                "text-base font-bold leading-none",
                "hover:bg-gray-50 active:scale-95 transition",
                isAllOut || qty >= maxQty
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-800"
              ].join(" ")}
              aria-label="เพิ่มจำนวน"
              title={Number.isFinite(maxQty) ? `เหลือ ${maxQty} ชิ้น` : undefined}
            >
              +
            </button>
          </div>

          {/* แสดงจำนวนคงเหลือใต้ปุ่ม */}
          {size && Number.isFinite(maxQty) && (
            <p
              className={[
                "mt-2 text-sm font-semibold",
                maxQty === 0
                  ? "text-red-600"
                  : maxQty <= 5
                  ? "text-orange-500"
                  : "text-emerald-600",
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
          disabled={isAllOut || !size}
          className={`w-full font-medium py-3 px-6 rounded-lg shadow transition
            ${
              isAllOut || !size
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-black hover:bg-gray-800 text-white"
            }`}
        >
          {isAllOut ? "สินค้าหมด" : !size ? "เลือกไซส์ก่อน" : "เพิ่มไปตะกร้า"}
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
