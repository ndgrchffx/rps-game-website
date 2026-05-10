"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUser } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

const MOVE_ICONS = { ROCK:"✊", PAPER:"🖐️", SCISSORS:"✌️" };
const MOVE_EMOJI = { ROCK:"💎", PAPER:"📄", SCISSORS:"✂️" };

function GameContent() {
  const router = useRouter();
  const params = useSearchParams();
  const roomCode = params.get("room");
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState({
    phase: "waiting", // waiting | picking | reveal | trivia | result | gameover
    round: 0,
    timer: 5,
    p1: { username:"", hp:100, buffs:[] },
    p2: { username:"", hp:100, buffs:[] },
    myMove: null,
    opponentPicked: false,
    lockedMove: null,
  });
  const [trivia, setTrivia] = useState(null); // { question, options, timeLimit, myAnswer }
  const [roundResult, setRoundResult] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [effects, setEffects] = useState([]); // screen effects
  const [myId, setMyId] = useState(null);
  const [spyHint, setSpyHint] = useState(null); // move yang TIDAK dipilih lawan
  const [opponentExposed, setOpponentExposed] = useState(null); // move lawan yg terexpose
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    setMyId(u.id);

    const socket = connectSocket();
    socketRef.current = socket;

    // Player joined — init state
    socket.on("game:player_joined", ({ state }) => {
  setGameState(prev => ({
    ...prev,
    p1: { id: state.p1.id, username: state.p1.username, hp: state.p1.hp, buffs: state.p1.buffs },
    p2: state.p2 ? { id: state.p2.id, username: state.p2.username, hp: state.p2.hp, buffs: state.p2.buffs } : prev.p2,
  }));
});

    // Challenge accepted init
    socket.on("game:challenge_accepted", ({ state }) => {
      setGameState(prev => ({
        ...prev,
        p1: { id: state.p1.id, username: state.p1.username, hp: state.p1.hp, buffs: state.p1.buffs },
        p2: state.p2 ? { id: state.p2.id, username: state.p2.username, hp: state.p2.hp, buffs: state.p2.buffs } : prev.p2,
      }));
    });

    socket.on("game:joined", ({ state }) => {
  if (!state) return;
  setGameState(prev => ({
    ...prev,
    p1: { id: state.p1.id, username: state.p1.username, hp: state.p1.hp, buffs: state.p1.buffs },
    p2: state.p2 ? { id: state.p2.id, username: state.p2.username, hp: state.p2.hp, buffs: state.p2.buffs } : prev.p2,
  }));
});

    // Round start
    socket.on("game:round_start", ({ round, timer, p1HP, p2HP, p1Buffs, p2Buffs }) => {
      setSpyHint(null);
      setOpponentExposed(null);
      setRoundResult(null);
      setTrivia(null);
      setGameState(prev => ({
        ...prev,
        phase:"picking", round, timer,
        myMove: null, opponentPicked: false, lockedMove: null,
        p1: { ...prev.p1, hp:p1HP, buffs:p1Buffs },
        p2: { ...prev.p2, hp:p2HP, buffs:p2Buffs },
      }));
      // Countdown
      let t = timer;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        t--;
        setGameState(prev => ({ ...prev, timer: t }));
        if (t <= 0) clearInterval(timerRef.current);
      }, 1000);
    });

    // Spy: kita dapat hint 1 move yang TIDAK dipilih lawan
    socket.on("game:spy_reveal", ({ notPickedMove }) => {
      setSpyHint(notPickedMove);
    });

    // Exposed: lawan kita terexpose, kita tahu movenya
    socket.on("game:opponent_exposed", ({ move }) => {
      setOpponentExposed(move);
    });

    // Move locked (debuff)
    socket.on("game:move_locked", ({ lockedMove }) => {
      setGameState(prev => ({ ...prev, lockedMove }));
    });

    // Opponent picked
    socket.on("game:opponent_picked", () => {
      setGameState(prev => ({ ...prev, opponentPicked: true }));
    });

    // Round result
    socket.on("game:round_result", (data) => {
      clearInterval(timerRef.current);
      setGameState(prev => ({
        ...prev, phase:"reveal",
        p1: { ...prev.p1, hp:data.p1HP },
        p2: { ...prev.p2, hp:data.p2HP },
      }));
      setRoundResult(data);
    });

    // Trivia start
    socket.on("game:trivia_start", (data) => {
      setGameState(prev => ({ ...prev, phase:"trivia" }));
      setTrivia({ ...data, myAnswer: null, triviaTimer: data.timeLimit });
      let t = data.timeLimit;
      const interval = setInterval(() => {
        t--;
        setTrivia(prev => prev ? { ...prev, triviaTimer: t } : prev);
        if (t <= 0) clearInterval(interval);
      }, 1000);
    });

    // Trivia self answered
    socket.on("game:trivia_self_answered", ({ correct, correctAnswer }) => {
      setTrivia(prev => prev ? { ...prev, answered: true, correct, correctAnswer } : prev);
    });

    // Effect received
    socket.on("game:effect_received", ({ effect, hp }) => {
      showEffect(effect);
    });

    // Trivia resolved
    socket.on("game:trivia_resolved", (data) => {
      setTrivia(prev => prev ? { ...prev, resolved: true, resolution: data } : prev);
      setGameState(prev => ({
        ...prev, phase:"reveal",
        p1: { ...prev.p1, hp:data.p1HP },
        p2: { ...prev.p2, hp:data.p2HP },
      }));
    });

    // Game over
    socket.on("game:over", (data) => {
      clearInterval(timerRef.current);
      setGameState(prev => ({ ...prev, phase:"gameover" }));
      setGameOver(data);
    });

    // Disconnect
    socket.on("game:player_disconnected", ({ username }) => {
      showEffect({ id:"disconnect", name:`❌ ${username} keluar`, type:"debuff" });
    });

    socket.on("game:ranked_match_found", ({ state }) => {
      setGameState(prev => ({
        ...prev,
        p1: { ...prev.p1, id: state.p1.id, username: state.p1.username, hp: state.p1.hp, buffs: state.p1.buffs },
        p2: state.p2 ? { ...prev.p2, id: state.p2.id, username: state.p2.username, hp: state.p2.hp, buffs: state.p2.buffs } : prev.p2,
      }));
    });

    return () => {
      clearInterval(timerRef.current);
      socket.off("game:player_joined");
      socket.off("game:challenge_accepted");
      socket.off("game:joined");
      socket.off("game:round_start");
      socket.off("game:move_locked");
      socket.off("game:opponent_picked");
      socket.off("game:round_result");
      socket.off("game:trivia_start");
      socket.off("game:trivia_self_answered");
      socket.off("game:effect_received");
      socket.off("game:trivia_resolved");
      socket.off("game:over");
      socket.off("game:player_disconnected");
      socket.off("game:ranked_match_found");
      socket.off("game:spy_reveal");
      socket.off("game:opponent_exposed");
    };
  }, [roomCode]);

  function showEffect(effect) {
    const id = Date.now();
    setEffects(prev => [...prev, { ...effect, id }]);
    setTimeout(() => setEffects(prev => prev.filter(e => e.id !== id)), 3000);
  }

  function sendMove(move) {
    if (gameState.phase !== "picking" || gameState.myMove || gameState.lockedMove) return;
    setGameState(prev => ({ ...prev, myMove: move }));
    socketRef.current?.emit("game:move", { roomCode, move });
  }

  function answerTrivia(answer) {
    if (trivia?.myAnswer) return;
    setTrivia(prev => prev ? { ...prev, myAnswer: answer } : prev);
    socketRef.current?.emit("game:trivia_answer", { roomCode, answer });
  }

  // Determine my player (p1 or p2)
  const isP1 = user && gameState.p1.id === user.id;
  const me = isP1 ? gameState.p1 : gameState.p2;
  const opponent = isP1 ? gameState.p2 : gameState.p1;
  const myResult = roundResult ? (roundResult.result === "DRAW" ? "DRAW" : (isP1 ? roundResult.result === "P1_WIN" : roundResult.result === "P2_WIN") ? "WIN" : "LOSE") : null;

  const timerPct = gameState.timer / 5;
  const timerColor = gameState.timer <= 2 ? "#E24B4A" : "#8B2635";

  if (gameState.phase === "waiting" && !gameState.round) {
    return (
      <main style={{ minHeight:"100vh", background:"#FDF0EE", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:"48px", marginBottom:"16px", animation:"pulse 2s infinite" }}>⏳</div>
          <p style={{ color:"#8B2635", fontSize:"18px", fontWeight:"700" }}>Menunggu permainan dimulai...</p>
          <p style={{ color:"#888", marginTop:"8px", fontSize:"14px" }}>Room: {roomCode}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight:"100vh", background:"#FDF0EE", fontFamily:"inherit", paddingBottom:"20px", position:"relative" }}>
      {/* Screen Effects */}
      <div style={{ position:"fixed", top:"80px", right:"16px", zIndex:50, display:"flex", flexDirection:"column", gap:"8px" }}>
        {effects.map(eff => (
          <div key={eff.id} style={{ background: eff.type==="buff"?"#e8f5e9":"#fde8e8", border:`2px solid ${eff.type==="buff"?"#4CAF7D":"#E24B4A"}`, borderRadius:"12px", padding:"10px 16px", fontSize:"13px", fontWeight:"700", color: eff.type==="buff"?"#2e7d32":"#8B2635", animation:"fadeIn 0.3s ease", maxWidth:"220px" }}>
            {eff.name}
          </div>
        ))}
      </div>

      {/* Navbar */}
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 24px", borderBottom:"1px solid var(--border)" }}>
        <div>
          <div style={{ fontWeight:"800", fontSize:"18px", color:"#8B2635" }}>JANKEN</div>
          <div style={{ fontSize:"11px", color:"#888", fontWeight:"600", letterSpacing:"0.5px" }}>
            RONDE {gameState.round} {gameState.round > 0 && gameState.round % 3 === 0 ? "• 🎯 TRIVIA BERIKUTNYA" : ""}
          </div>
        </div>
      </nav>

      <div style={{ padding:"24px", maxWidth:"540px", margin:"0 auto" }}>
        {/* HP Bars */}
        <div style={{ background:"#fff", borderRadius:"16px", padding:"16px 20px", marginBottom:"20px", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
            <span style={{ fontSize:"13px", fontWeight:"700", color:"#2D6A9F" }}>{me?.username || "Kamu"}</span>
            <span style={{ fontSize:"13px", fontWeight:"700", color:"#888" }}>vs</span>
            <span style={{ fontSize:"13px", fontWeight:"700", color:"#8B2635" }}>{opponent?.username || "Lawan"}</span>
          </div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#888", marginBottom:"4px" }}>
                <span>❤️ {me?.hp || 0} HP</span>
                <span style={{ fontSize:"10px", color:"#aaa" }}>{(me?.buffs || []).join(" ")}</span>
              </div>
              <div style={{ height:"10px", background:"#f0e8e8", borderRadius:"5px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${me?.hp || 0}%`, background:"#2D6A9F", borderRadius:"5px", transition:"width 0.5s ease" }}></div>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#888", marginBottom:"4px" }}>
                <span style={{ fontSize:"10px", color:"#aaa" }}>{(opponent?.buffs || []).join(" ")}</span>
                <span>❤️ {opponent?.hp || 0} HP</span>
              </div>
              <div style={{ height:"10px", background:"#f0e8e8", borderRadius:"5px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${opponent?.hp || 0}%`, background:"#8B2635", borderRadius:"5px", transition:"width 0.5s ease", marginLeft:"auto" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Timer */}
        {gameState.phase === "picking" && (
          <div style={{ display:"flex", justifyContent:"center", marginBottom:"24px" }}>
            <div style={{ width:"90px", height:"90px", borderRadius:"50%", border:`4px solid ${timerColor}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#fff", boxShadow: gameState.timer<=2?"0 0 0 8px rgba(226,75,74,0.15)":"none", transition:"all 0.3s" }}>
              <span style={{ fontSize:"36px", fontWeight:"900", color:timerColor, lineHeight:1 }}>{gameState.timer}</span>
              <span style={{ fontSize:"10px", color:"#aaa", letterSpacing:"1px" }}>DETIK</span>
            </div>
          </div>
        )}

        {/* VS Area */}
        {(gameState.phase === "picking" || gameState.phase === "reveal") && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"16px", marginBottom:"24px" }}>
            {/* My side */}
            <div style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#2D6A9F", letterSpacing:"1px", marginBottom:"8px" }}>KAMU</div>
              <div style={{ width:"100px", height:"100px", borderRadius:"50%", border:"3px solid #8B2635", margin:"0 auto", background:"#F4A090", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"44px" }}>
                {gameState.phase === "reveal" ? MOVE_ICONS[isP1 ? roundResult?.p1Move : roundResult?.p2Move] || "?" : gameState.myMove ? MOVE_ICONS[gameState.myMove] : "?"}
              </div>
              {gameState.lockedMove && <div style={{ fontSize:"11px", color:"#E24B4A", fontWeight:"700", marginTop:"6px" }}>🔒 {gameState.lockedMove}</div>}
            </div>

            {/* VS */}
            <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"#8B2635", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"800", flexShrink:0 }}>VS</div>

            {/* Opponent */}
            <div style={{ flex:1, textAlign:"center" }}>
              <div style={{ display:"inline-block", background:"#f0e8e8", color:"#888", fontSize:"11px", fontWeight:"700", padding:"4px 10px", borderRadius:"20px", letterSpacing:"1px", marginBottom:"8px" }}>LAWAN</div>
              <div style={{ width:"100px", height:"100px", borderRadius:"50%", border:"2px solid #e8d8d8", margin:"0 auto", background:"#f5efef", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"40px" }}>
                {gameState.phase === "reveal" 
                ? MOVE_ICONS[isP1 ? roundResult?.p2Move : roundResult?.p1Move] || "?"
                : opponentExposed 
                  ? MOVE_ICONS[opponentExposed]
                  : gameState.opponentPicked ? "✅" : "?"
              }
              </div>
            </div>
          </div>
        )}

        {/* Round Result */}
        {gameState.phase === "reveal" && roundResult && !trivia && (
          <div style={{ textAlign:"center", marginBottom:"20px", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:"28px", fontWeight:"900", color: myResult==="WIN"?"#4CAF7D":myResult==="LOSE"?"#E24B4A":"#888", marginBottom:"4px" }}>
              {myResult === "WIN" ? "🎉 MENANG!" : myResult === "LOSE" ? "💔 KALAH!" : "🤝 SERI!"}
            </div>
            {roundResult.result !== "DRAW" && (
              <div style={{ fontSize:"13px", color:"#888" }}>
                {myResult === "WIN" ? `Damage ke lawan: -${isP1?roundResult.damageToPl2:roundResult.damageToPl1} HP` : `Kamu kena: -${isP1?roundResult.damageToPl1:roundResult.damageToPl2} HP`}
              </div>
            )}
          </div>
        )}

        {/* Move Selection */}
        {gameState.phase === "picking" && (
          <>
            <div style={{ textAlign:"center", marginBottom:"12px" }}>
              <span style={{ fontSize:"12px", fontWeight:"700", color:"#888", letterSpacing:"2px" }}>PILIH SENJATAMU</span>
            </div>
            {spyHint && (
              <div style={{ textAlign:"center", marginBottom:"10px", padding:"8px 16px", background:"#e8f5e9", borderRadius:"12px", fontSize:"13px", fontWeight:"700", color:"#2e7d32" }}>
                👁️ Spy: Lawan TIDAK memilih {spyHint === "ROCK" ? "BATU" : spyHint === "PAPER" ? "KERTAS" : "GUNTING"}
              </div>
            )}

            {opponentExposed && (
              <div style={{ textAlign:"center", marginBottom:"10px", padding:"8px 16px", background:"#fff3e0", borderRadius:"12px", fontSize:"13px", fontWeight:"700", color:"#e65100" }}>
                🔍 Lawan memilih: {opponentExposed === "ROCK" ? "BATU" : opponentExposed === "PAPER" ? "KERTAS" : "GUNTING"}!
              </div>
            )}

            <div style={{ display:"flex", gap:"12px" }}>
              {["ROCK","PAPER","SCISSORS"].map(m => {
                const isLocked = gameState.lockedMove && gameState.lockedMove !== m;
                const isSelected = gameState.myMove === m || gameState.lockedMove === m;
                return (
                  <button key={m} onClick={() => !isLocked && sendMove(m)} disabled={!!gameState.myMove || !!gameState.lockedMove}
                    style={{ flex:1, background:"#fff", border: isSelected?"2.5px solid #8B2635":"2px solid transparent", borderRadius:"20px", padding:"20px 8px", cursor: isLocked?"not-allowed":"pointer", textAlign:"center", boxShadow: isSelected?"0 4px 20px rgba(139,38,53,0.15)":"0 2px 12px rgba(0,0,0,0.05)", opacity: isLocked?0.4:1, transition:"all 0.15s" }}>
                    <div style={{ fontSize:"28px", marginBottom:"8px" }}>{MOVE_EMOJI[m]}</div>
                    <div style={{ fontSize:"12px", fontWeight:"800", color: isSelected?"#8B2635":"#1a1a1a", letterSpacing:"0.5px" }}>
                      {m === "ROCK" ? "BATU" : m === "PAPER" ? "KERTAS" : "GUNTING"}
                    </div>
                    {isLocked && <div style={{ fontSize:"10px", color:"#E24B4A" }}>🔒</div>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* TRIVIA */}
        {gameState.phase === "trivia" && trivia && (
          <div style={{ background:"#fff", borderRadius:"20px", padding:"24px", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", animation:"fadeIn 0.4s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <div style={{ background:"#8B2635", color:"#fff", borderRadius:"20px", padding:"4px 14px", fontSize:"12px", fontWeight:"700", letterSpacing:"1px" }}>🎯 TRIVIA TIME!</div>
              <div style={{ fontSize:"20px", fontWeight:"900", color: (trivia.triviaTimer||0)<=5?"#E24B4A":"#8B2635" }}>{trivia.triviaTimer || 0}s</div>
            </div>
            <p style={{ fontSize:"16px", fontWeight:"600", color:"#1a1a1a", marginBottom:"20px", lineHeight:"1.5" }}>{trivia.question}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {trivia.options?.map((opt, i) => {
                let bg = "#fff", border = "1.5px solid #e0d8d8", color = "#1a1a1a";
                if (trivia.myAnswer === opt) { bg = "#f5eded"; border = "2px solid #8B2635"; }
                if (trivia.answered && opt === trivia.correctAnswer) { bg = "#e8f5e9"; border = "2px solid #4CAF7D"; color="#2e7d32"; }
                if (trivia.answered && trivia.myAnswer === opt && opt !== trivia.correctAnswer) { bg="#fde8e8"; border="2px solid #E24B4A"; color="#c62828"; }
                return (
                  <button key={i} onClick={() => answerTrivia(opt)} disabled={!!trivia.myAnswer}
                    style={{ padding:"14px 16px", borderRadius:"12px", border, background:bg, color, fontWeight:"600", fontSize:"14px", textAlign:"left", cursor: trivia.myAnswer?"default":"pointer", transition:"all 0.15s" }}>
                    <span style={{ marginRight:"10px", opacity:0.5 }}>{["A","B","C","D"][i]}.</span>{opt}
                  </button>
                );
              })}
            </div>
            {trivia.answered && (
              <div style={{ marginTop:"16px", padding:"12px", borderRadius:"12px", background: trivia.correct?"#e8f5e9":"#fde8e8", color: trivia.correct?"#2e7d32":"#c62828", fontSize:"14px", fontWeight:"700", textAlign:"center" }}>
                {trivia.correct ? "✅ Benar! Kamu dapat buff!" : "❌ Salah! Kamu kena debuff!"}
              </div>
            )}
          </div>
        )}

        {/* GAME OVER */}
        {gameState.phase === "gameover" && gameOver && (
          <div style={{ textAlign:"center", animation:"fadeIn 0.5s ease" }}>
            <div style={{ fontSize:"64px", marginBottom:"16px" }}>
              {gameOver.winnerId === myId ? "🏆" : "💀"}
            </div>
            <h2 style={{ fontSize:"32px", fontWeight:"900", color: gameOver.winnerId===myId?"#4CAF7D":"#8B2635", marginBottom:"8px" }}>
              {gameOver.winnerId === myId ? "MENANG!" : "KALAH!"}
            </h2>
            <p style={{ color:"#888", fontSize:"14px", marginBottom:"24px" }}>
              Pemenang: <b>{gameOver.winnerName}</b> • Total {gameOver.totalRounds} ronde
            </p>
            {(gameOver.p1Delta !== 0 || gameOver.p2Delta !== 0) && (
              <div style={{ background:"#fff", borderRadius:"16px", padding:"16px", marginBottom:"24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize:"12px", color:"#888", fontWeight:"700", marginBottom:"8px" }}>PERUBAHAN POIN RANKED</p>
                <p style={{ fontSize:"22px", fontWeight:"900", color: gameOver.winnerId===myId?"#4CAF7D":"#E24B4A" }}>
                  {gameOver.winnerId === myId ? "+" : ""}{isP1 ? gameOver.p1Delta : gameOver.p2Delta} PTS
                </p>
              </div>
            )}
            <div style={{ display:"flex", gap:"12px", justifyContent:"center" }}>
              <button onClick={() => router.push("/lobby")} style={{ padding:"12px 28px", borderRadius:"50px", border:"none", background:"#8B2635", color:"#fff", fontWeight:"700", fontSize:"14px" }}>
                Kembali ke Lobby
              </button>
              <button onClick={() => router.push("/leaderboard")} style={{ padding:"12px 28px", borderRadius:"50px", border:"2px solid #8B2635", background:"transparent", color:"#8B2635", fontWeight:"700", fontSize:"14px" }}>
                Lihat Ranking
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function GamePage() {
  return <Suspense><GameContent /></Suspense>;
}
