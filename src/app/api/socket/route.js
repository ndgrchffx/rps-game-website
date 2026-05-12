// Socket.io dihandle oleh server.js (custom HTTP server).
// Route ini hanya ada untuk mencegah Next.js 404 pada path /api/socket.
// Koneksi WebSocket ditangani langsung oleh Socket.io di server.js.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Socket.io berjalan di custom server, bukan API route ini." },
    { status: 200 }
  );
}
