import { and, asc, eq } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { messages, serverChannels, serverMembers, servers, voicePeers } from "../../../db/schema";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const db = getDb();
  const memberships = await db.select({ id: servers.id, name: servers.name, ownerId: servers.ownerId })
    .from(serverMembers)
    .innerJoin(servers, eq(serverMembers.serverId, servers.id))
    .where(eq(serverMembers.userId, user.id))
    .orderBy(asc(servers.createdAt));
  const result = await Promise.all(memberships.map(async (server) => {
    const channels = await db.select({ id: serverChannels.id, name: serverChannels.name, kind: serverChannels.kind })
      .from(serverChannels).where(eq(serverChannels.serverId, server.id)).orderBy(asc(serverChannels.position));
    return { ...server, channels };
  }));
  return Response.json({ servers: result });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { name?: string };
  const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
  if (name.length < 2 || name.length > 32) return Response.json({ error: "Название должно содержать 2–32 символа" }, { status: 400 });
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(servers).values({ id, ownerId: user.id, name });
  await db.insert(serverMembers).values({ serverId: id, userId: user.id, role: "owner" });
  await db.insert(serverChannels).values([
    { serverId: id, name: "чат", kind: "text", position: 0 },
    { serverId: id, name: "Голосовой", kind: "voice", position: 1 },
  ]);
  return Response.json({ server: { id, name, ownerId: user.id, channels: [{ name: "чат", kind: "text" }, { name: "Голосовой", kind: "voice" }] } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  const db = getDb();
  const [owned] = await db.select({ id: servers.id }).from(servers).where(and(eq(servers.id, id), eq(servers.ownerId, user.id))).limit(1);
  if (!owned) return Response.json({ error: "Группа не найдена или вы не владелец" }, { status: 404 });
  await db.delete(messages).where(eq(messages.serverId, id));
  await db.delete(voicePeers).where(eq(voicePeers.serverId, id));
  await db.delete(servers).where(eq(servers.id, id));
  return Response.json({ ok: true });
}
