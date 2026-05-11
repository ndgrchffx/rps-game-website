const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const users = [
    { username: "SkyLord", email: "skylord@janken.com", password: "password123", rankedPoints: 1250, wins: 15, losses: 5 },
    { username: "MoonChild", email: "moonchild@janken.com", password: "password123", rankedPoints: 1180, wins: 12, losses: 7 },
    { username: "BattleKing", email: "battleking@janken.com", password: "password123", rankedPoints: 1120, wins: 10, losses: 8 },
    { username: "NeonPaws", email: "neonpaws@janken.com", password: "password123", rankedPoints: 1050, wins: 8, losses: 10 },
    { username: "EchoMage", email: "echomage@janken.com", password: "password123", rankedPoints: 980, wins: 6, losses: 12 },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: hashed },
    });
    console.log(`✅ User ${u.username} created`);
  }

  console.log("✨ Seeding complete!");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
