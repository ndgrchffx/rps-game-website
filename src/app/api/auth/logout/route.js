// src/app/api/auth/logout/route.js
// Endpoint: POST /api/auth/logout
// Fungsi: Update status user menjadi offline

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromHeader, verifyToken } from "@/lib/jwt";

export async function POST(request) {
  try {
    const token = getTokenFromHeader(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token tidak ditemukan." },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: "Token tidak valid." },
        { status: 401 }
      );
    }

    // Update status offline dan lastSeen
    await prisma.user.update({
      where: { id: decoded.id },
      data: {
        isOnline: false,
        lastSeen: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, message: "Logout berhasil." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[LOGOUT ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
