import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { friendships, users } from "../../../db/schema";
import { friendPairKey, isOnline } from "../../social";

type RawUser = {
  id: number;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  bannerColor: string | null;
  isUltra: boolean;
  createdAt: string;
  lastActiveAt: number | null;
};

type PublicUser = Omit<RawUser, "lastActiveAt"> & { isOnline: boolean };

const publicUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarPath: users.avatarPath,
  bio: users.bio,
  bannerColor: users.bannerColor,
  isUltra: users.isUltra,
  createdAt: users.createdAt,
  lastActiveAt: users.lastActiveAt,
};

function publicUser(user: RawUser): PublicUser {
  const { lastActiveAt, ...rest } = user;
  return { ...rest, isOnline: isOnline(lastActiveAt) };
}

export async function GET(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const db = getDb();
  const relations = await db.select().from(friendships).where(or(
    eq(friendships.requesterId, currentUser.id),
    eq(friendships.addresseeId, currentUser.id),
  ));
  const relatedIds = [...new Set(relations.map((relation) =>
    relation.requesterId === currentUser.id ? relation.addresseeId : relation.requesterId,
  ))];
  const relatedUsers = relatedIds.length
    ? await db.select(publicUserColumns)
      .from(users).where(inArray(users.id, relatedIds))
    : [];
  const byId = new Map(relatedUsers.map((user) => [user.id, publicUser(user)]));

  const friends = relations
    .filter((relation) => relation.status === "accepted")
    .map((relation) => byId.get(relation.requesterId === currentUser.id ? relation.addresseeId : relation.requesterId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
  const incoming = relations
    .filter((relation) => relation.status === "pending" && relation.addresseeId === currentUser.id)
    .map((relation) => ({ ...byId.get(relation.requesterId)!, requestId: relation.id }))
    .filter((user) => Boolean(user.id));
  const outgoing = relations
    .filter((relation) => relation.status === "pending" && relation.requesterId === currentUser.id)
    .map((relation) => ({ ...byId.get(relation.addresseeId)!, requestId: relation.id }))
    .filter((user) => Boolean(user.id));

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 32) ?? "";
  let results: PublicUser[] = [];
  if (query.length >= 2) {
    // SQLite's LIKE only case-folds ASCII, so match on an explicit lower()
    // (overridden to be Unicode-aware in db/index.ts) instead of relying on
    // LIKE's built-in folding — otherwise Cyrillic search misses case variants.
    const needle = `%${query.toLowerCase()}%`;
    const rows = await db.select(publicUserColumns)
      .from(users)
      .where(and(
        ne(users.id, currentUser.id),
        or(
          sql`lower(${users.username}) LIKE ${needle}`,
          sql`lower(${users.displayName}) LIKE ${needle}`,
        ),
      ))
      .limit(20);
    results = rows.map(publicUser);
  }

  return Response.json({ friends, incoming, outgoing, results });
}

export async function POST(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { action?: string; userId?: number; requestId?: number };
  const db = getDb();

  if (payload.action === "request") {
    const userId = Number(payload.userId);
    if (!Number.isInteger(userId) || userId < 1 || userId === currentUser.id) {
      return Response.json({ error: "Некорректный пользователь" }, { status: 400 });
    }
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return Response.json({ error: "Пользователь не найден" }, { status: 404 });
    const pairKey = friendPairKey(currentUser.id, userId);
    const [existing] = await db.select().from(friendships).where(eq(friendships.pairKey, pairKey)).limit(1);
    if (existing) return Response.json({ error: "Заявка или дружба уже существует" }, { status: 409 });
    await db.insert(friendships).values({
      pairKey,
      requesterId: currentUser.id,
      addresseeId: userId,
      status: "pending",
    });
    return Response.json({ ok: true }, { status: 201 });
  }

  if (payload.action === "accept") {
    const requestId = Number(payload.requestId);
    const [accepted] = await db.update(friendships).set({ status: "accepted" })
      .where(and(
        eq(friendships.id, requestId),
        eq(friendships.addresseeId, currentUser.id),
        eq(friendships.status, "pending"),
      ))
      .returning({ id: friendships.id });
    if (!accepted) return Response.json({ error: "Заявка не найдена" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (payload.action === "remove" || payload.action === "decline") {
    const userId = Number(payload.userId);
    const requestId = Number(payload.requestId);
    if (Number.isInteger(requestId) && requestId > 0) {
      await db.delete(friendships).where(and(
        eq(friendships.id, requestId),
        or(eq(friendships.requesterId, currentUser.id), eq(friendships.addresseeId, currentUser.id)),
      ));
    } else if (Number.isInteger(userId) && userId > 0) {
      await db.delete(friendships).where(eq(friendships.pairKey, friendPairKey(currentUser.id, userId)));
    } else {
      return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
