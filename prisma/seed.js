// prisma/seed.js
// Seed data awal database (room General + user admin)

const { PrismaClient } = require("@prisma/client");
const bcrypt           = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai seeding database...");

  // ── 1. Buat user admin ─────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where:  { email: "admin@janken.com" },
    update: {},
    create: {
      username: "admin",
      email:    "admin@janken.com",
      password: hashedPassword,
    },
  });

  console.log("✅ User admin dibuat:", admin.username);

  // ── 2. Buat room General ───────────────────────────────────────────
  const generalRoom = await prisma.room.upsert({
    where:  { id: "general-room-id" },
    update: {},
    create: {
      id:          "general-room-id",
      name:        "General",
      description: "Ruang chat umum untuk semua pengguna",
      isPrivate:   false,
      creatorId:   admin.id,
    },
  });

  console.log("✅ Room General dibuat:", generalRoom.name);

  // ── 3. Tambahkan admin ke room General ────────────────────────────
  await prisma.roomMember.upsert({
    where:  { userId_roomId: { userId: admin.id, roomId: generalRoom.id } },
    update: {},
    create: { userId: admin.id, roomId: generalRoom.id },
  });

  // ── 4. Pesan sambutan di room General ────────────────────────────
  await prisma.message.create({
    data: {
      content:  "Selamat datang di Janken Chat! 🎮",
      type:     "SYSTEM",
      senderId: admin.id,
      roomId:   generalRoom.id,
    },
  });

  // ── 5. Buat room Gaming ───────────────────────────────────────────
  const gamingRoom = await prisma.room.upsert({
    where:  { id: "gaming-room-id" },
    update: {},
    create: {
      id:          "gaming-room-id",
      name:        "Gaming",
      description: "Diskusi seputar game dan tips bermain",
      isPrivate:   false,
      creatorId:   admin.id,
    },
  });

  await prisma.roomMember.upsert({
    where:  { userId_roomId: { userId: admin.id, roomId: gamingRoom.id } },
    update: {},
    create: { userId: admin.id, roomId: gamingRoom.id },
  });

  console.log("✅ Room Gaming dibuat:", gamingRoom.name);
  console.log("\n🎉 Seeding selesai!");
  console.log("📧 Login: admin@janken.com | Password: admin123");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
