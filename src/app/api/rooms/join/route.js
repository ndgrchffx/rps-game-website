// src/app/api/rooms/join/route.js
// Endpoint: POST /api/rooms/join
// Fungsi: User bergabung ke sebuah room

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromHeader, verifyToken } from "@/lib/jwt";

async function authenticate(request) {
  const token = getTokenFromHeader(request);
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return decoded;
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { roomId } = body;

    if (!roomId) {
      return NextResponse.json(
        { success: false, message: "roomId wajib disertakan." },
        { status: 400 }
      );
    }

    // Cek room ada
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json(
        { success: false, message: "Room tidak ditemukan." },
        { status: 404 }
      );
    }

    // Cek sudah jadi member
    const existing = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: user.id, roomId } },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Anda sudah bergabung ke room ini." },
        { status: 409 }
      );
    }

    // Tambahkan sebagai member
    await prisma.roomMember.create({
      data: { userId: user.id, roomId },
    });

    // Kirim pesan sistem
    await prisma.message.create({
      data: {
        content: `${user.username} bergabung ke room.`,
        type: "SYSTEM",
        senderId: user.id,
        roomId,
      },
    });

    return NextResponse.json(
      { success: true, message: `Berhasil bergabung ke room "${room.name}".` },
      { status: 200 }
    );
  } catch (error) {
    console.error("[JOIN ROOM ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
