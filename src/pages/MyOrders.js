// src/pages/MyOrders.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_ORDERS = "http://localhost:3000/api/my-orders";

const CURRENCY = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

/** สี/ป้ายสำหรับแต่ละสถานะ (อ่านง่ายบนพื้นหลังสว่าง) */
const STATUS_CONFIG = {
  pending: {
    label: "รอดำเนินการ",
    activeClass: "bg-gray-700 text-white border-gray-700 hover:bg-gray-800",
    badgeClass: "bg-gray-700 text-white",
  },
  ready_to_ship: {
    label: "รอจัดส่ง",
    activeClass: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700",
    badgeClass: "bg-indigo-600 text-white",
  },
  paid: {
    label: "ชำระเงินแล้ว",
    activeClass: "bg-sky-600 text-white border-sky-600 hover:bg-sky-700",
    badgeClass: "bg-sky-600 text-white",
  },
  shipped: {
    label: "จัดส่งแล้ว",
    activeClass: "bg-amber-500 text-black border-amber-500 hover:bg-amber-600",
    badgeClass: "bg-amber-500 text-black",
  },
  done: {
    label: "สำเร็จ",
    activeClass: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
    badgeClass: "bg-emerald-600 text-white",
  },
  cancelled: {
    label: "ยกเลิก",
    activeClass: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
    badgeClass: "bg-rose-600 text-white",
  },
};
const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const PAY_LABELS = {
  unpaid: "ยังไม่ชำระ",
  submitted: "ส่งสลิปแล้ว",
  paid: "ชำระแล้ว",
  rejected: "สลิปถูกปฏิเสธ",
};

const PAYMENT_METHOD_TH = {
  cod: "เก็บเงินปลายทาง",
  transfer: "โอนเงิน/สลิป",
};

/** ==== ค่ายขนส่ง + สร้างลิงก์ติดตาม ==== */
const TRACK_CARRIERS = {
  thailandpost: "ไปรษณีย์ไทย (Thailand Post)",
  kerry: "Kerry Express",
  flash: "Flash Express",
  jnt: "J&T Express",
  best: "BEST Express",
  ninjavan: "NinjaVan",
};

const trackingUrl = (carrier, code) => {
  const c = String(carrier || "").toLowerCase();
  const t = String(code || "").trim();
  if (!t) return null;
  switch (c) {
    case "thailandpost":
      return `https://track.thailandpost.com/?trackNumber=${encodeURIComponent(t)}`;
    case "kerry":
      return `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(t)}`;
    case "flash":
      return `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(t)}`;
    case "jnt":
      return `https://www.jtexpress.co.th/service/track/${encodeURIComponent(t)}`;
    case "best":
      return `https://www.best-inc.co.th/track?billcode=${encodeURIComponent(t)}`;
    case "ninjavan":
      return `https://www.ninjavan.co/th-th/tracking?id=${encodeURIComponent(t)}`;
    default:
      return `https://www.track.in.th/th/tracking/${encodeURIComponent(t)}`;
  }
};

/** ปุ่มคัดลอกข้อความเล็กๆ */
function Copyable({ text, children }) {
  const onCopy = () => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text)).then(() => {
      alert("คัดลอกแล้ว");
    });
  };
  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-gray-300 hover:bg-gray-100 active:scale-[0.99] transition"
      title="คัดลอก"
    >
      {children}
    </button>
  );
}

/** กล่องแสดง Tracking สวยๆ */
function TrackingBadge({ carrier, code }) {
  if (!carrier && !code) return null;
  const label = TRACK_CARRIERS[carrier] || "ไม่ระบุค่าย";
  const url = trackingUrl(carrier, code);
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white">
          🚚 {label}
        </span>
        {code && (
          <span className="font-mono text-sm text-gray-900">
            เลขพัสดุ: <span className="font-semibold">{code}</span>
          </span>
        )}
        {code && <Copyable text={code}>คัดลอกเลข</Copyable>}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm underline text-indigo-700 hover:text-indigo-900"
          >
            ติดตามพัสดุ
          </a>
        )}
      </div>
    </div>
  );
}

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // ฟิลเตอร์
  const [latestFirst, setLatestFirst] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState(
    ALL_STATUSES.filter((s) => s !== "cancelled")
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_ORDERS}?userId=${user.id}`);
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("load orders error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // —— ยกเลิกได้ทั้ง pending และ ready_to_ship —— 
const canCancel = (status) => ["pending", "ready_to_ship"].includes(status);

  async function cancelOrder(orderId) {
    if (!window.confirm("ยืนยันยกเลิกคำสั่งซื้อนี้หรือไม่?")) return;
    try {
      const res = await fetch(`http://localhost:3000/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // public route ไม่ต้องส่ง restock
      });

      // กันกรณีตอบกลับไม่ใช่ JSON
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await res.json()
        : { message: await res.text() };

      if (!res.ok) throw new Error(data?.message || "ยกเลิกไม่สำเร็จ");

      setOrders((os) =>
        os.map((o) => (o.id === orderId ? { ...o, status: data.status } : o))
      );
      alert("ยกเลิกออเดอร์เรียบร้อย");
    } catch (e) {
      alert(e.message);
    }
  }

  // นับจำนวนต่อสถานะ
  const statusCounts = useMemo(() => {
    const map = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]));
    orders.forEach((o) => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return map;
  }, [orders]);

  // กรอง + เรียง
  const visibleOrders = useMemo(() => {
    const filtered = orders.filter((o) => selectedStatuses.includes(o.status || ""));
    const sorted = [...filtered].sort((a, b) => {
      const ta = new Date(a.created_at || a.updated_at || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || 0).getTime();
      return latestFirst ? tb - ta : ta - tb;
    });
    return sorted;
  }, [orders, selectedStatuses, latestFirst]);

  const toggleStatus = (s) =>
    setSelectedStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const setOnlyStatus = (s) => setSelectedStatuses([s]);
  const selectAll = () => setSelectedStatuses([...ALL_STATUSES]);
  const selectNone = () => setSelectedStatuses([]);

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        กรุณา <Link to="/login" className="underline">เข้าสู่ระบบ</Link> เพื่อดูคำสั่งซื้อ
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">คำสั่งซื้อของฉัน</h1>

      {/* ฟิลเตอร์ */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="accent-indigo-600"
              checked={latestFirst}
              onChange={(e) => setLatestFirst(e.target.checked)}
            />
            เรียง “ล่าสุด” ก่อน
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-gray-900 text-white hover:bg-black transition"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={selectNone}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
            >
              เอาออกทั้งหมด
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-8">
          {ALL_STATUSES.map((s) => {
            const active = selectedStatuses.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                onDoubleClick={() => setOnlyStatus(s)}
                className={[
                  "px-4 py-2 rounded-full text-sm font-medium border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2",
                  active
                    ? STATUS_CONFIG[s].activeClass + " focus:ring-black"
                    : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 focus:ring-gray-300",
                ].join(" ")}
                title={`ดับเบิลคลิกเพื่อเลือกเฉพาะ: ${STATUS_CONFIG[s].label}`}
              >
                {STATUS_CONFIG[s].label}{" "}
                <span className="opacity-70">({statusCounts[s] || 0})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* รายการออเดอร์ */}
      {loading ? (
        // Skeleton
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 p-5 bg-white">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-56 bg-gray-200 rounded" />
                <div className="h-3 w-40 bg-gray-200 rounded" />
                <div className="h-20 w-full bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        // Empty state
        <div className="text-center text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-10">
          <div className="text-4xl mb-2">🧺</div>
          ยังไม่มีออเดอร์ตามตัวกรองที่เลือก
        </div>
      ) : (
        <div className="space-y-6">
          {visibleOrders.map((o) => (
            <div
              key={o.id}
              className={[
                "rounded-2xl border shadow-sm p-5 bg-white/90 backdrop-blur",
                "hover:shadow-md hover:-translate-y-[1px] transition",
                o.status === "cancelled" ? "opacity-60" : "",
              ].join(" ")}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">ออเดอร์ {o.order_code}</div>
                  <div className="text-sm text-gray-600">
                    วันที่: {o.created_at ? new Date(o.created_at).toLocaleString("th-TH") : "-"}
                  </div>

                  {(o.payment_method || o.payment_status) && (
                    <div className="text-sm text-gray-700 mt-1">
                      วิธีชำระเงิน:{" "}
                      <span className="font-medium">
                        {PAYMENT_METHOD_TH[o.payment_method] || o.payment_method || "-"}
                      </span>
                      {o.payment_status && (
                        <span className="ml-3">
                          สถานะชำระเงิน:{" "}
                          <span className="font-medium">{PAY_LABELS[o.payment_status] || "-"}</span>
                        </span>
                      )}
                      {o.slip_image && (
                        <a
                          href={`http://localhost:3000${o.slip_image}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-3 underline text-gray-900"
                        >
                          ดูสลิป
                        </a>
                      )}
                    </div>
                  )}

                  {/* Tracking */}
                  {(o.tracking_code || o.tracking_carrier) && (
                    <TrackingBadge carrier={o.tracking_carrier} code={o.tracking_code} />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      STATUS_CONFIG[o.status]?.badgeClass || "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {STATUS_CONFIG[o.status]?.label ?? o.status ?? "-"}
                  </span>

                  {canCancel(o.status) && (
                    <button
                      onClick={() => cancelOrder(o.id)}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-sm transition"
                    >
                      ยกเลิกคำสั่งซื้อ
                    </button>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-200">
                {o.items?.map((it) => (
                  <div key={it.id} className="flex items-center gap-4 py-3">
                    {it.image && (
                      <img
                        src={`http://localhost:3000${it.image}`}
                        alt={it.name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    )}
                    <div className="flex-1">
                      <div className="text-gray-900">{it.name}</div>
                      {it.size && <div className="text-sm text-gray-600">ไซซ์: {it.size}</div>}
                    </div>
                    <div className="text-sm text-gray-600">
                      {it.quantity} × {CURRENCY(it.unit_price ?? it.price_per_unit)}
                    </div>
                    <div className="font-semibold text-gray-900">{CURRENCY(it.line_total)}</div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <div className="text-gray-600 text-sm">ยอดรวม</div>
                  <div className="text-lg font-bold text-gray-900">{CURRENCY(o.total_price)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
