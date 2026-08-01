import { and, asc, eq, gt, lt, ne } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { users, voicePeers, voiceSignals } from "../../../db/schema";
import { areFriends } from "../../social";

// Chrome (and Electron on the same engine, unless backgroundThrottling is
// disabled) clamps setInterval to ~once/minute once a page has been hidden
// or unfocused for 5 minutes. A short TTL here would read that as the peer
// leaving mid-call and tear down a perfectly healthy WebRTC connection.
const PEER_TTL_MS = 90_000;
const SIGNAL_TTL_MS = 120_000;
const SIGNAL_KINDS = new Set(["offer", "answer", "ice"]);

async function canJoinVoiceRoom(userId: number, serverId: string, channel: string) {
  if (serverId !== "dm") return true;
  const match = /^dm:(\d+):(\d+)$/.exec(channel);
  if (!match) return false;
  const firstUserId = Number(match[1]);
  const secondUserId = Number(match[2]);
  if (userId !== firstUserId && userId !== secondUserId) return false;
  return areFriends(firstUserId, secondUserId);
}

async function cleanVoiceState() {
  const now = Date.now();
  const db = getDb();
  await db.delete(voicePeers).where(lt(voicePeers.updatedAt, now - PEER_TTL_MS));
  await db.delete(voiceSignals).where(lt(voiceSignals.createdAt, now - SIGNAL_TTL_MS));
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const url = new URL(request.url);
  const peerId = url.searchParams.get("peer")?.slice(0, 80) ?? "";
  const serverId = url.searchParams.get("server")?.slice(0, 40) ?? "";
  const channel = url.searchParams.get("channel")?.slice(0, 80) ?? "";
  const after = Number(url.searchParams.get("after") ?? 0);
  if (!peerId || !serverId || !channel || !Number.isFinite(after)) {
    return Response.json({ error: "Некорректная голосовая комната" }, { status: 400 });
  }

  if (!await canJoinVoiceRoom(user.id, serverId, channel)) {
    return Response.json({ error: "Голосовая комната недоступна" }, { status: 403 });
  }

  await cleanVoiceState();
  const db = getDb();
  const peers = await db
    .select({
      peerId: voicePeers.peerId,
      userId: users.id,
      displayName: users.displayName,
      username: users.username,
      avatarPath: users.avatarPath,
    })
    .from(voicePeers)
    .innerJoin(users, eq(voicePeers.userId, users.id))
    .where(and(
      eq(voicePeers.serverId, serverId),
      eq(voicePeers.channel, channel),
      ne(voicePeers.peerId, peerId),
      gt(voicePeers.updatedAt, Date.now() - PEER_TTL_MS),
    ));
  const signals = await db
    .select()
    .from(voiceSignals)
    .where(and(eq(voiceSignals.targetPeerId, peerId), gt(voiceSignals.id, after)))
    .orderBy(asc(voiceSignals.id))
    .limit(200);

  return Response.json({ peers, signals });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const payload = (await request.json()) as {
    action?: string;
    peerId?: string;
    serverId?: string;
    channel?: string;
    targetPeerId?: string;
    kind?: string;
    data?: unknown;
  };
  const action = payload.action ?? "";
  const peerId = payload.peerId?.slice(0, 80) ?? "";
  const serverId = payload.serverId?.slice(0, 40) ?? "";
  const channel = payload.channel?.slice(0, 80) ?? "";
  if (!peerId || !/^[a-zA-Z0-9-]+$/.test(peerId)) {
    return Response.json({ error: "Некорректный peer" }, { status: 400 });
  }

  const db = getDb();
  if (action === "join" || action === "heartbeat") {
    if (!serverId || !channel) {
      return Response.json({ error: "Не указана комната" }, { status: 400 });
    }
    if (!await canJoinVoiceRoom(user.id, serverId, channel)) {
      return Response.json({ error: "Голосовая комната недоступна" }, { status: 403 });
    }
    await cleanVoiceState();
    await db.insert(voicePeers).values({
      userId: user.id,
      peerId,
      serverId,
      channel,
      updatedAt: Date.now(),
    }).onConflictDoUpdate({
      target: voicePeers.peerId,
      set: { userId: user.id, serverId, channel, updatedAt: Date.now() },
    });
    return Response.json({ ok: true });
  }

  if (action === "leave") {
    await db.delete(voicePeers).where(and(eq(voicePeers.peerId, peerId), eq(voicePeers.userId, user.id)));
    await db.delete(voiceSignals).where(eq(voiceSignals.targetPeerId, peerId));
    return Response.json({ ok: true });
  }

  if (action === "signal") {
    const targetPeerId = payload.targetPeerId?.slice(0, 80) ?? "";
    const kind = payload.kind ?? "";
    const encoded = JSON.stringify(payload.data ?? null);
    if (!targetPeerId || !SIGNAL_KINDS.has(kind) || encoded.length > 32_000) {
      return Response.json({ error: "Некорректный сигнал" }, { status: 400 });
    }
    const [sender] = await db.select({ id: voicePeers.id }).from(voicePeers)
      .where(and(eq(voicePeers.peerId, peerId), eq(voicePeers.userId, user.id))).limit(1);
    const [target] = await db.select({ id: voicePeers.id }).from(voicePeers)
      .where(and(eq(voicePeers.peerId, targetPeerId), eq(voicePeers.serverId, serverId), eq(voicePeers.channel, channel))).limit(1);
    if (!sender || !target) {
      return Response.json({ error: "Участник не найден" }, { status: 404 });
    }
    await db.insert(voiceSignals).values({
      senderPeerId: peerId,
      targetPeerId,
      kind,
      payload: encoded,
      createdAt: Date.now(),
    });
    return Response.json({ ok: true }, { status: 201 });
  }

  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
