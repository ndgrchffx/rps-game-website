"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, saveAuth } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

export default function LeaderboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [challenging, setChallenging] = useState(null);
  const [notif, setNotif] = useState("");
  const [challenge, setChallenge] = useState(null);
  const socketRef = useRef(null);

  function fetchLeaderboard() {
    fetch("/api/leaderboard")
      .then(r => r.json())
      .then(d => { setPlayers(d.users || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  // Refresh poin user dari server setelah game selesai
  function refreshMyPoints() {
    fetch("/api/profile", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setUser(d.user);
          saveAuth(localStorage.getItem("token"), d.user);
        }
      }).catch(() => {});
  }

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    fetchLeaderboard();
    // Selalu refresh poin terbaru saat buka leaderboard
    refreshMyPoints();

    const socket = connectSocket();
    socketRef.current = socket;

    socket.on("user:online", fetchLeaderboard);
    socket.on("user:offline", fetchLeaderboard);

    // Refresh leaderboard setelah game selesai (poin berubah)
    socket.on("game:over", () => {
      setTimeout(() => { fetchLeaderboard(); refreshMyPoints(); }, 1000);
    });

    socket.on("game:challenge_received", (data) => {
      setChallenge(data);
    });

    socket.on("game:challenge_accepted", ({ roomCode, state }) => {
      const stateB64 = btoa(JSON.stringify(state));
      router.push(`/game?room=${roomCode}&gs=${stateB64}`);
    });

    socket.on("game:ranked_match_found", ({ roomCode, state }) => {
      const stateB64 = state ? btoa(JSON.stringify(state)) : "";
      router.push(`/game?room=${roomCode}${stateB64 ? `&gs=${stateB64}` : ""}`);
    });

    return () => {
      socket.off("user:online");
      socket.off("user:offline");
      socket.off("game:over");
      socket.off("game:challenge_received");
      socket.off("game:challenge_accepted");
      socket.off("game:ranked_match_found");
    };
  }, []);

  function challenge_player(targetUserId) {
    setChallenging(targetUserId);
    setNotif("");
    socketRef.current?.emit("game:challenge_player", { targetUserId });
    setNotif("⚔️ Challenge terkirim! Menunggu respons...");
    setTimeout(() => { setChallenging(null); setNotif(""); }, 10000);
  }

  function acceptChallenge() {
    socketRef.current?.emit("game:accept_challenge", { challengerId: challenge.challengerId });
    setChallenge(null);
  }

  // Refresh poin user dari players list
  const myDataInList = players.find(p => p.id === user?.id);
  const displayUser = myDataInList ? { ...user, rankedPoints: myDataInList.rankedPoints, wins: myDataInList.wins, losses: myDataInList.losses } : user;
  const myRank = players.findIndex(p => p.id === user?.id) + 1;

  const navItems = [
    { label:"Lobby", icon:"🎮", path:"/lobby", active:false },
    { label:"Rank", icon:"📊", path:"/leaderboard", active:true },
    { label:"Profil", icon:"👤", path:"/profile", active:false },
  ];

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", paddingBottom:"100px" }}>
      {/* Challenge Popup */}
      {challenge && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"24px", padding:"32px", maxWidth:"320px", width:"90%", textAlign:"center", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>⚔️</div>
            <h2 style={{ fontWeight:"800", fontSize:"20px", color:"#1a1a1a", marginBottom:"8px" }}>Challenge!</h2>
            <p style={{ color:"#666", fontSize:"14px", marginBottom:"4px" }}><b>{challenge.challengerName}</b> menantangmu!</p>
            <p style={{ color:"#888", fontSize:"12px", marginBottom:"24px" }}>Points: {challenge.challengerPoints} • Match Ranked (+1/-1 pts)</p>
            <div style={{ display:"flex", gap:"12px" }}>
              <button onClick={() => setChallenge(null)} style={{ flex:1, padding:"12px", borderRadius:"12px", border:"2px solid #e0d0d0", background:"transparent", fontWeight:"700", color:"#888", cursor:"pointer" }}>Tolak</button>
              <button onClick={acceptChallenge} style={{ flex:1, padding:"12px", borderRadius:"12px", border:"none", background:"#8B2635", color:"#fff", fontWeight:"700", cursor:"pointer" }}>⚔️ Terima!</button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 24px", borderBottom:"1px solid var(--border)" }}>
        <span style={{ fontWeight:"800", fontSize:"20px", color:"#8B2635" }}>JANKEN</span>
        <button onClick={fetchLeaderboard} style={{ background:"none", border:"1px solid #e0d0d0", borderRadius:"20px", padding:"6px 14px", fontSize:"12px", color:"#888", cursor:"pointer", fontWeight:"600" }}>🔄 Refresh</button>
      </nav>

      {notif && (
        <div style={{ background:"#e8f5e9", color:"#2e7d32", padding:"10px 24px", fontSize:"13px", fontWeight:"600", textAlign:"center" }}>
          {notif}
        </div>
      )}

      <div style={{ padding:"24px 20px", maxWidth:"540px", margin:"0 auto" }}>
        <div style={{ fontWeight:"800", fontSize:"18px", color:"#1a1a1a", marginBottom:"16px" }}>📊 RANKED LEADERBOARD</div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"40px", color:"#888" }}>
            <div style={{ fontSize:"32px", marginBottom:"12px" }}>⏳</div>
            <p>Memuat leaderboard...</p>
          </div>
        ) : players.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px", color:"#888", background:"#fff", borderRadius:"20px" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>👥</div>
            <p style={{ fontWeight:"700" }}>Belum ada pemain terdaftar</p>
            <p style={{ fontSize:"13px", marginTop:"8px" }}>Daftar akun untuk muncul di sini!</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"24px" }}>
            {players.map((p, i) => {
              const rank = i + 1;
              const isMe = p.id === user?.id;
              const medals = ["🥇","🥈","🥉"];
              return (
                <div key={p.id} style={{ background: isMe?"#fde8e8":"#fff", borderRadius:"14px", padding:"14px 18px", display:"flex", alignItems:"center", gap:"12px", boxShadow:"0 2px 10px rgba(0,0,0,0.04)", border: isMe?"2px solid #8B2635":"1px solid #f0e8e8" }}>
                  <span style={{ fontSize: rank<=3?"20px":"13px", color:"#bbb", fontWeight:"700", width:"28px", textAlign:"center", flexShrink:0 }}>
                    {rank <= 3 ? medals[rank-1] : `#${rank}`}
                  </span>
                  <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"#f0e8e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", overflow:"hidden", flexShrink:0 }}>
                    {p.avatar ? <img src={p.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" /> : "🧑"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:"700", fontSize:"14px", color:"#1a1a1a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {p.username}
                      {isMe && <span style={{ marginLeft:"6px", fontSize:"10px", color:"#8B2635", fontWeight:"700" }}>(Kamu)</span>}
                    </div>
                    <div style={{ fontSize:"11px", color:"#aaa" }}>{p.wins}W / {p.losses}L</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
                    {p.isOnline && !isMe && (
                      <button onClick={() => challenge_player(p.id)} disabled={!!challenging}
                        style={{ padding:"6px 10px", borderRadius:"20px", border:"none", background: challenging===p.id?"#888":"#8B2635", color:"#fff", fontSize:"11px", fontWeight:"700", cursor: challenging?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
                        {challenging===p.id ? "⏳" : "⚔️"}
                      </button>
                    )}
                    {p.isOnline && (
                      <span style={{ fontSize:"7px", color:"#4CAF7D", fontWeight:"700" }}>●</span>
                    )}
                    <span style={{ fontSize:"15px", fontWeight:"800", color:"#8B2635" }}>{p.rankedPoints}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* My rank card — pakai data terbaru dari list */}
        {user && myRank > 0 && (
          <div style={{ background:"#8B2635", borderRadius:"20px", padding:"20px 24px", boxShadow:"0 4px 20px rgba(139,38,53,0.2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
              <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:"#F4A090", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", overflow:"hidden", flexShrink:0 }}>
                {displayUser?.avatar ? <img src={displayUser.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" /> : "🧑"}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"10px", fontWeight:"700", color:"rgba(255,255,255,0.6)", letterSpacing:"1.5px", marginBottom:"2px" }}>RANKMU SAAT INI</div>
                <div style={{ fontSize:"22px", fontWeight:"900", color:"#fff" }}>#{myRank}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:"10px", fontWeight:"700", color:"rgba(255,255,255,0.6)", letterSpacing:"1px", marginBottom:"2px" }}>POIN</div>
                <div style={{ fontSize:"22px", fontWeight:"900", color:"#fff" }}>{myDataInList?.rankedPoints ?? displayUser?.rankedPoints ?? 1000}</div>
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
