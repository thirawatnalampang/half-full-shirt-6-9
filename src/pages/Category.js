import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

// ✅ map slug -> id + name (ตรงกับ DB จริง)
const CATEGORY_MAP = {
  band: { id: 1, name: 'เสื้อวง' },
  vintage: { id: 2, name: 'เสื้อวินเทจ' },
  harley: { id: 3, name: 'เสื้อฮาเล่' },
  thin: { id: 4, name: 'เสื้อผ้าบาง' },
};

export default function Category({ setCart }) {
  const { categoryName } = useParams(); // slug เช่น band/vintage
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);

  const category = CATEGORY_MAP[categoryName];

  useEffect(() => {
    if (!category) return;
    async function loadProducts() {
      try {
        const res = await fetch(
          `http://localhost:3000/api/products/by-category/${category.id}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('โหลดสินค้าไม่สำเร็จ:', err);
        setProducts([]);
      }
    }
    loadProducts();
  }, [category]);

  if (!category) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 text-purple-600 hover:underline">
          ← กลับไป
        </button>
        <h2 className="text-3xl font-bold mb-4">หมวด "{categoryName}" ไม่ถูกต้อง</h2>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 text-purple-600 hover:underline">
          ← กลับไป
        </button>
        <h2 className="text-3xl font-bold mb-4">ไม่พบสินค้าหมวด "{category.name}"</h2>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-purple-600 hover:underline">
        ← กลับไป
      </button>
      <h2 className="text-3xl font-bold mb-6">หมวดหมู่: {category.name}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} setCart={setCart} />
        ))}
      </div>
    </div>
  );
}
