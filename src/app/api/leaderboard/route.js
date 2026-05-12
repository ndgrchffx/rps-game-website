import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, username: true, avatar: true,
        rankedPoints: true, wins: true, losses: true, isOnline: true,
      },
      orderBy: { rankedPoints: "desc" },
      take: 50,
    });
    return NextResponse.json({ users });
  } catch (e) {
    console.error("[LEADERBOARD]:", e);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
