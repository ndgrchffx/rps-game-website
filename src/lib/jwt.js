// src/lib/jwt.js
// Helper untuk generate dan verify JWT token

import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "janken_chat_secret_247006111004";

/**
 * Generate JWT token
 * @param {object} payload - data yang disimpan di token (id, username)
 * @returns {string} token
 */
export function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

/**
 * Verify JWT token
 * @param {string} token
 * @returns {object|null} decoded payload, atau null jika invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

/**
 * Ambil token dari request header Authorization
 * @param {Request} request
 * @returns {string|null}
 */
export function getTokenFromHeader(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1];
}
