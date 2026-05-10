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
  const socketRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);

    fetch("/api/leaderboard").then(r=>r.json()).then(d => { setPlayers(d.users || []); setLoading(false); });

    const socket = connectSocket();
    socketRef.current = socket;

    // Refresh online status
    socket.on("user:online", () => fetch("/api/leaderboard").then(r=>r.json()).then(d=>setPlayers(d.users||[])));
    socket.on("user:offline", () => fetch("/api/leaderboard").then(r=>r.json()).then(d=>setPlayers(d.users||[])));

    socket.on("game:challenge_accepted", ({ roomCode }) => {
      router.push(`/game?room=${roomCode}`);
    });

    return () => { socket.off("user:online"); socket.off("user:offline"); socket.off("game:challenge_accepted"); };
  }, []);

  function challenge(targetUserId) {
    setChallenging(targetUserId);
    socketRef.current?.emit("game:challenge_player", { targetUserId });
    setTimeout(() => setChallenging(null), 5000);
  }

  const myRank = players.findIndex(p => p.id === user?.id) + 1;
  const top3 = players.slice(0, 3);
  const others = players.slice(3);

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

      <div style={{ padding:"24px 20px", maxWidth:"540px", margin:"0 auto" }}>
        {/* Podium */}
        {!loading && top3.length >= 3 && (
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:"8px", marginBottom:"32px", paddingTop:"24px" }}>
            {[top3[1], top3[0], top3[2]].map((p, i) => {
              const podiumRank = [2,1,3][i];
              const h = [110, 150, 90][i];
              const colors = ["#A8DCE7","#F4A090","#4CAF7D"];
              return (
                <div key={p.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                  <div style={{ position:"relative", marginBottom:"8px" }}>
                    {podiumRank===1 && <div style={{ position:"absolute", top:"-18px", left:"50%", transform:"translateX(-50%)", fontSize:"20px" }}>👑</div>}
                    <div style={{ width: podiumRank===1?"60px":"48px", height: podiumRank===1?"60px":"48px", borderRadius:"50%", background:colors[i], display:"flex", alignItems:"center", justifyContent:"center", fontSize: podiumRank===1?"24px":"18px", border:"3px solid #fff", boxShadow:"0 2px 12px rgba(0,0,0,0.1)", overflow:"hidden" }}>
                      {p.avatar ? <img src={p.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "🧑"}
                    </div>
                  </div>
                  <div style={{ width:"100%", height:`${h}px`, background:colors[i], borderRadius:"12px 12px 0 0", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"2px" }}>
                    <span style={{ fontSize:"11px", fontWeight:"600", color:"rgba(0,0,0,0.6)", maxWidth:"80%", textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.username}</span>
                    <span style={{ fontSize: podiumRank===1?"20px":"16px", fontWeight:"900", color:"rgba(0,0,0,0.75)" }}>{p.rankedPoints}</span>
                    <span style={{ fontSize:"10px", color:"rgba(0,0,0,0.4)" }}>{p.wins}W/{p.losses}L</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* All players */}
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"24px" }}>
          {(loading ? Array(5).fill(null) : others).map((p, i) => {
            if (!p) return <div key={i} style={{ background:"#fff", borderRadius:"14px", padding:"16px", height:"64px", animation:"pulse 1.5s infinite" }}></div>;
            const rank = i + 4;
            const isMe = p.id === user?.id;
            return (
              <div key={p.id} style={{ background: isMe?"#fde8e8":"#fff", borderRadius:"14px", padding:"14px 18px", display:"flex", alignItems:"center", gap:"12px", boxShadow:"0 2px 10px rgba(0,0,0,0.04)", border: isMe?"2px solid #8B2635":"none" }}>
                <span style={{ fontSize:"13px", color:"#bbb", fontWeight:"700", width:"20px", textAlign:"center" }}>#{rank}</span>
                <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:"#f0e8e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", overflow:"hidden", flexShrink:0 }}>
                  {p.avatar ? <img src={p.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "🧑"}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:"600", fontSize:"14px", color:"#1a1a1a" }}>{p.username} {isMe && <span style={{ fontSize:"10px", color:"#8B2635", fontWeight:"700" }}>(Kamu)</span>}</div>
                  <div style={{ fontSize:"11px", color:"#aaa" }}>{p.wins}W / {p.losses}L</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  {p.isOnline && !isMe && (
                    <button onClick={() => challenge(p.id)} disabled={challenging === p.id}
                      style={{ padding:"6px 12px", borderRadius:"20px", border:"none", background: challenging===p.id?"#888":"#8B2635", color:"#fff", fontSize:"11px", fontWeight:"700", cursor:"pointer" }}>
                      {challenging===p.id ? "⏳ Sent" : "⚔️ Challenge"}
                    </button>
                  )}
                  {p.isOnline && <span style={{ fontSize:"8px", color:"#4CAF7D", fontWeight:"700" }}>● ONLINE</span>}
                  <span style={{ fontSize:"16px", fontWeight:"800", color:"#8B2635" }}>{p.rankedPoints}</span>
                </div>
              </div>
            );
          })}
        </div>

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
          <button key={item.label} onClick={() => router.push(item.path)} style={{ flex:1, background:item.active?"#8B2635":"transparent", border:"none", borderRadius:item.active?"50px":"0", padding:"10px 16px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", margin:item.active?"0 8px":"0" }}>
            <span style={{ fontSize:"18px" }}>{item.icon}</span>
            <span style={{ fontSize:"11px", fontWeight:"700", color:item.active?"#fff":"#888" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
