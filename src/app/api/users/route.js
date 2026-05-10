// src/app/api/users/route.js
// Endpoint: GET /api/users → ambil daftar semua user + status online

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

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
      },
      orderBy: [
        { isOnline: "desc" },
        { username: "asc" },
      ],
    });

    return NextResponse.json(
      { success: true, data: { users } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET USERS ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
