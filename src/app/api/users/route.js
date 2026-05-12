import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTokenFromHeader, verifyToken } from "@/lib/jwt";

export async function GET(request) {
  const token = getTokenFromHeader(request);
  if (!token || !verifyToken(token))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const users = await prisma.user.findMany({
      where: { isOnline: true },
      select: { id: true, username: true, avatar: true, rankedPoints: true, isOnline: true },
    });
    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
