// src/components/ProductCard.jsx
import React, { useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

export default function ProductCard({ product }) {
  const { addToCart, cart = [] } = useCart();

  const [added, setAdded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [size, setSize] = useState('');

  /* ---------- รวมไซส์ ---------- */
  const sizes = useMemo(() => {
    const raw =
      product?.sizes ||
      product?.sizeOptions ||
      product?.options?.sizes ||
      (Array.isArray(product?.variants)
        ? product.variants.map(v => v?.size).filter(Boolean)
        : []);
    const list = Array.from(new Set((raw || []).filter(Boolean))).map(String);
    return list.length > 0 ? list : DEFAULT_SIZES;
  }, [product]);

  /* ---------- ราคาไซส์ (ถ้ามี) ---------- */
  const sizePrices = useMemo(() => {
    if (product?.sizePrices) return product.sizePrices;
    if (Array.isArray(product?.variants)) {
      const map = {};
      product.variants.forEach(v => { if (v?.size) map[String(v.size)] = Number(v.price ?? 0); });
      return map;
    }
    return null;
  }, [product]);

  /* ---------- สต็อกจริงต่อไซส์ / รวม ---------- */
  const baseStockBySize = useMemo(() => {
    if (product?.stockBySize && typeof product.stockBySize === 'object') {
      const out = {};
      Object.keys(product.stockBySize).forEach(k => {
        out[String(k)] = Number(product.stockBySize[k] ?? 0);
      });
      return out;
    }
    if (Array.isArray(product?.variants)) {
      const map = {};
      product.variants.forEach(v => {
        if (!v?.size) return;
        const key = String(v.size);
        map[key] = (map[key] || 0) + Number(v?.stock ?? 0);
      });
      return map;
    }
    return {};
  }, [product]);

  const totalBaseStock = useMemo(() => {
    if (Object.keys(baseStockBySize).length > 0) {
      return Object.values(baseStockBySize).reduce((a, b) => a + Number(b || 0), 0);
    }
    if (typeof product?.stock === 'number') return Number(product.stock);
    return undefined; // ไม่รู้สต็อก
  }, [baseStockBySize, product]);

  /* ---------- จำนวนในตะกร้า (ของสินค้านี้) ---------- */
  const cartCountBySize = useMemo(() => {
    const map = {};
    cart.filter(it => it.id === product?.id).forEach(it => {
      const k = String(it.size || '');
      map[k] = (map[k] || 0) + Number(it.qty || 1);
    });
    return map;
  }, [cart, product]);

  /* ---------- helper ---------- */
  const baseStockFor = (s) => {
    if (Object.keys(baseStockBySize).length > 0) return Number(baseStockBySize[s] ?? 0);
    if (typeof totalBaseStock === 'number') return Number(totalBaseStock);
    return 0; // ไม่รู้สต็อก → ถือว่า 0 เพื่อปลอดภัย
  };
  const inCartFor = (s) => Number(cartCountBySize[String(s || '')] || 0);
  const leftFor = (s) => Math.max(0, baseStockFor(s) - inCartFor(s));

  const totalInCartAllSizes = useMemo(
    () => cart.filter(it => it.id === product?.id).reduce((sum, it) => sum + Number(it.qty || 1), 0),
    [cart, product]
  );

  /* ---------- สถานะกดได้/ไม่ได้ของปุ่มเพิ่ม ---------- */
  // อย่างน้อยมี 1 ไซซ์ที่ยังเหลือให้หยิบ
  const hasAnySizeLeft = sizes.some(s => leftFor(s) > 0);
  // ถ้าไม่มีรายไซซ์แต่มีสต็อกรวม → ใช้รวม
  const hasOverallLeft =
    typeof totalBaseStock === 'number'
      ? totalBaseStock - totalInCartAllSizes > 0
      : false; // ไม่รู้สต็อก → บล็อกไว้ก่อนกันงง

  const canAdd = hasAnySizeLeft || hasOverallLeft;
  const addBtnDisabled = !canAdd;
  const addBtnLabel = addBtnDisabled ? 'ครบลิมิตในตะกร้า' : 'เพิ่มลงตะกร้า';

  /* ---------- Actions ---------- */
  const handleAddClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (addBtnDisabled) return;       // ❌ ครบลิมิตแล้วไม่ให้เปิด modal
    setShowPicker(true);
  };

  const confirmAddWithSize = () => {
    if (!size) return;
    const base = baseStockFor(size);  // สต็อกจริง
    const left = leftFor(size);       // เหลือหลังหักของใน cart

    if (base <= 0 || left <= 0) return; // กันทุกเคสเกินลิมิต

    const price =
      sizePrices && sizePrices[size] != null ? Number(sizePrices[size]) : Number(product.price || 0);

    addToCart({
      id: product.id,
      name: product.name,
      image: product.image,
      price,
      category: product.category,
      size,
      qty: 1,
      maxStock: base, // ส่ง “สต็อกจริง” ให้ CartContext ทำ clamp
    });

    setShowPicker(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
    setSize('');
  };

  /* ---------- UI ---------- */
  return (
    <div className="group relative rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden">
      {/* Badge */}
      <div className="absolute left-3 top-3 z-10">
        {product.category && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-black/80 text-white">
            {product.category}
          </span>
        )}
      </div>

      {/* รูปสินค้า */}
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative">
          <img
            src={product.image}
            alt={product.name}
            className={`w-full aspect-[4/3] object-cover ${addBtnDisabled ? 'opacity-60' : ''}`}
            loading="lazy"
          />
          <div className="absolute bottom-3 right-3 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-sm font-semibold">
            {(product.price ?? 0).toLocaleString()} บาท
          </div>
          {addBtnDisabled && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="rounded-xl bg-black/80 text-white px-4 py-2 text-sm font-semibold">
                สินค้าหมด
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* เนื้อหา */}
      <div className="p-4">
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-black">{product.name}</h3>
        </Link>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddClick}
            disabled={addBtnDisabled}
            aria-disabled={addBtnDisabled ? 'true' : 'false'}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
              addBtnDisabled
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed pointer-events-none'
                : 'bg-black text-white hover:bg-gray-800 active:scale-[0.99]'
            }`}
          >
            {addBtnLabel}
          </button>

          <Link
            to={`/product/${product.id}`}
            className="rounded-xl border border-gray-300 py-2.5 px-3 text-sm hover:bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            ดูรายละเอียด
          </Link>
        </div>
      </div>

      {/* Toast */}
      <div
        aria-live="polite"
        className={`pointer-events-none absolute top-3 right-3 transition-all ${
          added ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <div className="rounded-lg bg-black/85 text-white px-3 py-1.5 text-sm shadow-lg">
          ✅ เพิ่มลงตะกร้าแล้ว (ไซส์ {size || '-'})
        </div>
      </div>

      {/* Modal เลือกไซซ์ */}
      {showPicker && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold">เลือกไซซ์</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const base = baseStockFor(s);  // สต็อกจริง
                const left = leftFor(s);        // เหลือหลังหักของใน cart
                const active = size === s;
                const canPick = base > 0 && left > 0;
                const priceNote =
                  sizePrices && sizePrices[s] != null
                    ? `• ${(Number(sizePrices[s]) || 0).toLocaleString()}฿`
                    : '';
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => canPick && setSize(s)}
                    disabled={!canPick}
                    className={[
                      'relative px-3 py-1.5 rounded-lg border text-sm transition',
                      active
                        ? 'bg-black text-white border-black'
                        : canPick
                        ? 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed',
                    ].join(' ')}
                    title={`คงเหลือ ${left} / สต็อกจริง ${base}`}
                    aria-pressed={active ? 'true' : 'false'}
                  >
                    {s} {priceNote}
                    <span
                      className={`ml-2 text-[11px] font-medium ${
                        left === 0 ? 'text-red-600' : left <= 5 ? 'text-orange-500' : 'text-emerald-600'
                      }`}
                    >
                      เหลือ {left}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowPicker(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAddWithSize}
                disabled={!size || leftFor(size) <= 0 || baseStockFor(size) <= 0}
                className={`flex-1 rounded-xl py-2.5 text-sm text-white transition ${
                  size && leftFor(size) > 0 && baseStockFor(size) > 0
                    ? 'bg-black hover:bg-gray-800'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {size && leftFor(size) <= 0 ? 'ครบลิมิตแล้ว' : 'ยืนยันเพิ่มลงตะกร้า'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
