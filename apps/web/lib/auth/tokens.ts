import { createHash, randomBytes } from "node:crypto";

export function generateOneTimeToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeLoginName(value: string) {
  return value.trim().toLowerCase();
}
