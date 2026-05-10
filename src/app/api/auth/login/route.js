// src/app/api/auth/login/route.js
// Endpoint: POST /api/auth/login
// Fungsi: Login user dan kembalikan token JWT

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // ── 1. Validasi input ──────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    // ── 2. Cari user berdasarkan email ─────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Email atau password salah." },
        { status: 401 }
      );
    }

    // ── 3. Cocokkan password ───────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Email atau password salah." },
        { status: 401 }
      );
    }

    // ── 4. Update status online dan lastSeen ───────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeen: new Date(),
      },
    });

    // ── 5. Generate JWT token ──────────────────────────────────────
    const token = generateToken({ id: user.id, username: user.username });

    // ── 6. Return response (tanpa password) ────────────────────────
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        success: true,
        message: "Login berhasil!",
        data: {
          user: { ...userWithoutPassword, isOnline: true },
          token,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[LOGIN ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
