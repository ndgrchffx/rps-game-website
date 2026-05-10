"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

export default function LeaderboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [challenging, setChallenging] = useState(null);
  const [notif, setNotif] = useState("");
  const socketRef = useRef(null);

  function fetchLeaderboard() {
    fetch("/api/leaderboard")
      .then(r => r.json())
      .then(d => { setPlayers(d.users || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    fetchLeaderboard();

    const socket = connectSocket();
    socketRef.current = socket;

    socket.on("user:online", fetchLeaderboard);
    socket.on("user:offline", fetchLeaderboard);

    socket.on("game:challenge_accepted", ({ roomCode }) => {
      router.push(`/game?room=${roomCode}`);
    });

    socket.on("game:ranked_match_found", ({ roomCode }) => {
      router.push(`/game?room=${roomCode}`);
    });

    return () => {
      socket.off("user:online");
      socket.off("user:offline");
      socket.off("game:challenge_accepted");
      socket.off("game:ranked_match_found");
    };
  }, []);

  function challenge(targetUserId) {
    setChallenging(targetUserId);
    setNotif("");
    socketRef.current?.emit("game:challenge_player", { targetUserId });
    setNotif("⚔️ Challenge terkirim! Menunggu respons...");
    setTimeout(() => { setChallenging(null); setNotif(""); }, 10000);
  }

  const myRank = players.findIndex(p => p.id === user?.id) + 1;

  const navItems = [
    { label:"Lobby", icon:"🎮", path:"/lobby", active:false },
    { label:"Rank", icon:"📊", path:"/leaderboard", active:true },
    { label:"Profil", icon:"👤", path:"/profile", active:false },
  ];

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", paddingBottom:"100px" }}>
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 24px", borderBottom:"1px solid var(--border)" }}>
        <span style={{ fontWeight:"800", fontSize:"20px", color:"#8B2635" }}>JANKEN</span>
        <span style={{ fontSize:"12px", fontWeight:"700", color:"#888" }}>📊 RANKED LEADERBOARD</span>
      </nav>

      {notif && (
        <div style={{ background:"#e8f5e9", color:"#2e7d32", padding:"10px 24px", fontSize:"13px", fontWeight:"600", textAlign:"center" }}>
          {notif}
        </div>
      )}

      <div style={{ padding:"24px 20px", maxWidth:"540px", margin:"0 auto" }}>

        {/* Player list — semua player */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px", color:"#888" }}>
            <div style={{ fontSize:"32px", marginBottom:"12px" }}>⏳</div>
            <p>Memuat leaderboard...</p>
          </div>
        ) : players.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px", color:"#888", background:"#fff", borderRadius:"20px" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>👥</div>
            <p style={{ fontWeight:"700" }}>Belum ada pemain</p>
            <p style={{ fontSize:"13px", marginTop:"8px" }}>Daftarkan akun untuk muncul di sini!</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"24px" }}>
            {players.map((p, i) => {
              const rank = i + 1;
              const isMe = p.id === user?.id;
              const medals = ["🥇","🥈","🥉"];
              return (
                <div key={p.id} style={{ background: isMe?"#fde8e8":"#fff", borderRadius:"14px", padding:"14px 18px", display:"flex", alignItems:"center", gap:"12px", boxShadow:"0 2px 10px rgba(0,0,0,0.04)", border: isMe?"2px solid #8B2635":"none" }}>
                  <span style={{ fontSize: rank<=3?"20px":"14px", color:"#bbb", fontWeight:"700", width:"28px", textAlign:"center" }}>
                    {rank <= 3 ? medals[rank-1] : `#${rank}`}
                  </span>
                  <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"#f0e8e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", overflow:"hidden", flexShrink:0 }}>
                    {p.avatar ? <img src={p.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "🧑"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:"700", fontSize:"14px", color:"#1a1a1a" }}>
                      {p.username}
                      {isMe && <span style={{ marginLeft:"6px", fontSize:"10px", color:"#8B2635", fontWeight:"700" }}>(Kamu)</span>}
                    </div>
                    <div style={{ fontSize:"11px", color:"#aaa" }}>{p.wins}W / {p.losses}L</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    {p.isOnline && !isMe && (
                      <button onClick={() => challenge(p.id)} disabled={!!challenging}
                        style={{ padding:"6px 12px", borderRadius:"20px", border:"none", background: challenging===p.id?"#888":"#8B2635", color:"#fff", fontSize:"11px", fontWeight:"700", cursor: challenging?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
                        {challenging===p.id ? "⏳ Sent" : "⚔️ Challenge"}
                      </button>
                    )}
                    {p.isOnline && (
                      <span style={{ fontSize:"8px", color:"#4CAF7D", fontWeight:"700", whiteSpace:"nowrap" }}>● ONLINE</span>
                    )}
                    <span style={{ fontSize:"16px", fontWeight:"800", color:"#8B2635", whiteSpace:"nowrap" }}>{p.rankedPoints}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* My rank card */}
        {user && myRank > 0 && (
          <div style={{ background:"#8B2635", borderRadius:"20px", padding:"20px 24px", boxShadow:"0 4px 20px rgba(139,38,53,0.2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
              <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:"#F4A090", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", overflow:"hidden" }}>
                {user.avatar ? <img src={user.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "🧑"}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"10px", fontWeight:"700", color:"rgba(255,255,255,0.6)", letterSpacing:"1.5px", marginBottom:"2px" }}>RANKMU</div>
                <div style={{ fontSize:"22px", fontWeight:"900", color:"#fff" }}>#{myRank}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:"10px", fontWeight:"700", color:"rgba(255,255,255,0.6)", letterSpacing:"1px" }}>POIN</div>
                <div style={{ fontSize:"22px", fontWeight:"900", color:"#fff" }}>{user.rankedPoints || 1000}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:"0", left:"0", right:"0", background:"#fff", borderTop:"1px solid var(--border)", display:"flex", padding:"12px 0 20px" }}>
        {navItems.map(item => (
          <button key={item.label} onClick={() => router.push(item.path)}
            style={{ flex:1, background:item.active?"#8B2635":"transparent", border:"none", borderRadius:item.active?"50px":"0", padding:"10px 16px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", margin:item.active?"0 8px":"0" }}>
            <span style={{ fontSize:"18px" }}>{item.icon}</span>
            <span style={{ fontSize:"11px", fontWeight:"700", color:item.active?"#fff":"#888" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
