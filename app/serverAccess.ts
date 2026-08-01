import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { serverChannels, serverMembers } from "../db/schema";

export async function canAccessServerChannel(userId: number, serverId: string, channel: string, kind?: "text" | "voice") {
  const db = getDb();
  const [membership] = await db.select({ serverId: serverMembers.serverId }).from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId))).limit(1);
  if (!membership) return false;
  const predicates = [eq(serverChannels.serverId, serverId), eq(serverChannels.name, channel)];
  if (kind) predicates.push(eq(serverChannels.kind, kind));
  const [match] = await db.select({ id: serverChannels.id }).from(serverChannels).where(and(...predicates)).limit(1);
  return Boolean(match);
}
