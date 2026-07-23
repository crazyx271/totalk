import { and, desc, eq, or } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { directMessages, users } from "../../../db/schema";
import { areFriends } from "../../social";

const MAX_MESSAGE_LENGTH = 2000;

export async function GET(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const friendId = Number(new URL(request.url).searchParams.get("friend"));
  if (!Number.isInteger(friendId) || !await areFriends(currentUser.id, friendId)) {
    return Response.json({ error: "Личная переписка недоступна" }, { status: 403 });
  }
  const rows = await getDb()
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      recipientId: directMessages.recipientId,
      author: users.displayName,
      username: users.username,
      text: directMessages.content,
      createdAt: directMessages.createdAt,
    })
    .from(directMessages)
    .innerJoin(users, eq(directMessages.senderId, users.id))
    .where(or(
      and(eq(directMessages.senderId, currentUser.id), eq(directMessages.recipientId, friendId)),
      and(eq(directMessages.senderId, friendId), eq(directMessages.recipientId, currentUser.id)),
    ))
    .orderBy(desc(directMessages.createdAt), desc(directMessages.id))
    .limit(100);
  rows.reverse();
  return Response.json({ messages: rows });
}

export async function POST(request: Request) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { friendId?: number; text?: string };
  const friendId = Number(payload.friendId);
  const text = payload.text?.trim() ?? "";
  if (!Number.isInteger(friendId) || !text || text.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "Некорректное сообщение" }, { status: 400 });
  }
  if (!await areFriends(currentUser.id, friendId)) {
    return Response.json({ error: "Добавьте пользователя в друзья" }, { status: 403 });
  }
  const [message] = await getDb().insert(directMessages).values({
    senderId: currentUser.id,
    recipientId: friendId,
    content: text,
  }).returning({ id: directMessages.id, text: directMessages.content, createdAt: directMessages.createdAt });
  return Response.json({ message: { ...message, senderId: currentUser.id } }, { status: 201 });
}
