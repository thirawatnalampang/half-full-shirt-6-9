import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaUserCircle } from 'react-icons/fa';

const SERVER_URL = 'http://localhost:3000';

function parseThaiAddressParts(addr = '') {
  // พอประมาณสำหรับข้อมูลรูปแบบ: "... ต.บางรัก อ.บางกอกใหญ่ จ.กรุงเทพมหานคร 10110"
  const mSub = addr.match(/ต\.([^\sอจ\d]+)\s*/);
  const mDis = addr.match(/อ\.([^\sจ\d]+)\s*/);
  const mPro = addr.match(/จ\.([^\d]+?)(\s*\d{5})?$/);
  const mZip = addr.match(/(\d{5})\s*$/);
  return {
    subdistrict: mSub?.[1]?.trim() || '',
    district: mDis?.[1]?.trim() || '',
    province: mPro?.[1]?.trim() || '',
    zipcode: mZip?.[1] || '',
    cleanAddress: addr.replace(/\s*ต\.[^อจ0-9\s]+\s*อ\.[^จ0-9\s]+\s*จ\.[^\d]+(\s*\d{5})?\s*$/,'').trim(),
  };
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  // -------- ฟอร์มหลัก --------
  const [form, setForm] = useState({
    email: '',
    username: '',
    address: '',
    phone: '',
    profile_image: '',
    password: '',
    passwordConfirm: '',
    province: '',
    district: '',
    subdistrict: '',
  });

  const [uploading, setUploading] = useState(false);

  // -------- โหลดข้อมูลไทยแอดเดรส --------
  const [addrData, setAddrData] = useState([]);
  useEffect(() => {
    fetch('/thai-address.json')
      .then((r) => r.json())
      .then(setAddrData)
      .catch((e) => console.error('load thai-address.json error:', e));
  }, []);

  // zipcode อัตโนมัติ
  const zipcode = useMemo(() => {
    if (!form.province || !form.district || !form.subdistrict) return '';
    const p = addrData.find(x => x.province === form.province);
    const d = p?.amphoes?.find(a => a.amphoe === form.district);
    const t = d?.tambons?.find(tt => tt.tambon === form.subdistrict);
    return t?.zipcode || '';
  }, [addrData, form.province, form.district, form.subdistrict]);

  // options
  const provinceOptions = useMemo(() => addrData.map((p) => p.province), [addrData]);

  const districtOptions = useMemo(() => {
    if (!form.province) return [];
    const p = addrData.find((x) => x.province === form.province);
    return p?.amphoes?.map((a) => a.amphoe) || [];
  }, [addrData, form.province]);

  const subdistrictOptions = useMemo(() => {
    if (!form.province || !form.district) return [];
    const p = addrData.find((x) => x.province === form.province);
    const d = p?.amphoes?.find((a) => a.amphoe === form.district);
    return d?.tambons?.map((t) => t.tambon) || [];
  }, [addrData, form.province, form.district]);

  // -------- Prefill โปรไฟล์จาก backend --------
  useEffect(() => {
    if (user?.email) fetchProfile(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  async function fetchProfile(email) {
    try {
      const res = await fetch(`${SERVER_URL}/api/profile?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลโปรไฟล์ได้');
      const data = await res.json();

      // ถ้ายังไม่มี province/district/subdistrict แต่ address เป็นสตริงรวม ให้แยกครั้งแรกให้
      let province = data.province || '';
      let district = data.district || '';
      let subdistrict = data.subdistrict || '';
      let addr = data.address || '';
      if (!province && addr && /ต\..+อ\..+จ\./.test(addr)) {
        const parsed = parseThaiAddressParts(addr);
        province = parsed.province || province;
        district = parsed.district || district;
        subdistrict = parsed.subdistrict || subdistrict;
        addr = parsed.cleanAddress || addr;
      }

      setForm(prev => ({
        ...prev,
        email: data.email || '',
        username: data.username || '',
        address: addr,
        phone: data.phone || '',
        profile_image: data.profile_image || '',
        province,
        district,
        subdistrict,
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  // -------- handlers --------
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      let newVal = value.replace(/\D/g, '');
      if (newVal.length > 10) newVal = newVal.slice(0, 10);
      setForm((prev) => ({ ...prev, [name]: newVal }));
      return;
    }

    // reset ลูกเมื่อเปลี่ยนพ่อ
    if (name === 'province') {
      setForm((prev) => ({ ...prev, province: value, district: '', subdistrict: '' }));
      return;
    }
    if (name === 'district') {
      setForm((prev) => ({ ...prev, district: value, subdistrict: '' }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploading(true);
      const res = await fetch(`${SERVER_URL}/api/profile/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ');
      const data = await res.json();
      setForm((prev) => ({ ...prev, profile_image: data.url }));
      alert('อัปโหลดรูปสำเร็จ');
    } catch (err) {
      alert(err.message);
      setForm((prev) => ({ ...prev, profile_image: '' }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      alert('รหัสผ่านใหม่กับยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    try {
      const { passwordConfirm, ...rest } = form;
      if (!rest.email) {
        alert('ไม่พบอีเมลผู้ใช้');
        return;
      }

      // ส่งเป็น “แยกช่อง” + แนบ zipcode อัตโนมัติ
      const payload = { ...rest, zipcode };

      const res = await fetch(`${SERVER_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMsg = 'บันทึกข้อมูลไม่สำเร็จ';
        try {
          const errorData = await res.json();
          if (errorData.message) errorMsg = errorData.message;
        } catch {
          const errorText = await res.text();
          if (errorText) errorMsg = errorText;
        }
        throw new Error(errorMsg);
      }

      const updatedUser = await res.json();

      setForm((prev) => ({
        ...prev,
        username: updatedUser.username ?? prev.username,
        address: updatedUser.address ?? prev.address,
        phone: updatedUser.phone ?? prev.phone,
        profile_image: updatedUser.profile_image ?? prev.profile_image,
        province: updatedUser.province ?? prev.province,
        district: updatedUser.district ?? prev.district,
        subdistrict: updatedUser.subdistrict ?? prev.subdistrict,
        password: '',
        passwordConfirm: '',
      }));

      setUser((prev) => ({
        ...prev,
        ...updatedUser,
        role: updatedUser.role ?? prev?.role,
        isAdmin: updatedUser.isAdmin ?? prev?.isAdmin,
        email: updatedUser.email ?? prev?.email,
        profile_image: updatedUser.profile_image ?? prev?.profile_image,
      }));

      alert('บันทึกข้อมูลสำเร็จ');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">แก้ไขโปรไฟล์</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block mb-1 font-medium">Email (ไม่สามารถแก้ไขได้)</label>
          <input
            type="email"
            name="email"
            value={form.email}
            disabled
            className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block mb-1 font-medium">ชื่อ</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        {/* Address (บ้านเลขที่/ถนน เท่านั้น) */}
        <div>
          <label className="block mb-1 font-medium">ที่อยู่ (บ้านเลขที่/ถนน เท่านั้น)</label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            placeholder="บ้านเลขที่/หมู่/ถนน "
          />
        </div>

        {/* จังหวัด */}
        <div>
          <label className="block mb-1 font-medium">จังหวัด</label>
          <select
            name="province"
            value={form.province}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">-- เลือกจังหวัด --</option>
            {provinceOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* อำเภอ/เขต */}
        <div>
          <label className="block mb-1 font-medium">อำเภอ/เขต</label>
          <select
            name="district"
            value={form.district}
            onChange={handleChange}
            disabled={!form.province}
            className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
          >
            <option value="">-- เลือกอำเภอ --</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* ตำบล/แขวง */}
        <div>
          <label className="block mb-1 font-medium">ตำบล/แขวง</label>
          <select
            name="subdistrict"
            value={form.subdistrict}
            onChange={handleChange}
            disabled={!form.district}
            className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
          >
            <option value="">-- เลือกตำบล --</option>
            {subdistrictOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Zipcode (อัตโนมัติ) */}
        <div>
          <label className="block mb-1 font-medium">รหัสไปรษณีย์</label>
          <input
            type="text"
            value={zipcode}
            readOnly
            className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
            placeholder="จะขึ้นอัตโนมัติเมื่อเลือกตำบล"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block mb-1 font-medium">เบอร์โทรศัพท์</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            maxLength={10}
            pattern="\d{10}"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        {/* Profile Image */}
        <div>
          <label className="block mb-1 font-medium">Profile Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="mb-2"
          />
          {form.profile_image ? (
            <img
              src={form.profile_image.startsWith('http') ? form.profile_image : SERVER_URL + form.profile_image}
              alt="Profile Preview"
              className="w-32 h-32 object-cover rounded-full"
            />
          ) : (
            <FaUserCircle className="w-32 h-32 text-gray-400" />
          )}
        </div>

        {/* New Password */}
        <div>
          <label className="block mb-1 font-medium">เปลี่ยนรหัสผ่านใหม่ (ถ้าต้องการ)</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="รหัสผ่านใหม่"
            className="w-full border border-gray-300 rounded px-3 py-2"
            autoComplete="new-password"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block mb-1 font-medium">ยืนยันรหัสผ่านใหม่</label>
          <input
            type="password"
            name="passwordConfirm"
            value={form.passwordConfirm}
            onChange={handleChange}
            placeholder="ยืนยันรหัสผ่านใหม่"
            className="w-full border border-gray-300 rounded px-3 py-2"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          className="bg-[#6b3e26] text-white py-2 px-4 rounded hover:bg-[#8a553d]"
          disabled={uploading}
        >
          บันทึกข้อมูล
        </button>
      </form>
    </div>
  );
}
