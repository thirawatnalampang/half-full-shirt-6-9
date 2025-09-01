import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FaTshirt, FaTags, FaShoppingBag, FaUsers,
  FaPlus, FaSearch, FaEdit, FaTrash, FaSave, FaTimes, FaHome
} from "react-icons/fa";

const API = {
  products: "http://localhost:3000/api/admin/products",
  categories: "http://localhost:3000/api/admin/categories",
};

function classNames(...arr) { return arr.filter(Boolean).join(" "); }
function numberFormat(n) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(n || 0);
}

function TopBar({ title }) {
  return (
    <header className="sticky top-0 z-20 bg-neutral-900/80 backdrop-blur border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-neutral-300 hover:text-white" title="กลับหน้าหลัก">
            <FaHome size={18} />
          </Link>
          <h1 className="text-white font-semibold">{title}</h1>
        </div>
        <div className="text-xs text-neutral-400">Admin Console</div>
      </div>
    </header>
  );
}

const menu = [
  { key: "products", label: "สินค้า", icon: <FaTshirt /> },
  { key: "categories", label: "หมวดหมู่", icon: <FaTags /> },
  { key: "orders", label: "ออเดอร์", icon: <FaShoppingBag /> },
  { key: "users", label: "ผู้ใช้", icon: <FaUsers /> },
];

function Sidebar({ active, onChange }) {
  return (
    <aside className="w-64 shrink-0 bg-neutral-950 border-r border-neutral-800 h-[calc(100dvh-56px)] sticky top-14">
      <div className="p-4">
        <div className="text-neutral-400 text-xs mb-2">เมนูจัดการ</div>
        <ul className="space-y-1">
          {menu.map((m) => (
            <li key={m.key}>
              <button
                onClick={() => onChange(m.key)}
                className={classNames(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm",
                  active === m.key ? "bg-neutral-800 text-white" : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                )}
              >
                <span className="text-neutral-300">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function ProductsPanel() {
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);          // <- เก็บไฟล์จริง
  const [preview, setPreview] = useState("");      // <- preview URL

  const filtered = useMemo(() => {
    const kw = q.toLowerCase().trim();
    let items = Array.isArray(list) ? list : [];
    if (kw) {
      items = items.filter((i) =>
        (i.name || "").toLowerCase().includes(kw) ||
        (i.description || "").toLowerCase().includes(kw)
      );
    }
    return items;
  }, [q, list]);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch(API.products);
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadProducts error:", e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API.categories);
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("loadCategories error:", e);
      }
    })();
  }, []);

  function openCreate() {
    setEditing({ id: null, name: "", price: 0, category_id: "", description: "", stock: 0, image: "" });
    setFile(null);
    setPreview("");
    setDrawerOpen(true);
  }
  function openEdit(row) {
    setEditing({ ...row });
    setFile(null);
    setPreview(row.image ? `http://localhost:3000${row.image}` : "");
    setDrawerOpen(true);
  }
  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
    setFile(null);
    setPreview("");
  }

  // ✅ save function ที่แก้แล้ว
  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return alert("กรุณากรอกชื่อสินค้า");

    const formData = new FormData();
    formData.append("name", editing.name);
    formData.append("price", editing.price ?? 0);
    formData.append("stock", editing.stock ?? 0);
    if (editing.category_id) formData.append("category_id", editing.category_id);
    if (editing.description) formData.append("description", editing.description);

    if (file) {
      formData.append("image", file); 
    } else if (editing.image) {
      formData.append("oldImage", editing.image); 
    }

    const method = editing.id ? "PUT" : "POST";
    const url = editing.id ? `${API.products}/${editing.id}` : API.products;

    try {
      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error("save failed:", data);
        return alert("บันทึกไม่สำเร็จ");
      }

      await loadProducts();
      closeDrawer();
    } catch (err) {
      console.error("save error:", err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  }

  async function remove(id) {
    if (!window.confirm("ลบสินค้านี้หรือไม่?")) return;
    const res = await fetch(`${API.products}/${id}`, { method: "DELETE" });
    if (!res.ok) return alert("ลบไม่สำเร็จ");
    await loadProducts();
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview("");
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">จัดการสินค้า</h2>
          <p className="text-neutral-400 text-sm">เพิ่ม/แก้ไข/ลบ และอัปโหลดรูปจากเครื่อง</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ / รายละเอียด"
              className="pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-white text-black px-3 py-2 rounded-xl text-sm font-medium hover:bg-neutral-200"
          >
            <FaPlus /> เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-neutral-800 rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-950 text-neutral-400">
            <tr>
              <th className="px-4 py-3 text-left">สินค้า</th>
              <th className="px-4 py-3 text-left">หมวดหมู่</th>
              <th className="px-4 py-3 text-right">ราคา</th>
              <th className="px-4 py-3 text-right">สต็อก</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-900">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">กำลังโหลด...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-neutral-400">ไม่พบข้อมูล</td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-800/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.image ? `http://localhost:3000${p.image}` : "/assets/placeholder.png"}
                        alt={p.name}
                        className="w-12 h-12 object-cover rounded-xl border border-neutral-800"
                      />
                      <div>
                        <div className="text-white font-medium">{p.name}</div>
                        <div className="text-neutral-500 text-xs">ID: {p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {categories.find((c) => c.id === p.category_id)?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-white">{numberFormat(p.price)}</td>
                  <td className="px-4 py-3 text-right">{p.stock ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white">
                        <FaEdit /> แก้ไข
                      </button>
                      <button onClick={() => remove(p.id)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white">
                        <FaTrash /> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/60" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-neutral-950 border-l border-neutral-800 p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{editing?.id ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>
              <button onClick={closeDrawer} className="text-neutral-400 hover:text-white"><FaTimes /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">ชื่อสินค้า</label>
                <input
                  value={editing?.name || ""}
                  onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">หมวดหมู่</label>
                <select
                  value={editing?.category_id || ""}
                  onChange={(e) => setEditing((s) => ({ ...s, category_id: Number(e.target.value) }))}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">-- เลือกหมวดหมู่ --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">ราคา (บาท)</label>
                  <input
                    type="number"
                    value={editing?.price ?? 0}
                    onChange={(e) => setEditing((s) => ({ ...s, price: Number(e.target.value) }))}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">สต็อก</label>
                  <input
                    type="number"
                    value={editing?.stock ?? 0}
                    onChange={(e) => setEditing((s) => ({ ...s, stock: Number(e.target.value) }))}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">รายละเอียดสินค้า</label>
                <textarea
                  value={editing?.description || ""}
                  onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* อัปโหลดไฟล์จากเครื่อง */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">รูปภาพสินค้า (อัปโหลดไฟล์)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="w-full text-neutral-300"
                />
                {(preview || editing?.image) && (
                  <img
                    src={preview || (editing.image ? `http://localhost:3000${editing.image}` : "")}
                    alt="preview"
                    className="mt-3 w-36 h-36 object-cover rounded-xl border border-neutral-800"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={closeDrawer} className="px-4 py-2 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700">
                  ยกเลิก
                </button>
                <button onClick={save} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black font-medium hover:bg-emerald-400">
                  <FaSave /> บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder panels
function CategoriesPanel() { return <div className="p-6 text-neutral-300">TODO: CRUD หมวดหมู่</div>; }
function OrdersPanel() { return <div className="p-6 text-neutral-300">TODO: ตารางออเดอร์</div>; }
function UsersPanel() { return <div className="p-6 text-neutral-300">TODO: ตารางผู้ใช้</div>; }

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [active, setActive] = useState("products");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login", { state: { from: "/admin" } });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-dvh bg-neutral-950">
      <TopBar title="แผงควบคุมผู้ดูแลระบบ" />
      <div className="max-w-7xl mx-auto flex">
        <Sidebar active={active} onChange={setActive} />
        <main className="flex-1 min-w-0">
          {active === "products" && <ProductsPanel />}
          {active === "categories" && <CategoriesPanel />}
          {active === "orders" && <OrdersPanel />}
          {active === "users" && <UsersPanel />}
        </main>
      </div>
    </div>
  );
}
