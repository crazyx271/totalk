import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";

const SESSION_COOKIE = "totalk_session";
const SESSION_DAYS = 30;
const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(size: number) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashPassword(password: string, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(salt), iterations: 100_000 },
    key,
    256,
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < hash.length; index += 1) {
    difference |= hash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const item of cookies.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

// Behind a reverse proxy (Caddy), the request Node sees is always plain
// HTTP — the public-facing protocol lives in X-Forwarded-Proto. A cookie
// marked Secure over an actually-plain-HTTP deployment (e.g. bare-IP
// testing before a domain/TLS is set up) gets silently dropped by the
// browser, breaking every authenticated request after login.
function isSecureRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

function sessionCookieAttributes(request: Request) {
  return `Path=/; HttpOnly;${isSecureRequest(request) ? " Secure;" : ""} SameSite=Lax`;
}

export async function createSession(userId: number, request: Request) {
  const token = randomHex(32);
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await getDb().insert(sessions).values({ userId, tokenHash, expiresAt });
  return {
    token,
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${sessionCookieAttributes(request)}; Max-Age=${SESSION_DAYS * 86400}`,
  };
}

export async function getSessionUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  const [user] = await getDb()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
      bio: users.bio,
      bannerColor: users.bannerColor,
      bannerPath: users.bannerPath,
      avatarFrame: users.avatarFrame,
      isUltra: users.isUltra,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return user ?? null;
}

export async function deleteSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await getDb().delete(sessions).where(eq(sessions.tokenHash, await hashSessionToken(token)));
  }
  return `${SESSION_COOKIE}=; ${sessionCookieAttributes(request)}; Max-Age=0`;
}
