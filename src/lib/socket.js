import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    socket = io(process.env.NEXT_PUBLIC_APP_URL || "", {
      path: "/api/socket",
      auth: { token },
      autoConnect: false,
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
