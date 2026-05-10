// src/app/api/socket/route.js
// Socket.io Server untuk Realtime Chat
// Menangani: kirim pesan, join room, online/offline status, typing indicator

import { Server } from "socket.io";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

// ── Singleton Socket.io server ───────────────────────────────────────
// Agar tidak dibuat ulang setiap hot-reload di development
let io;

function getIO(server) {
  if (!io) {
    io = new Server(server, {
      path: "/api/socket",
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // ================================================================
    // EVENT: CONNECTION
    // Dipanggil setiap ada client yang terhubung ke socket
    // ================================================================
    io.on("connection", async (socket) => {
      console.log(`[SOCKET] Client terhubung: ${socket.id}`);

      // ── Autentikasi via token yang dikirim saat connect ───────────
      const token = socket.handshake.auth?.token;
      if (!token) {
        console.log("[SOCKET] Token tidak ada, disconnect.");
        socket.disconnect(true);
        return;
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        console.log("[SOCKET] Token tidak valid, disconnect.");
        socket.disconnect(true);
        return;
      }

      const userId   = decoded.id;
      const username = decoded.username;
      socket.userId   = userId;
      socket.username = username;

      // ── Update status online di database ──────────────────────────
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
      });

      // Broadcast ke semua user bahwa user ini online
      socket.broadcast.emit("user:online", { userId, username });

      console.log(`[SOCKET] User online: ${username} (${userId})`);

      // =============================================================
      // EVENT: JOIN ROOM
      // Client bergabung ke socket room agar menerima pesan room itu
      // =============================================================
      socket.on("room:join", async ({ roomId }) => {
        // Cek apakah user adalah member room
        const isMember = await prisma.roomMember.findUnique({
          where: { userId_roomId: { userId, roomId } },
        });

        if (!isMember) {
          socket.emit("error", { message: "Anda bukan anggota room ini." });
          return;
        }

        socket.join(roomId);
        console.log(`[SOCKET] ${username} bergabung ke room: ${roomId}`);

        // Beritahu anggota lain di room
        socket.to(roomId).emit("room:user_joined", {
          userId,
          username,
          roomId,
        });
      });

      // =============================================================
      // EVENT: LEAVE ROOM
      // Client meninggalkan socket room
      // =============================================================
      socket.on("room:leave", ({ roomId }) => {
        socket.leave(roomId);
        console.log(`[SOCKET] ${username} meninggalkan room: ${roomId}`);

        socket.to(roomId).emit("room:user_left", { userId, username, roomId });
      });

      // =============================================================
      // EVENT: SEND MESSAGE
      // Client mengirim pesan → simpan ke DB → broadcast ke room
      // =============================================================
      socket.on("message:send", async ({ roomId, content }) => {
        if (!roomId || !content || content.trim().length === 0) {
          socket.emit("error", { message: "roomId dan content wajib diisi." });
          return;
        }

        // Cek keanggotaan room
        const isMember = await prisma.roomMember.findUnique({
          where: { userId_roomId: { userId, roomId } },
        });

        if (!isMember) {
          socket.emit("error", { message: "Anda bukan anggota room ini." });
          return;
        }

        try {
          // Simpan pesan ke database
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

          // Broadcast pesan ke semua user di room (termasuk pengirim)
          io.to(roomId).emit("message:new", {
            id: message.id,
            content: message.content,
            type: message.type,
            createdAt: message.createdAt,
            sender: message.sender,
            roomId,
          });

          console.log(`[SOCKET] Pesan dari ${username} di room ${roomId}`);
        } catch (err) {
          console.error("[SOCKET] Gagal menyimpan pesan:", err);
          socket.emit("error", { message: "Gagal mengirim pesan." });
        }
      });

      // =============================================================
      // EVENT: TYPING INDICATOR
      // Memberitahu user lain bahwa seseorang sedang mengetik
      // =============================================================
      socket.on("typing:start", ({ roomId }) => {
        socket.to(roomId).emit("typing:started", { userId, username, roomId });
      });

      socket.on("typing:stop", ({ roomId }) => {
        socket.to(roomId).emit("typing:stopped", { userId, username, roomId });
      });

      // =============================================================
      // EVENT: DISCONNECT
      // Dipanggil saat client terputus
      // =============================================================
      socket.on("disconnect", async () => {
        console.log(`[SOCKET] User offline: ${username}`);

        try {
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: new Date() },
          });

          // Broadcast ke semua user bahwa user ini offline
          socket.broadcast.emit("user:offline", {
            userId,
            username,
            lastSeen: new Date(),
          });
        } catch (err) {
          console.error("[SOCKET] Gagal update status offline:", err);
        }
      });
    });

    console.log("[SOCKET] Socket.io server berhasil diinisialisasi.");
  }

  return io;
}

// ── Next.js route handler ─────────────────────────────────────────────
// Route ini digunakan untuk inisialisasi Socket.io
export async function GET(request) {
  return NextResponse.json({ message: "Socket.io server aktif." });
}

export { getIO };
