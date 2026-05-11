"use client";
import { useRouter } from "next/navigation";

export default function ResultPage() {
  const router = useRouter();
  const isWin = true; // nanti bisa diganti dynamic

  return (
    <main style={{
      minHeight: "100vh", background: "#FDF0EE",
      fontFamily: "sans-serif", paddingBottom: "40px"
    }}>
      {/* Notif */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px 24px" }}>
        <span style={{ fontSize: "20px", cursor: "pointer" }}>🔔</span>
      </div>

      <div style={{ padding: "0 24px", maxWidth: "540px", margin: "0 auto" }}>

        {/* Win/Lose Icon */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: isWin ? "#4CAF7D" : "#E24B4A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "32px", margin: "0 auto"
          }}>{isWin ? "🎉" : "😢"}</div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1 style={{
            fontSize: "42px", fontWeight: "900", margin: "0 0 8px",
            color: isWin ? "#8B2635" : "#555", letterSpacing: "-1px"
          }}>{isWin ? "YOU WIN!" : "YOU LOSE!"}</h1>
          <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
            {isWin ? "Exceptional move selection, Champ!" : "Better luck next time!"}
          </p>
        </div>

        {/* Rank Points Card */}
        <div style={{
          background: "#fff", borderRadius: "20px", padding: "24px 28px",
          marginBottom: "20px", boxShadow: "0 2px 16px rgba(0,0,0,0.05)"
        }}>
          <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "2px", color: "#888", marginBottom: "8px", textAlign: "center" }}>
            RANK POINTS
          </div>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <span style={{ fontSize: "48px", fontWeight: "900", color: isWin ? "#4CAF7D" : "#E24B4A" }}>
              {isWin ? "+42" : "-18"}
            </span>
            <span style={{ fontSize: "16px", fontWeight: "700", color: "#aaa", marginLeft: "6px" }}>RP</span>
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#888", letterSpacing: "0.5px" }}>GOLD TIER II</span>
              <span style={{ fontSize: "11px", color: "#888" }}>1,242 / 1,500</span>
            </div>
            <div style={{ height: "6px", background: "#f0e8e8", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                width: "83%", height: "100%",
                background: "#4CAF7D", borderRadius: "3px",
                transition: "width 1s ease"
              }}></div>
            </div>
          </div>
        </div>

        {/* YOU vs BOT */}
        <div style={{ marginBottom: "20px" }}>
          {/* Labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{
              background: "#2D6A9F", color: "#fff", fontSize: "11px",
              fontWeight: "700", padding: "4px 14px", borderRadius: "20px"
            }}>YOU</div>
            <div style={{
              background: "#f0e8e8", color: "#888", fontSize: "11px",
              fontWeight: "700", padding: "4px 14px", borderRadius: "20px"
            }}>BOT_3000</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Your choice */}
            <div style={{
              flex: 1, background: "#fff", borderRadius: "16px",
              padding: "20px", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "52px",
              border: "2px solid #fde8e8",
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)"
            }}>🖐️</div>

            {/* VS */}
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "#f0e8e8", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "11px", fontWeight: "800",
              color: "#888", flexShrink: 0
            }}>VS</div>

            {/* Enemy choice */}
            <div style={{
              flex: 1, background: "#fff", borderRadius: "16px",
              padding: "20px", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "52px",
              border: "2px solid #f0e8e8",
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)"
            }}>✊</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", padding: "0 8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "800", color: "#1a1a1a" }}>PAPER</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#aaa" }}>ROCK</span>
          </div>
        </div>

        {/* Bottom Cards: Opponent Reaction + Fastest Hand */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "28px" }}>
          {/* Opponent Reaction (Camera) */}
          <div style={{
            flex: 1, background: "#2a2a3a", borderRadius: "16px",
            height: "120px", display: "flex", flexDirection: "column",
            justifyContent: "flex-end", padding: "12px",
            overflow: "hidden", position: "relative"
          }}>
            <div style={{
              position: "absolute", top: "10px", right: "10px",
              width: "10px", height: "10px", borderRadius: "50%", background: "#E24B4A"
            }}></div>
            <div style={{
              fontSize: "60px", position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -60%)", opacity: 0.3
            }}>😱</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "14px" }}>📹</span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", letterSpacing: "1px" }}>
                OPPONENT REACTION
              </span>
            </div>
          </div>

          {/* Fastest Hand */}
          <div style={{
            flex: 1, background: "#A8DCE7", borderRadius: "16px",
            padding: "16px", display: "flex", flexDirection: "column",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#1a4a5a", lineHeight: "1.3" }}>
                Fastest<br />Hand
              </div>
              <span style={{ fontSize: "18px" }}>⚡</span>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "#1a4a5a" }}>0.4s</div>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#2D6A8A", letterSpacing: "1px" }}>
                REACTION TIME
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={() => router.push("/game")}
          style={{
            width: "100%", padding: "18px", background: "#8B2635",
            color: "#fff", border: "none", borderRadius: "50px",
            fontSize: "15px", fontWeight: "800", cursor: "pointer",
            letterSpacing: "2px", marginBottom: "12px", transition: "opacity 0.15s"
          }}
          onMouseOver={e => e.currentTarget.style.opacity = "0.88"}
          onMouseOut={e => e.currentTarget.style.opacity = "1"}
        >PLAY AGAIN</button>

        <button
          onClick={() => router.push("/lobby")}
          style={{
            width: "100%", padding: "16px", background: "#f0e8e8",
            color: "#888", border: "none", borderRadius: "50px",
            fontSize: "13px", fontWeight: "700", cursor: "pointer",
            letterSpacing: "2px"
          }}
        >BACK TO LOBBY</button>
      </div>
    </main>
  );
}