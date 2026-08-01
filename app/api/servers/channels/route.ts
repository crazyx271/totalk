import { and, eq } from "drizzle-orm";
import { getSessionUser } from "../../../auth";
import { getDb } from "../../../../db";
import { serverChannels, servers } from "../../../../db/schema";

const CHANNEL_KINDS = new Set(["text", "voice"]);

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { serverId?: string; name?: string; kind?: string };
  const serverId = payload.serverId?.trim() ?? "";
  const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
  const kind = payload.kind === "voice" ? "voice" : "text";
  if (!CHANNEL_KINDS.has(kind)) return Response.json({ error: "Некорректный тип канала" }, { status: 400 });
  if (name.length < 1 || name.length > 32) return Response.json({ error: "Название должно содержать 1–32 символа" }, { status: 400 });

  const db = getDb();
  // Only the owner can shape the channel list for now — there's no
  // moderator/role system yet, so this mirrors the existing "delete
  // server" restriction rather than inventing a new permission model.
  const [owned] = await db.select({ id: servers.id }).from(servers)
    .where(and(eq(servers.id, serverId), eq(servers.ownerId, user.id))).limit(1);
  if (!owned) return Response.json({ error: "Группа не найдена или вы не владелец" }, { status: 404 });

  const existing = await db.select({ position: serverChannels.position }).from(serverChannels).where(eq(serverChannels.serverId, serverId));
  const nextPosition = existing.length ? Math.max(...existing.map((row) => row.position)) + 1 : 0;

  const [channel] = await db.insert(serverChannels).values({ serverId, name, kind, position: nextPosition }).returning({
    id: serverChannels.id,
    name: serverChannels.name,
    kind: serverChannels.kind,
  });
  return Response.json({ channel }, { status: 201 });
}
