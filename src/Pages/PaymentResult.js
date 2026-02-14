// src/Pages/PaymentResult.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * ✅ Usage (from Cart.js after success):
 * navigate("/payment-result", {
 *   state: {
 *     status: "SUCCESS", // or "FAILED"
 *     method: paymentMethod, // "RAZORPAY" | "WALLET" | "COD"
 *     orderId,
 *     amount: grandTotal,
 *     currency: "INR",
 *     // Razorpay response:
 *     razorpay_order_id: response?.razorpay_order_id,
 *     razorpay_payment_id: response?.razorpay_payment_id,
 *     razorpay_signature: response?.razorpay_signature,
 *     message: "Payment successful"
 *   }
 * });
 *
 * ✅ If FAILED:
 * navigate("/payment-result", { state: { status:"FAILED", method:"RAZORPAY", orderId, amount: grandTotal, message:"Payment failed" } })
 */

const safe = (v, fb = "-") => (v === null || v === undefined || v === "" ? fb : v);

const money = (v) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const badgeColor = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "SUCCESS") return { bg: "rgba(47,210,107,.14)", bd: "rgba(47,210,107,.35)", tx: "#9ff0be" };
  if (s === "FAILED") return { bg: "rgba(255,90,90,.14)", bd: "rgba(255,90,90,.35)", tx: "#ffb4b4" };
  return { bg: "rgba(255,255,255,.06)", bd: "rgba(220,235,255,.14)", tx: "#e9eefc" };
};

const titleText = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "SUCCESS") return "Payment Successful";
  if (s === "FAILED") return "Payment Failed";
  return "Payment Status";
};

const iconText = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "SUCCESS") return "✅";
  if (s === "FAILED") return "❌";
  return "ℹ️";
};

function formatMethod(m) {
  const x = String(m || "").toUpperCase();
  if (x === "RAZORPAY") return "Razorpay";
  if (x === "WALLET") return "Wallet";
  if (x === "COD") return "Cash On Delivery";
  return safe(m, "-");
}

function maskId(id, keepStart = 6, keepEnd = 4) {
  const s = String(id || "");
  if (!s) return "-";
  if (s.length <= keepStart + keepEnd) return s;
  return `${s.slice(0, keepStart)}••••••${s.slice(-keepEnd)}`;
}

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const canCopy = value && value !== "-" && value !== "—";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // ignore
    }
  };

  return (
    <div style={S.row}>
      <div style={S.left}>{label}</div>
      <div style={S.right}>
        <span style={S.value}>{safe(value)}</span>
        {canCopy && (
          <button type="button" style={S.copyBtn} onClick={onCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PaymentResult() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // if user refreshes, state becomes undefined -> show fallback
  const status = state?.status || "SUCCESS";
  const method = state?.method || state?.paymentMethod || "RAZORPAY";

  const amount = state?.amount ?? state?.grandTotal ?? 0;
  const currency = state?.currency || "INR";

  const orderId = state?.orderId || state?.internal_order_id || "";
  const message = state?.message || "";

  // Razorpay fields
  const razorpay_order_id = state?.razorpay_order_id || state?.razorpayOrderId || "";
  const razorpay_payment_id = state?.razorpay_payment_id || state?.razorpayPaymentId || "";
  const razorpay_signature = state?.razorpay_signature || state?.razorpaySignature || "";

  // Wallet fields (optional if your backend returns)
  const walletTxnId = state?.walletTxnId || state?.transactionId || "";
  const walletBalance = state?.walletBalance;

  const colors = useMemo(() => badgeColor(status), [status]);

  // nice confetti-like pulse only for success
  useEffect(() => {
    // just UI; no logic
  }, []);

  const goOrders = () => navigate("/MyOrders"); // change if your route differs
  const goHome = () => navigate("/components/Dashboard"); // change if your route differs
  const goCart = () => navigate("/Cart");

  return (
    <div style={S.page}>
      <style>{css}</style>

      <div style={S.container}>
        <div style={S.card}>
          <div style={S.head}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ ...S.icon, background: colors.bg, borderColor: colors.bd, color: colors.tx }}>
                {iconText(status)}
              </div>
              <div>
                <div style={S.h1}>{titleText(status)}</div>
                <div style={S.sub}>
                  Method: <b style={{ color: "#ffd24a" }}>{formatMethod(method)}</b>
                  {orderId ? (
                    <>
                      {" "}
                      • Order: <b style={{ color: "#9ff0be" }}>#{orderId}</b>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ ...S.statusPill, background: colors.bg, borderColor: colors.bd, color: colors.tx }}>
              {String(status).toUpperCase()}
            </div>
          </div>

          {message ? (
            <div style={{ ...S.msg, borderColor: colors.bd, background: colors.bg, color: colors.tx }}>
              {message}
            </div>
          ) : null}

          <div style={S.amountBox}>
            <div style={S.amountLabel}>Paid Amount</div>
            <div style={S.amountValue}>
              {currency === "INR" ? "₹" : currency + " "}
              {money(amount)}
            </div>
            <div style={S.amountHint}>Keep this for your records.</div>
          </div>

          <div style={S.sectionTitle}>Transaction Details</div>
          <div style={S.box}>
            <CopyRow label="Order ID" value={orderId || "-"} />
            <CopyRow label="Payment Method" value={formatMethod(method)} />
            <CopyRow label="Amount" value={`${currency === "INR" ? "₹" : currency + " "}${money(amount)}`} />

            {String(method).toUpperCase() === "RAZORPAY" && (
              <>
                <CopyRow label="Razorpay Order ID" value={razorpay_order_id ? maskId(razorpay_order_id) : "-"} />
                <CopyRow label="Razorpay Payment ID" value={razorpay_payment_id ? maskId(razorpay_payment_id) : "-"} />
                <CopyRow label="Razorpay Signature" value={razorpay_signature ? maskId(razorpay_signature, 8, 6) : "-"} />
              </>
            )}

            {String(method).toUpperCase() === "WALLET" && (
              <>
                <CopyRow label="Wallet Transaction ID" value={walletTxnId ? maskId(walletTxnId) : "-"} />
                <CopyRow label="Wallet Balance" value={walletBalance != null ? `₹ ${money(walletBalance)}` : "-"} />
              </>
            )}
          </div>

          <div style={S.actions}>
            <button style={S.btnGhost} onClick={goCart}>
              ← Back to Cart
            </button>

            <button style={S.btn} onClick={goOrders}>
              View Orders
            </button>

            <button style={S.btnPrimary} onClick={goHome}>
              Go Home
            </button>
          </div>

          <div style={S.footerHint}>
            {String(status).toUpperCase() === "FAILED"
              ? "If money is deducted, it may auto-refund in some time. You can retry payment from Cart."
              : "Order placed successfully. You can track the order in Orders page."}
          </div>
        </div>
      </div>
    </div>
  );
}

const css = `
  *{ box-sizing:border-box; margin:0; padding:0; }
  html,body,#root{ height:100%; width:100%; }
  body{
    background: linear-gradient(180deg,#040915 0%,#060c19 50%,#050914 100%);
    color:#e9eefc;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    overflow-x:hidden;
  }
`;

const S = {
  page: { minHeight: "100vh" },
  container: { width: "min(920px, 100%)", margin: "0 auto", padding: "22px 16px 60px" },

  card: {
    borderRadius: 20,
    border: "1px solid rgba(220,235,255,.14)",
    background: "rgba(12,18,36,.72)",
    boxShadow: "0 10px 30px rgba(0,0,0,.30)",
    padding: 18,
  },

  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  icon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    border: "1px solid rgba(220,235,255,.14)",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    background: "rgba(255,255,255,.06)",
  },

  h1: { fontSize: 22, fontWeight: 950, letterSpacing: 0.2 },
  sub: { marginTop: 6, fontSize: 13, opacity: 0.86, color: "rgba(233,238,252,.85)" },

  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid rgba(220,235,255,.14)",
    background: "rgba(255,255,255,.06)",
    whiteSpace: "nowrap",
  },

  msg: {
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(220,235,255,.14)",
    background: "rgba(255,255,255,.06)",
    fontWeight: 800,
    fontSize: 13,
  },

  amountBox: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(220,235,255,.12)",
    background: "rgba(255,255,255,.05)",
  },
  amountLabel: { fontSize: 12, fontWeight: 900, opacity: 0.85 },
  amountValue: { marginTop: 6, fontSize: 30, fontWeight: 950, color: "#ffd24a" },
  amountHint: { marginTop: 6, fontSize: 12, opacity: 0.75 },

  sectionTitle: { marginTop: 16, fontSize: 14, fontWeight: 950, opacity: 0.95 },

  box: {
    marginTop: 10,
    borderRadius: 16,
    border: "1px solid rgba(220,235,255,.12)",
    background: "rgba(255,255,255,.05)",
    overflow: "hidden",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    borderBottom: "1px dashed rgba(220,235,255,.12)",
  },
  left: { fontSize: 12, opacity: 0.85, fontWeight: 900, color: "rgba(233,238,252,.85)" },
  right: { display: "flex", alignItems: "center", gap: 10 },
  value: { fontSize: 12, fontWeight: 900, color: "#e9eefc" },

  copyBtn: {
    padding: "7px 10px",
    borderRadius: 12,
    border: "1px solid rgba(220,235,255,.14)",
    background: "rgba(255,255,255,.06)",
    color: "#e9eefc",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },

  actions: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },

  btnGhost: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(220,235,255,.16)",
    background: "rgba(255,255,255,.06)",
    color: "#e9eefc",
    fontWeight: 900,
    cursor: "pointer",
  },
  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(74,140,255,.30)",
    background: "rgba(74,140,255,.10)",
    color: "#e9eefc",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #6D5BFF, #22D3EE)",
    color: "#08101f",
    fontWeight: 950,
    cursor: "pointer",
  },

  footerHint: { marginTop: 12, fontSize: 12, opacity: 0.75, textAlign: "right" },
};
