import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";

function randomUsername() {
  const adj = ["Brave","Swift","Bold","Wild","Calm","Cool","Fierce","Sharp"];
  const noun = ["Panda","Dragon","Tiger","Eagle","Wolf","Fox","Bear","Lion"];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj[Math.floor(Math.random()*adj.length)]}${noun[Math.floor(Math.random()*noun.length)]}${num}`;
}

export async function POST() {
  try {
    let username, attempts = 0;
    do {
      username = randomUsername();
      attempts++;
    } while (attempts < 10 && await prisma.user.findUnique({ where: { username } }));

    const email = `guest_${Date.now()}@janken.local`;
    const user = await prisma.user.create({
      data: { username, email, password: "" },
    });

    const token = generateToken({ id: user.id, username: user.username, email: user.email });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: null,
        rankedPoints: user.rankedPoints,
        wins: user.wins,
        losses: user.losses,
      },
    }, { status: 201 });
  } catch (e) {
    console.error("[GUEST ERROR]:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
