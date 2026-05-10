import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "janken_secret_2024";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    const res = NextResponse.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, rankedPoints: user.rankedPoints, wins: user.wins, losses: user.losses },
    });
    res.cookies.set("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60, path: "/" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
