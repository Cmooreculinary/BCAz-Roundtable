import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Armchair, ArrowRight, Play } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.onboarded ? "/" : "/welcome", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="roundtable-landing">
      <div style={betaBadgeStyle} data-testid="beta-badge">BETA</div>
      <section className="roundtable-landing__story" aria-label="Roundtable gathering worlds">
        <video className="roundtable-landing__film" autoPlay muted loop playsInline poster="/landing/roundtable-worlds.png">
          <source src="/landing/roundtable-intro.mp4" type="video/mp4" />
        </video>
        <div className="roundtable-landing__shade" />
        <div className="roundtable-landing__copy">
          <span className="roundtable-landing__eyebrow">One place for every circle</span>
          <h1>Your people.<br />Their world.<br /><em>One Roundtable.</em></h1>
          <p>Family dinner. Leadership meeting. Team strategy. Trail planning. Bible study. Every gathering gets the room it deserves.</p>
          <a className="roundtable-landing__watch" href="/landing/roundtable-intro.mp4"><Play size={15} fill="currentColor" /> Watch introduction</a>
        </div>
      </section>
      <section className="onboard-card roundtable-landing__auth">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div className="avatar" style={{ width: 44, height: 44, background: "#EC5B13", borderRadius: 6 }}>
            <Armchair size={24} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Roundtable_VO</div>
            <div className="text-mute" style={{ fontSize: 12 }}>Where your people gather.</div>
          </div>
        </div>

        <form onSubmit={submit} autoComplete="on">
          <label htmlFor="login-email" style={labelStyle}>Email</label>
          <input
            id="login-email"
            name="username"
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            inputMode="email"
            data-testid="login-email-input"
            style={{ margin: "6px 0 14px" }}
            required
          />

          <label htmlFor="login-password" style={labelStyle}>Password</label>
          <input
            id="login-password"
            name="password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            data-testid="login-password-input"
            style={{ margin: "6px 0 14px" }}
            required
          />

          {error && <div role="alert" style={{ color: "var(--mac-red)", fontSize: 12, marginBottom: 10 }}>{error}</div>}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || !email.trim() || !password}
            data-testid="login-submit-btn"
            style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--text-secondary)" }}>
          New here?{" "}
          <Link to="/register" style={{ color: "var(--mac-blue)", fontWeight: 600, textDecoration: "none" }} data-testid="login-go-register">
            Create an account <ArrowRight size={12} />
          </Link>
        </div>
      </section>
    </main>
  );
}

const betaBadgeStyle = {
  position: "fixed",
  top: 18,
  right: 18,
  zIndex: 210,
  background: "#1a3a6b",
  color: "#fff",
  padding: "6px 16px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
