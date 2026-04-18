import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Armchair } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await register(name, email, password);
      nav("/welcome");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboard-bg">
      <div style={{
        position: "fixed", top: 18, right: 18, zIndex: 210,
        background: "#1a3a6b", color: "#fff",
        padding: "6px 16px", borderRadius: 8,
        fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }} data-testid="beta-badge">
        BETA
      </div>
      <div className="onboard-card" style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            className="avatar"
            style={{ width: 44, height: 44, background: "var(--mac-purple)", borderRadius: 12 }}
          >
            <Armchair size={24} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Create your seat</div>
            <div className="text-mute" style={{ fontSize: 12 }}>Takes 20 seconds.</div>
          </div>
        </div>
        <form onSubmit={submit}>
          <label style={labelStyle}>Display Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} data-testid="register-name-input" style={{ margin: "6px 0 14px" }} />
          <label style={labelStyle}>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="register-email-input" style={{ margin: "6px 0 14px" }} />
          <label style={labelStyle}>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} data-testid="register-password-input" style={{ margin: "6px 0 14px" }} />
          {err && <div style={{ color: "var(--mac-red)", fontSize: 12, marginBottom: 10 }}>{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy} data-testid="register-submit-btn" style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}>
            {busy ? "Creating…" : "Create Account"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--text-secondary)" }}>
          Already have a seat?{" "}
          <Link to="/login" style={{ color: "var(--mac-blue)", fontWeight: 600, textDecoration: "none" }} data-testid="register-go-login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
