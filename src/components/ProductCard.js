import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      category: product.category,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="group relative rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
      {/* หมวดหมู่/ราคา มุมซ้ายบน */}
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        {product.category && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-black/80 text-white">
            {product.category}
          </span>
        )}
      </div>

      {/* รูปสินค้า */}
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-full aspect-[4/3] object-cover"
            loading="lazy"
          />
          {/* แถบราคา overlay มุมขวาล่างบนรูป */}
          <div className="absolute bottom-3 right-3 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-sm font-semibold">
            {product.price?.toLocaleString()} บาท
          </div>
        </div>
      </Link>

      {/* เนื้อหา */}
      <div className="p-4">
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-black">
            {product.name}
          </h3>
        </Link>

        {/* ปุ่มต่าง ๆ */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded-xl bg-black text-white py-2.5 text-sm font-medium hover:bg-gray-800 active:scale-[0.99] transition"
          >
            เพิ่มลงตะกร้า
          </button>

          <Link
            to={`/product/${product.id}`}
            className="rounded-xl border border-gray-300 py-2.5 px-3 text-sm hover:bg-gray-50"
            onClick={(e) => {
              // ให้คลิกปุ่มนี้ไปหน้า detail ได้ โดยไม่ชนกับ addToCart
              e.stopPropagation();
            }}
          >
            ดูรายละเอียด
          </Link>
        </div>
      </div>

      {/* Toast เพิ่มสำเร็จ */}
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
    </div>
  );
}
