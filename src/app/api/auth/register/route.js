import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";

export async function POST(req) {
  try {
    const { username, email, password } = await req.json();
    if (!username || !email || !password)
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
    if (username.length < 3 || username.length > 20)
      return NextResponse.json({ error: "Username harus 3-20 karakter." }, { status: 400 });
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return NextResponse.json({ error: "Username hanya boleh huruf, angka, dan underscore." }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username }] },
    });
    if (exists)
      return NextResponse.json({ error: "Email atau username sudah digunakan." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email: email.toLowerCase(), password: hashed },
    });

    // Auto-login setelah register
    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        rankedPoints: user.rankedPoints,
        wins: user.wins,
        losses: user.losses,
      },
    }, { status: 201 });
  } catch (e) {
    console.error("[REGISTER ERROR]:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
