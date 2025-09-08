// src/pages/SearchPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000';
const FALLBACK_IMG = 'https://placehold.co/300x300?text=IMG';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function SearchPage() {
  const qParams = useQuery();
  const navigate = useNavigate();

  const [q, setQ] = useState(qParams.get('query') || '');
  const [page, setPage] = useState(Number(qParams.get('page') || 1));
  const [limit, setLimit] = useState(Number(qParams.get('limit') || 24));
  const [sort, setSort] = useState(qParams.get('sort') || 'relevance');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  // sync url -> state
  useEffect(() => {
    setQ(qParams.get('query') || '');
    setPage(Number(qParams.get('page') || 1));
    setLimit(Number(qParams.get('limit') || 24));
    setSort(qParams.get('sort') || 'relevance');
  }, [qParams]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      if (!q) {
        setItems([]); setTotal(0); setError('');
        return;
      }
      setLoading(true); setError('');
      try {
        const url = new URL(`${API_BASE}/api/products/search`);
        url.searchParams.set('q', q);
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('sort', sort);

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          // ถ้าไม่ได้ใช้คุกกี้เซสชัน ให้ไม่ต้องส่ง credentials
          // credentials: 'include',
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('[SEARCH] HTTP', res.status, text);
          setItems([]); setTotal(0); setError(`HTTP ${res.status}`);
          return;
        }

        const data = await res.json();
        console.log('[SEARCH] URL =', url.toString(), 'DATA =', data);
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(Number.isFinite(data.total) ? data.total : (Array.isArray(data.items) ? data.items.length : 0));
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('[SEARCH] error', e);
          setError(String(e.message || e));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [q, page, limit, sort]);

  const totalPages = Math.max(1, Math.ceil((total || items.length) / limit));

  const applyUrl = (next) => {
    const sp = new URLSearchParams();
    if (q) sp.set('query', q);
    sp.set('page', String(next.page ?? page));
    sp.set('limit', String(next.limit ?? limit));
    sp.set('sort', next.sort ?? sort);
    navigate(`/search?${sp.toString()}`, { replace: false });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    applyUrl({ page: 1 });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ค้นหาซ้ำ/ปรับตัวกรอง */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="พิมพ์คำค้นหา เช่น เสื้อวง กางเกงวินเทจ ..."
          className="flex-1 border rounded-lg px-3 py-2"
        />
        <select value={sort} onChange={(e) => applyUrl({ sort: e.target.value, page: 1 })} className="border rounded-lg px-3 py-2">
          <option value="relevance">เรียงตามความใกล้เคียง</option>
          <option value="newest">ใหม่ล่าสุด</option>
          <option value="price_asc">ราคาต่ำ→สูง</option>
          <option value="price_desc">ราคาสูง→ต่ำ</option>
          <option value="name_asc">ชื่อ A→Z</option>
        </select>
        <select value={limit} onChange={(e) => applyUrl({ limit: Number(e.target.value), page: 1 })} className="border rounded-lg px-3 py-2">
          <option value={12}>12 / หน้า</option>
          <option value={24}>24 / หน้า</option>
          <option value={48}>48 / หน้า</option>
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white">ค้นหา</button>
      </form>

      {/* สรุปผล */}
      <div className="mt-4 text-sm text-gray-600">
        {q
          ? (loading ? 'กำลังค้นหา…'
              : `ผลลัพธ์ ${(total && total > 0) ? total : items.length} รายการ`)
          : 'พิมพ์คำค้นหาแล้วกดค้นหา'}
      </div>
      {error && <div className="mt-2 text-sm text-red-600">เกิดข้อผิดพลาด: {error}</div>}

      {/* รายการสินค้า */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((p) => (
          <Link key={p.product_id || p.id} to={`/product/${p.product_id || p.id}`} className="border rounded-lg overflow-hidden hover:shadow">
            <img src={p.image || FALLBACK_IMG} alt={p.name} className="w-full h-48 object-cover" />
            <div className="p-3">
              <div className="font-semibold line-clamp-2">{p.name}</div>
              <div className="text-sm text-gray-500 line-clamp-1">{p.category_name || p.category}</div>
              <div className="mt-1 font-bold">
                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(p.price || 0))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* หน้าเพจ */}
      {(items.length > 0 || total > 0) && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => applyUrl({ page: Math.max(1, page - 1) })}
            disabled={page <= 1}
          >
            ก่อนหน้า
          </button>
          <div className="px-3 py-1">{page} / {totalPages}</div>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => applyUrl({ page: Math.min(totalPages, page + 1) })}
            disabled={page >= totalPages}
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}
