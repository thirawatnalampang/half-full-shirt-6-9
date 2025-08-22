// src/pages/CartPage.jsx
import React from 'react';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const { cart, removeFromCart, setQty, clearCart } = useCart();

  const totalPrice = cart.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">ตะกร้าสินค้า ({cart.length})</h1>

      {cart.length === 0 ? (
        <p className="text-gray-500 italic">ยังไม่มีสินค้าในตะกร้า</p>
      ) : (
        <>
          <ul className="divide-y rounded-xl bg-white shadow">
            {cart.map((item) => (
              <li key={item.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-md" />
                  )}
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-500">{(item.price || 0).toLocaleString()} บาท/ชิ้น</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(item.id, (item.qty || 1) - 1)}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                    disabled={(item.qty || 1) <= 1}
                  >
                    -
                  </button>
                  <span className="w-10 text-center">{item.qty || 1}</span>
                  <button
                    onClick={() => setQty(item.id, (item.qty || 1) + 1)}
                    className="px-3 py-1 border rounded"
                  >
                    +
                  </button>

                  <span className="ml-4 font-semibold">
                    {(((item.price || 0) * (item.qty || 1))).toLocaleString()} บาท
                  </span>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="ml-4 text-red-600 hover:underline"
                  >
                    ลบ
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between mt-6">
            <button onClick={clearCart} className="text-gray-600 hover:underline">
              ลบทั้งหมด
            </button>
            <div className="text-xl font-bold">
              รวมทั้งหมด: {totalPrice.toLocaleString()} บาท
            </div>
          </div>
        </>
      )}
    </div>
  );
}
