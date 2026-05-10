// server.js
// Custom Next.js server yang mengintegrasikan Socket.io
// PENTING: Jalankan dengan "node server.js" bukan "next dev"

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "janken_chat_secret_247006111004";

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ── Inisialisasi Socket.io ──────────────────────────────────────────
  const io = new Server(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // ── Middleware: Autentikasi JWT ─────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Token tidak ditemukan."));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch {
      next(new Error("Token tidak valid."));
    }
  });

  // ── Event Handlers ──────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const { userId, username } = socket;
    console.log(`[SOCKET] ${username} terhubung (${socket.id})`);

    // Update status online
    await prisma.user
      .update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
      })
      .catch(console.error);

    socket.broadcast.emit("user:online", { userId, username });

    // ── Join Room ─────────────────────────────────────────────────────
    socket.on("room:join", async ({ roomId }) => {
      const isMember = await prisma.roomMember
        .findUnique({
          where: { userId_roomId: { userId, roomId } },
        })
        .catch(() => null);

      if (!isMember) {
        socket.emit("error", { message: "Anda bukan anggota room ini." });
        return;
      }

      socket.join(roomId);
      socket.to(roomId).emit("room:user_joined", { userId, username, roomId });
      console.log(`[SOCKET] ${username} join room: ${roomId}`);
    });

    // ── Leave Room ────────────────────────────────────────────────────
    socket.on("room:leave", ({ roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit("room:user_left", { userId, username, roomId });
    });

    // ── Send Message ──────────────────────────────────────────────────
    socket.on("message:send", async ({ roomId, content }) => {
      if (!roomId || !content?.trim()) {
        socket.emit("error", { message: "roomId dan content wajib diisi." });
        return;
      }

      const isMember = await prisma.roomMember
        .findUnique({
          where: { userId_roomId: { userId, roomId } },
        })
        .catch(() => null);

      if (!isMember) {
        socket.emit("error", { message: "Anda bukan anggota room ini." });
        return;
      }

      try {
        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            type: "TEXT",
            senderId: userId,
            roomId,
          },
          include: {
            sender: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });

        // Broadcast ke semua user di room (termasuk pengirim)
        io.to(roomId).emit("message:new", {
          id: message.id,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
          sender: message.sender,
          roomId,
        });

        console.log(`[SOCKET] Pesan dari ${username} → room ${roomId}`);
      } catch (err) {
        console.error("[SOCKET] Gagal simpan pesan:", err);
        socket.emit("error", { message: "Gagal mengirim pesan." });
      }
    });

    // ── Typing Indicators ─────────────────────────────────────────────
    socket.on("typing:start", ({ roomId }) => {
      socket.to(roomId).emit("typing:started", { userId, username, roomId });
    });

    socket.on("typing:stop", ({ roomId }) => {
      socket.to(roomId).emit("typing:stopped", { userId, username, roomId });
    });

    // ── Disconnect ────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`[SOCKET] ${username} offline`);

      await prisma.user
        .update({
          where: { id: userId },
          data: { isOnline: false, lastSeen: new Date() },
        })
        .catch(console.error);

      socket.broadcast.emit("user:offline", {
        userId,
        username,
        lastSeen: new Date(),
      });
    });
  });

  // ── Jalankan Server ─────────────────────────────────────────────────
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📡 Socket.io aktif di /api/socket`);
    console.log(`🗄️  Database terhubung via Prisma`);
    console.log(`🔧 Mode: ${dev ? "DEVELOPMENT" : "PRODUCTION"}\n`);
  });
});
