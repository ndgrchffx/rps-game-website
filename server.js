// server.js - JANKEN Game Server with Socket.io
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const webpush = require("web-push");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "janken_secret_2024";

// Web Push config
webpush.setVapidDetails(
  "mailto:janken@game.com",
  process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  process.env.VAPID_PRIVATE_KEY || "UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls"
);

// ── In-memory Game State ───────────────────────────────────
const gameRooms = new Map(); // roomCode → GameState
const userSockets = new Map(); // userId → socketId
const rankedQueue = []; // { userId, username, socketId }

function createGameState(sessionId, roomCode, mode, player1) {
  return {
    sessionId,
    roomCode,
    mode,
    status: "waiting",
    players: {
      p1: { ...player1, hp: 100, buffs: [], move: null, triviaAnswer: null },
      p2: null,
    },
    currentRound: 0,
    phase: "waiting", // waiting | countdown | picking | reveal | trivia | result
    roundTimer: null,
    triviaData: null,
    pendingTrivia: false,
  };
}

const BUFFS = [
  { id: "shield", name: "🛡️ Shield", desc: "Blok damage 1 ronde ini", type: "buff" },
  { id: "spy", name: "👁️ Spy", desc: "Lihat 1 pilihan yang TIDAK dipilih lawan", type: "buff" },
  { id: "extra_time", name: "⏱️ Extra Time", desc: "+3 detik waktu pilih", type: "buff" },
  { id: "double_damage", name: "⚔️ Double Damage", desc: "Damage 2x ronde ini", type: "buff" },
  { id: "heal", name: "💚 Heal", desc: "Pulihkan 15 HP", type: "buff" },
];

const DEBUFFS = [
  { id: "time_cut", name: "⏳ Time Cut", desc: "Waktu pilih berkurang 2 detik", type: "debuff" },
  { id: "hp_drain", name: "💀 HP Drain", desc: "Kehilangan 10 HP langsung", type: "debuff" },
  { id: "lock_random", name: "🔒 Move Lock", desc: "1 pilihan di-lock secara random", type: "debuff" },
  { id: "half_damage", name: "🪶 Weakened", desc: "Damage 0.5x ronde ini", type: "debuff" },
  { id: "reveal", name: "🔍 Exposed", desc: "Pilihanmu terlihat lawan ronde ini", type: "debuff" },
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function fetchTrivia() {
  try {
    const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986");
    const data = await res.json();
    if (!data.results?.length) throw new Error("no results");
    const q = data.results[0];
    const correct = decodeURIComponent(q.correct_answer);
    const incorrect = q.incorrect_answers.map(decodeURIComponent);
    const options = [...incorrect, correct].sort(() => Math.random() - 0.5);
    return {
      question: decodeURIComponent(q.question),
      options,
      correct,
      category: decodeURIComponent(q.category),
    };
  } catch {
    const fallback = [
      { question: "Ibukota Indonesia adalah?", options: ["Surabaya","Bandung","Jakarta","Medan"], correct: "Jakarta" },
      { question: "2 + 2 = ?", options: ["3","4","5","6"], correct: "4" },
      { question: "Siapa penemu telepon?", options: ["Edison","Newton","Graham Bell","Tesla"], correct: "Graham Bell" },
    ];
    return pickRandom(fallback);
  }
}

function calcDamage(result, attackerBuffs = []) {
  let base = 20;
  if (attackerBuffs.includes("double_damage")) base = 40;
  if (attackerBuffs.includes("half_damage")) base = 10;
  return base;
}

function resolveRound(move1, move2) {
  if (move1 === move2) return "DRAW";
  if (
    (move1 === "ROCK" && move2 === "SCISSORS") ||
    (move1 === "PAPER" && move2 === "ROCK") ||
    (move1 === "SCISSORS" && move2 === "PAPER")
  ) return "P1_WIN";
  return "P2_WIN";
}

async function sendPushNotification(userId, payload) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushSubscription: true } });
    if (!user?.pushSubscription) return;
    const sub = JSON.parse(user.pushSubscription);
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (e) {
    console.error("Push notification failed:", e.message);
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Token tidak ditemukan."));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch {
      next(new Error("Token tidak valid."));
    }
  });

  io.on("connection", async (socket) => {
    const { userId, username } = socket;
    userSockets.set(userId, socket.id);
    console.log(`[SOCKET] ${username} connected (${socket.id})`);

    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() },
    }).catch(console.error);

    socket.broadcast.emit("user:online", { userId, username });

    socket.on("game:create_room", async ({ mode }) => {
  if (mode === "RANKED") {
    // Cek apakah sudah ada di queue
    const alreadyQueued = rankedQueue.find(p => p.userId === userId);
    if (alreadyQueued) return;

    // Cek apakah ada player lain di queue
    const opponent = rankedQueue.find(p => p.userId !== userId);

    if (opponent) {
      // Match ditemukan! Hapus lawan dari queue
      const idx = rankedQueue.indexOf(opponent);
      rankedQueue.splice(idx, 1);

      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        const session = await prisma.gameSession.create({
          data: {
            roomCode,
            mode: "RANKED",
            player1Id: opponent.userId,
            player2Id: userId,
            status: "IN_PROGRESS",
          },
        });

        const state = createGameState(session.id, roomCode, "RANKED", {
          id: opponent.userId,
          username: opponent.username,
        });
        state.players.p2 = {
          id: userId,
          username,
          hp: 100,
          buffs: [],
          move: null,
          triviaAnswer: null,
        };
        gameRooms.set(roomCode, state);

        // Join kedua player ke room
        const opponentSock = io.sockets.sockets.get(opponent.socketId);
        if (opponentSock) opponentSock.join(roomCode);
        socket.join(roomCode);

        // Beritahu kedua player
        io.to(roomCode).emit("game:ranked_match_found", {
          roomCode,
          sessionId: session.id,
          state: sanitizeState(state),
        });

        setTimeout(() => startRound(io, roomCode, state), 3000);
      } catch (e) {
        socket.emit("error", { message: "Gagal membuat ranked game." });
      }
    } else {
      // Masuk queue, tunggu lawan
      rankedQueue.push({ userId, username, socketId: socket.id });
      socket.emit("game:queued", { position: rankedQueue.length });
    }
    return;
  }

  // CASUAL room seperti biasa
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    const session = await prisma.gameSession.create({
      data: {
        roomCode,
        mode: "CASUAL",
        player1Id: userId,
        status: "WAITING",
      },
    });
    const state = createGameState(session.id, roomCode, "CASUAL", { id: userId, username });
    gameRooms.set(roomCode, state);
    socket.join(roomCode);
    socket.emit("game:room_created", { roomCode, sessionId: session.id });
  } catch (e) {
    socket.emit("error", { message: "Gagal membuat room." });
  }
});

    socket.on("game:cancel_queue", () => {
      const queueIdx = rankedQueue.findIndex(p => p.userId === userId);
      if (queueIdx !== -1) {
        rankedQueue.splice(queueIdx, 1);
        console.log(`[QUEUE] ${username} keluar dari ranked queue`);
      }
    });

    // ── Join Room ────────────────────────────────────────────
    socket.on("game:join_room", async ({ roomCode }) => {
      const state = gameRooms.get(roomCode.toUpperCase());
      if (!state) { socket.emit("error", { message: "Room tidak ditemukan." }); return; }
      if (state.players.p2) { socket.emit("error", { message: "Room sudah penuh." }); return; }
      if (state.players.p1.id === userId) { socket.emit("error", { message: "Kamu sudah di room ini." }); return; }

      state.players.p2 = { id: userId, username, hp: 100, buffs: [], move: null, triviaAnswer: null };

      await prisma.gameSession.update({
        where: { roomCode: roomCode.toUpperCase() },
        data: { player2Id: userId, status: "IN_PROGRESS" },
      }).catch(console.error);

      socket.join(roomCode.toUpperCase());
      socket.emit("game:joined", { 
  roomCode: roomCode.toUpperCase(), 
  sessionId: state.sessionId,
  state: sanitizeState(state)
});
      io.to(roomCode.toUpperCase()).emit("game:player_joined", {
        player2: { id: userId, username },
        state: sanitizeState(state),
      });

      // Start first round after short delay
      setTimeout(() => startRound(io, roomCode.toUpperCase(), state), 2000);
    });

    // ── Player Move ──────────────────────────────────────────
    socket.on("game:move", async ({ roomCode, move }) => {
  const state = gameRooms.get(roomCode);
  if (!state || state.phase !== "picking") return;

  const isP1 = state.players.p1.id === userId;
  const isP2 = state.players.p2?.id === userId;
  if (!isP1 && !isP2) return;

  const player = isP1 ? state.players.p1 : state.players.p2;
  const opponent = isP1 ? state.players.p2 : state.players.p1;
  const opponentId = isP1 ? state.players.p2?.id : state.players.p1.id;
  const opponentSocketId = userSockets.get(opponentId);
  const opponentSock = io.sockets.sockets.get(opponentSocketId);

  player.move = move;

  // ── SPY buff: player ini dapat lihat 1 pilihan yang TIDAK dipilih lawan
  // Kirim ke player yang punya spy, tapi hanya bisa setelah lawan pick
  // Jadi kita simpan dulu, kirim saat lawan pick (lihat bagian bawah)

  // ── EXPOSED debuff: pilihan player ini terlihat oleh lawan
  if (player.buffs.includes("reveal")) {
    // Beritahu lawan move player ini
    if (opponentSock) {
      opponentSock.emit("game:opponent_exposed", { move });
    }
  }

  // ── Jika lawan punya SPY dan sudah pick, kirim 1 pilihan yang TIDAK dipilih player ini
  if (opponent?.buffs.includes("spy") && opponent?.move) {
    const allMoves = ["ROCK", "PAPER", "SCISSORS"];
    const notPicked = allMoves.filter(m => m !== move);
    const revealMove = pickRandom(notPicked);
    if (opponentSock) {
      opponentSock.emit("game:spy_reveal", { notPickedMove: revealMove });
    }
  }

  // ── Jika player ini punya SPY dan lawan sudah pick duluan
  if (player.buffs.includes("spy") && opponent?.move) {
    const allMoves = ["ROCK", "PAPER", "SCISSORS"];
    const notPicked = allMoves.filter(m => m !== opponent.move);
    const revealMove = pickRandom(notPicked);
    socket.emit("game:spy_reveal", { notPickedMove: revealMove });
  }

  // Notify other player that this player has picked (tanpa reveal move)
  socket.to(roomCode).emit("game:opponent_picked", { playerId: userId });

  // If both picked, resolve
  if (state.players.p1.move && state.players.p2?.move) {
    if (state.roundTimer) clearTimeout(state.roundTimer);
    await resolveRoundLogic(io, roomCode, state);
  }
});

    // ── Trivia Answer ────────────────────────────────────────
    socket.on("game:trivia_answer", async ({ roomCode, answer }) => {
      const state = gameRooms.get(roomCode);
      if (!state || state.phase !== "trivia" || !state.triviaData) return;

      const isP1 = state.players.p1.id === userId;
      const isP2 = state.players.p2?.id === userId;
      if (!isP1 && !isP2) return;

      const player = isP1 ? state.players.p1 : state.players.p2;
      if (player.triviaAnswer !== null) return; // already answered

      player.triviaAnswer = answer;
      const correct = answer === state.triviaData.correct;

      socket.emit("game:trivia_self_answered", { correct, answer, correctAnswer: state.triviaData.correct });

      // Apply effect
      const effect = correct ? pickRandom(BUFFS) : pickRandom(DEBUFFS);
      if (effect.id === "heal") { player.hp = Math.min(100, player.hp + 15); }
      if (effect.id === "hp_drain") { player.hp = Math.max(0, player.hp - 10); }
      if (!player.buffs) player.buffs = [];
      player.buffs.push(effect.id);

      socket.emit("game:effect_received", { effect, hp: player.hp });

      // Save to DB
      const field = isP1 ? { player1Answer: answer, player1Correct: correct, player1Effect: JSON.stringify(effect) }
        : { player2Answer: answer, player2Correct: correct, player2Effect: JSON.stringify(effect) };

      await prisma.triviaEvent.updateMany({
        where: { sessionId: state.sessionId, afterRound: state.currentRound - 1 },
        data: field,
      }).catch(console.error);

      // Check if both answered
      if (state.players.p1.triviaAnswer !== null && state.players.p2?.triviaAnswer !== null) {
        // Notify both players of each other's result
        io.to(roomCode).emit("game:trivia_resolved", {
          p1: { correct: state.players.p1.triviaAnswer === state.triviaData.correct, effect: state.players.p1.buffs.slice(-1)[0] },
          p2: { correct: state.players.p2.triviaAnswer === state.triviaData.correct, effect: state.players.p2.buffs.slice(-1)[0] },
          p1HP: state.players.p1.hp,
          p2HP: state.players.p2.hp,
        });
        state.triviaData = null;
        state.players.p1.triviaAnswer = null;
        state.players.p2.triviaAnswer = null;
        setTimeout(() => startRound(io, roomCode, state), 3000);
      }
    });

    // ── Challenge Player (from leaderboard) ─────────────────
    socket.on("game:challenge_player", async ({ targetUserId }) => {
      const targetSocketId = userSockets.get(targetUserId);
      if (!targetSocketId) {
        socket.emit("error", { message: "Pemain tidak online." });
        return;
      }
      const challenger = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, rankedPoints: true } });
      // Send push notification
      await sendPushNotification(targetUserId, {
        title: "⚔️ Challenge diterima!",
        body: `${challenger.username} menantangmu! Terima tantangan?`,
        data: { type: "challenge", challengerId: userId, challengerName: challenger.username },
      });
      // Also emit via socket if online
      io.to(targetSocketId).emit("game:challenge_received", {
        challengerId: userId,
        challengerName: challenger.username,
        challengerPoints: challenger.rankedPoints,
      });
    });

    // ── Accept Challenge ─────────────────────────────────────
    socket.on("game:accept_challenge", async ({ challengerId }) => {
      const challengerSocketId = userSockets.get(challengerId);
      if (!challengerSocketId) { socket.emit("error", { message: "Challenger offline." }); return; }
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const challenger = await prisma.user.findUnique({ where: { id: challengerId }, select: { username: true } });
      try {
        const session = await prisma.gameSession.create({
          data: { roomCode, mode: "RANKED", player1Id: challengerId, player2Id: userId, status: "IN_PROGRESS" },
        });
        const state = createGameState(session.id, roomCode, "RANKED", { id: challengerId, username: challenger.username });
        state.players.p2 = { id: userId, username, hp: 100, buffs: [], move: null, triviaAnswer: null };
        gameRooms.set(roomCode, state);

        const challengerSock = io.sockets.sockets.get(challengerSocketId);
        if (challengerSock) challengerSock.join(roomCode);
        socket.join(roomCode);

        io.to(roomCode).emit("game:challenge_accepted", { roomCode, sessionId: session.id, state: sanitizeState(state) });
        setTimeout(() => startRound(io, roomCode, state), 2000);
      } catch (e) {
        socket.emit("error", { message: "Gagal membuat ranked game." });
      }
    });

    // ── Save Push Subscription ───────────────────────────────
    socket.on("push:subscribe", async ({ subscription }) => {
      await prisma.user.update({
        where: { id: userId },
        data: { pushSubscription: JSON.stringify(subscription) },
      }).catch(console.error);
      socket.emit("push:subscribed", { ok: true });
    });

    // ── Disconnect ────────────────────────────────────────────
    socket.on("disconnect", async () => {
      userSockets.delete(userId);
      // Hapus dari ranked queue jika ada
      const queueIdx = rankedQueue.findIndex(p => p.userId === userId);
      if (queueIdx !== -1) rankedQueue.splice(queueIdx, 1);
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
      }).catch(console.error);
      socket.broadcast.emit("user:offline", { userId, username, lastSeen: new Date() });

      // Handle disconnect in game
      for (const [roomCode, state] of gameRooms.entries()) {
        if (state.players.p1?.id === userId || state.players.p2?.id === userId) {
          if (state.status !== "finished") {
            io.to(roomCode).emit("game:player_disconnected", { userId, username });
          }
        }
      }
    });
  });

  // ── Game Logic Functions ─────────────────────────────────
  function startRound(io, roomCode, state) {
  state.currentRound++;
  state.players.p1.move = null;
  if (state.players.p2) state.players.p2.move = null;
  state.phase = "picking";

  // Timer dihitung terpisah per player
  const BASE_TIMER = 5;

  let p1Timer = BASE_TIMER;
  if (state.players.p1.buffs.includes("extra_time")) p1Timer += 3;
  if (state.players.p1.buffs.includes("time_cut")) p1Timer -= 2;
  p1Timer = Math.max(3, p1Timer);

  let p2Timer = BASE_TIMER;
  if (state.players.p2?.buffs.includes("extra_time")) p2Timer += 3;
  if (state.players.p2?.buffs.includes("time_cut")) p2Timer -= 2;
  p2Timer = Math.max(3, p2Timer);

  // Locked move (debuff)
  const p1Locked = state.players.p1.buffs.includes("lock_random")
    ? pickRandom(["ROCK", "PAPER", "SCISSORS"]) : null;
  const p2Locked = state.players.p2?.buffs.includes("lock_random")
    ? pickRandom(["ROCK", "PAPER", "SCISSORS"]) : null;

  // Kirim timer masing-masing secara private ke tiap player
  const p1SocketId = userSockets.get(state.players.p1.id);
  const p2SocketId = userSockets.get(state.players.p2?.id);
  const p1Sock = io.sockets.sockets.get(p1SocketId);
  const p2Sock = io.sockets.sockets.get(p2SocketId);

  // Emit game:round_start ke masing-masing player dengan timer mereka sendiri
  if (p1Sock) {
    p1Sock.emit("game:round_start", {
      round: state.currentRound,
      timer: p1Timer,
      p1HP: state.players.p1.hp,
      p2HP: state.players.p2?.hp || 100,
      p1Buffs: state.players.p1.buffs,
      p2Buffs: state.players.p2?.buffs || [],
    });
  }

  if (p2Sock) {
    p2Sock.emit("game:round_start", {
      round: state.currentRound,
      timer: p2Timer,
      p1HP: state.players.p1.hp,
      p2HP: state.players.p2?.hp || 100,
      p1Buffs: state.players.p1.buffs,
      p2Buffs: state.players.p2?.buffs || [],
    });
  }

  // Locked move — set move otomatis dan beritahu player ybs
  if (p1Locked) {
    if (p1Sock) p1Sock.emit("game:move_locked", { lockedMove: p1Locked });
    state.players.p1.move = p1Locked;
  }
  if (p2Locked && state.players.p2) {
    if (p2Sock) p2Sock.emit("game:move_locked", { lockedMove: p2Locked });
    state.players.p2.move = p2Locked;
  }

  // Auto-resolve pakai timer terlama di antara keduanya
  // supaya player dengan extra_time masih bisa memilih
  const maxTimer = Math.max(p1Timer, p2Timer);

  state.roundTimer = setTimeout(async () => {
    const moves = ["ROCK", "PAPER", "SCISSORS"];
    if (!state.players.p1.move) state.players.p1.move = pickRandom(moves);
    if (state.players.p2 && !state.players.p2.move) state.players.p2.move = pickRandom(moves);
    await resolveRoundLogic(io, roomCode, state);
  }, maxTimer * 1000);
}

  async function resolveRoundLogic(io, roomCode, state) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    if (!p2) return;

    state.phase = "reveal";
    const result = resolveRound(p1.move, p2.move);

    let damageToPl1 = 0;
    let damageToPl2 = 0;

    if (result === "P1_WIN") {
      damageToPl2 = calcDamage(result, p1.buffs);
      if (!p2.buffs.includes("shield")) p2.hp -= damageToPl2;
      else damageToPl2 = 0;
    } else if (result === "P2_WIN") {
      damageToPl1 = calcDamage(result, p2.buffs);
      if (!p1.buffs.includes("shield")) p1.hp -= damageToPl1;
      else damageToPl1 = 0;
    }

    p1.hp = Math.max(0, p1.hp);
    p2.hp = Math.max(0, p2.hp);

    // Clear one-time buffs after round
    const oneTimeBuff = ["shield", "double_damage", "half_damage", "spy", "extra_time", "time_cut", "lock_random", "reveal"];
    p1.buffs = p1.buffs.filter(b => !oneTimeBuff.includes(b));
    p2.buffs = p2.buffs.filter(b => !oneTimeBuff.includes(b));

    // Save round to DB
    try {
      await prisma.gameRound.create({
        data: {
          sessionId: state.sessionId,
          roundNumber: state.currentRound,
          player1Move: p1.move,
          player2Move: p2.move,
          result,
          damageToPl1,
          damageToPl2,
        },
      });
    } catch (e) { console.error("Failed to save round:", e.message); }

    io.to(roomCode).emit("game:round_result", {
      round: state.currentRound,
      p1Move: p1.move,
      p2Move: p2.move,
      result,
      damageToPl1,
      damageToPl2,
      p1HP: p1.hp,
      p2HP: p2.hp,
    });

    // Check game over
    if (p1.hp <= 0 || p2.hp <= 0) {
      await endGame(io, roomCode, state, p1.hp <= 0 ? p2.id : p1.id);
      return;
    }

    // Check trivia (every 3 rounds)
    if (state.currentRound % 3 === 0) {
      state.phase = "trivia";
      state.pendingTrivia = true;
      p1.triviaAnswer = null;
      p2.triviaAnswer = null;
      const trivia = await fetchTrivia();
      state.triviaData = trivia;

      // Save trivia event
      try {
        await prisma.triviaEvent.create({
          data: {
            sessionId: state.sessionId,
            afterRound: state.currentRound,
            question: trivia.question,
            options: JSON.stringify(trivia.options),
            correctAnswer: trivia.correct,
          },
        });
      } catch (e) { console.error("Failed to save trivia:", e.message); }

      setTimeout(() => {
        io.to(roomCode).emit("game:trivia_start", {
          question: trivia.question,
          options: trivia.options,
          timeLimit: 15,
          afterRound: state.currentRound,
        });
      }, 2000);

      // Auto-resolve trivia after 15s if not both answered
      setTimeout(async () => {
        if (state.phase !== "trivia") return;
        const moves = ["ROCK","PAPER","SCISSORS"];
        if (p1.triviaAnswer === null) p1.triviaAnswer = "TIMEOUT";
        if (p2.triviaAnswer === null) p2.triviaAnswer = "TIMEOUT";
        io.to(roomCode).emit("game:trivia_resolved", {
          p1: { correct: false, effect: "hp_drain" },
          p2: { correct: false, effect: "hp_drain" },
          p1HP: p1.hp, p2HP: p2.hp,
          timeout: true,
        });
        state.triviaData = null;
        p1.triviaAnswer = null;
        p2.triviaAnswer = null;
        setTimeout(() => startRound(io, roomCode, state), 3000);
      }, 17000);
    } else {
      // Continue to next round
      setTimeout(() => startRound(io, roomCode, state), 2500);
    }
  }

  async function endGame(io, roomCode, state, winnerId) {
    state.phase = "result";
    state.status = "finished";

    const p1Won = winnerId === state.players.p1.id;
    let p1Delta = 0, p2Delta = 0;

    if (state.mode === "RANKED") {
      p1Delta = p1Won ? 1 : -1;
      p2Delta = p1Won ? -1 : 1;
      await prisma.user.update({ where: { id: state.players.p1.id }, data: { rankedPoints: { increment: p1Delta }, wins: p1Won ? { increment: 1 } : undefined, losses: !p1Won ? { increment: 1 } : undefined } }).catch(console.error);
      await prisma.user.update({ where: { id: state.players.p2.id }, data: { rankedPoints: { increment: p2Delta }, wins: !p1Won ? { increment: 1 } : undefined, losses: p1Won ? { increment: 1 } : undefined } }).catch(console.error);
    }

    await prisma.gameSession.update({
      where: { id: state.sessionId },
      data: { status: "FINISHED", winnerId, player1PointsDelta: p1Delta, player2PointsDelta: p2Delta },
    }).catch(console.error);

    io.to(roomCode).emit("game:over", {
      winnerId,
      winnerName: p1Won ? state.players.p1.username : state.players.p2.username,
      p1HP: state.players.p1.hp,
      p2HP: state.players.p2.hp,
      p1Delta,
      p2Delta,
      totalRounds: state.currentRound,
    });

    // Cleanup after 1 minute
    setTimeout(() => gameRooms.delete(roomCode), 60000);
  }

  function sanitizeState(state) {
    return {
      roomCode: state.roomCode,
      mode: state.mode,
      status: state.status,
      phase: state.phase,
      currentRound: state.currentRound,
      p1: { id: state.players.p1?.id, username: state.players.p1?.username, hp: state.players.p1?.hp, buffs: state.players.p1?.buffs },
      p2: state.players.p2 ? { id: state.players.p2.id, username: state.players.p2.username, hp: state.players.p2.hp, buffs: state.players.p2.buffs } : null,
    };
  }

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 JANKEN server berjalan di http://localhost:${PORT}`);
    console.log(`📡 Socket.io aktif di /api/socket\n`);
  });
});
