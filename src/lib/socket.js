import { io } from "socket.io-client";

let socket = null;
let currentToken = null;

export function getSocket() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Jika token berubah (login baru / halaman refresh), buat socket baru
  if (socket && currentToken !== token) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }

  if (!socket) {
    currentToken = token;
    socket = io(process.env.NEXT_PUBLIC_APP_URL || "", {
      path: "/api/socket",
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
