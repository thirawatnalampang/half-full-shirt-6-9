// src/pages/CheckoutPage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000';

const formatTHB = (n) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(n || 0));

const SHIPPING_THRESHOLD = 1000;
const SHIPPING_FEE_STANDARD = 50;
const SHIPPING_FEE_EXPRESS = 80;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();
  const { user } = useAuth();

  // ฟอร์มที่อยู่
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    addressLine: '',
    district: '',
    province: '',
    postcode: '',
    note: '',
  });
  const [shippingMethod, setShippingMethod] = useState('standard'); // standard | express
  const [paymentMethod, setPaymentMethod] = useState('cod');        // cod | transfer
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  // โปรไฟล์ (เก็บมาทั้ง profile_image ด้วย)
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);

  // ฟอร์มสลิป
  const [slipFile, setSlipFile] = useState(null);
  const [slipAmount, setSlipAmount] = useState('');

  useEffect(() => {
    async function loadProfile() {
      if (!user?.email) return;
      try {
        setLoadingProfile(true);
        const res = await fetch(`${API_BASE}/api/profile?email=${encodeURIComponent(user.email)}`);
        if (!res.ok) throw new Error('โหลดโปรไฟล์ไม่สำเร็จ');
        const data = await res.json();
        setProfile(data);
        setForm((f) => ({
          ...f,
          fullName: data?.username || f.fullName || '',
          phone: data?.phone || f.phone || '',
          addressLine: data?.address || f.addressLine || '',
        }));
      } catch {
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [user?.email]);

  // คำนวณยอด
  const subtotal = useMemo(
    () => (cart || []).reduce((s, it) => s + (Number(it.price) || 0) * (it.qty || 1), 0),
    [cart]
  );
  const shipping = useMemo(() => {
    if (shippingMethod === 'express') return SHIPPING_FEE_EXPRESS;
    if (subtotal === 0 || subtotal >= SHIPPING_THRESHOLD) return 0;
    return SHIPPING_FEE_STANDARD;
  }, [shippingMethod, subtotal]);
  const totalQty = useMemo(() => (cart || []).reduce((s, it) => s + (it.qty || 0), 0), [cart]);
  const total = subtotal + shipping;

  const isEmpty = !cart || cart.length === 0;

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function validate() {
    const required = ['fullName', 'phone', 'addressLine', 'district', 'province', 'postcode'];
    for (const k of required) {
      if (!String(form[k] || '').trim()) return `กรุณากรอกข้อมูลให้ครบ: ${k}`;
    }
    if (!/^\d{5}$/.test(String(form.postcode))) return 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก';
    if (!/^\d{9,10}$/.test(String(form.phone))) return 'เบอร์โทรควรเป็นตัวเลข 9-10 หลัก';

    if (paymentMethod === 'transfer' && !slipFile) {
      return 'กรุณาแนบรูปสลิปโอนเงิน';
    }
    return null;
  }

  async function placeOrder() {
    const msg = validate();
    if (msg) return setErr(msg);

    setErr(null);
    setSubmitting(true);
    try {
      const items = (cart || []).map((it) => ({
        id: it.id,
        name: it.name,
        size: it.size ?? null,
        price: Number(it.price) || 0,
        qty: it.qty || 1,
        image: it.image || null,
        category: it.category || null,
      }));

      const payload = {
        userId: user?.id || user?.user_id || null,
        email: user?.email || null,
        items,
        amounts: { subtotal, shipping, total, totalQty },
        shippingMethod,
        paymentMethod,
        address: { ...form },
        note: form.note || '',
      };

      // 1) สร้างคำสั่งซื้อ
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'สร้างคำสั่งซื้อไม่สำเร็จ');
      const orderId = data?.orderId || data?.id;

      // 2) ถ้าโอน → อัปโหลดสลิป
      if (paymentMethod === 'transfer' && orderId) {
        const fd = new FormData();
        fd.append('file', slipFile);
        if (slipAmount) fd.append('amount', slipAmount);

        const up = await fetch(`${API_BASE}/api/orders/${orderId}/upload-slip`, {
          method: 'POST',
          body: fd,
        });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData?.message || 'อัปโหลดสลิปไม่สำเร็จ');
      }

      // 3) (ตัวเลือก) บันทึกกลับโปรไฟล์ — ส่ง profile_image เดิมไปด้วย กันรูปหาย
      if (saveToProfile && user?.email) {
        try {
          await fetch(`${API_BASE}/api/profile`, {
            method: 'PUT', // ถ้า backend รองรับ PATCH แนะนำใช้ PATCH
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              username: form.fullName,
              phone: form.phone,
              address: form.addressLine,
              // ✅ สำคัญ: อย่าทิ้งรูปเดิม
              profile_image:
                profile?.profile_image ||
                user?.profile_image ||
                user?.profile_image_url ||
                user?.image || '',
            }),
          });
        } catch {}
      }

      // 4) เก็บ summary กันหาย
      const summary = {
        orderId,
        items,
        amounts: { subtotal, shipping, total, totalQty },
        shippingMethod,
        paymentMethod,
        address: { ...form },
      };
      try {
        sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
      } catch {}

      clearCart(); // ต้องลบเฉพาะ cart ไม่ลบ localStorage ทั้งหมด
      navigate(orderId ? `/order-success/${orderId}` : `/order-success`, {
        replace: true,
        state: { summary },
      });
    } catch (e) {
      setErr(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  if (isEmpty) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-3">ตะกร้าว่างอยู่</h1>
        <Link to="/" className="text-neutral-700 underline">กลับไปเลือกซื้อสินค้า</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-6">ชำระเงิน (Checkout)</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ซ้าย: ฟอร์มข้อมูลผู้รับ */}
        <div className="lg:col-span-2 space-y-6">
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
              {err}
            </div>
          )}

          {/* ข้อมูลผู้รับ */}
          <section className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">ข้อมูลผู้รับ</h2>
              <button
                type="button"
                disabled={loadingProfile || !profile}
                onClick={() => {
                  if (!profile) return;
                  setForm((f) => ({
                    ...f,
                    fullName: profile?.username || f.fullName || '',
                    phone: profile?.phone || f.phone || '',
                    addressLine: profile?.address || f.addressLine || '',
                  }));
                }}
                className="text-sm px-3 py-1.5 rounded-lg border hover:bg-neutral-50 disabled:opacity-60"
                title={profile ? 'ดึงจากโปรไฟล์' : 'ยังไม่มีข้อมูลโปรไฟล์'}
              >
                {loadingProfile ? 'กำลังโหลด…' : 'ใช้ข้อมูลจากโปรไฟล์'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">ชื่อ-นามสกุล *</label>
                <input name="fullName" value={form.fullName} onChange={onChange}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">เบอร์โทร *</label>
                <input name="phone" value={form.phone} onChange={onChange} placeholder="เช่น 0812345678"
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">ที่อยู่ *</label>
                <textarea name="addressLine" value={form.addressLine} onChange={onChange} rows={3}
                  placeholder="บ้านเลขที่ / หมู่บ้าน / ถนน"
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">ตำบล/แขวง *</label>
                <input name="district" value={form.district} onChange={onChange}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">จังหวัด *</label>
                <input name="province" value={form.province} onChange={onChange}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">รหัสไปรษณีย์ *</label>
                <input name="postcode" value={form.postcode} onChange={onChange} placeholder="เช่น 10110"
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">หมายเหตุ (ถ้ามี)</label>
                <input name="note" value={form.note} onChange={onChange} placeholder="ฝากร้าน/คนส่ง ฯลฯ"
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2" />
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={saveToProfile} onChange={(e) => setSaveToProfile(e.target.checked)} />
              อัปเดตชื่อ/เบอร์/ที่อยู่ไปยังโปรไฟล์ของฉัน
            </label>
          </section>

          {/* วิธีจัดส่ง */}
          <section className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-5">
            <h2 className="text-lg font-bold mb-4">วิธีจัดส่ง</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="radio" name="ship" value="standard"
                  checked={shippingMethod === 'standard'} onChange={() => setShippingMethod('standard')} />
                <span>
                  Standard (฿{SHIPPING_FEE_STANDARD}) — <span className="text-neutral-500">ฟรีเมื่อยอดถึง {formatTHB(SHIPPING_THRESHOLD)}</span>
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input type="radio" name="ship" value="express"
                  checked={shippingMethod === 'express'} onChange={() => setShippingMethod('express')} />
                <span>Express (฿{SHIPPING_FEE_EXPRESS})</span>
              </label>
            </div>
          </section>

          {/* วิธีชำระเงิน */}
          <section className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-5">
            <h2 className="text-lg font-bold mb-4">วิธีชำระเงิน</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="radio" name="pay" value="cod"
                  checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                <span>ชำระเงินปลายทาง (COD)</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="radio" name="pay" value="transfer"
                  checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} />
                <span>โอนผ่านธนาคาร4595458995959595 กสิกร/พร้อมเพย์ 0988405158</span>
              </label>
            </div>

            {paymentMethod === 'transfer' && (
              <div className="mt-4 space-y-3 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-neutral-50 dark:bg-neutral-900/40">
                <div>
                  <label className="block text-sm mb-1">แนบรูปสลิป *</label>
                  <input type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">ยอดที่โอน </label>
                  <input
                    value={slipAmount}
                    onChange={(e) => setSlipAmount(e.target.value)}
                    placeholder="เช่น 850.00"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                  />
                </div>
                <p className="text-xs text-neutral-500">
                  หลังส่งคำสั่งซื้อ สลิปจะถูกอัปโหลดให้อัตโนมัติและรอแอดมินตรวจสอบ
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ขวา: สรุปคำสั่งซื้อ */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/70 dark:border-neutral-800 p-5">
            <h2 className="text-lg font-bold mb-4">สรุปคำสั่งซื้อ</h2>

            <ul className="space-y-3 mb-4 max-h-64 overflow-auto pr-1">
              {cart.map((it) => {
                const price = Number(it.price) || 0;
                const qty = it.qty || 1;
                return (
                  <li key={`${it.id}::${it.size ?? ''}`} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {it.name}{it.size ? ` • ${it.size}` : ''} × {qty}
                      </div>
                      <div className="text-neutral-500">{formatTHB(price)} / ชิ้น</div>
                    </div>
                    <div className="font-semibold">{formatTHB(price * qty)}</div>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>จำนวนสินค้า</span><span className="font-medium">{totalQty} ชิ้น</span></div>
              <div className="flex justify-between"><span>ยอดรวมสินค้า</span><span className="font-medium">{formatTHB(subtotal)}</span></div>
              <div className="flex justify-between"><span>ค่าจัดส่ง</span><span className="font-medium">{shipping === 0 ? 'ฟรี' : formatTHB(shipping)}</span></div>

              {shippingMethod === 'standard' && subtotal < SHIPPING_THRESHOLD && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  ซื้อเพิ่มอีก {formatTHB(SHIPPING_THRESHOLD - subtotal)} เพื่อรับสิทธิ์ส่งฟรี (Standard)
                </div>
              )}

              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 flex justify-between text-base">
                <span className="font-semibold">ยอดชำระรวม</span>
                <span className="font-extrabold">{formatTHB(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={placeOrder}
              disabled={submitting}
              className="w-full mt-5 h-12 rounded-xl bg-neutral-900 text-white font-semibold hover:-translate-y-0.5 active:translate-y-0 transition disabled:opacity-60"
            >
              {submitting ? 'กำลังสร้างคำสั่งซื้อ...' : 'ยืนยันสั่งซื้อ'}
            </button>

            <p className="mt-3 text-xs text-neutral-500">
              เมื่อกดยืนยัน ระบบจะบันทึกคำสั่งซื้อ
              {paymentMethod === 'transfer' ? ' และอัปโหลดสลิปของคุณ' : ' และพาคุณไปหน้าสำเร็จ'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
