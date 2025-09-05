// src/pages/CartPage.jsx
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const formatTHB = (n) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(n || 0));

const SHIPPING_THRESHOLD = 1000; // ส่งฟรีเมื่อยอดถึง
const SHIPPING_FEE = 50;

export default function CartPage() {
  const { cart, removeFromCart, setQty, clearCart } = useCart();

  const { subtotal, totalQty, shipping, total } = useMemo(() => {
    const subtotal = cart.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.qty || 1), 0);
    const totalQty = cart.reduce((s, i) => s + (i.qty || 0), 0);
    const shipping = subtotal === 0 || subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shipping;
    return { subtotal, totalQty, shipping, total };
  }, [cart]);

  if (cart.length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-10 text-center">
          <div className="text-6xl mb-4">🛍️</div>
          <h1 className="text-2xl font-bold mb-2">ตะกร้ายังว่างอยู่</h1>
          <p className="text-neutral-500 mb-6">เริ่มช้อปสินค้า แล้วกลับมาที่นี่เพื่อชำระเงิน</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 text-white hover:-translate-y-0.5 active:translate-y-0 transition"
          >
            ไปหน้าสินค้า
            <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-6">ตะกร้าสินค้า</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ซ้าย: รายการสินค้า */}
        <div className="lg:col-span-2">
          <ul className="space-y-4">
            {cart.map((item) => {
              const price = Number(item.price) || 0;
              const qty = item.qty || 1;
              const lineTotal = price * qty;
              return (
                <li
                  key={item.id}
                  className="group bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-4 md:p-5 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-4 md:gap-5">
                    <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-neutral-400">IMG</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{item.name}</p>
                          <p className="text-sm text-neutral-500 mt-0.5">
                            {formatTHB(price)} / ชิ้น
                          </p>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                          aria-label={`ลบ ${item.name} ออกจากตะกร้า`}
                        >
                          ลบ
                        </button>
                      </div>

                      {/* ควบคุมจำนวน + ราคา */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                          <button
                            onClick={() => setQty(item.id, Math.max(1, qty - 1))}
                            className="px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40"
                            disabled={qty <= 1}
                            aria-label="ลดจำนวน"
                          >
                            −
                          </button>
                          <input
                            className="w-12 text-center outline-none border-x border-neutral-200 dark:border-neutral-700 py-2 bg-white dark:bg-neutral-900"
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) => {
                              const v = Math.max(1, Number(e.target.value) || 1);
                              setQty(item.id, v);
                            }}
                            aria-label="จำนวน"
                          />
                          <button
                            onClick={() => setQty(item.id, qty + 1)}
                            className="px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                            aria-label="เพิ่มจำนวน"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-neutral-500">รวม</div>
                          <div className="text-lg font-bold">{formatTHB(lineTotal)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={clearCart}
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white underline underline-offset-2"
            >
              ลบทั้งหมด
            </button>
            <Link
              to="/"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            >
              เลือกซื้อสินค้าต่อ →
            </Link>
          </div>
        </div>

        {/* ขวา: สรุปคำสั่งซื้อ */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-5">
            <h2 className="text-lg font-bold mb-4">สรุปคำสั่งซื้อ</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>จำนวนสินค้า</span>
                <span className="font-medium">{totalQty} ชิ้น</span>
              </div>
              <div className="flex justify-between">
                <span>ยอดรวมสินค้า</span>
                <span className="font-medium">{formatTHB(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>ค่าจัดส่ง</span>
                <span className="font-medium">
                  {shipping === 0 ? 'ฟรี' : formatTHB(shipping)}
                </span>
              </div>

              {subtotal < SHIPPING_THRESHOLD && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  ซื้อเพิ่มอีก {formatTHB(SHIPPING_THRESHOLD - subtotal)} เพื่อรับสิทธิ์ส่งฟรี
                </div>
              )}

              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 flex justify-between text-base">
                <span className="font-semibold">ยอดชำระรวม</span>
                <span className="font-extrabold">{formatTHB(total)}</span>
              </div>
            </div>

            <button
              className="w-full mt-5 h-12 rounded-xl bg-neutral-900 text-white font-semibold hover:-translate-y-0.5 active:translate-y-0 transition"
              onClick={() => alert('ไปหน้าเช็คเอาท์ (ใส่ลิงก์/เนวิเกตตามระบบของคุณ)')}
            >
              ชำระเงิน
            </button>

            <p className="mt-3 text-xs text-neutral-500">
              ดำเนินการชำระเงินเพื่อยืนยันคำสั่งซื้อของคุณ
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
