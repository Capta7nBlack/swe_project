// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./AuthContext";
import Logo from "./Logo";
import { api } from "./api";

/* ---------------- Header ---------------- */
function HeaderBar() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="app-shell header">
      <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
        <Logo small />

        <nav className="nav" style={{ marginLeft: 12 }}>
          {token && (
            <>
              <Link to="/dashboard" className={isActive("/dashboard") ? "active" : ""}>
                Dashboard
              </Link>
              <Link to="/products" className={isActive("/products") ? "active" : ""}>
                Products
              </Link>
              <Link to="/orders" className={isActive("/orders") ? "active" : ""}>
                Orders
              </Link>
              <Link to="/chat" className={isActive("/chat") ? "active" : ""}>
                Chat
              </Link>
              <Link to="/profile" className={isActive("/profile") ? "active" : ""}>
                Profile
              </Link>
            </>
          )}

          <Link to="/about" className={isActive("/about") ? "active" : ""}>
            About
          </Link>

          {!token && (
            <Link
              to="/register"
              className={isActive("/register") ? "active" : ""}
              style={{ marginLeft: 8 }}
            >
              Register
            </Link>
          )}
        </nav>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        {!token ? (
          <button
            className="btn btn-primary"
            style={{ textDecoration: "none", fontWeight: 500 }}
            onClick={() => navigate("/")}
          >
            Login
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

function AuthWatcher() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const protectedPrefixes = [
      "/dashboard",
      "/products",
      "/orders",
      "/chat",
      "/profile"
    ];

    const path = location.pathname || "/";
    const isProtected = protectedPrefixes.some(
      (p) => path === p || path.startsWith(p + "/")
    );

    if (isProtected && !token) {
      navigate("/", { replace: true });
    }
  }, [token, location.pathname, navigate]);

  return null;
}

/* ---------------- Sign Up Page ---------------- */
function SignUpPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const createAccount = async (e) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      alert("Please fill all fields.");
      return;
    }

    try {
      await api.post("/auth/register", {
        email,
        password,
        name: fullName,
        role: "supplier_admin"
      });
      alert("Account successfully created! Please log in.");
      navigate("/");
    } catch (err) {
      alert("Registration failed: " + err.message);
    }
  };

  return (
    <div className="app-shell center-page" style={{ marginTop: "-80px" }}>
      <div className="card center-card login-card fade-in" style={{ maxWidth: 640 }}>
        <div className="panel-title" style={{ textAlign: "center" }}>
          Create Supplier Account
        </div>

        <form onSubmit={createAccount} style={{ marginTop: 8 }}>
          <div
            className="form-row"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <input
              className="input"
              placeholder="Full name (Company Name)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" style={{ minWidth: 160 }}>
              Create account
            </button>
          </div>
        </form>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span className="small">
            Already have an account?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              Login
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Login Page ---------------- */
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const doLogin = async () => {
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  };

  return (
    <div className="app-shell center-page" style={{ marginTop: "-80px" }}>
      <div className="card center-card login-card fade-in">
        <div className="panel-title" style={{ textAlign: "center" }}>Supplier Login</div>

        <div className="form-row">
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={doLogin}>Login</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard() {
  const [linkRequests, setLinkRequests] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const links = await api.get("/supplier/links");
      // Normalize fields for UI
      const mappedLinks = links.map(item => ({
        id: item.id,
        consumerName: `Customer #${item.consumer_id}`,
        createdAt: item.created_at,
        status: item.status
      }));
      setLinkRequests(mappedLinks);

      const orderData = await api.get("/orders");
      const mappedOrders = orderData.map(o => ({
        ...o,
        consumerName: `Customer #${o.consumer_id}`
      }));
      setOrders(mappedOrders);
    } catch (e) {
      console.error(e);
    }
  };

  const updateLinkStatus = async (id, status) => {
    try {
      await api.put(`/supplier/links/${id}`, { status });
      loadData(); // refresh
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const pendingLinks = linkRequests.filter((l) => l.status === "pending").length;
  // Use accepted links as "Active Chats" / "Connected Customers"
  const totalChats = linkRequests.filter((l) => l.status === "accepted").length;

  const today = new Date();
  const isSameDay = (ts) => {
    const d = new Date(ts);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };
  const todaysOrders = orders.filter((o) => isSameDay(o.created_at)).length;

  const formatDateTime = (ts) => new Date(ts).toLocaleString();

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  return (
    <div className="app-shell center-grid fade-in">
      <div className="card center-card" style={{ maxWidth: 1100 }}>
        <div className="panel-title">Supplier Dashboard</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <div className="stat-card">
            <div className="stat-label">Orders today</div>
            <div className="stat-value">{todaysOrders}</div>
            <div className="stat-sub">New orders created today</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Pending orders</div>
            <div className="stat-value">{pendingOrders}</div>
            <div className="stat-sub">Waiting for confirmation</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Connected Customers</div>
            <div className="stat-value">{totalChats}</div>
            <div className="stat-sub">Active links</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Link requests</div>
            <div className="stat-value">{pendingLinks}</div>
            <div className="stat-sub">Pending connection requests</div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
            gap: 16,
          }}
        >
          <div className="panel">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              Incoming Link Requests
            </div>
            <div className="small" style={{ marginBottom: 12 }}>
              Approve or reject connection requests from your customers.
            </div>

            {linkRequests.length === 0 && (
              <div className="small" style={{ color: "var(--muted)" }}>
                No link requests yet.
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {linkRequests.map((lr) => (
                <div key={lr.id} className="request">
                  <div>
                    <div style={{ fontWeight: 600 }}>{lr.consumerName}</div>
                    <div className="meta">
                      Requested at: {formatDateTime(lr.createdAt)}
                    </div>
                    <div className="small">
                      Status:{" "}
                      <span
                        className="badge"
                        style={{
                          background:
                            lr.status === "pending"
                              ? "rgba(245,158,11,0.1)"
                              : lr.status === "accepted"
                              ? "rgba(16,185,129,0.1)"
                              : "rgba(248,113,113,0.1)",
                          color:
                            lr.status === "pending"
                              ? "#b45309"
                              : lr.status === "accepted"
                              ? "#047857"
                              : "#b91c1c",
                        }}
                      >
                        {lr.status}
                      </span>
                    </div>
                  </div>

                  {lr.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        alignItems: "flex-end",
                      }}
                    >
                      <button
                        className="btn btn-primary"
                        style={{ padding: "4px 10px" }}
                        onClick={() => updateLinkStatus(lr.id, "accepted")}
                      >
                        Approve
                      </button>

                      <button
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px" }}
                        onClick={() => updateLinkStatus(lr.id, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              Recent Orders
            </div>
            <div className="small" style={{ marginBottom: 12 }}>
              Last few orders placed by your customers.
            </div>

            {recentOrders.length === 0 && (
              <div className="small" style={{ color: "var(--muted)" }}>
                No orders yet.
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {recentOrders.map((o) => (
                <div key={o.id} className="request">
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      #{o.id} — {o.consumerName}
                    </div>
                    <div className="meta">
                      Created: {formatDateTime(o.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="small">
                      Total: <strong>{o.total_amount}</strong>
                    </div>
                    <div className="small">
                      Status:{" "}
                      <span
                        className="badge"
                        style={{
                          background: "rgba(37,99,235,0.06)",
                          color: "var(--accent)",
                        }}
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, textAlign: "right" }}>
              <Link to="/orders" className="small" style={{ color: "var(--accent)" }}>
                View all orders →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Products ---------------- */
function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    quantity: "",
    unit: "",
  });

  const [editingDiscountFor, setEditingDiscountFor] = useState(null);
  const [discountInput, setDiscountInput] = useState("");

  const [editingProductFor, setEditingProductFor] = useState(null);
  const [editedFields, setEditedFields] = useState({
    name: "",
    price: "",
    quantity: "",
    unit: "",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await api.get("/products/my-catalog");
      setProducts(data);
    } catch (e) {
      console.error("Failed to load products", e);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  const formatPrice = (value) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "KZT",
      maximumFractionDigits: 0,
    }).format(value);

  const removeProduct = async (id) => {
    if (!window.confirm("Remove this product?")) return;
    try {
      // Assuming backend supports DELETE /products/{id}
      await api.post(`/products/delete/${id}`, {}); // or api.delete if available
      // Fallback to filtering locally if delete API is missing in description
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch(e) {
      console.error(e);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim() || !newProduct.price) {
      alert("Fill all fields.");
      return;
    }

    try {
      await api.post("/products", {
        name: newProduct.name.trim(),
        price: parseFloat(newProduct.price),
        quantity: parseInt(newProduct.quantity),
        unit: newProduct.unit.trim()
      });
      loadProducts();
      setNewProduct({ name: "", price: "", quantity: "", unit: "" });
    } catch (e) {
      alert("Failed to add product");
    }
  };

  const openDiscountEditor = (id) => {
    setEditingProductFor(null);
    const p = products.find((x) => x.id === id);
    setDiscountInput(p?.discountPercent ? String(p.discountPercent) : "");
    setEditingDiscountFor(id);
  };

  const cancelDiscountEdit = () => {
    setEditingDiscountFor(null);
    setDiscountInput("");
  };

  const applyDiscount = async (id) => {
    const raw = discountInput.trim();
    const v = Number(raw);
    if (Number.isNaN(v) || v < 0 || v > 100) {
      alert("Enter valid percent (0–100).");
      return;
    }

    try {
      await api.put(`/products/${id}/discount`, { percent: Math.round(v) });
      loadProducts();
      cancelDiscountEdit();
    } catch (e) {
      alert("Failed to apply discount");
    }
  };

  const openEditEditor = (id) => {
    setEditingDiscountFor(null);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setEditedFields({
      name: p.name,
      price: String(p.price),
      quantity: String(p.quantity),
      unit: p.unit,
    });
    setEditingProductFor(id);
  };

  const cancelEdit = () => {
    setEditingProductFor(null);
    setEditedFields({ name: "", price: "", quantity: "", unit: "" });
  };

  const saveEdit = async (id) => {
    const name = editedFields.name.trim();
    const price = Number(editedFields.price);
    const quantity = parseInt(editedFields.quantity, 10);
    const unit = editedFields.unit.trim();

    if (!name || Number.isNaN(price)) {
      alert("Fill all fields correctly.");
      return;
    }

    try {
      await api.put(`/products/${id}`, {
        name,
        price,
        quantity,
        unit
      });
      loadProducts();
      cancelEdit();
    } catch(e) {
      alert("Failed to update product");
    }
  };

  const handleEditorKeyDown = (e, type, id) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (type === "discount") applyDiscount(id);
      if (type === "edit") saveEdit(id);
    }
    if (e.key === "Escape") {
      if (type === "discount") cancelDiscountEdit();
      if (type === "edit") cancelEdit();
    }
  };

  return (
    <div className="app-shell center-grid fade-in">
      <div className="card center-card" style={{ maxWidth: 1100 }}>
        <div className="panel-title">Product Catalog</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 14,
            marginBottom: 16,
          }}
        >
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="small" style={{ color: "var(--muted)" }}>
            Total: <strong>{products.length}</strong>
          </div>
        </div>

        <div
          style={{
            borderRadius: 14,
            background: "rgba(15,23,42,0.01)",
            padding: 10,
            marginBottom: 18,
          }}
        >
          {filteredProducts.length === 0 ? (
            <div className="small" style={{ color: "var(--muted)" }}>
              No products found.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div
                className="small"
                style={{
                  display: "grid",
                  gridTemplateColumns: "3fr 1fr 1fr 1.4fr",
                  padding: "4px 10px",
                  color: "var(--muted)",
                }}
              >
                <div>Name</div>
                <div>Price</div>
                <div>Stock</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {filteredProducts.map((p) => {
                const discounted = p.discountPercent > 0;
                const discountedPrice = discounted
                  ? Math.round(p.price * (1 - p.discountPercent / 100))
                  : p.price;

                return (
                  <div
                    key={p.id}
                    className="request"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "3fr 1fr 1fr 1.4fr",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="meta">Unit: {p.unit}</div>
                    </div>

                    <div className="small">
                      {discounted ? (
                        <>
                          <div style={{ textDecoration: "line-through", opacity: 0.6 }}>
                            {formatPrice(p.original_price || p.price)}
                          </div>
                          <div style={{ fontWeight: 700 }}>
                            {formatPrice(p.price)}
                          </div>
                          <span className="badge">-{p.discountPercent}%</span>
                        </>
                      ) : (
                        formatPrice(p.price)
                      )}
                    </div>

                    <div className="small">
                      {p.quantity > 0 ? (
                        <>
                          {p.quantity}{" "}
                          <span style={{ color: "var(--muted)" }}>in stock</span>
                        </>
                      ) : (
                        <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                          Out of stock
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 6,
                      }}
                    >
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px" }}
                        onClick={() => openDiscountEditor(p.id)}
                      >
                        Discount
                      </button>

                      {/* ADD THE EDIT BUTTON FROM FRIEND'S VERSION */}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px" }}
                        onClick={() => openEditEditor(p.id)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px", color: "#b91c1c" }}
                        onClick={() => removeProduct(p.id)}
                      >
                        Remove
                      </button>
                    </div>

                    {/* EXPANDING EDIT ROWS */}
                    {editingDiscountFor === p.id && (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          marginTop: 6,
                          padding: 10,
                          borderRadius: 8,
                          background: "rgba(59,130,246,0.03)",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 600, minWidth: 160 }}>
                          Set discount for {p.name}
                        </div>
                        <input
                          className="input"
                          style={{ width: 120 }}
                          value={discountInput}
                          placeholder="10"
                          onChange={(e) => setDiscountInput(e.target.value)}
                          onKeyDown={(e) =>
                            handleEditorKeyDown(e, "discount", p.id)
                          }
                        />
                        <button
                          className="btn btn-primary"
                          onClick={() => applyDiscount(p.id)}
                        >
                          Apply
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={cancelDiscountEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {editingProductFor === p.id && (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          marginTop: 6,
                          padding: 12,
                          borderRadius: 8,
                          background: "rgba(15,23,42,0.02)",
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          className="input"
                          value={editedFields.name}
                          onChange={(e) =>
                            setEditedFields((s) => ({
                              ...s,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Product name"
                          style={{ flex: "1 1 280px", minWidth: 180 }}
                          onKeyDown={(e) =>
                            handleEditorKeyDown(e, "edit", p.id)
                          }
                        />

                        <input
                          className="input"
                          value={editedFields.price}
                          onChange={(e) =>
                            setEditedFields((s) => ({
                              ...s,
                              price: e.target.value,
                            }))
                          }
                          placeholder="Price"
                          style={{ flex: "0 1 140px", minWidth: 120 }}
                          onKeyDown={(e) =>
                            handleEditorKeyDown(e, "edit", p.id)
                          }
                        />

                        <input
                          className="input"
                          value={editedFields.quantity}
                          onChange={(e) =>
                            setEditedFields((s) => ({
                              ...s,
                              quantity: e.target.value,
                            }))
                          }
                          placeholder="Quantity"
                          style={{ flex: "0 1 120px", minWidth: 100 }}
                          onKeyDown={(e) =>
                            handleEditorKeyDown(e, "edit", p.id)
                          }
                        />

                        <input
                          className="input"
                          value={editedFields.unit}
                          onChange={(e) =>
                            setEditedFields((s) => ({
                              ...s,
                              unit: e.target.value,
                            }))
                          }
                          placeholder="Unit"
                          style={{ flex: "0 1 140px", minWidth: 100 }}
                          onKeyDown={(e) =>
                            handleEditorKeyDown(e, "edit", p.id)
                          }
                        />

                        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                          <button className="btn btn-primary" onClick={() => saveEdit(p.id)}>
                            Save
                          </button>
                          <button className="btn btn-ghost" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="panel"
          style={{
            marginTop: 4,
            borderRadius: 14,
            background: "#f9fafb",
          }}
        >
          <div className="panel-title" style={{ marginBottom: 8 }}>
            Add New Product
          </div>

          <form
            onSubmit={handleAdd}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              className="input"
              placeholder="Product name"
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <input
              className="input"
              placeholder="Price"
              value={newProduct.price}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, price: e.target.value }))
              }
            />
            <input
              className="input"
              placeholder="Quantity"
              value={newProduct.quantity}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, quantity: e.target.value }))
              }
            />
            <input
              className="input"
              placeholder="Unit"
              value={newProduct.unit}
              onChange={(e) =>
                setNewProduct((prev) => ({ ...prev, unit: e.target.value }))
              }
            />

            <button type="submit" className="btn btn-primary">
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get("/orders").then(data => {
      setOrders(data.map(o => ({
        ...o,
        consumer_name: `Customer #${o.consumer_id}`
      })));
    });
  }, []);

  const formatTime = (ts) =>
    new Date(ts).toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="app-shell center-grid fade-in">
      <div className="card center-card" style={{ maxWidth: 900 }}>
        <div className="panel-title">Orders</div>
        <div className="small" style={{ marginBottom: 12 }}>
          Click an order to view details and open chat with the customer.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => navigate(`/orders/${o.id}`)}
              style={{
                textAlign: "left",
                border: "none",
                padding: 0,
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <div className="request">
                <div>
                  <div style={{ fontWeight: 700 }}>
                    Order #{o.id} — {o.consumer_name}
                  </div>
                  <div className="meta">Created: {formatTime(o.created_at)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="small">
                    Total: <strong>{o.total_amount}</strong>
                  </div>
                  <div className="small">
                    Status:{" "}
                    <span
                      className="badge"
                      style={{
                        background: "rgba(37,99,235,0.06)",
                        color: "var(--accent)",
                      }}
                    >
                      {o.status}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ORDER DETAILS ---------------- */
function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.get("/orders").then(list => {
      const found = list.find(o => o.id === parseInt(id));
      if(found) setOrder({ ...found, consumer_name: `Customer #${found.consumer_id}` });
    });
  }, [id]);

  const formatTime = (ts) =>
    new Date(ts).toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!order) return <div>Loading...</div>;

  const acceptOrder = async () => {
    try {
      await api.put(`/orders/${id}/status`, { status: "confirmed" });
      setOrder((prev) => ({ ...prev, status: "confirmed" }));
    } catch(e) {
      alert("Failed");
    }
  };

  const rejectOrder = async () => {
    if (!window.confirm("Reject this order?")) return;
    try {
      await api.put(`/orders/${id}/status`, { status: "rejected" });
      setOrder((prev) => ({ ...prev, status: "rejected" }));
    } catch(e) {
      alert("Failed");
    }
  };

  const goToChat = () => {
    navigate("/chat", {
      state: { consumerId: order.consumer_id, customerName: order.consumer_name },
    });
  };

  return (
    <div className="app-shell center-grid fade-in">
      <div className="card center-card" style={{ maxWidth: 800 }}>
        <div className="panel-title">Order #{order.id}</div>

        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          <div><strong>Customer:</strong> {order.consumer_name}</div>
          <div><strong>Status:</strong> <span className="badge">{order.status}</span></div>
          <div><strong>Total amount:</strong> {order.total_amount} ₸</div>
          <div><strong>Created at:</strong> {formatTime(order.created_at)}</div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button className="btn btn-ghost" onClick={() => navigate("/orders")}>
            ← Back to Orders
          </button>

          {order.status === "pending" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={acceptOrder}>
                Accept Order
              </button>
              <button className="btn btn-ghost" style={{ color: "#b91c1c" }} onClick={rejectOrder}>
                Reject Order
              </button>
              <button className="btn btn-primary" onClick={goToChat}>
                Open Chat
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={goToChat}>
              Open Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- CHAT ---------------- */
function Chat() {
  const location = useLocation();
  // Match user's API expectations where consumerId is passed
  const startId = location.state?.consumerId;
  const [activeId, setActiveId] = useState(startId || null);
  
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const messagesRef = useRef(null);

  // Load conversations (accepted links)
  useEffect(() => {
    const loadConvos = async () => {
      try {
        const links = await api.get("/supplier/links");
        const accepted = links.filter(l => l.status === "accepted").map(l => ({
          id: l.consumer_id,
          name: `Customer #${l.consumer_id}`
        }));
        setConversations(accepted);
        if (!activeId && accepted.length > 0) {
          setActiveId(accepted[0].id);
        }
      } catch (e) { console.error(e); }
    };
    loadConvos();
  }, []);

  // Poll messages
  useEffect(() => {
    if (!activeId) return;
    const fetchMsgs = () => {
      api.get(`/chat/${activeId}`).then(setMessages).catch(() => {});
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 3000);
    return () => clearInterval(interval);
  }, [activeId]);

  // Scroll bottom
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !activeId) return;
    try {
      await api.post("/chat", { recipient_id: activeId, content: text });
      setText("");
      // Immediate refresh
      const msgs = await api.get(`/chat/${activeId}`);
      setMessages(msgs);
    } catch (e) { alert("Failed to send"); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  const activeConv = conversations.find(c => c.id === activeId);

  return (
    <div className="app-shell center-grid fade-in">
      <div
        className="card center-card chat-card"
        style={{ maxWidth: 1000, minHeight: "65vh", display: "flex", flexDirection: "column" }}
      >
        <div className="panel-title">Chat</div>

        <div style={{ display: "flex", gap: 16, marginTop: 12, minHeight: "55vh" }}>
          <div style={{ width: 260, borderRight: "1px solid rgba(15,23,42,0.06)", paddingRight: 10, paddingTop: 4 }}>
            <div className="small" style={{ marginBottom: 8, fontWeight: 600 }}>Conversations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {conversations.map((conv) => {
                const isActive = conv.id === activeId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveId(conv.id)}
                    style={{
                      textAlign: "left",
                      border: "none",
                      background: isActive ? "rgba(59,130,246,0.06)" : "transparent",
                      borderRadius: 10,
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: isActive ? "var(--accent)" : "var(--text)" }}>
                      {conv.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="small" style={{ marginBottom: 8, fontWeight: 600 }}>
              {activeConv ? `Chat with ${activeConv.name}` : "Select a chat"}
            </div>

            <div
              ref={messagesRef}
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                height: "52vh",
                boxSizing: "border-box",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 8,
                borderRadius: 10,
                background: "rgba(15,23,42,0.01)",
              }}
            >
              {messages.map((m) => (
                <div key={m.id} style={{ alignSelf: m.sender_id === activeId ? "flex-start" : "flex-end", maxWidth: "78%", wordBreak: "break-word" }}>
                  <div style={{ background: m.sender_id === activeId ? "rgba(0,0,0,0.04)" : "rgba(59,130,246,0.1)", padding: 10, borderRadius: 10 }}>
                    <div style={{ fontSize: 13 }}>{m.content}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeConv ? "Write a message..." : "Select a conversation first"}
                disabled={!activeConv}
              />
              <button className="btn btn-primary" onClick={send} disabled={!activeConv}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="app-shell center-grid fade-in">
      <div className="card center-card" style={{ maxWidth: 700 }}>
        <div className="panel-title">About This Platform</div>
        <p className="small">
          This Supplier–Consumer Platform was developed as a project by our team.
        </p>
      </div>
    </div>
  );
}

function ProfilePage() {
  const [about, setAbout] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [tempAbout, setTempAbout] = React.useState("");

  useEffect(() => {
    const savedAbout = localStorage.getItem("supplierAbout");
    const savedVis = localStorage.getItem("supplierVisible") === "true";
    setAbout(savedAbout || "");
    setVisible(savedVis);
    setTempAbout(savedAbout || "");
  }, []);

  const saveAbout = async () => {
    try {
      await api.put("/supplier/profile", { about: tempAbout });
      setAbout(tempAbout);
      localStorage.setItem("supplierAbout", tempAbout);
      setEditing(false);
    } catch(e) {
      alert("Failed to save profile (Backend err)");
      // Fallback for demo if API not ready
      setAbout(tempAbout);
      localStorage.setItem("supplierAbout", tempAbout);
      setEditing(false);
    }
  };

  const toggleVisibility = async () => {
    const newStatus = !visible;
    try {
      await api.post(`/supplier/visibility/${newStatus ? 'show' : 'hide'}`);
      setVisible(newStatus);
      localStorage.setItem("supplierVisible", newStatus);
    } catch (e) {
       // Fallback
      setVisible(newStatus);
      localStorage.setItem("supplierVisible", newStatus);
    }
  };

  return (
    <div className="app-shell center-grid fade-in">
      <div className="card center-card" style={{ maxWidth: 700 }}>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          Supplier Profile
        </div>

        <button
          className="btn"
          style={{
            background: visible ? "rgba(16,185,129,0.15)" : "rgba(248,113,113,0.15)",
            color: visible ? "#047857" : "#b91c1c",
            marginBottom: 16,
          }}
          onClick={toggleVisibility}
        >
          {visible ? "Make Invisible" : "Make Visible"}
        </button>

        <div className="panel">
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
            About Me
          </div>

          {!editing ? (
            <>
              <div style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>
                {about.trim() ? (
                  about
                ) : (
                  <span style={{ color: "var(--muted)" }}>
                    Nothing written yet.
                  </span>
                )}
              </div>

              <button className="btn btn-primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          ) : (
            <>
              <textarea
                value={tempAbout}
                onChange={(e) => setTempAbout(e.target.value)}
                style={{
                  width: "100%",
                  height: 140,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.1)",
                  marginBottom: 12,
                }}
              />

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={saveAbout}>
                  Save
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setTempAbout(about);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ROOT APP ---------------- */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <HeaderBar />
        <AuthWatcher />

        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<SignUpPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Fallback */}
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
