import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const { username, email, password } = await req.json();
    if (!username || !email || !password)
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });

    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (exists) return NextResponse.json({ error: "Email atau username sudah digunakan." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, password: hashed },
      select: { id: true, username: true, email: true, rankedPoints: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
