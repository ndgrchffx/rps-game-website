"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearAuth } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

export default function LobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [notif, setNotif] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);

    fetch("/api/leaderboard").then(r => r.json()).then(d => setLeaders(d.users?.slice(0, 3) || []));

    const socket = connectSocket();
    socketRef.current = socket;

    // Casual: P1 buat room → redirect ke waiting dengan state
    socket.on("game:room_created", ({ roomCode, state }) => {
      // Encode state sebagai base64 di URL supaya game page tahu kita P1
      const stateB64 = btoa(JSON.stringify(state));
      router.push(`/waiting?code=${roomCode}&mode=casual&gs=${stateB64}`);
    });

    // Casual: P2 join room → redirect ke game dengan info bahwa kita P2
    socket.on("game:joined", ({ roomCode, state }) => {
      const stateB64 = btoa(JSON.stringify(state));
      router.push(`/game?room=${roomCode}&gs=${stateB64}`);
    });

    // Ranked match found → redirect ke game dengan state
    socket.on("game:ranked_match_found", ({ roomCode, state }) => {
      const stateB64 = btoa(JSON.stringify(state));
      router.push(`/game?room=${roomCode}&gs=${stateB64}`);
    });

    // Challenge accepted → redirect ke game dengan state
    socket.on("game:challenge_accepted", ({ roomCode, state }) => {
      const stateB64 = btoa(JSON.stringify(state));
      router.push(`/game?room=${roomCode}&gs=${stateB64}`);
    });

    socket.on("game:challenge_received", (data) => {
      setChallenge(data);
    });

    socket.on("game:queued", () => {
      router.push(`/waiting?code=RANKED&mode=ranked`);
    });

    socket.on("error", (e) => setNotif(e.message || "Terjadi kesalahan."));

    return () => {
      socket.off("game:room_created");
      socket.off("game:joined");
      socket.off("game:ranked_match_found");
      socket.off("game:challenge_accepted");
      socket.off("game:challenge_received");
      socket.off("game:queued");
      socket.off("error");
    };
  }, []);

  function createCasualRoom() {
    socketRef.current?.emit("game:create_room", { mode: "CASUAL" });
  }

  function joinRoom() {
    if (!joinCode.trim()) return;
    socketRef.current?.emit("game:join_room", { roomCode: joinCode.trim().toUpperCase() });
    // game:joined akan ditangkap listener di atas
  }

  function findRankedMatch() {
    socketRef.current?.emit("game:create_room", { mode: "RANKED" });
  }

  function acceptChallenge() {
    socketRef.current?.emit("game:accept_challenge", { challengerId: challenge.challengerId });
    setChallenge(null);
  }

  const navItems = [
    { label:"Lobby", icon:"🎮", path:"/lobby", active:true },
    { label:"Rank", icon:"📊", path:"/leaderboard", active:false },
    { label:"Profil", icon:"👤", path:"/profile", active:false },
  ];

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", fontFamily:"inherit", paddingBottom:"100px" }}>
      {/* Challenge Popup */}
      {challenge && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"24px", padding:"32px", maxWidth:"320px", width:"90%", textAlign:"center", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>⚔️</div>
            <h2 style={{ fontWeight:"800", fontSize:"20px", color:"#1a1a1a", marginBottom:"8px" }}>Challenge!</h2>
            <p style={{ color:"#666", fontSize:"14px", marginBottom:"4px" }}><b>{challenge.challengerName}</b> menantangmu!</p>
            <p style={{ color:"#888", fontSize:"12px", marginBottom:"24px" }}>Points: {challenge.challengerPoints}</p>
            <div style={{ display:"flex", gap:"12px" }}>
              <button onClick={() => setChallenge(null)} style={{ flex:1, padding:"12px", borderRadius:"12px", border:"2px solid #e0d0d0", background:"transparent", fontWeight:"700", color:"#888", cursor:"pointer" }}>Tolak</button>
              <button onClick={acceptChallenge} style={{ flex:1, padding:"12px", borderRadius:"12px", border:"none", background:"#8B2635", color:"#fff", fontWeight:"700", cursor:"pointer" }}>Terima!</button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 24px", borderBottom:"1px solid var(--border)", background:"#FDF0EE" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"#E8737A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", overflow:"hidden" }}>
            {user?.avatar ? <img src={user.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" /> : "🐼"}
          </div>
          <div>
            <div style={{ fontWeight:"800", fontSize:"16px", color:"#8B2635" }}>JANKEN</div>
            <div style={{ fontSize:"11px", color:"#4CAF7D", fontWeight:"700" }}>● {user?.rankedPoints || 1000} PTS</div>
          </div>
        </div>
        <span style={{ fontSize:"20px", cursor:"pointer" }}>🔔</span>
      </nav>

      {notif && (
        <div style={{ background:"#fde8e8", color:"#8B2635", padding:"10px 24px", fontSize:"13px", fontWeight:"600" }}>
          {notif}
        </div>
      )}

      <div style={{ padding:"24px 20px", maxWidth:"680px", margin:"0 auto" }}>
        {/* Ranked Banner */}
        <div style={{ background:"#8B2635", borderRadius:"24px", padding:"32px 28px", marginBottom:"24px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", right:"-20px", top:"-10px", fontSize:"120px", opacity:"0.12", transform:"rotate(15deg)" }}>✊</div>
          <div style={{ display:"inline-block", background:"rgba(255,255,255,0.2)", color:"#fff", fontSize:"11px", fontWeight:"700", padding:"4px 12px", borderRadius:"20px", letterSpacing:"1px", marginBottom:"12px" }}>SEASON 1 LIVE</div>
          <h2 style={{ color:"#fff", fontSize:"32px", fontWeight:"900", margin:"0 0 10px", letterSpacing:"-0.5px" }}>RANKED MATCH</h2>
          <p style={{ color:"rgba(255,255,255,0.75)", fontSize:"13px", margin:"0 0 24px", lineHeight:"1.6", maxWidth:"280px" }}>
            Menangkan untuk +1 poin, kalah -1 poin. Trivia twists setiap 3 ronde!
          </p>
          <button onClick={findRankedMatch} style={{ background:"#fff", color:"#8B2635", border:"none", padding:"12px 28px", borderRadius:"50px", fontSize:"13px", fontWeight:"800", cursor:"pointer", letterSpacing:"1.5px" }}>
            PLAY RANKED ⚡
          </button>
        </div>

        {/* Casual */}
        <div style={{ display:"flex", gap:"16px", marginBottom:"32px" }}>
          <div onClick={createCasualRoom} style={{ flex:1, background:"#fff", borderRadius:"20px", padding:"28px 20px", textAlign:"center", cursor:"pointer", boxShadow:"0 2px 16px rgba(0,0,0,0.05)", transition:"transform 0.15s" }}
            onMouseOver={e => e.currentTarget.style.transform="translateY(-2px)"}
            onMouseOut={e => e.currentTarget.style.transform="translateY(0)"}>
            <div style={{ width:"56px", height:"56px", borderRadius:"50%", background:"#A8DCE7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", margin:"0 auto 14px" }}>➕</div>
            <div style={{ fontWeight:"800", fontSize:"16px", color:"#2D6A9F", marginBottom:"8px" }}>BUAT ROOM</div>
            <div style={{ fontSize:"12px", color:"#888" }}>Main bareng teman</div>
          </div>
          <div onClick={() => setShowJoin(!showJoin)} style={{ flex:1, background:"#fff", borderRadius:"20px", padding:"28px 20px", textAlign:"center", cursor:"pointer", boxShadow:"0 2px 16px rgba(0,0,0,0.05)", transition:"transform 0.15s" }}
            onMouseOver={e => e.currentTarget.style.transform="translateY(-2px)"}
            onMouseOut={e => e.currentTarget.style.transform="translateY(0)"}>
            <div style={{ width:"56px", height:"56px", borderRadius:"50%", background:"#4CAF7D", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", margin:"0 auto 14px" }}>🔢</div>
            <div style={{ fontWeight:"800", fontSize:"16px", color:"#1a6a4a", marginBottom:"8px" }}>JOIN CODE</div>
            <div style={{ fontSize:"12px", color:"#888" }}>Masukkan kode room</div>
          </div>
        </div>

        {showJoin && (
          <div style={{ background:"#fff", borderRadius:"16px", padding:"20px", marginBottom:"24px", boxShadow:"0 2px 16px rgba(0,0,0,0.05)", animation:"fadeIn 0.2s ease" }}>
            <div style={{ display:"flex", gap:"10px" }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Masukkan kode room (6 huruf)"
                style={{ flex:1, padding:"12px 16px", borderRadius:"10px", border:"1.5px solid #e0d8d8", fontSize:"15px", fontWeight:"700", letterSpacing:"2px", outline:"none" }}
                maxLength={6} onKeyDown={e => e.key === "Enter" && joinRoom()} />
              <button onClick={joinRoom} style={{ background:"#8B2635", color:"#fff", border:"none", padding:"12px 20px", borderRadius:"10px", fontWeight:"700", fontSize:"14px", cursor:"pointer" }}>JOIN</button>
            </div>
          </div>
        )}

        {/* Top Legends */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
            <span style={{ fontWeight:"800", fontSize:"18px", color:"#1a1a1a" }}>📊 TOP LEGENDS</span>
            <span onClick={() => router.push("/leaderboard")} style={{ fontSize:"13px", color:"#8B2635", fontWeight:"700", cursor:"pointer" }}>Lihat Semua</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {leaders.map((p, i) => (
              <div key={p.id} style={{ background:"#fff", borderRadius:"16px", padding:"16px 20px", display:"flex", alignItems:"center", gap:"14px", boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
                <span style={{ fontSize:"14px", color:"#aaa", fontWeight:"700", width:"20px" }}>#{i+1}</span>
                <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"#fde8e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", overflow:"hidden" }}>
                  {p.avatar ? <img src={p.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" /> : "🧑"}
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:"600", fontSize:"15px", color:"#1a1a1a" }}>{p.username}</span>
                  {p.isOnline && <span style={{ marginLeft:"8px", fontSize:"10px", color:"#4CAF7D", fontWeight:"700" }}>● ONLINE</span>}
                </div>
                <span style={{ fontSize:"16px", fontWeight:"800", color:"#8B2635" }}>{p.rankedPoints} pts</span>
              </div>
            ))}
          </div>
        </div>
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
