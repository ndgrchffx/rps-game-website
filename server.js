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

webpush.setVapidDetails(
  "mailto:janken@game.com",
  process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  process.env.VAPID_PRIVATE_KEY || "UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls"
);

const gameRooms = new Map();
const userSockets = new Map(); // userId -> socketId
const rankedQueue = [];        // [{ userId, username, socketId }]

function createGameState(sessionId, roomCode, mode, player1) {
  return {
    sessionId, roomCode, mode,
    status: "waiting",
    players: {
      p1: { ...player1, hp: 100, buffs: [], move: null, triviaAnswer: null },
      p2: null,
    },
    currentRound: 0,
    phase: "waiting",
    roundTimer: null,
    triviaData: null,
  };
}

const BUFFS = [
  { id: "shield",        name: "🛡️ Shield",       desc: "Blok damage 1 ronde ini",              type: "buff" },
  { id: "spy",           name: "👁️ Spy",           desc: "Lihat 1 pilihan yang TIDAK dipilih lawan", type: "buff" },
  { id: "extra_time",    name: "⏱️ Extra Time",    desc: "+3 detik waktu pilih",                 type: "buff" },
  { id: "double_damage", name: "⚔️ Double Damage", desc: "Damage 2x ronde ini",                 type: "buff" },
  { id: "heal",          name: "💚 Heal",           desc: "Pulihkan 15 HP",                       type: "buff" },
];

const DEBUFFS = [
  { id: "time_cut",    name: "⏳ Time Cut",  desc: "Waktu pilih berkurang 2 detik",      type: "debuff" },
  { id: "hp_drain",    name: "💀 HP Drain",  desc: "Kehilangan 10 HP langsung",          type: "debuff" },
  { id: "lock_random", name: "🔒 Move Lock", desc: "1 pilihan di-lock secara random",    type: "debuff" },
  { id: "half_damage", name: "🪶 Weakened",  desc: "Damage 0.5x ronde ini",              type: "debuff" },
  { id: "reveal",      name: "🔍 Exposed",   desc: "Pilihanmu terlihat lawan ronde ini", type: "debuff" },
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
    return { question: decodeURIComponent(q.question), options, correct, category: decodeURIComponent(q.category) };
  } catch {
    const fallback = [
      { question: "Ibukota Indonesia adalah?", options: ["Surabaya","Bandung","Jakarta","Medan"], correct: "Jakarta" },
      { question: "2 + 2 = ?", options: ["3","4","5","6"], correct: "4" },
      { question: "Planet terbesar di tata surya?", options: ["Bumi","Mars","Jupiter","Saturnus"], correct: "Jupiter" },
      { question: "Siapa penemu telepon?", options: ["Edison","Newton","Graham Bell","Tesla"], correct: "Graham Bell" },
      { question: "Bahasa pemrograman apa yang dipakai Next.js?", options: ["Python","Java","JavaScript","Ruby"], correct: "JavaScript" },
    ];
    return pickRandom(fallback);
  }
}

// FIX: Damage hanya dari buffs aktif (bukan heal/hp_drain yang sudah di-apply langsung)
function calcDamage(attackerBuffs = [], defenderBuffs = []) {
  let base = 20;
  let multiplier = 1;
  if (attackerBuffs.includes("double_damage")) multiplier *= 2;
  if (defenderBuffs.includes("half_damage")) multiplier *= 0.5;
  return Math.floor(base * multiplier);
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

function sanitizeState(state) {
  return {
    roomCode: state.roomCode,
    mode: state.mode,
    status: state.status,
    phase: state.phase,
    currentRound: state.currentRound,
    p1: {
      id: state.players.p1?.id,
      username: state.players.p1?.username,
      hp: state.players.p1?.hp,
      // FIX: hanya kirim buffs yang relevan untuk round (bukan heal/hp_drain)
      buffs: (state.players.p1?.buffs || []).filter(b => !["heal","hp_drain"].includes(b)),
    },
    p2: state.players.p2 ? {
      id: state.players.p2.id,
      username: state.players.p2.username,
      hp: state.players.p2.hp,
      buffs: (state.players.p2.buffs || []).filter(b => !["heal","hp_drain"].includes(b)),
    } : null,
  };
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
    pingTimeout: 60000,
    pingInterval: 25000,
  });

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

    // FIX: Jika user reconnect dengan socket baru, update map
    const prevSocketId = userSockets.get(userId);
    if (prevSocketId && prevSocketId !== socket.id) {
      console.log(`[SOCKET] ${username} reconnected, ganti socket ${prevSocketId} -> ${socket.id}`);
      // Update semua room yang melibatkan user ini
      for (const [roomCode, state] of gameRooms.entries()) {
        if (state.players.p1?.id === userId || state.players.p2?.id === userId) {
          // Auto-rejoin room
          socket.join(roomCode);
          socket.emit("game:reconnected", { roomCode, state: sanitizeState(state) });
          console.log(`[SOCKET] ${username} auto-rejoin room ${roomCode}`);
        }
      }
    }
    userSockets.set(userId, socket.id);
    console.log(`[SOCKET] ${username} connected (${socket.id})`);

    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() },
    }).catch(console.error);

    socket.broadcast.emit("user:online", { userId, username });

    // ── Create Room ──────────────────────────────────────────
    socket.on("game:create_room", async ({ mode }) => {
      if (mode === "RANKED") {
        // FIX: Cek apakah user sudah di dalam game aktif
        for (const [, state] of gameRooms.entries()) {
          if (
            (state.players.p1?.id === userId || state.players.p2?.id === userId) &&
            state.status !== "finished"
          ) {
            socket.emit("error", { message: "Kamu masih dalam game yang berjalan." });
            return;
          }
        }

        const alreadyQueued = rankedQueue.find(p => p.userId === userId);
        if (alreadyQueued) {
          // Update socketId jika reconnect
          alreadyQueued.socketId = socket.id;
          socket.emit("game:queued", { position: rankedQueue.indexOf(alreadyQueued) + 1 });
          return;
        }

        // FIX: Cari lawan yang bukan diri sendiri dan socketnya masih aktif
        const opponentIdx = rankedQueue.findIndex(p => {
          if (p.userId === userId) return false;
          const opSock = io.sockets.sockets.get(p.socketId);
          return !!opSock; // pastikan socket masih connected
        });

        if (opponentIdx !== -1) {
          const opponent = rankedQueue[opponentIdx];
          rankedQueue.splice(opponentIdx, 1);

          const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          try {
            const session = await prisma.gameSession.create({
              data: { roomCode, mode: "RANKED", player1Id: opponent.userId, player2Id: userId, status: "IN_PROGRESS" },
            });
            const state = createGameState(session.id, roomCode, "RANKED", { id: opponent.userId, username: opponent.username });
            state.players.p2 = { id: userId, username, hp: 100, buffs: [], move: null, triviaAnswer: null };
            state.status = "in_progress";
            gameRooms.set(roomCode, state);

            const opponentSock = io.sockets.sockets.get(opponent.socketId);
            if (opponentSock) opponentSock.join(roomCode);
            socket.join(roomCode);

            const sanitized = sanitizeState(state);
            io.to(roomCode).emit("game:ranked_match_found", {
              roomCode, sessionId: session.id, state: sanitized,
            });
            console.log(`[RANKED] Match found: ${opponent.username} vs ${username}, room=${roomCode}`);
            setTimeout(() => startRound(io, roomCode, state), 3000);
          } catch (e) {
            console.error("Ranked match error:", e);
            // Kembalikan opponent ke queue
            rankedQueue.push(opponent);
            socket.emit("error", { message: "Gagal membuat ranked game." });
          }
        } else {
          rankedQueue.push({ userId, username, socketId: socket.id });
          socket.emit("game:queued", { position: rankedQueue.length });
          console.log(`[QUEUE] ${username} masuk queue, total: ${rankedQueue.length}`);
        }
        return;
      }

      // FIX: Cek juga untuk CASUAL
      for (const [, state] of gameRooms.entries()) {
        if (
          (state.players.p1?.id === userId || state.players.p2?.id === userId) &&
          state.status !== "finished"
        ) {
          socket.emit("error", { message: "Kamu masih dalam game yang berjalan." });
          return;
        }
      }

      // CASUAL
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        const session = await prisma.gameSession.create({
          data: { roomCode, mode: "CASUAL", player1Id: userId, status: "WAITING" },
        });
        const state = createGameState(session.id, roomCode, "CASUAL", { id: userId, username });
        gameRooms.set(roomCode, state);
        socket.join(roomCode);
        socket.emit("game:room_created", { roomCode, sessionId: session.id, state: sanitizeState(state) });
        console.log(`[CASUAL] Room ${roomCode} dibuat oleh ${username}`);
      } catch (e) {
        console.error("Create room error:", e);
        socket.emit("error", { message: "Gagal membuat room." });
      }
    });

    // ── Cancel Queue ─────────────────────────────────────────
    socket.on("game:cancel_queue", () => {
      const idx = rankedQueue.findIndex(p => p.userId === userId);
      if (idx !== -1) { rankedQueue.splice(idx, 1); console.log(`[QUEUE] ${username} keluar dari queue`); }
    });

    // ── Join Room ────────────────────────────────────────────
    socket.on("game:join_room", async ({ roomCode }) => {
      const code = roomCode.toUpperCase();
      const state = gameRooms.get(code);
      if (!state) { socket.emit("error", { message: "Room tidak ditemukan." }); return; }
      if (state.status === "finished") { socket.emit("error", { message: "Game sudah selesai." }); return; }
      if (state.players.p2) { socket.emit("error", { message: "Room sudah penuh." }); return; }
      if (state.players.p1.id === userId) { socket.emit("error", { message: "Kamu sudah di room ini." }); return; }

      state.players.p2 = { id: userId, username, hp: 100, buffs: [], move: null, triviaAnswer: null };
      state.status = "in_progress";

      await prisma.gameSession.update({
        where: { roomCode: code },
        data: { player2Id: userId, status: "IN_PROGRESS" },
      }).catch(console.error);

      socket.join(code);
      const sanitized = sanitizeState(state);
      // Kirim ke P2 (yang join)
      socket.emit("game:joined", { roomCode: code, sessionId: state.sessionId, state: sanitized });
      // Kirim ke semua di room (P1 yang menunggu juga dapat info)
      io.to(code).emit("game:player_joined", { player2: { id: userId, username }, state: sanitized });

      console.log(`[CASUAL] ${username} join room ${code}`);
      setTimeout(() => startRound(io, code, state), 2000);
    });

    // ── Player Move ──────────────────────────────────────────
    socket.on("game:move", async ({ roomCode, move }) => {
      const state = gameRooms.get(roomCode);
      if (!state || state.phase !== "picking") return;
      if (!["ROCK","PAPER","SCISSORS"].includes(move)) return;

      const isP1 = state.players.p1.id === userId;
      const isP2 = state.players.p2?.id === userId;
      if (!isP1 && !isP2) return;

      const player = isP1 ? state.players.p1 : state.players.p2;
      const opponent = isP1 ? state.players.p2 : state.players.p1;

      // FIX: Jika ada lock_random, move sudah di-set saat startRound — abaikan input
      if (player.move !== null) return;

      player.move = move;

      const opponentSocketId = userSockets.get(opponent?.id);
      const opponentSock = opponentSocketId ? io.sockets.sockets.get(opponentSocketId) : null;

      // EXPOSED debuff: move player ini terlihat lawan
      if (player.buffs.includes("reveal") && opponentSock) {
        opponentSock.emit("game:opponent_exposed", { move });
      }

      // SPY: player ini punya spy dan lawan sudah pick → reveal sekarang
      if (player.buffs.includes("spy") && opponent?.move) {
        const notPicked = ["ROCK","PAPER","SCISSORS"].filter(m => m !== opponent.move);
        socket.emit("game:spy_reveal", { notPickedMove: pickRandom(notPicked) });
      }

      // SPY: lawan punya spy, player ini baru pick → beri tahu lawan sekarang
      if (opponent?.buffs.includes("spy") && opponentSock) {
        const notPicked = ["ROCK","PAPER","SCISSORS"].filter(m => m !== move);
        opponentSock.emit("game:spy_reveal", { notPickedMove: pickRandom(notPicked) });
      }

      socket.to(roomCode).emit("game:opponent_picked", { playerId: userId });

      if (state.players.p1.move && state.players.p2?.move) {
        if (state.roundTimer) { clearTimeout(state.roundTimer); state.roundTimer = null; }
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
      if (player.triviaAnswer !== null) return;

      player.triviaAnswer = answer;
      const correct = answer === state.triviaData.correct;

      socket.emit("game:trivia_self_answered", { correct, answer, correctAnswer: state.triviaData.correct });

      // FIX: Pisahkan efek instant (heal/hp_drain) dari buffs round berikutnya
      const effect = correct ? pickRandom(BUFFS) : pickRandom(DEBUFFS);
      let hpChange = 0;

      if (effect.id === "heal") {
        hpChange = Math.min(100, player.hp + 15) - player.hp;
        player.hp = Math.min(100, player.hp + 15);
        // Tidak masuk buffs array — efek langsung
      } else if (effect.id === "hp_drain") {
        hpChange = Math.max(0, player.hp - 10) - player.hp; // negatif
        player.hp = Math.max(0, player.hp - 10);
        // Tidak masuk buffs array — efek langsung
      } else {
        // Buff/debuff round: masuk array, akan di-clear setelah resolveRoundLogic
        // FIX: Jangan stack buff yang sama (kecuali multi buff dari trivia berbeda)
        if (!player.buffs.includes(effect.id)) {
          player.buffs.push(effect.id);
        }
      }

      socket.emit("game:effect_received", { effect, hp: player.hp, hpChange });

      // Simpan ke DB
      const field = isP1
        ? { player1Answer: answer, player1Correct: correct, player1Effect: JSON.stringify(effect) }
        : { player2Answer: answer, player2Correct: correct, player2Effect: JSON.stringify(effect) };

      await prisma.triviaEvent.updateMany({
        where: { sessionId: state.sessionId, afterRound: state.currentRound },
        data: field,
      }).catch(console.error);

      // Cek apakah kedua player sudah menjawab
      if (state.players.p1.triviaAnswer !== null && state.players.p2?.triviaAnswer !== null) {
        // FIX: Kirim hp terkini (setelah heal/drain) ke kedua player
        io.to(roomCode).emit("game:trivia_resolved", {
          p1: {
            correct: state.players.p1.triviaAnswer === state.triviaData.correct,
            effect: state.players.p1.buffs.slice(-1)[0] || (state.players.p1.triviaAnswer === state.triviaData.correct ? "heal" : "hp_drain"),
          },
          p2: {
            correct: state.players.p2.triviaAnswer === state.triviaData.correct,
            effect: state.players.p2.buffs.slice(-1)[0] || (state.players.p2.triviaAnswer === state.triviaData.correct ? "heal" : "hp_drain"),
          },
          p1HP: state.players.p1.hp,
          p2HP: state.players.p2.hp,
        });
        state.triviaData = null;
        state.players.p1.triviaAnswer = null;
        state.players.p2.triviaAnswer = null;
        setTimeout(() => startRound(io, roomCode, state), 3000);
      }
    });

    // ── Challenge Player ─────────────────────────────────────
    socket.on("game:challenge_player", async ({ targetUserId }) => {
      const targetSocketId = userSockets.get(targetUserId);
      if (!targetSocketId) { socket.emit("error", { message: "Pemain tidak online." }); return; }

      // FIX: Cek jika target sudah dalam game
      for (const [, state] of gameRooms.entries()) {
        if (
          (state.players.p1?.id === targetUserId || state.players.p2?.id === targetUserId) &&
          state.status !== "finished"
        ) {
          socket.emit("error", { message: "Pemain sedang dalam game." });
          return;
        }
      }

      const challenger = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, rankedPoints: true },
      });

      await sendPushNotification(targetUserId, {
        title: "⚔️ Challenge Masuk!",
        body: `${challenger.username} menantangmu di JANKEN! Buka app untuk terima.`,
        data: { type: "challenge", challengerId: userId, challengerName: challenger.username, url: "/leaderboard" },
      });

      io.to(targetSocketId).emit("game:challenge_received", {
        challengerId: userId,
        challengerName: challenger.username,
        challengerPoints: challenger.rankedPoints,
      });
    });

    // ── Accept Challenge ─────────────────────────────────────
    socket.on("game:accept_challenge", async ({ challengerId }) => {
      const challengerSocketId = userSockets.get(challengerId);
      if (!challengerSocketId) { socket.emit("error", { message: "Challenger sudah offline." }); return; }

      // FIX: Cek apakah challenger masih online
      const challengerSock = io.sockets.sockets.get(challengerSocketId);
      if (!challengerSock) { socket.emit("error", { message: "Challenger sudah offline." }); return; }

      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const challenger = await prisma.user.findUnique({ where: { id: challengerId }, select: { username: true } });

      try {
        const session = await prisma.gameSession.create({
          data: { roomCode, mode: "RANKED", player1Id: challengerId, player2Id: userId, status: "IN_PROGRESS" },
        });
        const state = createGameState(session.id, roomCode, "RANKED", { id: challengerId, username: challenger.username });
        state.players.p2 = { id: userId, username, hp: 100, buffs: [], move: null, triviaAnswer: null };
        state.status = "in_progress";
        gameRooms.set(roomCode, state);

        challengerSock.join(roomCode);
        socket.join(roomCode);

        const sanitized = sanitizeState(state);
        io.to(roomCode).emit("game:challenge_accepted", { roomCode, sessionId: session.id, state: sanitized });
        console.log(`[CHALLENGE] ${challenger.username} vs ${username}, room=${roomCode}`);
        setTimeout(() => startRound(io, roomCode, state), 2000);
      } catch (e) {
        console.error("Accept challenge error:", e);
        socket.emit("error", { message: "Gagal membuat challenge game." });
      }
    });

    // ── Push Subscribe ───────────────────────────────────────
    socket.on("push:subscribe", async ({ subscription }) => {
      await prisma.user.update({
        where: { id: userId },
        data: { pushSubscription: JSON.stringify(subscription) },
      }).catch(console.error);
      socket.emit("push:subscribed", { ok: true });
    });

    // ── Disconnect ────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      console.log(`[SOCKET] ${username} disconnected: ${reason}`);

      // FIX: Hanya hapus dari map jika ini adalah socket terbaru user
      if (userSockets.get(userId) === socket.id) {
        userSockets.delete(userId);
      }

      const queueIdx = rankedQueue.findIndex(p => p.userId === userId);
      if (queueIdx !== -1) rankedQueue.splice(queueIdx, 1);

      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
      }).catch(console.error);

      socket.broadcast.emit("user:offline", { userId, username, lastSeen: new Date() });

      for (const [roomCode, state] of gameRooms.entries()) {
        if (state.players.p1?.id === userId || state.players.p2?.id === userId) {
          if (state.status !== "finished") {
            io.to(roomCode).emit("game:player_disconnected", { userId, username });
          }
        }
      }
    });
  });

  // ── Game Logic ───────────────────────────────────────────
  function startRound(io, roomCode, state) {
    // FIX: Jangan mulai ronde jika game sudah selesai atau p2 belum ada
    if (!state.players.p2 || state.status === "finished") return;

    state.currentRound++;
    state.players.p1.move = null;
    state.players.p2.move = null;
    // FIX: Reset triviaAnswer juga
    state.players.p1.triviaAnswer = null;
    state.players.p2.triviaAnswer = null;
    state.phase = "picking";

    const BASE = 5;
    // FIX: Gunakan set untuk cek buffs agar tidak double-apply
    const p1Buffs = new Set(state.players.p1.buffs);
    const p2Buffs = new Set(state.players.p2.buffs);

    let p1Timer = BASE;
    if (p1Buffs.has("extra_time")) p1Timer += 3;
    if (p1Buffs.has("time_cut")) p1Timer -= 2;
    p1Timer = Math.max(3, p1Timer);

    let p2Timer = BASE;
    if (p2Buffs.has("extra_time")) p2Timer += 3;
    if (p2Buffs.has("time_cut")) p2Timer -= 2;
    p2Timer = Math.max(3, p2Timer);

    // FIX: lock_random — set move di server sebelum kirim event
    let p1Locked = null;
    let p2Locked = null;
    if (p1Buffs.has("lock_random")) {
      p1Locked = pickRandom(["ROCK","PAPER","SCISSORS"]);
      state.players.p1.move = p1Locked;
    }
    if (p2Buffs.has("lock_random")) {
      p2Locked = pickRandom(["ROCK","PAPER","SCISSORS"]);
      state.players.p2.move = p2Locked;
    }

    const p1SocketId = userSockets.get(state.players.p1.id);
    const p2SocketId = userSockets.get(state.players.p2.id);
    const p1Sock = p1SocketId ? io.sockets.sockets.get(p1SocketId) : null;
    const p2Sock = p2SocketId ? io.sockets.sockets.get(p2SocketId) : null;

    const roundPayloadBase = {
      round: state.currentRound,
      p1HP: state.players.p1.hp,
      p2HP: state.players.p2.hp,
      p1Buffs: state.players.p1.buffs.filter(b => !["heal","hp_drain"].includes(b)),
      p2Buffs: state.players.p2.buffs.filter(b => !["heal","hp_drain"].includes(b)),
    };

    if (p1Sock) p1Sock.emit("game:round_start", { ...roundPayloadBase, timer: p1Timer, lockedMove: p1Locked });
    if (p2Sock) p2Sock.emit("game:round_start", { ...roundPayloadBase, timer: p2Timer, lockedMove: p2Locked });

    // Jika keduanya locked, langsung resolve
    if (p1Locked && p2Locked) {
      state.roundTimer = setTimeout(async () => {
        await resolveRoundLogic(io, roomCode, state);
      }, 1500);
      return;
    }

    const maxTimer = Math.max(p1Timer, p2Timer);
    state.roundTimer = setTimeout(async () => {
      if (state.phase !== "picking") return; // sudah dihandle
      if (!state.players.p1.move) state.players.p1.move = pickRandom(["ROCK","PAPER","SCISSORS"]);
      if (state.players.p2 && !state.players.p2.move) state.players.p2.move = pickRandom(["ROCK","PAPER","SCISSORS"]);
      await resolveRoundLogic(io, roomCode, state);
    }, maxTimer * 1000);
  }

  async function resolveRoundLogic(io, roomCode, state) {
    // FIX: Guard agar tidak dipanggil dua kali
    if (state.phase !== "picking") return;

    const p1 = state.players.p1;
    const p2 = state.players.p2;
    if (!p2) return;

    state.phase = "reveal";
    const result = resolveRound(p1.move, p2.move);

    let damageToPl1 = 0;
    let damageToPl2 = 0;

    if (result === "P1_WIN") {
      damageToPl2 = calcDamage(p1.buffs, p2.buffs);
      if (p2.buffs.includes("shield")) {
        damageToPl2 = 0;
      } else {
        p2.hp = Math.max(0, p2.hp - damageToPl2);
      }
    } else if (result === "P2_WIN") {
      damageToPl1 = calcDamage(p2.buffs, p1.buffs);
      if (p1.buffs.includes("shield")) {
        damageToPl1 = 0;
      } else {
        p1.hp = Math.max(0, p1.hp - damageToPl1);
      }
    }

    // FIX: Clear buffs setelah digunakan (tapi hanya buff round — bukan yang sudah di-apply instant)
    p1.buffs = [];
    p2.buffs = [];

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
          player1Buffs: JSON.stringify(p1.buffs),
          player2Buffs: JSON.stringify(p2.buffs),
        },
      });
      // Sync HP dan currentRound ke GameSession
      await prisma.gameSession.update({
        where: { id: state.sessionId },
        data: { currentRound: state.currentRound, player1HP: p1.hp, player2HP: p2.hp },
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

    console.log(`[ROUND ${state.currentRound}] ${p1.move} vs ${p2.move} = ${result} | HP: ${p1.hp} vs ${p2.hp}`);

    if (p1.hp <= 0 || p2.hp <= 0) {
      // FIX: Jika seri (keduanya 0), p1 menang
      const winnerId = p1.hp <= 0 && p2.hp <= 0
        ? p1.id
        : p1.hp <= 0 ? p2.id : p1.id;
      await endGame(io, roomCode, state, winnerId);
      return;
    }

    if (state.currentRound % 3 === 0) {
      state.phase = "trivia";
      p1.triviaAnswer = null;
      p2.triviaAnswer = null;

      const trivia = await fetchTrivia();
      state.triviaData = trivia;

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

      // Auto-resolve trivia setelah 17 detik (2 delay + 15 limit)
      setTimeout(async () => {
        if (state.phase !== "trivia" || !state.triviaData) return;

        let changed = false;
        if (p1.triviaAnswer === null) {
          p1.triviaAnswer = "TIMEOUT";
          p1.hp = Math.max(0, p1.hp - 10);
          changed = true;
        }
        if (p2.triviaAnswer === null) {
          p2.triviaAnswer = "TIMEOUT";
          p2.hp = Math.max(0, p2.hp - 10);
          changed = true;
        }

        if (!changed) return; // Sudah dihandle

        io.to(roomCode).emit("game:trivia_resolved", {
          p1: { correct: false, effect: "hp_drain" },
          p2: { correct: false, effect: "hp_drain" },
          p1HP: p1.hp,
          p2HP: p2.hp,
          timeout: true,
        });
        state.triviaData = null;
        p1.triviaAnswer = null;
        p2.triviaAnswer = null;
        setTimeout(() => startRound(io, roomCode, state), 3000);
      }, 17000);
    } else {
      setTimeout(() => startRound(io, roomCode, state), 2500);
    }
  }

  async function endGame(io, roomCode, state, winnerId) {
    if (state.status === "finished") return; // Guard double-call
    state.phase = "result";
    state.status = "finished";

    const p1Won = winnerId === state.players.p1.id;
    let p1Delta = 0, p2Delta = 0;

    if (state.mode === "RANKED") {
      p1Delta = p1Won ? 1 : -1;
      p2Delta = p1Won ? -1 : 1;

      await prisma.user.update({
      where: { id: state.players.p1.id },
      data: {
        rankedPoints: { increment: p1Delta },
        ...(p1Won ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
      },
    }).catch(console.error);

    await prisma.user.update({
      where: { id: state.players.p2.id },
      data: {
        rankedPoints: { increment: p2Delta },
        ...(!p1Won ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
      },
    }).catch(console.error);
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

    // Bersihkan room setelah 2 menit
    setTimeout(() => gameRooms.delete(roomCode), 120000);
  }

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 JANKEN server berjalan di http://localhost:${PORT}`);
    console.log(`📡 Socket.io aktif di /api/socket\n`);
  });
});
