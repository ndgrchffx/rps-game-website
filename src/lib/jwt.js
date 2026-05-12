import jwt from "jsonwebtoken";

// SATU JWT_SECRET untuk seluruh app (server.js + API routes)
const SECRET = process.env.JWT_SECRET || "janken_secret_2024";

export function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromHeader(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1];
}
