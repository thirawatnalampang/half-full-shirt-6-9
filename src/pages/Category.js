import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { products } from '../data';
import ProductCard from '../components/ProductCard';

const CATEGORY_MAP = {
  band: 'เสื้อวง',
  vintage: 'เสื้อวินเทจ',
  harley: 'เสื้อฮาเล่',
  adventure: 'เสื้อผจญภัย', // ← ตรงกับ product id:4
};

export default function Category({ setCart }) {
  const { categoryName } = useParams(); // ได้ค่าเป็น slug
  const navigate = useNavigate();

  const displayName = CATEGORY_MAP[categoryName]; // แปลง slug -> ชื่อไทย

  const filteredProducts = products.filter(
    (p) => p.category === displayName
  );

  if (!displayName) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 text-purple-600 hover:underline">
          ← กลับไป
        </button>
        <h2 className="text-3xl font-bold mb-4">
          หมวด "{categoryName}" ไม่ถูกต้อง
        </h2>
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-4 text-purple-600 hover:underline">
          ← กลับไป
        </button>
        <h2 className="text-3xl font-bold mb-4">
          ไม่พบสินค้าหมวด "{displayName}"
        </h2>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-purple-600 hover:underline">
        ← กลับไป
      </button>
      <h2 className="text-3xl font-bold mb-6">หมวดหมู่: {displayName}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            setCart={setCart} // ถ้ายังใช้ผ่าน props
          />
        ))}
      </div>
    </div>
  );
}
