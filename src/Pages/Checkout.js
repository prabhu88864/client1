import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";

export default function Checkout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const topRef = useRef(null);

  const selectedAddressIdFromPrev = String(loc?.state?.selectedAddressId || "");

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // data needed
  const [cart, setCart] = useState(null);
  const [me, setMe] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [deliveryRules, setDeliveryRules] = useState([]);

  // payment
  const [paymentMethod, setPaymentMethod] = useState("RAZORPAY");
  const [paying, setPaying] = useState(false);
  const [rzpReady, setRzpReady] = useState(false);

  const safeNum = (v) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const money = (v) => safeNum(v).toFixed(2);

  const cartItems = (cart?.CartItems || cart?.cartItems || cart?.items || []) ?? [];
  const getProduct = (it) => it?.product || it?.Product || it?.productDetails || {};
  const getQty = (it) => safeNum(it?.qty ?? it?.quantity ?? it?.cartQty ?? 1) || 1;

  const userType = String(me?.userType || "").toUpperCase().trim();
  const getApplicablePercent = (p) => {
    if (userType === "ENTREPRENEUR") return safeNum(p?.entrepreneurDiscount ?? 0);
    if (userType === "TRAINEE_ENTREPRENEUR") return safeNum(p?.traineeEntrepreneurDiscount ?? 0);
    return 0;
  };

  const subtotal =
    cart?.totalAmount ??
    cartItems.reduce((s, it) => {
      const p = getProduct(it);
      const price = safeNum(p?.price ?? it?.price ?? 0);
      return s + price * getQty(it);
    }, 0);

  const summaryProducts = useMemo(() => {
    return cartItems.map((it) => {
      const p = getProduct(it);
      const qty = getQty(it);
      const price = safeNum(p?.price ?? it?.price ?? 0);
      const percent = getApplicablePercent(p);
      const lineTotal = price * qty;
      const lineDiscount = (lineTotal * percent) / 100;
      return {
        id: it?.id ?? it?._id ?? `${p?.id || ""}-${p?.name || ""}`,
        name: p?.name || it?.name || "Product",
        qty,
        price,
        percent,
        lineTotal,
        lineDiscount,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, userType]);

  const discountAmount = useMemo(() => {
    const sum = summaryProducts.reduce((s, x) => s + safeNum(x.lineDiscount), 0);
    return Math.min(sum, safeNum(subtotal));
  }, [summaryProducts, subtotal]);

  const subtotalAfterDiscount = useMemo(() => {
    const v = safeNum(subtotal) - safeNum(discountAmount);
    return v < 0 ? 0 : v;
  }, [subtotal, discountAmount]);

  const deliveryCharge = useMemo(() => {
    const base = safeNum(subtotalAfterDiscount);
    if (!Array.isArray(deliveryRules) || deliveryRules.length === 0) return 0;

    const active = deliveryRules.filter((r) => r?.isActive !== false);
    const matches = active.filter((r) => {
      const min = safeNum(r?.minAmount ?? 0);
      const max = safeNum(r?.maxAmount ?? 0);
      return base >= min && base <= max;
    });
    if (matches.length === 0) return 0;
    matches.sort((a, b) => safeNum(a.maxAmount) - safeNum(b.maxAmount));
    return safeNum(matches[0]?.charge ?? 0);
  }, [deliveryRules, subtotalAfterDiscount]);

  const grandTotal = useMemo(() => safeNum(subtotalAfterDiscount) + safeNum(deliveryCharge), [subtotalAfterDiscount, deliveryCharge]);

  const selectedAddress = useMemo(() => {
    if (!selectedAddressIdFromPrev) return null;
    return addresses.find((a) => String(a?.id ?? a?._id) === String(selectedAddressIdFromPrev)) || null;
  }, [addresses, selectedAddressIdFromPrev]);

  const walletBalance = safeNum(wallet?.balance ?? 0);
  const canPayWithWallet = walletBalance >= safeNum(grandTotal);

  // Razorpay script
  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);

      const existing = document.getElementById("razorpay-checkout-js");
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => resolve(false));
        return;
      }

      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  // Load all again (best practice)
  const loadAll = async () => {
    try {
      setLoading(true);
      setErr("");

      const [cartRes, meRes, addrRes, walletRes, dcRes] = await Promise.all([
        axiosInstance.get("/api/cart", { params: { _ts: Date.now() } }),
        axiosInstance.get("/api/users/me", { params: { _ts: Date.now() } }),
        axiosInstance.get("/api/addresses", { params: { _ts: Date.now() } }),
        axiosInstance.get("/api/wallet", { params: { _ts: Date.now() } }),
        axiosInstance.get("/api/deliverycharges", { params: { _ts: Date.now() } }),
      ]);

      setCart(cartRes.data || null);
      setMe(meRes?.data?.user || meRes?.data || null);

      const raw = addrRes.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.addresses) ? raw.addresses : [];
      setAddresses(list);

      setWallet(walletRes.data || null);
      setDeliveryRules(Array.isArray(dcRes.data) ? dcRes.data : []);
    } catch (e) {
      setErr(e?.response?.data?.msg || e?.message || "Failed to load checkout data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!selectedAddressIdFromPrev) {
      navigate("/cart", { replace: true });
      return;
    }

    loadAll();

    (async () => {
      const ok = await loadRazorpayScript();
      setRzpReady(!!ok);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payNow = async () => {
    if (paying) return;

    if (!selectedAddressIdFromPrev) {
      setErr("Please select an address.");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (cartItems.length === 0) {
      setErr("Cart is empty.");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (paymentMethod === "WALLET" && !canPayWithWallet) {
      setErr("Insufficient wallet balance for Grand Total.");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (paymentMethod === "RAZORPAY" && !rzpReady) {
      setErr("Razorpay script not loaded. Refresh & try again.");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    try {
      setPaying(true);
      setErr("");

      // 1) Create internal order
      const orderRes = await axiosInstance.post("/api/orders", {
        paymentMethod,
        addressId: Number(selectedAddressIdFromPrev),
      });

      const createdOrder = orderRes?.data?.order || orderRes?.data || {};
      const orderId = createdOrder?.id || createdOrder?.orderId;

      // ✅ Wallet / COD → go result directly
      if (paymentMethod === "WALLET" || paymentMethod === "COD") {
        navigate("/payment-result", {
          state: {
            status: "SUCCESS",
            method: paymentMethod,
            orderId,
            amount: grandTotal,
            currency: "INR",
            message: paymentMethod === "WALLET" ? "Wallet payment successful ✅" : "Order placed successfully (COD) ✅",
          },
        });
        return;
      }

      // 2) Create Razorpay order
      const rzCreate = await axiosInstance.post("/api/razorpay/create-order", { orderId: Number(orderId) });
      const rz = rzCreate?.data || {};

      const razorpayOrderId = rz?.orderId || rz?.razorpay_order_id;
      const amountPaise = safeNum(rz?.amount ?? 0);
      const currency = rz?.currency || "INR";
      const keyId = rz?.keyId || rz?.key_id || rz?.key || "";

      if (!razorpayOrderId || !amountPaise || !keyId) {
        setErr("Razorpay create-order missing fields.");
        return;
      }

      const options = {
        key: keyId,
        amount: String(amountPaise),
        currency,
        name: "Bestway",
        description: `Order #${orderId}`,
        order_id: razorpayOrderId,
        prefill: {
          name: [selectedAddress?.receiverFirstName, selectedAddress?.receiverLastName].filter(Boolean).join(" "),
          contact: selectedAddress?.receiverPhone || "",
          email: me?.email || "",
        },
        notes: { internal_order_id: String(orderId) },
        theme: { color: "#6D5BFF" },

        handler: async function (response) {
          try {
            await axiosInstance.post("/api/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            navigate("/payment-result", {
              state: {
                status: "SUCCESS",
                method: "RAZORPAY",
                orderId,
                amount: grandTotal,
                currency: "INR",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                message: "Razorpay payment successful ✅",
              },
            });
          } catch (e) {
            navigate("/payment-result", {
              state: {
                status: "FAILED",
                method: "RAZORPAY",
                orderId,
                amount: grandTotal,
                currency: "INR",
                message: "Payment verification failed ❌",
              },
            });
          }
        },
        modal: {
          ondismiss: function () {
            // user closed Razorpay
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      setErr(e?.response?.data?.msg || e?.message || "Pay now failed");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div style={S.page}>
      <style>{css}</style>
      <div style={S.container}>
        <div ref={topRef} />

        <div style={S.hero}>
          <div>
            <div style={S.h1}>Checkout</div>
            <div style={S.sub}>Step 2: Review + Pay</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={S.btn} onClick={() => navigate("/cart")}>← Back</button>
            <button style={S.btn} onClick={loadAll}>↻ Refresh</button>
          </div>
        </div>

        {err && <div style={{ ...S.info, color: "#ffb4b4" }}>{err}</div>}

        {loading ? (
          <div style={S.info}>Loading checkout…</div>
        ) : (
          <div className="grid2">
            <div style={S.panel}>
              <div style={S.panelTitle}>Order Summary</div>

              <div style={S.box}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Products</div>
                {summaryProducts.length === 0 ? (
                  <div style={{ opacity: 0.75, fontSize: 12 }}>No items</div>
                ) : (
                  summaryProducts.map((p) => (
                    <div key={p.id} style={S.rowLine}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{p.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          Qty: {p.qty} • Discount: {p.percent}% • (-₹ {money(p.lineDiscount)})
                        </div>
                      </div>
                      <div style={{ fontWeight: 950, color: "#ffd24a" }}>₹ {money(p.lineTotal - p.lineDiscount)}</div>
                    </div>
                  ))
                )}
              </div>

              <div style={S.sumRow}><span>Subtotal</span><b>₹ {money(subtotal)}</b></div>
              <div style={S.sumRow}><span>Discount ({userType || "USER"})</span><b style={{ color: "#9ff0be" }}>- ₹ {money(discountAmount)}</b></div>
              <div style={S.sumRow}><span>Payable Subtotal</span><b>₹ {money(subtotalAfterDiscount)}</b></div>
              <div style={S.sumRow}><span>Delivery</span><b>{deliveryCharge > 0 ? `₹ ${money(deliveryCharge)}` : <span style={{ color: "#9ff0be" }}>FREE</span>}</b></div>
              <div style={{ ...S.sumRow, borderBottom: "none" }}>
                <span style={{ fontWeight: 950 }}>Grand Total</span>
                <b style={{ color: "#ffd24a", fontSize: 16 }}>₹ {money(grandTotal)}</b>
              </div>

              <div style={{ height: 10 }} />

              <div style={S.box}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>Selected Address</b>
                  <button style={S.tinyBtn} onClick={() => navigate("/cart")}>Change</button>
                </div>
                {selectedAddress ? (
                  <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.5 }}>
                    {selectedAddress.label} • {selectedAddress.receiverFirstName} {selectedAddress.receiverLastName || ""} • {selectedAddress.receiverPhone}
                    <br />
                    {selectedAddress.house}, {selectedAddress.area}
                    {selectedAddress.landmark ? `, ${selectedAddress.landmark}` : ""} - {selectedAddress.pincode}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, color: "#ffb4b4" }}>Address not found. Go back and select again.</div>
                )}
              </div>
            </div>

            <div style={S.panel}>
              <div style={S.panelTitle}>Payment</div>

              <div style={S.box}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>Wallet</b>
                  <span style={{ color: "#ffd24a", fontWeight: 950 }}>₹ {money(wallet?.balance)}</span>
                </div>
                {paymentMethod === "WALLET" && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {canPayWithWallet ? (
                      <span style={{ color: "#9ff0be", fontWeight: 900 }}>✅ Enough</span>
                    ) : (
                      <span style={{ color: "#ffb4b4", fontWeight: 900 }}>❌ Not enough</span>
                    )}
                  </div>
                )}
              </div>

              <div style={S.field}>
                <div style={S.label}>Payment Method</div>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={S.input}>
                  <option value="RAZORPAY">RAZORPAY</option>
                  <option value="WALLET">WALLET</option>
                  <option value="COD">COD</option>
                </select>

                {paymentMethod === "RAZORPAY" && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                    Razorpay: {rzpReady ? <b style={{ color: "#9ff0be" }}>Ready</b> : <b style={{ color: "#ffb4b4" }}>Not Loaded</b>}
                  </div>
                )}
              </div>

              <button
                style={{
                  ...S.payBtn,
                  opacity:
                    paying ||
                    cartItems.length === 0 ||
                    !selectedAddressIdFromPrev ||
                    (paymentMethod === "WALLET" && !canPayWithWallet) ||
                    (paymentMethod === "RAZORPAY" && !rzpReady)
                      ? 0.6
                      : 1,
                }}
                disabled={
                  paying ||
                  cartItems.length === 0 ||
                  !selectedAddressIdFromPrev ||
                  (paymentMethod === "WALLET" && !canPayWithWallet) ||
                  (paymentMethod === "RAZORPAY" && !rzpReady)
                }
                onClick={payNow}
              >
                {paying ? "Processing..." : paymentMethod === "COD" ? "Place Order" : "Pay Now"}
              </button>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Step 3 will show success/failed screen.
              </div>
            </div>
          </div>
        )}
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
  page: { minHeight: "100vh" },
  container: { width: "min(1200px, 100%)", margin: "0 auto", padding: "18px 16px 60px" },

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

  panel: { borderRadius: 18, padding: 14, border: "1px solid rgba(220,235,255,.12)", background: "rgba(255,255,255,.06)" },
  panelTitle: { fontSize: 16, fontWeight: 950, marginBottom: 10 },

  info: { padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.06)", border: "1px solid rgba(220,235,255,.12)", marginBottom: 10 },

  box: { borderRadius: 14, padding: 12, border: "1px solid rgba(220,235,255,.10)", background: "rgba(10,16,35,.55)", marginBottom: 10 },

  rowLine: { display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px dashed rgba(220,235,255,.10)", paddingBottom: 10, marginBottom: 10 },

  sumRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px dashed rgba(220,235,255,.10)" },

  field: { marginTop: 10 },
  label: { fontSize: 12, opacity: 0.78, fontWeight: 900, marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(220,235,255,.14)", background: "rgba(255,255,255,.05)", color: "#e9eefc", outline: "none" },

  tinyBtn: { padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(220,235,255,.14)", background: "rgba(255,255,255,.06)", color: "#e9eefc", fontWeight: 900, cursor: "pointer" },

  payBtn: { marginTop: 12, width: "100%", height: 46, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #6D5BFF, #22D3EE)", color: "#08101f", fontWeight: 950, cursor: "pointer", fontSize: 14 },
};
