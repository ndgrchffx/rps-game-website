import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user)
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });

    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    const res = NextResponse.json({
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
    });
    res.cookies.set("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60, path: "/" });
    return res;
  } catch (e) {
    console.error("[LOGIN ERROR]:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
