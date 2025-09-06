// src/components/ProductCard.jsx
import React, { useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

// ✅ ชุดไซส์มาตรฐาน fallback (ถึง 3XL)
const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  const [added, setAdded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [size, setSize] = useState('');

  // รวมไซส์จาก product ถ้ามี ไม่มีก็ใช้ DEFAULT_SIZES
  const sizes = useMemo(() => {
    const raw =
      product?.sizes ||
      product?.sizeOptions ||
      product?.options?.sizes ||
      (Array.isArray(product?.variants)
        ? product.variants.map(v => v?.size).filter(Boolean)
        : []);
    const list = Array.from(new Set((raw || []).filter(Boolean))).map(String);
    return list.length > 0 ? list : DEFAULT_SIZES;
  }, [product]);

  // แผนที่ราคาไซส์ (ถ้ามี)
  const sizePrices = useMemo(() => {
    if (product?.sizePrices) return product.sizePrices;
    if (Array.isArray(product?.variants)) {
      const map = {};
      product.variants.forEach(v => {
        if (v?.size) map[String(v.size)] = Number(v.price ?? 0);
      });
      return map;
    }
    return null;
  }, [product]);

  const handleAddClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPicker(true); // 🔒 บังคับเลือกไซส์ก่อนเสมอ
  };

  const confirmAddWithSize = () => {
    if (!size) return;

    const price =
      sizePrices && sizePrices[size] != null
        ? Number(sizePrices[size])
        : Number(product.price || 0);

    addToCart({
      id: product.id,
      name: product.name,
      image: product.image,
      price,
      category: product.category,
      size,                          // ✅ เก็บไซส์
      sizePrices: sizePrices || undefined,
    });

    setShowPicker(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
    setSize('');
  };

  return (
    <div className="group relative rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
      {/* Badge หมวดหมู่ */}
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
            src={product.image}
            alt={product.name}
            className="w-full aspect-[4/3] object-cover"
            loading="lazy"
          />
          <div className="absolute bottom-3 right-3 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-sm font-semibold">
            {(product.price ?? 0).toLocaleString()} บาท
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

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddClick}
            className="flex-1 rounded-xl bg-black text-white py-2.5 text-sm font-medium hover:bg-gray-800 active:scale-[0.99] transition"
          >
            เพิ่มลงตะกร้า
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
          ✅ เพิ่มลงตะกร้าแล้ว (ไซส์ {size || '-'})
        </div>
      </div>

      {/* Modal เลือกไซส์ */}
      {showPicker && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold">เลือกไซซ์</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const active = size === s;
                const priceNote =
                  sizePrices && sizePrices[s] != null
                    ? `• ${(Number(sizePrices[s]) || 0).toLocaleString()}฿`
                    : '';
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={[
                      'px-3 py-1.5 rounded-lg border text-sm transition',
                      active
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50',
                    ].join(' ')}
                    aria-pressed={active ? 'true' : 'false'}
                  >
                    {s} {priceNote}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowPicker(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAddWithSize}
                disabled={!size}
                className={`flex-1 rounded-xl py-2.5 text-sm text-white transition ${
                  size ? 'bg-black hover:bg-gray-800' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                ยืนยันเพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
