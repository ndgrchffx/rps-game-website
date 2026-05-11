# JANKEN - RPS Battle Arena 🥊

Game Rock Paper Scissors multiplayer realtime dengan sistem HP, Trivia, Ranked Match, dan Web Push Notification.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React 18
- **Backend**: Node.js custom server + Socket.io (realtime)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Push Notification**: Web Push API (web-push)

## Fitur Platform-Specific

### Web
- 🔔 **Web Push Notification** – Challenge dari leaderboard dikirim via push notif bahkan saat tab tertutup
- 🖱️ **Drag & Drop Avatar** – Upload foto profil dengan drag & drop file

## Mekanisme Game

### Alur Permainan
1. Pilih **Ranked Match** (poin +/-1) atau **Casual Room** (buat/join kode)
2. Setiap ronde: pilih **Batu/Kertas/Gunting** dalam **5 detik**
3. Menang ronde → lawan kehilangan **20 HP** (default)
4. Kalah HP → game selesai

### Trivia System (setiap 3 ronde)
- Pertanyaan pilihan ganda muncul
- **Benar** → Buff random: Shield, Spy, Extra Time, Double Damage, Heal
- **Salah** → Debuff random: Time Cut, HP Drain, Move Lock, Weakened, Exposed

### Buff & Debuff Details

| Buff | Efek |
|------|------|
| 🛡️ Shield | Blok damage 1 ronde |
| 👁️ Spy | Lihat 1 pilihan yang TIDAK dipilih lawan |
| ⏱️ Extra Time | +3 detik waktu pilih |
| ⚔️ Double Damage | Damage 2x ronde ini |
| 💚 Heal | Pulihkan 15 HP |

| Debuff | Efek |
|--------|------|
| ⏳ Time Cut | Waktu pilih -2 detik |
| 💀 HP Drain | Langsung -10 HP |
| 🔒 Move Lock | 1 pilihan di-lock random |
| 🪶 Weakened | Damage 0.5x ronde ini |
| 🔍 Exposed | Pilihanmu terlihat lawan |

### Ranked System
- Setiap menang: **+1 poin ranked**
- Setiap kalah: **-1 poin ranked**
- Starting points: **1000**
- Challenge pemain online dari leaderboard + Web Push Notification

## Setup & Instalasi

### 1. Prasyarat
- Node.js >= 18
- PostgreSQL (local atau cloud seperti Supabase/Neon)

### 2. Instalasi
```bash
npm install
```

### 3. Environment Variables
Salin `.env.example` menjadi `.env` dan isi:
```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/janken_db"
JWT_SECRET="random-secret-string"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Untuk VAPID keys (Web Push), generate dengan:
```bash
npx web-push generate-vapid-keys
```

### 4. Database
```bash
npm run db:generate   # generate Prisma client
npm run db:push       # push schema ke database
npm run db:seed       # (opsional) isi data awal
```

### 5. Jalankan
```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## Struktur Folder

```
src/
├── app/
│   ├── api/
│   │   ├── auth/login, register, logout
│   │   ├── leaderboard/
│   │   ├── profile/
│   │   └── push/vapid/
│   ├── lobby/          ← Halaman utama, buat/join room
│   ├── waiting/        ← Tunggu lawan
│   ├── game/           ← Arena permainan
│   ├── leaderboard/    ← Ranking + Challenge
│   └── profile/        ← Profil + Drag&Drop + Push
├── lib/
│   ├── auth.js         ← JWT helpers
│   ├── prisma.js       ← Prisma client
│   └── socket.js       ← Socket.io client
server.js               ← Custom server + Game Engine
public/
└── sw.js               ← Service Worker (Web Push)
prisma/
└── schema.prisma       ← Database schema
```

## Arsitektur Sistem

```
[Web Client] ←─── WebSocket ───→ [Node.js + Socket.io]
[Mobile]     ←─── REST API  ───→ [Next.js API Routes ]
                                         │
                                   [PostgreSQL via Prisma]
                                         │
                                   [Open Trivia DB API]
                                         │
                                   [Web Push (VAPID)]
```
