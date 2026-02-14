import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";

export default function CartAndAddress() {
  const navigate = useNavigate();
  const topRef = useRef(null);

  // CART
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // USER
  const [meLoading, setMeLoading] = useState(true);
  const [meErr, setMeErr] = useState("");
  const [me, setMe] = useState(null);

  // ADDRESS
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrErr, setAddrErr] = useState("");
  const [addrMsg, setAddrMsg] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const emptyForm = {
    label: "Home",
    pincode: "",
    house: "",
    area: "",
    landmark: "",
    receiverFirstName: "",
    receiverLastName: "",
    receiverPhone: "",
    isDefault: true,
  };
  const [form, setForm] = useState(emptyForm);

  // IMAGES
  const API_ORIGIN = useMemo(() => {
    const base = (axiosInstance.defaults.baseURL || "").trim();
    if (!base) return "http://localhost:3000";
    return base.replace(/\/+$/, "");
  }, []);

  const normalizeImages = (images) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    if (typeof images === "string") {
      const s = images.trim();
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "string") return [parsed];
      } catch {
        const cleaned = s.replace(/^"+|"+$/g, "");
        return cleaned ? [cleaned] : [];
      }
    }
    return [];
  };

  const imgUrl = (path) => {
    if (!path) return "";
    const p = String(path).trim();
    if (p.startsWith("http://") || p.startsWith("https://")) return p;
    if (p.startsWith("/")) return `${API_ORIGIN}${p}`;
    return `${API_ORIGIN}/${p}`;
  };

  const safeNum = (v) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  const money = (v) => safeNum(v).toFixed(2);

  // CART HELPERS
  const cartItems = (data?.CartItems || data?.cartItems || data?.items || []) ?? [];
  const getProduct = (it) => it?.product || it?.Product || it?.productDetails || {};
  const getQty = (it) => safeNum(it?.qty ?? it?.quantity ?? it?.cartQty ?? 1) || 1;
  const itemsCount = data?.itemsCount ?? cartItems.length ?? 0;
  const totalQty = data?.totalQty ?? cartItems.reduce((s, it) => s + getQty(it), 0);

  // LOADERS
  const loadCart = async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await axiosInstance.get("/api/cart", { params: { _ts: Date.now() } });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.msg || e?.message || "Failed to load cart");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMe = async () => {
    try {
      setMeLoading(true);
      setMeErr("");
      const res = await axiosInstance.get("/api/users/me", { params: { _ts: Date.now() } });
      setMe(res?.data?.user || res?.data || null);
    } catch (e) {
      setMeErr(e?.response?.data?.msg || e?.message || "Failed to load user");
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  };

  const loadAddresses = async () => {
    try {
      setAddrLoading(true);
      setAddrErr("");
      setAddrMsg("");
      const res = await axiosInstance.get("/api/addresses", { params: { _ts: Date.now() } });
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.addresses) ? raw.addresses : [];
      setAddresses(list);
    } catch (e) {
      setAddrErr(e?.response?.data?.msg || e?.message || "Failed to load addresses");
      setAddresses([]);
    } finally {
      setAddrLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    loadCart();
    loadMe();
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DEFAULT ADDRESS
  const defaultAddress = useMemo(() => {
    if (!Array.isArray(addresses) || addresses.length === 0) return null;
    return addresses.find((a) => a?.isDefault) || addresses[0] || null;
  }, [addresses]);

  useEffect(() => {
    if (selectedAddressId) return;
    const defId = defaultAddress?.id ?? defaultAddress?._id ?? "";
    if (defId) setSelectedAddressId(String(defId));
  }, [defaultAddress, selectedAddressId]);

  const selectedAddress = useMemo(() => {
    if (!selectedAddressId) return defaultAddress || null;
    return addresses.find((a) => String(a?.id ?? a?._id) === String(selectedAddressId)) || defaultAddress || null;
  }, [addresses, selectedAddressId, defaultAddress]);

  // UPDATE QTY
  const updateQty = async (cartItemId, newQty) => {
    const qty = Number(newQty);
    if (!cartItemId) return;
    if (!Number.isFinite(qty) || qty < 1) return;

    try {
      setUpdatingId(cartItemId);
      setErr("");
      const res = await axiosInstance.put(`/api/cart/${cartItemId}`, { qty });
      const updated = res?.data;
      if (updated && (updated.CartItems || updated.cartItems || updated.items)) setData(updated);
      else await loadCart();
    } catch (e) {
      setErr(e?.response?.data?.msg || e?.message || "Failed to update quantity");
    } finally {
      setUpdatingId(null);
    }
  };

  // DELETE ITEM
  const removeItem = async (cartItemId) => {
    if (!cartItemId) return;
    const ok = window.confirm("Remove this item from cart?");
    if (!ok) return;

    try {
      setDeletingId(cartItemId);
      setErr("");
      await axiosInstance.delete(`/api/cart/${cartItemId}`);
      await loadCart();
    } catch (e) {
      setErr(e?.response?.data?.msg || e?.message || "Failed to remove item");
    } finally {
      setDeletingId(null);
    }
  };

  // ADDRESS ACTIONS
  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setAddrMsg("");
    setAddrErr("");
  };

  const startEdit = (addr) => {
    const id = addr?.id ?? addr?._id;
    setEditingId(id || null);

    setForm({
      label: addr?.label || "Home",
      pincode: addr?.pincode || "",
      house: addr?.house || "",
      area: addr?.area || "",
      landmark: addr?.landmark || "",
      receiverFirstName: addr?.receiverFirstName || "",
      receiverLastName: addr?.receiverLastName || "",
      receiverPhone: addr?.receiverPhone || "",
      isDefault: !!addr?.isDefault,
    });

    setFormOpen(true);
    setAddrMsg("");
    setAddrErr("");
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const onFormChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const saveAddress = async (e) => {
    e.preventDefault();
    setAddrMsg("");
    setAddrErr("");

    if (!form.label || !form.pincode || !form.house || !form.area || !form.receiverFirstName || !form.receiverPhone) {
      setAddrErr("Please fill required fields: label, pincode, house, area, receiverFirstName, receiverPhone");
      return;
    }

    try {
      setSavingAddr(true);
      const payload = {
        label: form.label,
        pincode: form.pincode,
        house: form.house,
        area: form.area,
        landmark: form.landmark || "",
        receiverFirstName: form.receiverFirstName,
        receiverLastName: form.receiverLastName || "",
        receiverPhone: form.receiverPhone,
        isDefault: !!form.isDefault,
      };

      if (editingId) {
        await axiosInstance.put(`/api/addresses/${editingId}`, payload);
        setAddrMsg("Address updated ✅");
      } else {
        await axiosInstance.post("/api/addresses", payload);
        setAddrMsg("Address added ✅");
      }

      await loadAddresses();
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (e2) {
      setAddrErr(e2?.response?.data?.msg || e2?.message || "Failed to save address");
    } finally {
      setSavingAddr(false);
    }
  };

  // ✅ NEXT → go checkout page
  const goNext = () => {
    setErr("");
    if (cartItems.length === 0) {
      setErr("Cart is empty.");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!selectedAddressId) {
      setErr("Please select an address.");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    navigate("/checkout", {
      state: {
        selectedAddressId: String(selectedAddressId),
      },
    });
  };

  return (
    <div style={S.page}>
      <style>{css}</style>

      <div style={S.container}>
        <div ref={topRef} />

        <div style={S.hero}>
          <div>
            <div style={S.h1}>Cart</div>
            <div style={S.sub}>Step 1: Cart + Address</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.82 }}>
              {meLoading ? (
                "Loading user…"
              ) : meErr ? (
                <span style={{ color: "#ffb4b4", fontWeight: 800 }}>{meErr}</span>
              ) : (
                <>
                  User: <b style={{ color: "#ffd24a" }}>{me?.name || "—"}</b>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={S.btn} onClick={() => navigate(-1)}>← Back</button>
            <button style={S.btn} onClick={() => { loadCart(); loadMe(); loadAddresses(); }}>↻ Refresh</button>
          </div>
        </div>

        {err && <div style={{ ...S.info, color: "#ffb4b4" }}>{err}</div>}

        <div className="grid2">
          {/* CART */}
          <div style={S.panel}>
            <div style={S.panelTop}>
              <div>
                <div style={S.panelTitle}>Cart Items</div>
                <div style={S.panelSub}>Update qty / delete item</div>
              </div>
              <div style={S.badge2}>{itemsCount} items • Qty {totalQty}</div>
            </div>

            {loading ? (
              <div style={S.info}>Loading cart…</div>
            ) : cartItems.length === 0 ? (
              <div style={S.info}>Cart is empty.</div>
            ) : (
              <div style={S.list}>
                {cartItems.map((it, idx) => {
                  const p = getProduct(it);
                  const qty = getQty(it);

                  const imgs = normalizeImages(p?.images);
                  const img = imgUrl(imgs?.[0]);

                  const price = safeNum(p?.price || it?.price || 0);
                  const lineTotal = price * qty;

                  const cartItemId = it?.id ?? it?.cartItemId ?? it?._id;
                  const isUpdating = String(updatingId) === String(cartItemId);
                  const isDeleting = String(deletingId) === String(cartItemId);

                  return (
                    <div key={cartItemId ?? idx} style={S.item}>
                      <div style={S.imgWrap}>
                        <img
                          src={img || "https://via.placeholder.com/220x160?text=No+Image"}
                          alt={p?.name || "Product"}
                          style={S.img}
                          onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/220x160?text=No+Image")}
                        />
                      </div>

                      <div style={S.itemBody}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={S.name}>{p?.name || it?.name || "—"}</div>
                          <button
                            style={{ ...S.delBtn, opacity: isDeleting ? 0.6 : 1 }}
                            onClick={() => removeItem(cartItemId)}
                            disabled={isDeleting}
                            title="Remove item"
                          >
                            {isDeleting ? "Removing…" : "🗑"}
                          </button>
                        </div>

                        <div style={S.meta}>
                          <span>{p?.brand || "—"}</span>
                          <span style={{ opacity: 0.7 }}>{p?.category || ""}</span>
                        </div>

                        <div style={S.row}>
                          <div style={S.price}>₹ {money(price)}</div>
                          <div style={S.badge}>Stock: {safeNum(p?.stockQty ?? 0) || "—"}</div>
                        </div>

                        <div style={S.qtyRow}>
                          <div style={S.qtyBox}>
                            <button
                              style={{ ...S.qtyBtn, opacity: qty <= 1 || isUpdating ? 0.5 : 1 }}
                              onClick={() => qty > 1 && updateQty(cartItemId, qty - 1)}
                              disabled={qty <= 1 || isUpdating}
                            >
                              −
                            </button>
                            <div style={S.qtyValue}>{qty}</div>
                            <button
                              style={{ ...S.qtyBtn, opacity: isUpdating ? 0.6 : 1 }}
                              onClick={() => updateQty(cartItemId, qty + 1)}
                              disabled={isUpdating}
                            >
                              +
                            </button>
                          </div>
                          {isUpdating && <div style={S.updatingText}>Updating…</div>}
                        </div>

                        <div style={S.lineTotal}>Line Total: ₹ {money(lineTotal)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ADDRESS */}
          <div style={S.panel}>
            <div style={S.panelTop}>
              <div>
                <div style={S.panelTitle}>Delivery Address</div>
                <div style={S.panelSub}>Select / Add / Edit</div>
              </div>
              <button style={S.smallPrimaryBtn} onClick={startAdd}>+ Add</button>
            </div>

            {addrErr && <div style={{ ...S.info, color: "#ffb4b4" }}>{addrErr}</div>}
            {addrMsg && <div style={{ ...S.info, color: "#b6ffcc" }}>{addrMsg}</div>}

            {addrLoading ? (
              <div style={S.info}>Loading addresses…</div>
            ) : addresses.length === 0 ? (
              <div style={S.info}>No address found. Click “+ Add”.</div>
            ) : (
              <>
                <div style={S.field}>
                  <div style={S.label}>Choose Address *</div>
                  <select value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} style={S.input}>
                    {addresses.map((a) => {
                      const id = a?.id ?? a?._id;
                      const text = `${a?.label || "Address"} • ${a?.receiverFirstName || ""} • ${a?.area || ""} - ${a?.pincode || ""}`;
                      return (
                        <option key={id} value={String(id)}>
                          {text}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedAddress && (
                  <div style={{ ...S.addrBox, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 950 }}>
                        {selectedAddress.label || "Address"}{" "}
                        {selectedAddress.isDefault ? <span style={S.pill}>DEFAULT</span> : null}
                      </div>
                      <button style={S.tinyBtn} onClick={() => startEdit(selectedAddress)}>Edit</button>
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.5 }}>
                      {selectedAddress.receiverFirstName} {selectedAddress.receiverLastName || ""} • {selectedAddress.receiverPhone}
                      <br />
                      {selectedAddress.house}, {selectedAddress.area}
                      {selectedAddress.landmark ? `, ${selectedAddress.landmark}` : ""} - {selectedAddress.pincode}
                    </div>
                  </div>
                )}
              </>
            )}

            {formOpen && (
              <div style={{ marginTop: 14 }}>
                <div style={S.formTitle}>{editingId ? "Edit Address" : "Add New Address"}</div>

                <form onSubmit={saveAddress} style={S.formGrid}>
                  <div style={S.field}>
                    <div style={S.label}>Label *</div>
                    <select value={form.label} onChange={(e) => onFormChange("label", e.target.value)} style={S.input}>
                      <option>Home</option>
                      <option>Office</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>Pincode *</div>
                    <input value={form.pincode} onChange={(e) => onFormChange("pincode", e.target.value)} style={S.input} />
                  </div>

                  <div style={S.fieldFull}>
                    <div style={S.label}>House / Flat *</div>
                    <input value={form.house} onChange={(e) => onFormChange("house", e.target.value)} style={S.input} />
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>Area *</div>
                    <input value={form.area} onChange={(e) => onFormChange("area", e.target.value)} style={S.input} />
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>Landmark</div>
                    <input value={form.landmark} onChange={(e) => onFormChange("landmark", e.target.value)} style={S.input} />
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>Receiver First Name *</div>
                    <input value={form.receiverFirstName} onChange={(e) => onFormChange("receiverFirstName", e.target.value)} style={S.input} />
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>Receiver Last Name</div>
                    <input value={form.receiverLastName} onChange={(e) => onFormChange("receiverLastName", e.target.value)} style={S.input} />
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>Receiver Phone *</div>
                    <input value={form.receiverPhone} onChange={(e) => onFormChange("receiverPhone", e.target.value)} style={S.input} />
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>Default?</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10 }}>
                      <input type="checkbox" checked={!!form.isDefault} onChange={(e) => onFormChange("isDefault", e.target.checked)} />
                      <span style={{ opacity: 0.9, fontWeight: 800 }}>Make default</span>
                    </label>
                  </div>

                  <div style={S.fieldFull}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="submit" style={{ ...S.primaryBtn, opacity: savingAddr ? 0.6 : 1 }} disabled={savingAddr}>
                        {savingAddr ? "Saving…" : editingId ? "Update" : "Save"}
                      </button>
                      <button type="button" style={S.btnGhost} onClick={cancelForm}>Cancel</button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <button
                style={{ ...S.payBtn, opacity: cartItems.length === 0 || !selectedAddressId ? 0.6 : 1 }}
                disabled={cartItems.length === 0 || !selectedAddressId}
                onClick={goNext}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const css = `
  *{ margin:0; padding:0; box-sizing:border-box; }
  html,body,#root{ height:100%; width:100%; }
  body{
    overflow-x:hidden;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
    background: linear-gradient(180deg,#040915 0%,#060c19 50%,#050914 100%);
    color: #e9eefc;
  }
  input, textarea, select, button { font-family: inherit; }

  .grid2{
    display:grid;
    grid-template-columns: 1.2fr .8fr;
    gap: 12px;
    align-items:start;
  }
  @media (max-width: 1100px){
    .grid2{ grid-template-columns: 1fr; }
  }
`;

const S = {
  page: { minHeight: "100vh", color: "#e9eefc" },
  container: { width: "min(1400px, 100%)", margin: "0 auto", padding: "18px 16px 60px" },

  hero: {
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(220,235,255,.14)",
    background: "rgba(12,18,36,.72)",
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  h1: { fontSize: 34, fontWeight: 950 },
  sub: { marginTop: 6, fontSize: 13, opacity: 0.8 },

  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(220,235,255,.16)",
    background: "rgba(255,255,255,.06)",
    color: "#e9eefc",
    fontWeight: 900,
    cursor: "pointer",
  },

  panel: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(220,235,255,.12)",
    background: "rgba(255,255,255,.06)",
  },
  panelTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  panelTitle: { fontSize: 16, fontWeight: 950 },
  panelSub: { marginTop: 4, fontSize: 12, opacity: 0.75 },

  badge2: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(34,211,238,.35)",
    background: "rgba(34,211,238,.10)",
    color: "#bff7ff",
    whiteSpace: "nowrap",
  },

  info: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(220,235,255,.12)",
    marginBottom: 10,
  },

  list: { display: "grid", gap: 12 },

  item: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: 12,
    borderRadius: 16,
    border: "1px solid rgba(220,235,255,.12)",
    background: "rgba(255,255,255,.05)",
    overflow: "hidden",
  },
  imgWrap: { background: "rgba(255,255,255,.05)" },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },

  itemBody: { padding: 12 },
  name: { fontSize: 15, fontWeight: 950 },
  meta: { marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, opacity: 0.9 },
  row: { marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },

  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(74,140,255,.35)",
    background: "rgba(74,140,255,.10)",
    color: "#a9c8ff",
    whiteSpace: "nowrap",
  },

  price: { fontSize: 14, fontWeight: 950, color: "#ffd24a" },
  qtyRow: { marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },

  qtyBox: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(220,235,255,.14)",
    background: "rgba(255,255,255,.06)",
  },
  qtyBtn: { width: 40, height: 36, border: "none", background: "rgba(255,255,255,.04)", color: "#e9eefc", fontSize: 18, fontWeight: 950, cursor: "pointer" },
  qtyValue: { width: 46, height: 36, display: "grid", placeItems: "center", fontWeight: 950 },

  updatingText: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(233,238,252,.78)",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px dashed rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.05)",
  },

  lineTotal: { marginTop: 10, fontSize: 12, opacity: 0.85 },

  delBtn: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,180,180,.35)",
    background: "rgba(255,180,180,.10)",
    color: "#ffb4b4",
    fontWeight: 950,
    cursor: "pointer",
  },

  smallPrimaryBtn: {
    padding: "9px 12px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #6D5BFF, #22D3EE)",
    color: "#08101f",
    fontWeight: 950,
    cursor: "pointer",
  },

  addrBox: { borderRadius: 14, padding: 12, border: "1px solid rgba(220,235,255,.12)", background: "rgba(10,16,35,.55)" },
  pill: { marginLeft: 8, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 950, border: "1px solid rgba(34,211,238,.35)", background: "rgba(34,211,238,.10)", color: "#bff7ff" },
  tinyBtn: { padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(220,235,255,.14)", background: "rgba(255,255,255,.06)", color: "#e9eefc", fontWeight: 900, cursor: "pointer" },

  formTitle: { marginTop: 12, fontSize: 14, fontWeight: 950, opacity: 0.9 },

  formGrid: { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  field: {},
  fieldFull: { gridColumn: "1 / -1" },
  label: { fontSize: 12, opacity: 0.78, fontWeight: 900, marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(220,235,255,.14)", background: "rgba(255,255,255,.05)", color: "#e9eefc", outline: "none" },

  primaryBtn: { flex: 1, height: 44, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6D5BFF, #22D3EE)", color: "#08101f", fontWeight: 950, cursor: "pointer", padding: "0 14px" },
  btnGhost: { height: 44, borderRadius: 12, border: "1px solid rgba(220,235,255,.14)", background: "rgba(255,255,255,.06)", color: "#e9eefc", fontWeight: 900, cursor: "pointer", padding: "0 14px" },

  payBtn: { marginTop: 12, width: "100%", height: 46, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6D5BFF, #22D3EE)", color: "#08101f", fontWeight: 950, cursor: "pointer", fontSize: 14 },
};
