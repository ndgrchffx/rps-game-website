// src/app/api/rooms/route.js
// Endpoint: GET  /api/rooms  → ambil semua room yang diikuti user
//           POST /api/rooms  → buat room baru

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

// ============================================================
// GET /api/rooms
// Mengambil daftar room yang diikuti oleh user yang login
// ============================================================
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: { userId: user.id },
        },
      },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        _count: {
          select: { members: true, messages: true },
        },
        // Ambil pesan terakhir
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: { username: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Format response: sertakan lastMessage
    const formattedRooms = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      isPrivate: room.isPrivate,
      createdAt: room.createdAt,
      creator: room.creator,
      memberCount: room._count.members,
      messageCount: room._count.messages,
      lastMessage: room.messages[0] || null,
    }));

    return NextResponse.json(
      { success: true, data: { rooms: formattedRooms } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET ROOMS ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/rooms
// Membuat room baru dan otomatis menambahkan creator sebagai member
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
    const { name, description, isPrivate = false } = body;

    if (!name || name.trim().length < 3) {
      return NextResponse.json(
        { success: false, message: "Nama room minimal 3 karakter." },
        { status: 400 }
      );
    }

    // Cek duplikat nama room (untuk public rooms)
    if (!isPrivate) {
      const existingRoom = await prisma.room.findFirst({
        where: { name: name.trim(), isPrivate: false },
      });

      if (existingRoom) {
        return NextResponse.json(
          { success: false, message: "Nama room sudah digunakan." },
          { status: 409 }
        );
      }
    }

    // Buat room dan langsung tambahkan creator sebagai member
    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isPrivate,
        creatorId: user.id,
        members: {
          create: { userId: user.id },
        },
      },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    // Kirim pesan sistem "Room dibuat"
    await prisma.message.create({
      data: {
        content: `Room "${room.name}" telah dibuat oleh ${user.username}.`,
        type: "SYSTEM",
        senderId: user.id,
        roomId: room.id,
      },
    });

    return NextResponse.json(
      { success: true, message: "Room berhasil dibuat!", data: { room } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST ROOM ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
