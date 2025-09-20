// src/pages/MyOrdersPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiRefreshCw, FiAlertCircle, FiCheckCircle, FiClock, FiX,
  FiTruck, FiPackage, FiCopy, FiUser, FiMapPin, FiPhone
} from "react-icons/fi";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const FALLBACK_IMG = "https://placehold.co/48x48?text=IMG";

const formatTHB = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

const STATUS_TH = {
  pending: "รอดำเนินการ",
  ready_to_ship: "รอจัดส่ง",
  shipped: "จัดส่งแล้ว",
  done: "สำเร็จ",
  cancelled: "ยกเลิก",
};
const PAYMENT_TH = {
  unpaid: "ยังไม่ชำระ",
  submitted: "ส่งสลิปแล้ว",
  paid: "ชำระแล้ว",
  rejected: "สลิปถูกปฏิเสธ",
};

// utils
const cx = (...c) => c.filter(Boolean).join(" ");
const statusPillColor = (s) => ({
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  ready_to_ship: "bg-violet-100 text-violet-800 border-violet-200",
  shipped: "bg-sky-100 text-sky-700 border-sky-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
}[s] || "bg-neutral-100 text-neutral-700 border-neutral-200");

const payPillColor = (p) => ({
  unpaid: "bg-neutral-100 text-neutral-800 border-neutral-200",
  submitted: "bg-amber-100 text-amber-800 border-amber-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
}[p || "unpaid"]);

const ORDER_FLOW = ["pending", "ready_to_ship", "shipped", "done"];
const ORDER_FLOW_LABELS = ["รับคำสั่งซื้อ", "เตรียมจัดส่ง", "จัดส่งแล้ว", "สำเร็จ"];

/* ===== Tracking helpers ===== */
const trackingUrl = (carrier, code) => {
  if (!code) return null;
  const c = String(carrier || "").toLowerCase();
  const q = encodeURIComponent(code);
  if (c.includes("kerry")) return `https://th.kerryexpress.com/th/track/?track=${q}`;
  if (c.includes("thai") || c.includes("ems")) return `https://track.thailandpost.co.th/?trackNumber=${q}`;
  if (c.includes("j&t") || c.includes("jnt")) return `https://www.jtexpress.co.th/index/query/gzquery.html?billcode=${q}`;
  if (c.includes("flash")) return `https://www.flashexpress.com/fle/tracking?se=${q}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || ""} ${code}`)}`;
};

/* ===== Stop events helper (กันคลิกไหลออกไปโดน <Link>) ===== */
function StopBubble({ children }) {
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <span
      onClick={stop}
      onMouseDown={stop}
      onMouseUp={stop}
      onTouchStart={stop}
      onTouchEnd={stop}
      className="select-text cursor-text"
    >
      {children}
    </span>
  );
}

/* ===== Copyable (กัน event + คัดลอก) ===== */
function Copyable({ text, children, className }) {
  if (!text) return null;
  const doCopy = async () => {
    try { await navigator.clipboard?.writeText(String(text)); alert("คัดลอกแล้ว"); }
    catch (e) { console.error("copy failed:", e); }
  };
  const stopAll = (e) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <button
      type="button"
      onClick={(e)=>{ stopAll(e); doCopy(); }}
      onMouseDown={stopAll}
      onMouseUp={stopAll}
      onKeyDown={(e)=>{ if(e.key===" "||e.key==="Enter"){ stopAll(e); doCopy(); } }}
      className={cx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs hover:bg-neutral-50 active:scale-[0.99]",
        className
      )}
      title="คัดลอก"
    >
      <FiCopy className="shrink-0" /> {children}
    </button>
  );
}

function TrackingBadge({ carrier, code, updatedAt }) {
  if (!code) return null;

  // ใช้ helper ที่ประกาศไว้ข้างบน
  const url = trackingUrl(carrier, code);
  if (!url) return null;

  const openTrack = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <button
        type="button"
        onClick={openTrack}
        onMouseDown={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 hover:bg-amber-200"
        title="กดเพื่อดูสถานะพัสดุ"
      >
        <FiTruck className="shrink-0" />
        {carrier ? `${carrier} • ` : ""}เลขพัสดุ: <span className="font-semibold">{code}</span>
      </button>
      {updatedAt && (
        <span className="text-neutral-400">
          อัปเดต {new Date(updatedAt).toLocaleString("th-TH")}
        </span>
      )}
    </div>
  );
}

function extractShipping(o = {}) {
  const snap =
    o.shipping_address_snapshot ||
    o.address_snapshot ||
    o.shipping_info ||
    o.user_snapshot ||
    null;

  const pick = (...arr) =>
    arr.find((v) => v != null && String(v).trim() !== "") || null;

  const name = pick(
    o.receiver_name, o.recipient_name, o.shipping_name, o.shipping_fullname,
    o.full_name, o.recipient, snap?.name, snap?.full_name, snap?.recipient, o.name
  );

  const phone = pick(
    o.phone, o.receiver_phone, o.shipping_phone, o.tel, o.mobile,
    snap?.phone, snap?.tel, snap?.mobile
  );

  const address_line = pick(o.address_line, o.address_line1, snap?.address_line, snap?.address_line1);
  const address_line2 = pick(o.address_line2, snap?.address_line2);
  const detail = pick(o.address_detail, o.shipping_address_detail, snap?.address_detail);
  const subdistrict = pick(o.subdistrict, o.tambon, snap?.subdistrict, snap?.tambon);
  const district = pick(o.district, o.amphoe, snap?.district, snap?.amphoe);
  const province = pick(o.province, snap?.province);
  const postal = pick(
    o.postal_code, o.postcode, o.zip, o.zipcode,
    snap?.postal_code, snap?.postcode, snap?.zip, snap?.zipcode
  );
  const strAddress = pick(
    o.shipping_address, o.address, o.address_full,
    o.shipping_address_text, snap?.address, snap?.address_full
  );

  const lines = [];
  if (strAddress) {
    lines.push(strAddress);
  } else {
    if (address_line) lines.push(address_line);
    if (address_line2) lines.push(address_line2);
    if (detail) lines.push(detail);
    const area = [subdistrict, district, province].filter(Boolean).join(" ");
    if (area) lines.push(area);
    if (postal) lines.push(postal);
  }

  // ✅ ทำความสะอาดบรรทัด ป้องกันช่องว่างเกิน
  const cleanLines = lines
    .flatMap(v => String(v).split(/\r?\n/))
    .map(s => s.trim())
    .filter(Boolean);

  const addressText = cleanLines.join("\n");

  return { name, phone, addressText, lines };
}

/* ===== Badges ===== */
function PaymentBadge({ method, status }) {
  const methodTH = method === "cod" ? "ปลายทาง" : "โอน";
  const statusTH = PAYMENT_TH[status] || PAYMENT_TH.unpaid;
  const color = payPillColor(status || "unpaid");
  return (
    <span className={cx("px-2 py-0.5 text-xs rounded-full border inline-flex items-center gap-1", color)}>
      {status === "paid" ? <FiCheckCircle /> : status === "rejected" ? <FiX /> : <FiClock />}
      {methodTH} • {statusTH}
    </span>
  );
}

function OrderBadge({ status }) {
  return (
    <span className={cx("px-2 py-0.5 text-xs rounded-full border inline-flex items-center gap-1", statusPillColor(status))}>
      {status === "done" ? <FiCheckCircle /> : status === "cancelled" ? <FiX /> : <FiPackage />}
      {STATUS_TH[status] || status}
    </span>
  );
}

function OrderStepper({ status }) {
  if (status === "cancelled") {
    return (<div className="flex items-center gap-2 text-rose-700 text-sm"><FiX /> คำสั่งซื้อถูกยกเลิก</div>);
  }
  const idx = Math.max(0, ORDER_FLOW.indexOf(status));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {ORDER_FLOW_LABELS.map((label, i) => {
          const active = i <= idx;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cx(
                  "w-6 h-6 rounded-full grid place-items-center text-xs border",
                  active ? "bg-black text-white border-black" : "bg-white text-neutral-400 border-neutral-300"
                )}
              >
                {i + 1}
              </div>
              <div className={cx("text-xs", active ? "text-black font-medium" : "text-neutral-400")}>{label}</div>
              {i < ORDER_FLOW_LABELS.length - 1 && (
                <div className={cx("w-8 h-[2px]", active ? "bg-black" : "bg-neutral-200")} />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-neutral-600">
        {`ตอนนี้อยู่ ขั้นที่ ${idx + 1} • ${ORDER_FLOW_LABELS[idx]}`}
      </div>
    </div>
  );
}

/* ===== Page ===== */
export default function MyOrdersPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // โหลดรายการของฉัน (ใส่ email ใน deps แก้ eslint)
  const reloadMine = useCallback(async () => {
    const qUser = encodeURIComponent(user?.user_id ?? "");
    const qEmail = encodeURIComponent(user?.email ?? "");
    const res = await fetch(`${API_BASE}/api/my-orders?userId=${qUser}&email=${qEmail}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLastRefreshedAt(new Date());
  }, [user?.user_id, user?.email]);

  async function cancelOrder(orderId) {
    if (!window.confirm("ต้องการยกเลิกคำสั่งซื้อนี้ใช่ไหม?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/cancel`, {
        method: "PATCH", // ให้ตรง backend ของคุณ
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_id: user?.user_id }),
        credentials: "omit", // ถ้า API ไม่ใช้คุกกี้ แนะนำ omit เพื่อเลี่ยง CORS รวม credentials
      });
      if (!res.ok) {
        const t = await res.text();
        alert(t || "ยกเลิกคำสั่งซื้อไม่สำเร็จ");
        return;
      }
      await reloadMine();
    } catch (e) {
      console.error("cancel order error:", e);
      alert("เกิดข้อผิดพลาดในการยกเลิก");
    }
  }

  useEffect(() => {
    if (!user) {
      nav("/login", { state: { from: "/my-orders" } });
      return;
    }
    (async () => {
      try { setLoading(true); setErr(""); await reloadMine(); }
      catch { setErr("โหลดรายการคำสั่งซื้อไม่สำเร็จ"); }
      finally { setLoading(false); }
    })();
  }, [user, nav, reloadMine]);

  const sortedAndFiltered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
    if (statusFilter === "all") return sorted;
    return sorted.filter((o) => (o.status || "").toLowerCase() === statusFilter);
  }, [rows, statusFilter]);

  const summary = useMemo(() => {
  const norm = (v) => String(v || "").toLowerCase();

  // ✅ เอาเฉพาะออเดอร์ที่จ่ายแล้ว และไม่ใช่สถานะยกเลิก
  const paidRows = rows.filter(
    (r) => norm(r.payment_status) === "paid" && norm(r.status) !== "cancelled"
  );

  const totalAmount = paidRows.reduce(
    (sum, r) => sum + Number(r.total_amount || 0),
    0
  );

  const totalOrders = rows.length; // ทั้งหมด (ถ้าจะนับเฉพาะที่จ่ายแล้วก็ใช้ paidRows.length)
  const byStatus = rows.reduce((acc, r) => {
    const k = norm(r.status || "unknown");
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return {
    totalOrders,
    totalAmount,            // 💰 ยอดใช้จ่ายรวมเฉพาะที่ "paid"
    paidCount: paidRows.length, // (ตัวเลือก) จำนวนออเดอร์ที่จ่ายแล้ว
    byStatus,
  };
}, [rows]);

  const counts = useMemo(() => ({
    all: rows.length,
    pending: summary.byStatus.pending || 0,
    ready_to_ship: summary.byStatus.ready_to_ship || 0,
    shipped: summary.byStatus.shipped || 0,
    done: summary.byStatus.done || 0,
    cancelled: summary.byStatus.cancelled || 0,
  }), [rows, summary]);

  const empty = !loading && sortedAndFiltered.length === 0;

  const FILTERS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "pending", label: STATUS_TH.pending },
    { key: "ready_to_ship", label: STATUS_TH.ready_to_ship },
    { key: "shipped", label: STATUS_TH.shipped },
    { key: "done", label: STATUS_TH.done },
    { key: "cancelled", label: STATUS_TH.cancelled },
  ];

  const activeFilter = FILTERS.find(f => f.key === statusFilter) || FILTERS[0];
  const activeCount = counts[statusFilter] ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-5">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-black via-neutral-800 to-neutral-700 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-white/70 mb-1">
              <Link to="/" className="hover:underline">หน้าแรก</Link> <span className="mx-1">/</span> คำสั่งซื้อของฉัน
            </div>
            <h1 className="text-2xl font-bold tracking-tight">🧾 คำสั่งซื้อของฉัน</h1>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-3 h-10 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition"
            title="รีเฟรช"
          >
            <FiRefreshCw />
            รีเฟรช
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-6 bg-white">
          <SummaryCard title="จำนวนคำสั่งซื้อ" value={summary.totalOrders} />
          <SummaryCard title="ยอดใช้จ่ายรวม" value={<span className="text-emerald-600">{formatTHB(summary.totalAmount)}</span>} />
          <div className="rounded-xl border p-4">
            <div className="text-sm text-neutral-500">สถานะล่าสุด</div>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {Object.entries(summary.byStatus).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-neutral-50 border">
                  {(STATUS_TH[k] || k)}: <b>{v}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Viewing bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border rounded-xl px-4 py-3">
        <div className="text-sm">กำลังดู: <b>{activeFilter.label}</b> {`(${activeCount})`}</div>
        <div className="text-xs text-neutral-500">
          {lastRefreshedAt ? `อัปเดตล่าสุด: ${lastRefreshedAt.toLocaleString("th-TH")}` : "—"}
        </div>
      </div>

      {/* Filters */}
      <div className="w-full overflow-x-auto">
        <div className="inline-flex rounded-full border bg-white p-1 shadow-sm sticky top-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cx(
                "px-4 h-10 rounded-full text-sm transition relative",
                statusFilter === key ? "bg-black text-white shadow" : "hover:bg-neutral-50"
              )}
            >
              <span>{label}</span>
              <span
                className={cx(
                  "ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs border",
                  statusFilter === key ? "bg-white/10 border-white/20" : "bg-neutral-100 border-neutral-200 text-neutral-700"
                )}
              >
                {counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          <FiAlertCircle className="shrink-0" />
          <span className="text-sm">{err}</span>
        </div>
      )}

      {!loading && !err && (
        empty ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {sortedAndFiltered.map((o) => {
              const ship = extractShipping(o);
              return (
                <Link
                  key={o.order_id}
                  to={`/orders/${o.order_id}`}
                  className="block bg-white border rounded-2xl p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold truncate">คำสั่งซื้อ #{o.order_id}</div>
                        <OrderBadge status={o.status} />
                        <PaymentBadge method={o.payment_method} status={o.payment_status} />
                      </div>

                      <div className="text-xs text-neutral-500 mt-0.5">
                        {new Date(o.order_date).toLocaleString("th-TH")} • {o.total_items} ชิ้น
                      </div>

                      {/* ผู้รับ & ที่อยู่จัดส่ง (ครบทุกบรรทัด, ไม่ truncate) */}
                      <div className="mt-3 rounded-xl border border-dashed bg-neutral-50/60 p-3">
                        <div className="grid gap-3 md:grid-cols-3 md:items-start">
                          {/* ชื่อ */}
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="w-7 h-7 mt-0.5 rounded-full bg-white border grid place-items-center">
                              <FiUser className="text-neutral-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-neutral-500">ผู้รับ</div>
                              <StopBubble>
                                <div className="text-sm font-medium text-neutral-900 break-words whitespace-pre-wrap">
                                  {ship.name || "—"}
                                </div>
                              </StopBubble>
                            </div>
                            {ship.name && <Copyable text={ship.name} className="ml-2">คัดลอกชื่อ</Copyable>}
                          </div>

                          {/* เบอร์ */}
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="w-7 h-7 mt-0.5 rounded-full bg-white border grid place-items-center">
                              <FiPhone className="text-neutral-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-neutral-500">เบอร์</div>
                              <StopBubble>
                                <div className="text-sm font-medium text-neutral-900 break-words whitespace-pre-wrap">
                                  {ship.phone || "—"}
                                </div>
                              </StopBubble>
                            </div>
                            {ship.phone && <Copyable text={ship.phone} className="ml-2">คัดลอกเบอร์</Copyable>}
                          </div>

                          {/* ที่อยู่ (ทุกบรรทัด) */}
                          <div className="flex items-start gap-2 md:col-span-1 min-w-0">
                            <div className="w-7 h-7 mt-0.5 rounded-full bg-white border grid place-items-center">
                              <FiMapPin className="text-neutral-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-neutral-500">ที่อยู่จัดส่ง</div>
                              <StopBubble>
                                <div className="text-sm font-medium text-neutral-900 break-words whitespace-pre-line">
                                  {ship.addressText || "—"}
                                </div>
                              </StopBubble>
                            </div>
                            {ship.addressText && <Copyable text={ship.addressText} className="ml-2">คัดลอกที่อยู่</Copyable>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <OrderStepper status={o.status} />
                      </div>

                      {/* รูปสินค้า + รายชื่อ */}
                      {Array.isArray(o.items) && o.items.length > 0 && (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {o.items.map((it) => (
                              <img
                                key={it.order_detail_id}
                                src={it.item_image || FALLBACK_IMG}
                                alt={it.item_name || it.item_type}
                                className="w-12 h-12 rounded-md object-cover border"
                                onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                                title={it.item_name || it.item_type}
                                onClick={(e)=>e.stopPropagation()}
                              />
                            ))}
                          </div>
                          <ul className="mt-3 space-y-1">
                            {o.items.map((it, idx) => (
                              <li
                                key={it.order_detail_id || `name-${idx}`}
                                className="flex items-center gap-2 text-base font-semibold text-gray-900"
                              >
                                <span className="truncate">{it.item_name || it.item_type || "สินค้า"}</span>
                                <span className="text-sm text-gray-500">× {Number(it.quantity || 1)}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <TrackingBadge
                        carrier={o.carrier}
                        code={o.tracking_code}
                        updatedAt={o.tracking_updated_at}
                      />

                      {(["pending", "ready_to_ship"].includes(o.status) && !o.carrier && !o.tracking_code) && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancelOrder(o.order_id); }}
                          className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm"
                          title="ยกเลิกคำสั่งซื้อนี้"
                        >
                          <FiX /> ยกเลิกคำสั่งซื้อ
                        </button>
                      )}

                      <div className="font-bold text-emerald-600 whitespace-nowrap">
                        {formatTHB(o.total_amount)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

/* ===== Subcomponents ===== */
function SummaryCard({ title, value }) {
  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border rounded-2xl p-4 bg-white shadow-sm animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-md bg-neutral-200" />
        <div className="flex-1">
          <div className="h-4 w-1/3 bg-neutral-200 rounded mb-2" />
          <div className="h-3 w-2/3 bg-neutral-200 rounded mb-1.5" />
          <div className="h-3 w-1/2 bg-neutral-200 rounded mb-3" />
          <div className="h-8 w-full bg-neutral-100 rounded" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center border rounded-2xl bg-white">
      <div className="text-5xl mb-3">🛒</div>
      <h3 className="text-lg font-semibold">ไม่พบคำสั่งซื้อในสถานะนี้</h3>
      <p className="text-neutral-600 text-sm mt-1">เริ่มเลือกสินค้าถูกใจ แล้วย้อนกลับมาดูที่นี่ได้เลย</p>
      <Link to="/" className="inline-block mt-3 px-4 py-2 rounded-xl border hover:bg-neutral-50">
        เริ่มช้อปเลย
      </Link>
    </div>
  );
}
