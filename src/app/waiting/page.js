"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUser } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

function WaitingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const roomCode = params.get("code");
  const mode = params.get("mode") || "casual";
  const gsParam = params.get("gs"); // game state dari P1
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);

    const socket = connectSocket();
    socketRef.current = socket;

    // P1 menunggu di sini — saat P2 join, server emit game:player_joined ke room
    // P1 menerima event ini dan harus redirect ke game dengan state
    socket.on("game:player_joined", ({ state }) => {
      const stateB64 = btoa(JSON.stringify(state));
      router.push(`/game?room=${roomCode}&gs=${stateB64}`);
    });

    // Ranked: match ditemukan
    socket.on("game:ranked_match_found", ({ roomCode: rc, state }) => {
      const stateB64 = btoa(JSON.stringify(state));
      router.push(`/game?room=${rc}&gs=${stateB64}`);
    });

    return () => {
      socket.off("game:player_joined");
      socket.off("game:ranked_match_found");
    };
  }, [roomCode]);

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function cancelQueue() {
    if (mode === "ranked") socketRef.current?.emit("game:cancel_queue");
    router.push("/lobby");
  }

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <div style={{ textAlign:"center", animation:"fadeIn 0.4s ease" }}>
        <div style={{ fontSize:"64px", marginBottom:"16px", animation:"pulse 2s ease infinite" }}>⏳</div>
        <h1 style={{ fontSize:"28px", fontWeight:"900", color:"#8B2635", marginBottom:"8px" }}>Menunggu Lawan</h1>
        <p style={{ color:"#888", fontSize:"14px", marginBottom:"32px" }}>
          {mode === "ranked" ? "Mencari pemain di ranked match..." : "Bagikan kode room ke temanmu"}
        </p>

        {mode !== "ranked" && roomCode && roomCode !== "RANKED" && (
          <div style={{ background:"#fff", borderRadius:"20px", padding:"28px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", marginBottom:"24px", maxWidth:"320px" }}>
            <p style={{ fontSize:"12px", fontWeight:"700", color:"#888", letterSpacing:"2px", marginBottom:"12px" }}>KODE ROOM</p>
            <div style={{ fontSize:"36px", fontWeight:"900", letterSpacing:"8px", color:"#8B2635", marginBottom:"20px" }}>{roomCode}</div>
            <button onClick={copyCode} style={{ width:"100%", padding:"12px", borderRadius:"12px", border:"2px solid #8B2635", background: copied?"#8B2635":"transparent", color: copied?"#fff":"#8B2635", fontWeight:"700", fontSize:"14px", transition:"all 0.2s", cursor:"pointer" }}>
              {copied ? "✅ Tersalin!" : "📋 Salin Kode"}
            </button>
          </div>
        )}

        <div style={{ display:"flex", gap:"8px", alignItems:"center", justifyContent:"center", color:"#888", fontSize:"13px", marginBottom:"32px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#4CAF7D", animation:"pulse 1.5s ease infinite" }}></div>
          {mode === "ranked" ? "Mencari lawan..." : "Menunggu pemain ke-2..."}
        </div>

        <button onClick={cancelQueue} style={{ padding:"10px 24px", borderRadius:"50px", border:"none", background:"#f5eded", color:"#888", fontWeight:"700", fontSize:"13px", cursor:"pointer" }}>
          ← Kembali ke Lobby
        </button>
      </div>
    </main>
  );
}

export default function WaitingPage() {
  return <Suspense><WaitingContent /></Suspense>;
}
