import React from 'react';
import { useNavigate } from 'react-router-dom';

const categories = [
  { name: 'เสื้อวง',     slug: 'band',      image: '/assets/categories/shirt1.png' },
  { name: 'เสื้อวินเทจ', slug: 'vintage',   image: '/assets/categories/shirt1.png' },
  { name: 'เสื้อฮาเล่',  slug: 'harley',    image: '/assets/categories/shirt1.png' },
  { name: 'เสื้อผ้าบาง', slug: 'adventure', image: '/assets/categories/shirt1.png' },
];

const features = [
  { title: 'ความเป็นวินเทจ', description: 'เสื้อผ้าวินเทจแท้จากยุค 80s-90s สะสมได้' },
  { title: 'คุณภาพดีเยี่ยม', description: 'ผ่านการคัดเลือกและดูแลอย่างดี' },
  { title: 'ราคาย่อมเยา',   description: 'เริ่มต้นเพียง 100 บาท' },
  { title: 'จัดส่งทั่วไทย',  description: 'แพ็คดี ส่งไว ทันใจแน่นอน' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-100">
      {/* Banner */}
      <div
        className="w-full h-[250px] sm:h-[350px] bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/image/bg.png')" }}
      >
        <div className="bg-black bg-opacity-30 w-full h-full flex items-center justify-center">
          <h1 className="text-white text-4xl sm:text-5xl font-bold">ONE OF VINTAGE</h1>
        </div>
      </div>

      {/* หมวดหมู่สินค้า: กดแล้วไปหน้า category */}
      <div className="max-w-6xl mx-auto py-12 px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((c) => (
          <div
            key={c.slug}
            className="relative rounded-xl shadow-md overflow-hidden group cursor-pointer"
            onClick={() => navigate(`/category/${c.slug}`)}
          >
            <img src={c.image} alt={c.name} className="w-full h-60 object-cover" />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition flex items-center justify-center rounded-xl">
              <span className="text-white text-xl font-bold">{c.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* จุดเด่น */}
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-10">
        {features.map((f, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-6 text-center">
            <h2 className="text-xl font-bold mb-2 text-brown-700">{f.title}</h2>
            <p className="text-gray-600">{f.description}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="bg-[#6b3e26] text-white py-10 text-sm">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <h4 className="font-bold mb-2">KP VINTAGE</h4>
            <p>เสื้อผ้าวินเทจแท้ คัดพิเศษทุกตัว</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">เมนู</h4>
            <p>หน้าแรก</p>
            <p>สินค้า</p>
            <p>ติดต่อเรา</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">ติดตามเรา</h4>
            <p>Facebook</p>
            <p>Instagram</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">ติดต่อ</h4>
            <p>โทร: 090-XXXXXXX</p>
            <p>LINE: @kpvintage</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
