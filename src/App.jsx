import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const initialProducts = [
  { id: 1, name: "Elote entero", price: 40, cost: 18, stock: 60, minStock: 15 },
  { id: 2, name: "Elote en vaso", price: 40, cost: 17, stock: 80, minStock: 20 },
  { id: 3, name: "Elote 1/2 litro", price: 90, cost: 38, stock: 30, minStock: 10 },
  { id: 4, name: "Dorinachos", price: 70, cost: 32, stock: 35, minStock: 10 },
  { id: 5, name: "Ramen", price: 85, cost: 40, stock: 25, minStock: 8 },
  { id: 6, name: "Tostielotes", price: 75, cost: 34, stock: 25, minStock: 8 },
];

const money = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [tab, setTab] = useState("caja");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [receivedAmount, setReceivedAmount] = useState("");

  const [expenseForm, setExpenseForm] = useState({
    concept: "",
    category: "Ingredientes",
    amount: "",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    cost: "",
    stock: "",
    minStock: "",
  });

  const loadProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("id");

  if (error) {
    console.log(error);
    return;
  }

  const formattedProducts = data.map((product) => ({
    id: product.id,
    name: product.name,
    price: Number(product.price),
    cost: Number(product.cost),
    stock: Number(product.stock),
    minStock: Number(product.min_stock),
  }));

  setProducts(formattedProducts);
};

useEffect(() => {
  loadProducts();
}, []);

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const cartCost = cart.reduce((sum, item) => sum + item.totalCost, 0);
  const change = Math.max(Number(receivedAmount || 0) - cartTotal, 0);

  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalSalesCost = sales.reduce((sum, sale) => sum + sale.totalCost, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = totalSales - totalSalesCost - totalExpenses;

  const addToCart = (product) => {
    if (product.stock <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      const qtyInCart = existing ? existing.quantity : 0;
      if (qtyInCart >= product.stock) return prev;

      if (existing) {
        return prev.map((item) => {
          if (item.productId !== product.id) return item;
          const nextQty = item.quantity + 1;
          return {
            ...item,
            quantity: nextQty,
            total: nextQty * item.price,
            totalCost: nextQty * item.cost,
          };
        });
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          price: product.price,
          cost: product.cost,
          total: product.price,
          totalCost: product.cost,
        },
      ];
    });
  };

  const changeQty = (productId, amount) => {
    const product = products.find((p) => p.id === productId);

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + amount;
          if (product && nextQty > product.stock) return item;
          return {
            ...item,
            quantity: nextQty,
            total: nextQty * item.price,
            totalCost: nextQty * item.cost,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setReceivedAmount("");
    setPaymentMethod("Efectivo");
  };

  const checkout = async () => {
  if (cart.length === 0) return;

  if (paymentMethod === "Efectivo" && Number(receivedAmount || 0) < cartTotal) {
    alert("El monto recibido es menor al total.");
    return;
  }

  const newSales = cart.map((item) => ({
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    price: item.price,
    total: item.total,
    total_cost: item.totalCost,
    payment_method: paymentMethod,
    sale_date: today(),
  }));

  const { error: salesError } = await supabase
    .from("sales")
    .insert(newSales);

  if (salesError) {
    console.log(salesError);
    alert("Error al guardar la venta.");
    return;
  }

  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);

    await supabase
      .from("products")
      .update({ stock: product.stock - item.quantity })
      .eq("id", item.productId);
  }

  clearCart();
  await loadProducts();
  alert("Venta registrada en Supabase.");
};

  const addExpense = async () => {
  const amount = Number(expenseForm.amount);

  if (!expenseForm.concept || amount <= 0) return;

  const { error } = await supabase.from("expenses").insert({
    concept: expenseForm.concept,
    category: expenseForm.category,
    amount,
    expense_date: today(),
  });

  if (error) {
    console.log(error);
    alert("Error al guardar gasto.");
    return;
  }

  setExpenses((prev) => [
    { id: Date.now(), date: today(), ...expenseForm, amount },
    ...prev,
  ]);

  setExpenseForm({ concept: "", category: "Ingredientes", amount: "" });
};

  const addProduct = async () => {
  if (!productForm.name || Number(productForm.price) <= 0) return;

  const { error } = await supabase.from("products").insert({
    name: productForm.name,
    price: Number(productForm.price),
    cost: Number(productForm.cost || 0),
    stock: Number(productForm.stock || 0),
    min_stock: Number(productForm.minStock || 0),
  });

  if (error) {
    console.log(error);
    alert("Error al guardar producto.");
    return;
  }

  setProductForm({
    name: "",
    price: "",
    cost: "",
    stock: "",
    minStock: "",
  });

  await loadProducts();
};

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Punto de Venta Elotes</h1>
          <p style={styles.subtitle}>Caja rápida para celular</p>
        </div>
        <span style={styles.badge}>El Volcán</span>
      </header>

      <section style={styles.statsGrid}>
        <Stat label="Ventas" value={money(totalSales)} />
        <Stat label="Gastos" value={money(totalExpenses)} />
        <Stat label="Costo" value={money(totalSalesCost)} />
        <Stat label="Ganancia" value={money(netProfit)} />
      </section>

      {tab === "caja" && (
        <main style={styles.mainGrid}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Toca para vender</h2>
            <div style={styles.productsGrid}>
              {products.map((product) => (
                <button
                  key={product.id}
                  style={{
                    ...styles.productButton,
                    opacity: product.stock <= 0 ? 0.45 : 1,
                  }}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                >
                  <strong style={styles.productName}>{product.name}</strong>
                  <span style={styles.price}>{money(product.price)}</span>
                  <small style={styles.stock}>Stock: {product.stock}</small>
                </button>
              ))}
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.ticketHeader}>
              <h2 style={styles.sectionTitle}>🧾 Ticket</h2>
              <button style={styles.smallButton} onClick={clearCart}>Limpiar</button>
            </div>

            {cart.length === 0 ? (
              <div style={styles.empty}>No hay productos en el ticket.</div>
            ) : (
              <div style={styles.ticketItems}>
                {cart.map((item) => (
                  <div key={item.productId} style={styles.ticketItem}>
                    <div>
                      <strong>{item.productName}</strong>
                      <p style={styles.muted}>{money(item.price)} c/u</p>
                    </div>
                    <div style={styles.qtyRow}>
                      <button style={styles.qtyButton} onClick={() => changeQty(item.productId, -1)}>−</button>
                      <strong>{item.quantity}</strong>
                      <button style={styles.qtyButton} onClick={() => changeQty(item.productId, 1)}>+</button>
                    </div>
                    <strong>{money(item.total)}</strong>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.totalBox}>
              <div style={styles.row}><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>
              <div style={styles.row}><span>Costo</span><strong>{money(cartCost)}</strong></div>
              <div style={styles.bigRow}><span>Total</span><strong>{money(cartTotal)}</strong></div>
            </div>

            <div style={styles.payments}>
              {['Efectivo', 'Tarjeta', 'Transferencia'].map((method) => (
                <button
                  key={method}
                  style={{
                    ...styles.paymentButton,
                    background: paymentMethod === method ? '#111827' : '#fff',
                    color: paymentMethod === method ? '#fff' : '#111827',
                  }}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method}
                </button>
              ))}
            </div>

            {paymentMethod === "Efectivo" && (
              <div style={styles.cashGrid}>
                <label style={styles.label}>
                  Recibido
                  <input
                    style={styles.input}
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <div style={styles.changeBox}>
                  <small>Cambio</small>
                  <strong>{money(change)}</strong>
                </div>
              </div>
            )}

            <button style={styles.checkoutButton} onClick={checkout}>
              Cobrar {money(cartTotal)}
            </button>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Ventas recientes</h2>
            {sales.length === 0 ? <p style={styles.muted}>Aún no hay ventas.</p> : sales.slice(0, 10).map((sale) => (
              <div key={sale.id} style={styles.listItem}>
                <div>
                  <strong>{sale.productName}</strong>
                  <p style={styles.muted}>{sale.quantity} · {sale.paymentMethod}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>{money(sale.total)}</strong>
                  <button style={styles.deleteButton} onClick={() => removeSale(sale)}>Eliminar</button>
                </div>
              </div>
            ))}
          </section>
        </main>
      )}

      {tab === "gastos" && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Registrar gasto</h2>
          <input style={styles.input} placeholder="Concepto" value={expenseForm.concept} onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })} />
          <select style={styles.input} value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
            <option>Ingredientes</option>
            <option>Desechables</option>
            <option>Gas</option>
            <option>Renta</option>
            <option>Otros</option>
          </select>
          <input style={styles.input} type="number" placeholder="Monto" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
          <button style={styles.checkoutButton} onClick={addExpense}>Guardar gasto</button>

          <h3 style={styles.sectionTitle}>Lista de gastos</h3>
          {expenses.map((expense) => (
            <div key={expense.id} style={styles.listItem}>
              <div>
                <strong>{expense.concept}</strong>
                <p style={styles.muted}>{expense.category}</p>
              </div>
              <strong>{money(expense.amount)}</strong>
            </div>
          ))}
        </section>
      )}

      {tab === "stock" && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Agregar producto</h2>
          <input style={styles.input} placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
          <input style={styles.input} type="number" placeholder="Precio venta" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
          <input style={styles.input} type="number" placeholder="Costo" value={productForm.cost} onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })} />
          <input style={styles.input} type="number" placeholder="Stock" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} />
          <input style={styles.input} type="number" placeholder="Stock mínimo" value={productForm.minStock} onChange={(e) => setProductForm({ ...productForm, minStock: e.target.value })} />
          <button style={styles.checkoutButton} onClick={addProduct}>Guardar producto</button>

          <h3 style={styles.sectionTitle}>Inventario</h3>
          {products.map((product) => (
            <div key={product.id} style={styles.listItem}>
              <div>
                <strong>{product.name}</strong>
                <p style={styles.muted}>Precio {money(product.price)} · Costo {money(product.cost)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>{product.stock}</strong>
                <p style={{ color: product.stock <= product.minStock ? '#dc2626' : '#16a34a', margin: 0 }}>
                  {product.stock <= product.minStock ? 'Bajo' : 'Normal'}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "resumen" && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Resumen</h2>
          <div style={styles.summaryGrid}>
            <Stat label="Ventas" value={money(totalSales)} />
            <Stat label="Costo vendido" value={money(totalSalesCost)} />
            <Stat label="Gastos" value={money(totalExpenses)} />
            <Stat label="Ganancia neta" value={money(netProfit)} />
          </div>
        </section>
      )}

      <nav style={styles.nav}>
        <button style={tabButton(tab === "caja")} onClick={() => setTab("caja")}>Caja</button>
        <button style={tabButton(tab === "gastos")} onClick={() => setTab("gastos")}>Gastos</button>
        <button style={tabButton(tab === "stock")} onClick={() => setTab("stock")}>Stock</button>
        <button style={tabButton(tab === "resumen")} onClick={() => setTab("resumen")}>Resumen</button>
      </nav>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

const tabButton = (active) => ({
  border: 'none',
  borderRadius: 18,
  padding: '12px 8px',
  fontWeight: 800,
  background: active ? '#111827' : '#f1f5f9',
  color: active ? '#fff' : '#111827',
});

const styles = {
  page: { minHeight: '100vh', background: '#f1f5f9', padding: 12, paddingBottom: 96, fontFamily: 'Arial, sans-serif', color: '#111827' },
  header: { background: '#fff', borderRadius: 24, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 12 },
  title: { margin: 0, fontSize: 24, lineHeight: 1.1 },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
  badge: { background: '#111827', color: '#fff', padding: '8px 12px', borderRadius: 999, fontWeight: 700, fontSize: 12 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  stat: { background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  mainGrid: { display: 'grid', gap: 12 },
  card: { background: '#fff', borderRadius: 24, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 12 },
  sectionTitle: { margin: '0 0 14px', fontSize: 20 },
  productsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  productButton: {
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#111827',
  borderRadius: 22,
  padding: 14,
  minHeight: 132,
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 1px 3px rgba(0,0,0,.08)'
},
 productName: {
  fontSize: 16,
  lineHeight: 1.15,
  color: '#111827'
},
  price: { fontSize: 22, fontWeight: 900, marginTop: 10 },
  stock: { color: '#64748b', marginTop: 8 },
  ticketHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  smallButton: { border: 'none', background: '#f1f5f9', borderRadius: 14, padding: '8px 12px', fontWeight: 700 },
  empty: { border: '1px dashed #cbd5e1', borderRadius: 18, padding: 24, textAlign: 'center', color: '#64748b' },
  ticketItems: { display: 'grid', gap: 10 },
  ticketItem: { border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 18, padding: 12, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' },
  qtyRow: { display: 'flex', gap: 8, alignItems: 'center' },
  qtyButton: { border: '1px solid #cbd5e1', background: '#fff', borderRadius: 12, width: 36, height: 36, fontSize: 20, fontWeight: 900 },
  totalBox: { background: '#f1f5f9', borderRadius: 18, padding: 14, marginTop: 14 },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#475569' },
  bigRow: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 10, fontSize: 22, fontWeight: 900 },
  payments: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 },
  paymentButton: { border: '1px solid #cbd5e1', borderRadius: 16, padding: '12px 4px', fontWeight: 800, fontSize: 12 },
  cashGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 },
  label: { fontWeight: 700, fontSize: 14 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 16, padding: 14, margin: '6px 0 10px', fontSize: 16 },
  changeBox: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  checkoutButton: { width: '100%', border: 'none', background: '#111827', color: '#fff', borderRadius: 22, padding: 18, fontWeight: 900, fontSize: 18, marginTop: 14 },
  muted: { color: '#64748b', margin: '4px 0 0', fontSize: 13 },
  listItem: { borderBottom: '1px solid #e2e8f0', padding: '12px 0', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  deleteButton: { display: 'block', border: 'none', background: 'transparent', color: '#dc2626', marginTop: 4 },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  nav: { position: 'fixed', left: 12, right: 12, bottom: 12, background: '#fff', borderRadius: 24, padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, boxShadow: '0 10px 30px rgba(0,0,0,.18)' },
};

