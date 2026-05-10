// src/app/api/auth/register/route.js
// Endpoint: POST /api/auth/register
// Fungsi: Mendaftarkan user baru

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // ── 1. Validasi input ──────────────────────────────────────────
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Username, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { success: false, message: "Username minimal 3 karakter." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password minimal 6 karakter." },
        { status: 400 }
      );
    }

    // ── 2. Cek apakah username/email sudah terdaftar ───────────────
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      const field = existingUser.username === username ? "Username" : "Email";
      return NextResponse.json(
        { success: false, message: `${field} sudah digunakan.` },
        { status: 409 }
      );
    }

    // ── 3. Hash password ───────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── 4. Simpan user ke database ─────────────────────────────────
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    // ── 5. Buat room "General" dan tambahkan user sebagai member ───
    // Cari atau buat room General
    let generalRoom = await prisma.room.findFirst({
      where: { name: "General" },
    });

    if (!generalRoom) {
      generalRoom = await prisma.room.create({
        data: {
          name: "General",
          description: "Ruang chat umum untuk semua pengguna",
          isPrivate: false,
          creatorId: user.id,
        },
      });
    }

    // Tambah user ke room General
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: generalRoom.id,
      },
    });

    // ── 6. Generate JWT token ──────────────────────────────────────
    const token = generateToken({ id: user.id, username: user.username });

    return NextResponse.json(
      {
        success: true,
        message: "Registrasi berhasil!",
        data: { user, token },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER ERROR]:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
