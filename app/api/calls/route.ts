import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { directCalls, users } from "../../../db/schema";
import { areFriends, friendPairKey } from "../../social";

const CALL_TTL_MS = 5 * 60_000;
// Generous on purpose: a burst of retried/unanswered calls (e.g. someone
// mashing the call button while debugging connectivity) shouldn't be able to
// push a real, completed call out of the history window.
const HISTORY_LIMIT = 100;

export async function GET(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const friendParam = new URL(request.url).searchParams.get("friend");
  if (friendParam) {
    const friendId = Number(friendParam);
    if (!Number.isInteger(friendId)) return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    const rows = await getDb().select().from(directCalls).where(and(
      or(
        and(eq(directCalls.callerId, currentUser.id), eq(directCalls.calleeId, friendId)),
        and(eq(directCalls.callerId, friendId), eq(directCalls.calleeId, currentUser.id)),
      ),
      inArray(directCalls.status, ["ended", "declined"]),
    )).orderBy(desc(directCalls.updatedAt)).limit(HISTORY_LIMIT);
    return Response.json({
      history: rows.map((call) => ({
        id: call.id,
        incoming: call.calleeId === currentUser.id,
        status: call.status as "ended" | "declined",
        missed: call.acceptedAt === null,
        durationMs: call.acceptedAt !== null ? Math.max(0, call.updatedAt - call.acceptedAt) : 0,
        createdAt: call.createdAt,
      })),
    });
  }

  const rows = await getDb().select({
    id: directCalls.id,
    callerId: directCalls.callerId,
    calleeId: directCalls.calleeId,
    room: directCalls.room,
    status: directCalls.status,
    updatedAt: directCalls.updatedAt,
  }).from(directCalls).where(and(
    or(eq(directCalls.callerId, currentUser.id), eq(directCalls.calleeId, currentUser.id)),
    // An accepted call is an ongoing conversation and must stay visible no
    // matter how long it's been running; the TTL only prunes calls that
    // rang and were never picked up. Applying it to "accepted" too used to
    // make every call vanish from this list — and get hung up client-side —
    // exactly CALL_TTL_MS after it was answered.
    or(
      and(eq(directCalls.status, "ringing"), gt(directCalls.updatedAt, Date.now() - CALL_TTL_MS)),
      eq(directCalls.status, "accepted"),
    ),
  )).orderBy(desc(directCalls.updatedAt)).limit(10);
  const otherIds = [...new Set(rows.map((call) =>
    call.callerId === currentUser.id ? call.calleeId : call.callerId,
  ))];
  const people = new Map<number, { id: number; username: string; displayName: string; avatarPath: string | null }>();
  for (const id of otherIds) {
    const [person] = await getDb().select({ id: users.id, username: users.username, displayName: users.displayName, avatarPath: users.avatarPath })
      .from(users).where(eq(users.id, id)).limit(1);
    if (person) people.set(id, person);
  }
  return Response.json({
    calls: rows.map((call) => ({
      ...call,
      incoming: call.calleeId === currentUser.id,
      person: people.get(call.callerId === currentUser.id ? call.calleeId : call.callerId),
    })),
  });
}

export async function POST(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { action?: string; friendId?: number; callId?: number };
  const db = getDb();

  if (payload.action === "start") {
    const friendId = Number(payload.friendId);
    if (!Number.isInteger(friendId) || !await areFriends(currentUser.id, friendId)) {
      return Response.json({ error: "Звонить можно только друзьям" }, { status: 403 });
    }
    const now = Date.now();
    const [existing] = await db.select().from(directCalls).where(and(
      or(
        and(eq(directCalls.callerId, currentUser.id), eq(directCalls.calleeId, friendId)),
        and(eq(directCalls.callerId, friendId), eq(directCalls.calleeId, currentUser.id)),
      ),
      or(eq(directCalls.status, "ringing"), eq(directCalls.status, "accepted")),
    )).limit(1);

    // Already talking — pressing the call button again shouldn't tear down
    // a live conversation and start a new one.
    if (existing?.status === "accepted") {
      return Response.json({ call: existing });
    }
    // The friend is already ringing us: two people calling each other at
    // the same time used to race (each "start" ended the other's ringing
    // call before it could ever be accepted), so nobody's call ever showed
    // as answered even after a real conversation. Treat this as answering
    // their call instead of starting a competing one.
    if (existing?.status === "ringing" && existing.callerId === friendId) {
      await db.update(directCalls).set({ status: "accepted", acceptedAt: now, updatedAt: now }).where(eq(directCalls.id, existing.id));
      return Response.json({ call: { ...existing, status: "accepted", acceptedAt: now } });
    }

    if (existing) {
      await db.update(directCalls).set({ status: "ended", updatedAt: now }).where(eq(directCalls.id, existing.id));
    }
    const [call] = await db.insert(directCalls).values({
      callerId: currentUser.id,
      calleeId: friendId,
      room: `dm:${friendPairKey(currentUser.id, friendId)}`,
      status: "ringing",
      createdAt: now,
      updatedAt: now,
    }).returning();
    return Response.json({ call }, { status: 201 });
  }

  const callId = Number(payload.callId);
  if (!Number.isInteger(callId)) return Response.json({ error: "Некорректный звонок" }, { status: 400 });
  const [call] = await db.select().from(directCalls).where(and(
    eq(directCalls.id, callId),
    or(eq(directCalls.callerId, currentUser.id), eq(directCalls.calleeId, currentUser.id)),
  )).limit(1);
  if (!call) return Response.json({ error: "Звонок не найден" }, { status: 404 });

  if (payload.action === "accept" && call.calleeId === currentUser.id && call.status === "ringing") {
    const acceptedAt = Date.now();
    await db.update(directCalls).set({ status: "accepted", acceptedAt, updatedAt: acceptedAt }).where(eq(directCalls.id, callId));
    return Response.json({ call: { ...call, status: "accepted", acceptedAt } });
  }
  if (payload.action === "decline" || payload.action === "end") {
    await db.update(directCalls).set({ status: payload.action === "decline" ? "declined" : "ended", updatedAt: Date.now() })
      .where(eq(directCalls.id, callId));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Действие недоступно" }, { status: 400 });
}
