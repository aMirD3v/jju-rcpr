import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function key() {
  const encoded = process.env.MFA_ENCRYPTION_KEY ?? "";
  const value = Buffer.from(encoded, "base64");
  if (value.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must decode to 32 bytes.");
  return value;
}
export function newTotpSecret() {
  const bytes = randomBytes(20); let bits = 0; let buffer = 0; let result = "";
  for (const byte of bytes) { buffer = (buffer << 8) | byte; bits += 8; while (bits >= 5) { result += alphabet[(buffer >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) result += alphabet[(buffer << (5 - bits)) & 31];
  return result;
}
function decodeBase32(value: string) {
  let bits = 0; let buffer = 0; const output: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/, "")) { const index = alphabet.indexOf(character); if (index < 0) throw new Error("Invalid TOTP secret."); buffer = (buffer << 5) | index; bits += 5; if (bits >= 8) { output.push((buffer >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(output);
}
export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}
function decryptTotpSecret(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
export function verifyTotp(encryptedSecret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = decodeBase32(decryptTotpSecret(encryptedSecret)); const now = Math.floor(Date.now() / 30000);
  for (let step = now - 1; step <= now + 1; step++) {
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step)); const digest = createHmac("sha1", secret).update(counter).digest(); const offset = digest[digest.length - 1] & 15;
    const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) | ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
    const expected = String(binary % 1_000_000).padStart(6, "0");
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}
export function makeRecoveryCodes() { return Array.from({ length: 10 }, () => randomBytes(6).toString("hex").toUpperCase()); }
export function hashRecoveryCode(code: string) { return createHash("sha256").update(code.replace(/[-\s]/g, "").toUpperCase()).digest("hex"); }
export async function consumeRecoveryCode(userId: string, code: string) {
  if (!/^[a-f0-9]{12}$/i.test(code.replace(/[-\s]/g, ""))) return false;
  const changed = await prisma.mfaRecoveryCode.updateMany({ where: { userId, tokenHash: hashRecoveryCode(code), usedAt: null }, data: { usedAt: new Date() } });
  return changed.count === 1;
}
