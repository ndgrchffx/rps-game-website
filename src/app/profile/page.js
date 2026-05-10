"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, saveAuth, clearAuth, fetchWithAuth } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState("");
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    setUsername(u.username);

    // Fetch fresh data
    fetchWithAuth("/api/profile").then(r=>r.json()).then(d => {
      if (d.user) { setUser(d.user); setUsername(d.user.username); saveAuth(localStorage.getItem("token"), d.user); }
    });

    // Check push subscription status
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then(async reg => {
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      });
    }

    const socket = connectSocket();
    socketRef.current = socket;
  }, []);

  // Handle drag & drop avatar (Web platform-specific feature)
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) { setMsg("File harus berupa gambar!"); return; }
    processImageFile(file);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) processImageFile(file);
  }

  function processImageFile(file) {
    if (file.size > 2 * 1024 * 1024) { setMsg("File terlalu besar (maks 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      uploadAvatar(base64);
    };
    reader.readAsDataURL(file);
  }

  async function uploadAvatar(base64) {
    setSaving(true);
    const res = await fetchWithAuth("/api/profile", { method:"PATCH", body: JSON.stringify({ avatar: base64 }) });
    const data = await res.json();
    if (data.user) {
      const updated = { ...user, avatar: data.user.avatar };
      setUser(updated);
      saveAuth(localStorage.getItem("token"), updated);
      setMsg("✅ Avatar diperbarui!");
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  async function saveProfile() {
    setSaving(true);
    const res = await fetchWithAuth("/api/profile", { method:"PATCH", body: JSON.stringify({ username }) });
    const data = await res.json();
    if (data.user) {
      const updated = { ...user, username: data.user.username };
      setUser(updated);
      saveAuth(localStorage.getItem("token"), updated);
      setMsg("✅ Profil disimpan!");
      setEditing(false);
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  // Web Push (Web platform-specific feature)
  async function togglePush() {
    setPushLoading(true);
    if (pushEnabled) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setPushEnabled(false);
      setPushLoading(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidRes = await fetch("/api/push/vapid");
      const { publicKey } = await vapidRes.json();

      function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = window.atob(base64);
        return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      socketRef.current?.emit("push:subscribe", { subscription: sub.toJSON() });
      setPushEnabled(true);
      setMsg("✅ Web Push aktif! Kamu akan dapat notifikasi challenge.");
    } catch (e) {
      setMsg("❌ Gagal aktifkan Push: " + e.message);
    }
    setPushLoading(false);
    setTimeout(() => setMsg(""), 4000);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method:"POST" });
    clearAuth();
    router.push("/login");
  }

  const winRate = user ? (user.wins + user.losses > 0 ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0) : 0;

  const navItems = [
    { label:"Lobby", icon:"🎮", path:"/lobby", active:false },
    { label:"Rank", icon:"📊", path:"/leaderboard", active:false },
    { label:"Profil", icon:"👤", path:"/profile", active:true },
  ];

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", paddingBottom:"100px" }}>
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 24px", borderBottom:"1px solid var(--border)" }}>
        <span style={{ fontWeight:"800", fontSize:"20px", color:"#8B2635" }}>JANKEN</span>
        <button onClick={logout} style={{ background:"none", border:"none", color:"#888", fontWeight:"700", fontSize:"13px", cursor:"pointer" }}>Keluar</button>
      </nav>

      {msg && <div style={{ background: msg.startsWith("✅")?"#e8f5e9":"#fde8e8", color: msg.startsWith("✅")?"#2e7d32":"#c62828", padding:"10px 24px", fontSize:"13px", fontWeight:"600", textAlign:"center" }}>{msg}</div>}

      <div style={{ padding:"24px 20px", maxWidth:"500px", margin:"0 auto" }}>
        {/* Avatar */}
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          {/* Drag & Drop area (Web-specific feature) */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ width:"100px", height:"100px", borderRadius:"50%", margin:"0 auto 12px", border: dragOver?"3px dashed #8B2635":"3px solid #e0d0d0", background: dragOver?"#fde8e8":"#f5efef", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", overflow:"hidden", position:"relative" }}>
            {user?.avatar ? (
              <img src={user.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            ) : (
              <span style={{ fontSize:"40px" }}>🧑</span>
            )}
            <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", opacity:0, transition:"opacity 0.2s" }}
              onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
              <span style={{ color:"#fff", fontSize:"11px", fontWeight:"700" }}>📷 Ubah</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display:"none" }} />
          <p style={{ fontSize:"11px", color:"#888", marginBottom:"4px" }}>🖱️ Drag & drop gambar atau klik untuk upload</p>
          <p style={{ fontSize:"10px", color:"#bbb" }}>Platform-specific feature: Drag & Drop</p>
        </div>

        {/* Profile Card */}
        <div style={{ background:"#fff", borderRadius:"20px", padding:"24px", boxShadow:"0 2px 16px rgba(0,0,0,0.05)", marginBottom:"16px" }}>
          {editing ? (
            <div style={{ display:"flex", gap:"10px", marginBottom:"16px" }}>
              <input value={username} onChange={e=>setUsername(e.target.value)} style={{ flex:1, padding:"10px 14px", borderRadius:"10px", border:"1.5px solid #e0d8d8", fontSize:"15px", fontWeight:"600", outline:"none" }} />
              <button onClick={saveProfile} disabled={saving} style={{ padding:"10px 16px", borderRadius:"10px", border:"none", background:"#8B2635", color:"#fff", fontWeight:"700", fontSize:"13px" }}>
                {saving?"...":"Simpan"}
              </button>
              <button onClick={() => { setEditing(false); setUsername(user.username); }} style={{ padding:"10px 16px", borderRadius:"10px", border:"none", background:"#f0e8e8", color:"#888", fontWeight:"700", fontSize:"13px" }}>
                Batal
              </button>
            </div>
          ) : (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <div>
                <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#1a1a1a" }}>{user?.username}</h2>
                <p style={{ fontSize:"13px", color:"#888" }}>{user?.email}</p>
              </div>
              <button onClick={() => setEditing(true)} style={{ padding:"8px 16px", borderRadius:"20px", border:"1.5px solid #e0d0d0", background:"transparent", color:"#888", fontWeight:"700", fontSize:"12px", cursor:"pointer" }}>Edit</button>
            </div>
          )}

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            {[
              { label:"POIN", value: user?.rankedPoints || 1000, color:"#8B2635" },
              { label:"MENANG", value: user?.wins || 0, color:"#4CAF7D" },
              { label:"WIN RATE", value: `${winRate}%`, color:"#2D6A9F" },
            ].map(s => (
              <div key={s.label} style={{ textAlign:"center", background:"#f5f5f5", borderRadius:"12px", padding:"14px 8px" }}>
                <div style={{ fontSize:"22px", fontWeight:"900", color:s.color }}>{s.value}</div>
                <div style={{ fontSize:"10px", color:"#888", fontWeight:"700", letterSpacing:"0.5px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Web Push Toggle */}
        {"serviceWorker" in (typeof navigator !== "undefined" ? navigator : {}) && (
          <div style={{ background:"#fff", borderRadius:"20px", padding:"20px 24px", boxShadow:"0 2px 16px rgba(0,0,0,0.05)", marginBottom:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:"700", fontSize:"14px", color:"#1a1a1a", marginBottom:"2px" }}>🔔 Web Push Notification</div>
                <div style={{ fontSize:"11px", color:"#888" }}>Terima notifikasi challenge dari pemain lain</div>
                <div style={{ fontSize:"10px", color:"#bbb", marginTop:"2px" }}>Platform-specific: Web Push API</div>
              </div>
              <button onClick={togglePush} disabled={pushLoading}
                style={{ padding:"8px 18px", borderRadius:"20px", border:"none", background: pushEnabled?"#4CAF7D":"#8B2635", color:"#fff", fontWeight:"700", fontSize:"12px", cursor:"pointer", opacity: pushLoading?0.7:1 }}>
                {pushLoading?"..." : pushEnabled ? "✅ Aktif" : "Aktifkan"}
              </button>
            </div>
          </div>
        )}

        {/* Joined date */}
        <div style={{ background:"#fff", borderRadius:"20px", padding:"20px 24px", boxShadow:"0 2px 16px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize:"12px", color:"#aaa", fontWeight:"600" }}>
            Bergabung sejak {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", { year:"numeric", month:"long", day:"numeric" }) : "-"}
          </div>
          <div style={{ fontSize:"12px", color:"#aaa", fontWeight:"600", marginTop:"4px" }}>
            Total kalah: {user?.losses || 0}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:"0", left:"0", right:"0", background:"#fff", borderTop:"1px solid var(--border)", display:"flex", padding:"12px 0 20px" }}>
        {navItems.map(item => (
          <button key={item.label} onClick={() => router.push(item.path)} style={{ flex:1, background:item.active?"#8B2635":"transparent", border:"none", borderRadius:item.active?"50px":"0", padding:"10px 16px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", margin:item.active?"0 8px":"0" }}>
            <span style={{ fontSize:"18px" }}>{item.icon}</span>
            <span style={{ fontSize:"11px", fontWeight:"700", color:item.active?"#fff":"#888" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
