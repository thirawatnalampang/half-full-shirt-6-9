import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';            // ⬅️ เพิ่ม useNavigate
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';                // ⬅️ เพิ่ม useAuth

const formatTHB = (n) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(n || 0));

const SHIPPING_THRESHOLD = 1000;
const SHIPPING_FEE = 50;

export default function CartPage() {
  const { cart, removeFromCart, setQty, increaseQty, decreaseQty, clearCart } = useCart();
  const { user } = useAuth();                                    // ⬅️ ดึง user จาก Context
  const navigate = useNavigate();                                // ⬅️ สำหรับนำทาง

  const { subtotal, totalQty, shipping, total } = useMemo(() => {
    const subtotal = cart.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    const totalQty = cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const shipping = subtotal === 0 || subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shipping;
    return { subtotal, totalQty, shipping, total };
  }, [cart]);

  // ⬅️ เช็กล็อกอินก่อนพาไปหน้า checkout
  const handleCheckout = (e) => {
    e.preventDefault();
    if (!user) {
      const redirect = encodeURIComponent('/checkout');
      navigate(`/login?redirect=${redirect}`);
      return;
    }
    navigate('/checkout');
  };

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
              const qty = Number(item.qty) || 1;
              const max = Number.isFinite(item.maxStock) ? Number(item.maxStock) : undefined;
              const lineTotal = price * qty;
              const atLimit = Number.isFinite(max) && qty >= max;
              const itemKey = `${String(item.id)}::${item.size ?? ''}`;

              return (
                <li
                  key={itemKey}
                  className="group bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-4 md:p-5 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-4 md:gap-5">
                    <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-neutral-400">IMG</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {item.name}{item.size ? ` • ${item.size}` : ''}
                          </p>
                          <p className="text-sm text-neutral-500 mt-0.5">
                            {formatTHB(price)} / ชิ้น
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id, item.size)}
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
                            type="button"
                            onClick={() => decreaseQty(item.id, item.size, 1)}
                            className="px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40"
                            disabled={qty <= 1}
                            aria-label="ลดจำนวน"
                          >
                            −
                          </button>

                          <input
                            className="w-16 text-center outline-none border-x border-neutral-200 dark:border-neutral-700 py-2 bg-white dark:bg-neutral-900"
                            type="number"
                            min={1}
                            max={max ?? undefined}
                            value={qty}
                            onChange={(e) => {
                              const v = Math.max(1, Number(e.target.value) || 1);
                              setQty(item.id, item.size, v);
                            }}
                            aria-label="จำนวน"
                          />

                          <button
                            type="button"
                            onClick={() => increaseQty(item.id, item.size, 1)}
                            className="px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40"
                            aria-label="เพิ่มจำนวน"
                            disabled={atLimit}
                            title={atLimit ? 'ครบลิมิตสต็อกแล้ว' : undefined}
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-neutral-500">รวม</div>
                          <div className="text-lg font-bold">{formatTHB(lineTotal)}</div>
                          {atLimit && (
                            <div className="text-xs text-amber-600 mt-1">
                              ครบลิมิตสต็อกแล้ว
                              {Number.isFinite(max) ? ` (${max} ชิ้น)` : ''}
                            </div>
                          )}
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
              type="button"
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

            {!user && (                                                     /* ⬅️ แจ้งเตือนถ้ายังไม่ล็อกอิน */
              <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                กรุณาเข้าสู่ระบบก่อนดำเนินการชำระเงิน
              </div>
            )}

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

            {/* ปุ่มชำระเงินที่เช็กล็อกอินก่อน */}
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full mt-5 h-12 rounded-xl bg-neutral-900 text-white font-semibold hover:-translate-y-0.5 active:translate-y-0 transition grid place-items-center"
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
