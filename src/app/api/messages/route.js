// src/app/api/messages/route.js
// Endpoint: GET  /api/messages?roomId=xxx  → ambil pesan di room
//           POST /api/messages             → kirim pesan baru

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromHeader, verifyToken } from "@/lib/jwt";

// ── Helper: autentikasi dari token ──────────────────────────────────
async function authenticate(request) {
  const token = getTokenFromHeader(request);
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return decoded;
}

// ============================================================
// GET /api/messages?roomId=xxx&page=1&limit=50
// Mengambil riwayat pesan dalam sebuah room
// ============================================================
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const page   = parseInt(searchParams.get("page")  || "1");
    const limit  = parseInt(searchParams.get("limit") || "50");

    if (!roomId) {
      return NextResponse.json(
        { success: false, message: "roomId wajib disertakan." },
        { status: 400 }
      );
    }

    // Cek apakah user adalah member room
    const isMember = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: { userId: user.id, roomId },
      },
    });

    if (!isMember) {
      return NextResponse.json(
        { success: false, message: "Anda bukan anggota room ini." },
        { status: 403 }
      );
    }

    // Ambil pesan dengan pagination (terbaru dulu, lalu dibalik)
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        isDeleted: false,
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true, isOnline: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Balik urutan agar pesan terlama di atas
    const orderedMessages = messages.reverse();

    const total = await prisma.message.count({
      where: { roomId, isDeleted: false },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          messages: orderedMessages,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET MESSAGES ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/messages
// Menyimpan pesan baru ke database
// (Pengiriman realtime dilakukan oleh Socket.io server)
// ============================================================
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
    const { roomId, content, type = "TEXT" } = body;

    if (!roomId || !content) {
      return NextResponse.json(
        { success: false, message: "roomId dan content wajib diisi." },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Pesan tidak boleh kosong." },
        { status: 400 }
      );
    }

    // Cek keanggotaan room
    const isMember = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: { userId: user.id, roomId },
      },
    });

    if (!isMember) {
      return NextResponse.json(
        { success: false, message: "Anda bukan anggota room ini." },
        { status: 403 }
      );
    }

    // Simpan pesan ke database
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        type,
        senderId: user.id,
        roomId,
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: { message } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST MESSAGE ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
