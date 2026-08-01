import { and, desc, eq, gt } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { directMessages, users } from "../../../db/schema";

export async function GET(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const after = Number(new URL(request.url).searchParams.get("after") ?? 0);
  const [latest] = await getDb().select({ id: directMessages.id }).from(directMessages)
    .where(eq(directMessages.recipientId, currentUser.id)).orderBy(desc(directMessages.id)).limit(1);
  if (!Number.isInteger(after) || after <= 0) return Response.json({ cursor: latest?.id ?? 0, items: [] });
  const items = await getDb().select({
    id: directMessages.id,
    senderId: directMessages.senderId,
    author: users.displayName,
    avatarPath: users.avatarPath,
    text: directMessages.content,
    kind: directMessages.kind,
  }).from(directMessages).innerJoin(users, eq(directMessages.senderId, users.id))
    .where(and(eq(directMessages.recipientId, currentUser.id), gt(directMessages.id, after)))
    .orderBy(desc(directMessages.id)).limit(20);
  items.reverse();
  return Response.json({ cursor: latest?.id ?? after, items });
}
