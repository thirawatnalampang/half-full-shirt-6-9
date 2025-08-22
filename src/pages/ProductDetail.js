import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { products } from '../data';
import { useCart } from '../context/CartContext';

export default function ProductDetail() {
  const { productId } = useParams();
  const product = products.find((p) => p.id === Number(productId));
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  if (!product) return <p className="p-6">ไม่พบสินค้า</p>;

  const handleAdd = () => {
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
      <img src={product.image} alt={product.name} className="w-full rounded-xl mb-4" />
      <p className="text-gray-700">{product.description}</p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-2xl text-green-700 font-semibold">
          {product.price.toLocaleString()} บาท
        </span>
        <button
          type="button"
          onClick={handleAdd}
          className="bg-black hover:bg-gray-800 text-white font-medium py-3 px-6 rounded-lg shadow"
        >
          เพิ่มลงตะกร้า
        </button>
      </div>

      {/* Toast */}
      <div
        className={`fixed top-5 right-5 transition-all ${
          added ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
        aria-live="polite"
      >
        <div className="rounded-lg bg-black/85 text-white px-3 py-2 text-sm shadow-lg">
          ✅ เพิ่มลงตะกร้าแล้ว
        </div>
      </div>
    </div>
  );
}
