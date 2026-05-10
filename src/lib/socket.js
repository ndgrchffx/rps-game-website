// src/lib/socket.js
// Helper Socket.io Client untuk digunakan di komponen React

import { io } from "socket.io-client";

let socket;

/**
 * Inisialisasi koneksi Socket.io
 * @param {string} token - JWT token user yang login
 * @returns {Socket} instance socket
 */
export function initSocket(token) {
  if (socket && socket.connected) return socket;

  socket = io(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", {
    path: "/api/socket",
    auth: { token },       // Token dikirim saat handshake untuk autentikasi
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // ── Event listener dasar ─────────────────────────────────────────
  socket.on("connect", () => {
    console.log("[SOCKET CLIENT] Terhubung ke server:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[SOCKET CLIENT] Terputus:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("[SOCKET CLIENT] Koneksi error:", error.message);
  });

  socket.on("error", (err) => {
    console.error("[SOCKET CLIENT] Error:", err.message);
  });

  return socket;
}

/**
 * Mendapatkan instance socket yang sudah ada
 * @returns {Socket|null}
 */
export function getSocket() {
  return socket || null;
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ── Helper functions untuk emit event ───────────────────────────────

/**
 * Bergabung ke socket room
 * @param {string} roomId
 */
export function joinRoom(roomId) {
  if (!socket) return;
  socket.emit("room:join", { roomId });
}

/**
 * Meninggalkan socket room
 * @param {string} roomId
 */
export function leaveRoom(roomId) {
  if (!socket) return;
  socket.emit("room:leave", { roomId });
}

/**
 * Mengirim pesan
 * @param {string} roomId
 * @param {string} content
 */
export function sendMessage(roomId, content) {
  if (!socket) return;
  socket.emit("message:send", { roomId, content });
}

/**
 * Emit typing start
 * @param {string} roomId
 */
export function startTyping(roomId) {
  if (!socket) return;
  socket.emit("typing:start", { roomId });
}

/**
 * Emit typing stop
 * @param {string} roomId
 */
export function stopTyping(roomId) {
  if (!socket) return;
  socket.emit("typing:stop", { roomId });
}
