# 🎮 Janken Chat — Realtime Chat App (UAS)

**Naila Salsabila | NPM: 247006111004**  
Program Studi Informatika, Universitas Siliwangi

---

## 📌 Deskripsi Project

Aplikasi **Realtime Chat** berbasis web menggunakan:

| Teknologi       | Fungsi                        |
|-----------------|-------------------------------|
| **Next.js**     | Frontend + API Routes         |
| **Socket.io**   | Komunikasi realtime           |
| **Prisma ORM**  | Interaksi dengan database     |
| **PostgreSQL**  | Penyimpanan data permanen     |
| **JWT**         | Autentikasi token             |
| **bcryptjs**    | Hash password                 |

---

## 🎯 Fitur yang Diimplementasikan

### Fitur Wajib (OBE)
- ✅ Registrasi pengguna baru
- ✅ Login pengguna dengan JWT
- ✅ Kirim & terima pesan secara realtime (Socket.io)
- ✅ Tampilkan pesan langsung tanpa refresh halaman
- ✅ Status online / offline pengguna

### Fitur Bonus
- ✅ Typing indicator ("sedang mengetik...")
- ✅ Riwayat pesan tersimpan di database
- ✅ Multiple room chat
- ✅ Last seen timestamp
- ✅ Pesan sistem otomatis (user bergabung, dll.)

---

## 🏗️ Arsitektur Sistem

```
Browser (React)
    │
    ├── HTTP Request (API Routes) → Next.js → Prisma → PostgreSQL
    │
    └── WebSocket (Socket.io Client) → Socket.io Server → Prisma → PostgreSQL
```

---

## 📁 Struktur Folder

```
rps-game/
├── prisma/
│   ├── schema.prisma        ← Model database (User, Room, Message)
│   └── seed.js              ← Data awal database
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── register/route.js  ← POST /api/auth/register
│   │   │   │   ├── login/route.js     ← POST /api/auth/login
│   │   │   │   └── logout/route.js    ← POST /api/auth/logout
│   │   │   ├── messages/route.js      ← GET & POST /api/messages
│   │   │   ├── rooms/
│   │   │   │   ├── route.js           ← GET & POST /api/rooms
│   │   │   │   └── join/route.js      ← POST /api/rooms/join
│   │   │   ├── users/route.js         ← GET /api/users
│   │   │   └── socket/route.js        ← Socket.io info
│   │   │
│   │   ├── login/page.js              ← Halaman login (sudah ada)
│   │   ├── lobby/page.js              ← Halaman lobby
│   │   └── ...
│   │
│   └── lib/
│       ├── prisma.js        ← Singleton Prisma client
│       ├── jwt.js           ← Helper JWT (generate, verify)
│       └── socket.js        ← Socket.io client helper
│
├── server.js                ← Custom server Node.js + Socket.io
├── package.json
└── .env                     ← Konfigurasi environment
```

---

## ⚙️ Cara Setup & Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Siapkan Environment
```bash
# Salin file contoh
cp .env.example .env

# Edit file .env dan isi DATABASE_URL dengan koneksi PostgreSQL kamu
```

Isi file `.env`:
```env
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/janken_chat"
JWT_SECRET="secret_kamu_yang_aman"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Buat Database PostgreSQL
```sql
-- Di PostgreSQL, buat database baru
CREATE DATABASE janken_chat;
```

### 4. Jalankan Migrasi Database
```bash
# Generate Prisma client
npm run db:generate

# Jalankan migrasi (buat tabel)
npm run db:migrate
# → Ketik nama migrasi: "init_chat_database"
```

### 5. Seed Data Awal (Opsional)
```bash
npm run db:seed
```
Ini akan membuat:
- User admin (admin@janken.com / admin123)
- Room "General" dan "Gaming"

### 6. Jalankan Aplikasi
```bash
# Development (gunakan custom server)
npm run dev

# Production
npm run build
npm start
```

Buka browser: **http://localhost:3000**

---

## 🔌 API Endpoints

| Method | Endpoint               | Fungsi                        | Auth |
|--------|------------------------|-------------------------------|------|
| POST   | `/api/auth/register`   | Registrasi user baru          | ❌   |
| POST   | `/api/auth/login`      | Login & dapatkan token JWT    | ❌   |
| POST   | `/api/auth/logout`     | Logout & update status offline| ✅   |
| GET    | `/api/rooms`           | Ambil semua room user         | ✅   |
| POST   | `/api/rooms`           | Buat room baru                | ✅   |
| POST   | `/api/rooms/join`      | Bergabung ke room             | ✅   |
| GET    | `/api/messages?roomId` | Ambil riwayat pesan           | ✅   |
| POST   | `/api/messages`        | Kirim pesan (via HTTP)        | ✅   |
| GET    | `/api/users`           | Daftar user & status online   | ✅   |

✅ = Butuh Authorization header: `Bearer <token>`

---

## 📡 Socket.io Events

### Client → Server (emit)
| Event           | Data                        | Keterangan                  |
|-----------------|-----------------------------|-----------------------------|
| `room:join`     | `{ roomId }`                | Bergabung ke socket room    |
| `room:leave`    | `{ roomId }`                | Keluar dari socket room     |
| `message:send`  | `{ roomId, content }`       | Kirim pesan                 |
| `typing:start`  | `{ roomId }`                | Mulai mengetik              |
| `typing:stop`   | `{ roomId }`                | Berhenti mengetik           |

### Server → Client (on/listen)
| Event              | Data                              | Keterangan                  |
|--------------------|-----------------------------------|-----------------------------|
| `message:new`      | `{ id, content, sender, roomId }` | Pesan baru masuk            |
| `user:online`      | `{ userId, username }`            | User online                 |
| `user:offline`     | `{ userId, username, lastSeen }`  | User offline                |
| `typing:started`   | `{ userId, username, roomId }`    | User sedang mengetik        |
| `typing:stopped`   | `{ userId, username, roomId }`    | User berhenti mengetik      |
| `room:user_joined` | `{ userId, username, roomId }`    | User bergabung ke room      |
| `room:user_left`   | `{ userId, username, roomId }`    | User keluar dari room       |

---

## 🗄️ Model Database

```
User
 ├── id, username, email, password (hashed)
 ├── isOnline, lastSeen, avatar
 ├── sentMessages → [Message]
 └── rooms → [RoomMember]

Room
 ├── id, name, description, isPrivate
 ├── creatorId → User
 ├── members → [RoomMember]
 └── messages → [Message]

RoomMember (junction User ↔ Room)
 ├── userId → User
 └── roomId → Room

Message
 ├── id, content, type (TEXT/IMAGE/SYSTEM)
 ├── senderId → User
 └── roomId → Room
```

---

## 🧪 Contoh Penggunaan API (dengan fetch)

### Register
```javascript
const res = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "naila",
    email:    "naila@example.com",
    password: "password123"
  })
});
const data = await res.json();
// data.data.token → simpan untuk request berikutnya
```

### Kirim Pesan via HTTP
```javascript
await fetch("/api/messages", {
  method: "POST",
  headers: {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({ roomId: "xxx", content: "Halo semua!" })
});
```

### Koneksi Socket.io
```javascript
import { initSocket, joinRoom, sendMessage } from "@/lib/socket";

const socket = initSocket(token);

// Join room
joinRoom("roomId");

// Kirim pesan via socket (realtime)
sendMessage("roomId", "Halo!");

// Dengarkan pesan baru
socket.on("message:new", (message) => {
  console.log("Pesan baru:", message);
});
```

---

*UAS Pemrograman Web — Universitas Siliwangi 2025/2026*
