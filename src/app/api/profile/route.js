import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "janken_secret_2024";

function getUser(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || req.cookies.get("token")?.value;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

export async function GET(req) {
  const decoded = getUser(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, username: true, email: true, avatar: true, rankedPoints: true, wins: true, losses: true, createdAt: true },
  });
  return NextResponse.json({ user });
}

export async function PATCH(req) {
  const decoded = getUser(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const allowed = {};
  if (body.avatar) allowed.avatar = body.avatar;
  if (body.username) allowed.username = body.username;
  const user = await prisma.user.update({ where: { id: decoded.id }, data: allowed, select: { id: true, username: true, avatar: true, rankedPoints: true } });
  return NextResponse.json({ user });
}
