// src/pages/OrderSuccessPage.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const formatTHB = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const { state } = useLocation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // helper: ทำให้โครงสร้างจาก API ตรงกับ summary ที่เราใช้
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
        // 1) จาก state
        if (state?.summary) {
          setSummary(state.summary);
          try { localStorage.setItem("lastOrderSummary", JSON.stringify(state.summary)); } catch {}
          return;
        }
        // 2) จาก localStorage (ทนกว่า sessionStorage)
        const ls = localStorage.getItem("lastOrderSummary");
        if (ls) {
          setSummary(JSON.parse(ls));
          return;
        }
        // 3) จาก API (กรณีเปิดลิงก์ตรง / กลับมาใหม่หลัง logout/login)
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
        <p className="text-neutral-600">ไม่พบข้อมูลสรุปคำสั่งซื้อ</p>
        <Link to="/" className="underline text-blue-600">กลับหน้าหลัก</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-3">สั่งซื้อสำเร็จ 🎉</h1>
      <p className="text-neutral-700 mb-4">
        หมายเลขคำสั่งซื้อ: <span className="font-mono">{summary.orderCode || orderId || summary.orderId}</span>
      </p>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow border p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">สรุปสินค้า</h2>
        <ul className="space-y-3">
          {summary.items.map((it) => (
            <li key={`${it.id}::${it.size ?? ""}`} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {it.image && (
                  <img
                    src={it.image.startsWith("http") ? it.image : `${API_BASE}${it.image}`}
                    alt={it.name}
                    className="w-12 h-12 rounded border object-cover"
                  />
                )}
                <div>
                  <div className="font-medium">
                    {it.name} {it.size ? `• ${it.size}` : ""} × {it.qty}
                  </div>
                  <div className="text-sm text-neutral-500">{formatTHB(it.price)} / ชิ้น</div>
                </div>
              </div>
              <div className="font-semibold">{formatTHB(it.price * it.qty)}</div>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t pt-3 text-right space-y-1 text-sm">
          <div>รวมสินค้า: {formatTHB(summary.amounts.subtotal)}</div>
          <div>ค่าส่ง: {summary.amounts.shipping === 0 ? "ฟรี" : formatTHB(summary.amounts.shipping)}</div>
          <div className="font-bold text-base">ยอดชำระรวม: {formatTHB(summary.amounts.total)}</div>
        </div>
      </div>

      <Link to="/" className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
