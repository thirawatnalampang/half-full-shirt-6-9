export default function Cart({ cart = [] }) {
  return (
    <aside className="fixed bottom-8 right-8 bg-white rounded-xl shadow-xl p-5 w-80 max-w-full">
      <h3 className="text-xl font-bold text-purple-800 mb-4">
        ตะกร้าสินค้า ({cart.length})
      </h3>
      {cart.length === 0 ? (
        <p className="text-gray-500 italic">ยังไม่มีสินค้าในตะกร้า</p>
      ) : (
        <ul className="max-h-52 overflow-auto">
          {cart.map((item, index) => (
            <li
              key={index}
              className="flex justify-between items-center border-b py-2 last:border-none"
            >
              <span>{item.name}</span>
              <span className="font-semibold text-green-700">
                {item.price} บาท
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}