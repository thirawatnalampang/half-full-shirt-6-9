import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_ORDERS = "http://localhost:3000/api/my-orders";

const CURRENCY = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  ready_to_ship: "รอจัดส่ง",
  paid: "ชำระเงินแล้ว",
  shipped: "จัดส่งแล้ว",
  done: "สำเร็จ",
  cancelled: "ยกเลิก",
};

const PAY_LABELS = {
  unpaid: "ยังไม่ชำระ",
  submitted: "ส่งสลิปแล้ว",
  paid: "ชำระแล้ว",
  rejected: "สลิปถูกปฏิเสธ",
};

const statusClass = (s) => {
  switch (s) {
    case "ready_to_ship": return "bg-indigo-500 text-white";
    case "paid":         return "bg-sky-600 text-white";
    case "shipped":      return "bg-amber-500 text-black";
    case "done":         return "bg-emerald-500 text-black";
    case "cancelled":    return "bg-rose-600 text-white";
    default:             return "bg-neutral-700 text-white"; // ไม่รู้จัก/ว่าง
  }
};

// รายการสถานะสำหรับตัวกรอง
const ALL_STATUSES = ["pending","ready_to_ship","paid","shipped","done","cancelled"];

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ ตัวกรอง
  const [latestFirst, setLatestFirst] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState(
    ALL_STATUSES.filter(s => s !== "cancelled") // เริ่มต้นไม่รวมยกเลิก
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

  async function cancelOrder(orderId) {
    if (!window.confirm("ยืนยันยกเลิกคำสั่งซื้อนี้หรือไม่?")) return;
    try {
      const res = await fetch(`http://localhost:3000/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restock: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "ยกเลิกไม่สำเร็จ");
      setOrders((os) => os.map((x) => (x.id === orderId ? { ...x, status: data.status } : x)));
      alert("ยกเลิกออเดอร์เรียบร้อย");
    } catch (e) {
      alert(e.message);
    }
  }

  // นับจำนวนต่อสถานะ (ไว้ขึ้นตัวเลขบนตัวกรอง)
  const statusCounts = useMemo(() => {
    const map = Object.fromEntries(ALL_STATUSES.map(s => [s, 0]));
    orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
    return map;
  }, [orders]);

  // กรอง + เรียง (แก้: includes(o.status || ""))
  const visibleOrders = useMemo(() => {
    const filtered = orders.filter(o => selectedStatuses.includes(o.status || ""));
    const sorted = [...filtered].sort((a, b) => {
      const ta = new Date(a.created_at || a.updated_at || 0).getTime();
      const tb = new Date(b.created_at || b.updated_at || 0).getTime();
      return latestFirst ? tb - ta : ta - tb;
    });
    return sorted;
  }, [orders, selectedStatuses, latestFirst]);

  function toggleStatus(s) {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }
  function setOnlyStatus(s) { setSelectedStatuses([s]); }
  function selectAll()      { setSelectedStatuses([...ALL_STATUSES]); }
  function selectNone()     { setSelectedStatuses([]); }

  if (!user) {
    return (
      <div className="p-6 text-center text-neutral-400">
        กรุณา <Link to="/login" className="underline">เข้าสู่ระบบ</Link> เพื่อดูคำสั่งซื้อ
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-white">คำสั่งซื้อของฉัน</h1>

      {/* ตัวกรอง */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={latestFirst}
              onChange={(e) => setLatestFirst(e.target.checked)}
            />
            เรียง “ล่าสุด” ก่อน
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={selectNone}
              className="px-2 py-1 text-xs rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            >
              เอาออกทั้งหมด
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              onDoubleClick={() => setOnlyStatus(s)} // ดับเบิลคลิกเพื่อเลือกสถานะเดียว
              className={[
                "px-3 py-1.5 rounded-full text-sm border",
                selectedStatuses.includes(s)
                  ? "bg-neutral-200 text-neutral-900 border-neutral-300"
                  : "bg-neutral-900 text-neutral-300 border-neutral-700",
              ].join(" ")}
              title={`ดับเบิลคลิกเพื่อแสดงเฉพาะ: ${STATUS_LABELS[s]}`}
            >
              {STATUS_LABELS[s]}{" "}
              <span className="opacity-70">({statusCounts[s] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-neutral-400">กำลังโหลด...</div>
      ) : visibleOrders.length === 0 ? (
        <div className="text-neutral-400">
          {orders.length === 0 ? "ยังไม่มีคำสั่งซื้อ" : "ไม่มีออเดอร์ตามตัวกรองที่เลือก"}
        </div>
      ) : (
        <div className="space-y-6">
          {visibleOrders.map((o) => (
            <div
              key={o.id}
              className={
                "bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow " +
                (o.status === "cancelled" ? "opacity-60" : "")
              }
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-white">ออเดอร์ {o.order_code}</div>
                  <div className="text-sm text-neutral-400">
                    วันที่: {o.created_at ? new Date(o.created_at).toLocaleString("th-TH") : "-"}
                  </div>
                  {(o.payment_method || o.payment_status) && (
                    <div className="text-sm text-neutral-300 mt-1">
                      วิธีชำระเงิน: <span className="font-medium">{o.payment_method || "-"}</span>
                      {o.payment_status && (
                        <span className="ml-3">
                          สถานะชำระเงิน:{" "}
                          <span className="font-medium">{PAY_LABELS[o.payment_status] || "-"}</span>
                        </span>
                      )}
                      {o.slip_image && (
                        <a
                          href={`http://localhost:3000${o.slip_image}`}
                          target="_blank" rel="noreferrer"
                          className="ml-3 underline text-neutral-200"
                        >
                          ดูสลิป
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusClass(o.status)}`}>
                    {/* แก้: ไม่ fallback เป็น "รอดำเนินการ" */}
                    {STATUS_LABELS[o.status] ?? o.status ?? "-"}
                  </span>

                  {["pending", "ready_to_ship"].includes(o.status) && (
                    <button
                      onClick={() => cancelOrder(o.id)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm"
                    >
                      ยกเลิกคำสั่งซื้อ
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-neutral-800">
                {o.items?.map((it) => (
                  <div key={it.id} className="flex items-center gap-4 py-3">
                    {it.image && (
                      <img
                        src={`http://localhost:3000${it.image}`}
                        alt={it.name}
                        className="w-16 h-16 object-cover rounded-lg border border-neutral-800"
                      />
                    )}
                    <div className="flex-1">
                      <div className="text-white">{it.name}</div>
                      {it.size && <div className="text-sm text-neutral-400">ไซซ์: {it.size}</div>}
                    </div>
                    <div className="text-sm text-neutral-400">
                      {it.quantity} × {CURRENCY(it.unit_price ?? it.price_per_unit)}
                    </div>
                    <div className="font-medium text-white">
                      {CURRENCY(it.line_total)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <div className="text-neutral-400 text-sm">ยอดรวม</div>
                  <div className="text-lg font-bold text-white">{CURRENCY(o.total_price)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
