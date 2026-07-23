import { env } from "cloudflare:workers";
import { getSessionUser } from "../../../auth";

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const STUN_SERVERS: IceServer = {
  urls: [
    "stun:stun.cloudflare.com:3478",
    "stun:stun.l.google.com:19302",
  ],
};

const DEFAULT_TURN_TTL_SECONDS = 3600;

function parseIceUrls(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseTtl(raw: string | undefined) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 60) return DEFAULT_TURN_TTL_SECONDS;
  return Math.min(Math.floor(value), 86_400);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function signTurnUsername(username: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
  return bytesToBase64(new Uint8Array(signature));
}

async function createTurnServer(userId: number, urls: string[]) {
  const secret = env.TURN_SECRET?.trim() ?? "";
  if (secret) {
    const ttl = parseTtl(env.TURN_TTL_SECONDS);
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiresAt}:user-${userId}`;
    return {
      urls,
      username,
      credential: await signTurnUsername(username, secret),
    } satisfies IceServer;
  }

  const username = env.TURN_USERNAME?.trim() ?? "";
  const credential = env.TURN_CREDENTIAL?.trim() ?? "";
  if (!username || !credential) return null;
  return { urls, username, credential } satisfies IceServer;
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const iceServers: IceServer[] = [STUN_SERVERS];

  const turnUrls = parseIceUrls(env.TURN_URLS);
  if (turnUrls.length > 0) {
    const turnServer = await createTurnServer(user.id, turnUrls);
    if (turnServer) iceServers.push(turnServer);
  }

  return Response.json({ iceServers, hasTurn: turnUrls.length > 0 });
}