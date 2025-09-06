import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [added, setAdded] = useState(false);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(
          `http://localhost:3000/api/admin/products/${productId}`
        );
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error("Error loading product:", err);
      }
    }
    loadProduct();
  }, [productId]);

  if (!product) {
    return <p className="p-6 text-center">กำลังโหลดสินค้า...</p>;
  }

  const handleAdd = () => {
    addToCart({
      id: product.id,
      name: product.name,
      image: product.image
        ? `http://localhost:3000${product.image}`
        : "/assets/placeholder.png",
      price: product.price,
      qty,
      size,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* ซ้าย: ภาพสินค้า */}
      <div>
        <img
          src={
            product.image
              ? `http://localhost:3000${product.image}`
              : "/assets/placeholder.png"
          }
          alt={product.name}
          className="w-full rounded-xl border border-gray-300 object-cover"
        />
        {/* แถวภาพย่อย (demo ใช้ภาพเดียวซ้ำ) */}
        <div className="flex gap-3 mt-4">
          <img
            src={
              product.image
                ? `http://localhost:3000${product.image}`
                : "/assets/placeholder.png"
            }
            alt="thumb"
            className="w-20 h-20 object-cover rounded-lg border cursor-pointer"
          />
          <img
            src={
              product.image
                ? `http://localhost:3000${product.image}`
                : "/assets/placeholder.png"
            }
            alt="thumb"
            className="w-20 h-20 object-cover rounded-lg border cursor-pointer"
          />
        </div>
      </div>

      {/* ขวา: รายละเอียด */}
      <div>
        {/* ปุ่มย้อนกลับ */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 text-purple-600 hover:underline"
        >
          ← กลับไป
        </button>

        <h1 className="text-3xl font-bold mb-3">{product.name}</h1>
        <p className="text-xl text-red-600 font-semibold mb-4">
          ราคา {product.price.toLocaleString()} บาท
        </p>
        <p className="text-gray-700 mb-6 leading-relaxed">
          {product.description || "ไม่มีรายละเอียดสินค้า"}
        </p>

       {/* เลือกขนาด */}
<div className="mb-6">
  <h3 className="text-sm font-medium text-gray-600 mb-2">Size:</h3>
  <div className="flex gap-2 flex-wrap">
    {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((s) => (
      <button
        key={s}
        onClick={() => setSize(s)}
        className={`px-4 py-2 border rounded-lg ${
          size === s
            ? "bg-black text-white"
            : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
      >
        {s}
      </button>
    ))}
  </div>
</div>

        {/* จำนวน */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Quantity:</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-3 py-1 border rounded-lg"
            >
              −
            </button>
            <span className="text-lg font-medium">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="px-3 py-1 border rounded-lg"
            >
              +
            </button>
          </div>
        </div>

        {/* ปุ่มเพิ่มตะกร้า */}
        <button
          type="button"
          onClick={handleAdd}
          className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-6 rounded-lg shadow"
        >
          เพิ่มไปตะกร้า
        </button>

        {/* Toast แจ้งเตือน */}
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
