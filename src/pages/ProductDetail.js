import React from 'react';
import { useParams } from 'react-router-dom';
import { products } from '../data';

export default function ProductDetail({ setCart }) {
  const { productId } = useParams();
  const product = products.find((p) => p.id === parseInt(productId));

  if (!product) return <p>ไม่พบสินค้า</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
      <img src={product.image} alt={product.name} className="w-full rounded-xl mb-4" />
      <p>{product.description}</p>
      <p className="text-2xl text-green-700 mt-4">{product.price} บาท</p>
      <button
        onClick={() => setCart(prev => [...prev, product])}
        className="mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow"
      >
        เพิ่มลงตะกร้า
      </button>
    </div>
  );
}
