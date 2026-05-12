import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromHeader, verifyToken } from "@/lib/jwt";

async function authenticate(request) {
  const token = getTokenFromHeader(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request) {
  try {
    const decoded = await authenticate(request);
    if (!decoded)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, username: true, email: true, avatar: true,
        rankedPoints: true, wins: true, losses: true,
        isOnline: true, lastSeen: true, createdAt: true,
      },
    });
    if (!user)
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

    return NextResponse.json({ user });
  } catch (e) {
    console.error("[PROFILE GET]:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const decoded = await authenticate(request);
    if (!decoded)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json();
    const { avatar, username } = body;

    const updateData = {};
    if (avatar !== undefined) updateData.avatar = avatar;
    if (username) {
      if (username.length < 3 || username.length > 20)
        return NextResponse.json({ error: "Username harus 3-20 karakter." }, { status: 400 });
      if (!/^[a-zA-Z0-9_]+$/.test(username))
        return NextResponse.json({ error: "Username hanya boleh huruf, angka, underscore." }, { status: 400 });

      const exists = await prisma.user.findFirst({
        where: { username, NOT: { id: decoded.id } },
      });
      if (exists)
        return NextResponse.json({ error: "Username sudah digunakan." }, { status: 409 });

      updateData.username = username;
    }

    const user = await prisma.user.update({
      where: { id: decoded.id },
      data: updateData,
      select: {
        id: true, username: true, email: true, avatar: true,
        rankedPoints: true, wins: true, losses: true,
      },
    });

    return NextResponse.json({ user });
  } catch (e) {
    console.error("[PROFILE PATCH]:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
