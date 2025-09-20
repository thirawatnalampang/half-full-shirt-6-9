// src/pages/OrderSuccessPage.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { FiCheckCircle, FiHome, FiFileText, FiShoppingBag } from "react-icons/fi";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const formatTHB = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const { state } = useLocation();


  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // ให้โครงสร้าง API -> summary ที่ใช้ในหน้านี้
  const toSummaryShape = (payload) => {
    if (!payload?.order) return null;
    const { order, items = [] } = payload;
    return {
      orderId: order.id,
      orderCode: order.order_code,
      items: items.map((it) => ({
        id: it.product_id || it.id,
        name: it.name,
        size: it.size,
        price: Number(it.unit_price || 0),
        qty: Number(it.quantity || 0),
        image: it.image || null,
      })),
      amounts: {
        subtotal: Number(order.subtotal || 0),
        shipping: Number(order.shipping || 0),
        total: Number(order.total_price || 0),
        totalQty: Number(order.total_qty || 0),
      },
      shippingMethod: order.shipping_method,
      paymentMethod: order.payment_method,
      address: {
        fullName: order.full_name,
        phone: order.phone,
        addressLine: order.address_line,
        subdistrict: order.subdistrict,
        district: order.district,
        province: order.province,
        postcode: order.postcode,
      },
      createdAt: order.created_at,
    };
  };

  useEffect(() => {
    (async () => {
      try {
        // 1) ได้จาก state ตอน redirect หลังสั่งซื้อสำเร็จ
        if (state?.summary) {
          setSummary(state.summary);
          try { localStorage.setItem("lastOrderSummary", JSON.stringify(state.summary)); } catch {}
          return;
        }
        // 2) ดึงจาก localStorage เผื่อ refresh หน้า
        const ls = localStorage.getItem("lastOrderSummary");
        if (ls) {
          setSummary(JSON.parse(ls));
          return;
        }
        // 3) ยิง API ด้วย orderId (กรณีเปิดลิงก์ตรง)
        if (orderId) {
          const res = await fetch(`${API_BASE}/api/orders/${orderId}/public`);
          if (res.ok) {
            const data = await res.json();
            const s = toSummaryShape(data);
            if (s) {
              setSummary(s);
              try { localStorage.setItem("lastOrderSummary", JSON.stringify(s)); } catch {}
              return;
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, state]);

  if (loading) {
    return <div className="max-w-4xl mx-auto p-6">กำลังโหลด...</div>;
  }

  if (!summary) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">สั่งซื้อสำเร็จ</h1>
        <p className="text-neutral-600 mb-4">ไม่พบข้อมูลสรุปคำสั่งซื้อ</p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-neutral-50">
          <FiHome /> กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  const addr = summary.address || {};
  const orderCode = summary.orderCode || orderId || summary.orderId;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Hero success */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/15 grid place-items-center">
            <FiCheckCircle className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">สั่งซื้อสำเร็จ 🎉</h1>
            <p className="text-white/90 mt-1">
              หมายเลขคำสั่งซื้อ: <span className="font-mono">{orderCode}</span>
            </p>
          </div>
          <div className="ml-auto">
            <button
              className="inline-flex items-center gap-2 px-3 h-10 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition"
              onClick={() => window.location.reload()}
              title="รีเฟรช"
            >
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-6 p-6 bg-white">
          {/* รายการสินค้า */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <FiShoppingBag /> สรุปสินค้า
            </h2>
            <div className="rounded-xl border p-4">
              {Array.isArray(summary.items) && summary.items.length > 0 ? (
                <ul className="space-y-3">
                  {summary.items.map((it) => (
                    <li key={`${it.id}::${it.size ?? ""}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {it.image && (
                          <img
                            src={it.image.startsWith("http") ? it.image : `${API_BASE}${it.image}`}
                            alt={it.name}
                            className="w-12 h-12 rounded border object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {it.name} {it.size ? `• ${it.size}` : ""} × {it.qty}
                          </div>
                          <div className="text-sm text-neutral-500">{formatTHB(it.price)} / ชิ้น</div>
                        </div>
                      </div>
                      <div className="font-semibold whitespace-nowrap">
                        {formatTHB(it.price * it.qty)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-neutral-500">— ไม่มีรายการสินค้า —</div>
              )}

              <div className="mt-4 border-t pt-3 text-right space-y-1 text-sm">
                <div>รวมสินค้า: {formatTHB(summary.amounts.subtotal)}</div>
                <div>
                  ค่าส่ง: {summary.amounts.shipping === 0 ? "ฟรี" : formatTHB(summary.amounts.shipping)}
                </div>
                <div className="font-bold text-base">
                  ยอดชำระรวม: {formatTHB(summary.amounts.total)}
                </div>
              </div>
            </div>
          </div>

          {/* ที่อยู่ & วิธีชำระ */}
          <div className="space-y-6">
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold mb-2">ที่อยู่จัดส่ง</h3>
              <div className="text-sm space-y-0.5">
                <div><span className="text-neutral-500">ผู้รับ:</span> {addr.fullName || "—"}</div>
                <div><span className="text-neutral-500">เบอร์:</span> {addr.phone || "—"}</div>
                <div className="whitespace-pre-wrap">
                  <span className="text-neutral-500">ที่อยู่:</span>{" "}
                  {[addr.addressLine, addr.district, addr.province, addr.postcode, addr.subdistrict].filter(Boolean).join(" ")}
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="font-semibold mb-2">การชำระเงิน & จัดส่ง</h3>
              <div className="text-sm space-y-0.5">
                <div>
                  <span className="text-neutral-500">วิธีชำระเงิน:</span>{" "}
                  {summary.paymentMethod === "cod" ? "เก็บเงินปลายทาง" : "โอนเงิน/สลิป"}
                </div>
                <div>
                  <span className="text-neutral-500">วิธีจัดส่ง:</span>{" "}
                  {summary.shippingMethod === "express" ? "ด่วน (Express)" : "ปกติ (Standard)"}
                </div>
                {summary.createdAt && (
                  <div>
                    <span className="text-neutral-500">วันที่สั่งซื้อ:</span>{" "}
                    {new Date(summary.createdAt).toLocaleString("th-TH")}
                  </div>
                )}
              </div>
            </div>

            {/* ปุ่มการกระทำ */}
<div className="rounded-xl border p-4">
  <div className="grid gap-2">
    <Link
      to="/orders"  // ⬅ ให้ตรงกับ Route ใน App.jsx
      className="inline-flex items-center justify-center gap-2 h-10 rounded-lg border hover:bg-neutral-50"
    >
      <FiFileText /> ไปหน้า คำสั่งซื้อของฉัน
    </Link>
    <Link
      to="/"
      className="inline-flex items-center justify-center gap-2 h-10 rounded-lg border hover:bg-neutral-50"
    >
      <FiHome /> กลับหน้าหลัก
    </Link>
  </div>
</div>
          </div>
        </div>
      </div>

      
    </div>
  );
}
