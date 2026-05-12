"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = tab === "login"
        ? { email: form.email, password: form.password }
        : { username: form.username, email: form.email, password: form.password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan.");
        return;
      }

      saveAuth(data.token, data.user);
      router.push("/lobby");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal masuk sebagai tamu."); return; }
      saveAuth(data.token, data.user);
      router.push("/lobby");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#FDF0EE", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>✊🖐️✌️</div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", color: "#8B2635", margin: 0 }}>JANKEN</h1>
          <p style={{ color: "#888", fontSize: "14px", marginTop: "4px" }}>RPS Battle Arena</p>
        </div>

        {/* Tab */}
        <div style={{ display: "flex", background: "#f0e8e8", borderRadius: "12px", padding: "4px", marginBottom: "24px" }}>
          {["login","register"].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }}
              style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", fontWeight: "700", fontSize: "13px", cursor: "pointer", background: tab === t ? "#8B2635" : "transparent", color: tab === t ? "#fff" : "#888", transition: "all 0.2s" }}>
              {t === "login" ? "Masuk" : "Daftar"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {tab === "register" && (
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#888", letterSpacing: "1px" }}>USERNAME</label>
              <input
                name="username" value={form.username} onChange={handleChange}
                placeholder="min. 3 karakter, huruf/angka/_"
                style={inputStyle}
                required minLength={3} maxLength={20}
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#888", letterSpacing: "1px" }}>EMAIL</label>
            <input
              name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="email@kamu.com"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#888", letterSpacing: "1px" }}>PASSWORD</label>
            <input
              name="password" type="password" value={form.password} onChange={handleChange}
              placeholder="min. 6 karakter"
              style={inputStyle}
              required minLength={6}
            />
          </div>

          {error && (
            <div style={{ background: "#fde8e8", border: "1px solid #E24B4A", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#8B2635", fontWeight: "600" }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ marginTop: "4px", padding: "14px", borderRadius: "12px", border: "none", background: loading ? "#ccc" : "#8B2635", color: "#fff", fontWeight: "800", fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
            {loading ? "⏳ Memproses..." : tab === "login" ? "MASUK →" : "DAFTAR →"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "#e0d0d0" }} />
          <span style={{ fontSize: "12px", color: "#aaa", fontWeight: "600" }}>atau</span>
          <div style={{ flex: 1, height: "1px", background: "#e0d0d0" }} />
        </div>

        {/* Guest */}
        <button onClick={handleGuest} disabled={loading}
          style={{ width: "100%", padding: "13px", borderRadius: "12px", border: "2px solid #e0d0d0", background: "#fff", color: "#888", fontWeight: "700", fontSize: "14px", cursor: loading ? "not-allowed" : "pointer" }}>
          👤 Main sebagai Tamu
        </button>

        <p style={{ textAlign: "center", fontSize: "11px", color: "#bbb", marginTop: "20px" }}>
          Tamu tidak bisa login ulang — data akan hilang
        </p>
      </div>
    </main>
  );
}

const inputStyle = {
  display: "block", width: "100%", marginTop: "6px",
  padding: "12px 14px", borderRadius: "10px",
  border: "1.5px solid #e0d0d0", fontSize: "14px",
  outline: "none", background: "#fff",
  boxSizing: "border-box",
};
