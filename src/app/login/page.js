"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Terjadi kesalahan."); setLoading(false); return; }
      if (mode === "register") { setMode("login"); setError(""); setForm({ ...form, password: "" }); setLoading(false); return; }
      saveAuth(data.token, data.user);
      router.push("/lobby");
    } catch { setError("Gagal terhubung ke server."); setLoading(false); }
  }

  const inp = { width:"100%", padding:"12px 16px", borderRadius:"12px", border:"1.5px solid #e0d8d8", fontSize:"15px", outline:"none", background:"#fff" };

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"400px", animation:"fadeIn 0.4s ease" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"36px" }}>
          <div style={{ fontSize:"48px", marginBottom:"8px" }}>✊🖐️✌️</div>
          <h1 style={{ fontSize:"32px", fontWeight:"900", color:"#8B2635", letterSpacing:"-1px" }}>JANKEN</h1>
          <p style={{ color:"#888", fontSize:"14px", marginTop:"4px" }}>Rock Paper Scissors Battle Arena</p>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:"24px", padding:"32px", boxShadow:"0 4px 32px rgba(0,0,0,0.08)" }}>
          {/* Tabs */}
          <div style={{ display:"flex", background:"#f5eded", borderRadius:"12px", padding:"4px", marginBottom:"24px" }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{ flex:1, padding:"10px", borderRadius:"10px", border:"none", fontSize:"14px", fontWeight:"700",
                  background: mode===m ? "#8B2635" : "transparent", color: mode===m ? "#fff" : "#888", transition:"all 0.2s" }}>
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            {mode === "register" && (
              <input style={inp} placeholder="Username" value={form.username}
                onChange={e => setForm({...form, username: e.target.value})} required minLength={3} />
            )}
            <input style={inp} type="email" placeholder="Email" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})} required />
            <input style={inp} type="password" placeholder="Password" value={form.password}
              onChange={e => setForm({...form, password: e.target.value})} required minLength={6} />

            {error && <div style={{ background:"#fde8e8", color:"#8B2635", padding:"10px 14px", borderRadius:"10px", fontSize:"13px", fontWeight:"600" }}>{error}</div>}

            <button type="submit" disabled={loading}
              style={{ background:"#8B2635", color:"#fff", border:"none", padding:"14px", borderRadius:"12px",
                fontSize:"15px", fontWeight:"800", letterSpacing:"1px", opacity: loading ? 0.7 : 1, transition:"opacity 0.2s" }}>
              {loading ? "⏳ Loading..." : mode === "login" ? "MASUK" : "DAFTAR"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
