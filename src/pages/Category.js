import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { products } from '../data';
import ProductCard from '../components/ProductCard';

export default function Category({ setCart }) {
  const { categoryName } = useParams();
  const navigate = useNavigate();

  const filteredProducts = products.filter(
    (product) => product.category === categoryName
  );

  if (filteredProducts.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-purple-600 hover:underline"
        >
          ← กลับไป
        </button>
        <h2 className="text-3xl font-bold mb-4">
          ไม่พบสินค้าหมวด "{categoryName}"
        </h2>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-purple-600 hover:underline"
      >
        ← กลับไป
      </button>
      <h2 className="text-3xl font-bold mb-6">หมวดหมู่: {categoryName}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            setCart={setCart}
          />
        ))}
      </div>
    </div>
  );
}
