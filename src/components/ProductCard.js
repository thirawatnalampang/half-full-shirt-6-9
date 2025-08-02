import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProductCard({ product, setCart }) {
  const navigate = useNavigate();

  const handleAddToCart = (e) => {
    e.stopPropagation();
    setCart((prev) => [...prev, product]);
  };

  return (
    <div
      className="bg-white rounded-xl shadow-lg cursor-pointer hover:shadow-2xl transition p-4"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <img
        src={product.image}
        alt={product.name}
        className="w-full h-64 object-cover rounded-t-xl"
      />
      <div className="mt-4">
        <h3 className="text-xl font-bold">{product.name}</h3>
        <p className="text-green-600 font-semibold">{product.price} บาท</p>
        <button
          onClick={handleAddToCart}
          className="mt-3 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded shadow"
        >
          เพิ่มลงตะกร้า
        </button>
      </div>
    </div>
  );
}
