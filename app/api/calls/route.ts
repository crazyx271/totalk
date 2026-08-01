import { and, desc, eq, gt, or } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { directCalls, users } from "../../../db/schema";
import { areFriends, friendPairKey } from "../../social";

const CALL_TTL_MS = 5 * 60_000;

export async function GET(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });
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
    await db.update(directCalls).set({ status: "ended", updatedAt: now }).where(and(
      or(
        and(eq(directCalls.callerId, currentUser.id), eq(directCalls.calleeId, friendId)),
        and(eq(directCalls.callerId, friendId), eq(directCalls.calleeId, currentUser.id)),
      ),
      or(eq(directCalls.status, "ringing"), eq(directCalls.status, "accepted")),
    ));
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
    await db.update(directCalls).set({ status: "accepted", updatedAt: Date.now() }).where(eq(directCalls.id, callId));
    return Response.json({ call: { ...call, status: "accepted" } });
  }
  if (payload.action === "decline" || payload.action === "end") {
    await db.update(directCalls).set({ status: payload.action === "decline" ? "declined" : "ended", updatedAt: Date.now() })
      .where(eq(directCalls.id, callId));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Действие недоступно" }, { status: 400 });
}
