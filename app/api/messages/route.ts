import { and, desc, eq } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { messages, users } from "../../../db/schema";
import { isSticker } from "../../stickers";

const MAX_MESSAGE_LENGTH = 2000;

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const url = new URL(request.url);
  const serverId = url.searchParams.get("server")?.trim().slice(0, 40) ?? "";
  const channel = url.searchParams.get("channel")?.trim().slice(0, 80) ?? "";
  if (!serverId || !channel) {
    return Response.json({ error: "Не указан канал" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: messages.id,
      userId: users.id,
      author: users.displayName,
      username: users.username,
      avatarPath: users.avatarPath,
      text: messages.content,
      kind: messages.kind,
      fileName: messages.fileName,
      fileMime: messages.fileMime,
      fileSize: messages.fileSize,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(and(eq(messages.serverId, serverId), eq(messages.channel, channel)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(100);

  rows.reverse();
  return Response.json({ messages: rows });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const payload = (await request.json()) as {
    serverId?: string;
    channel?: string;
    text?: string;
    kind?: string;
  };
  const serverId = payload.serverId?.trim().slice(0, 40) ?? "";
  const channel = payload.channel?.trim().slice(0, 80) ?? "";
  const text = payload.text?.trim() ?? "";
  const kind = payload.kind === "sticker" ? "sticker" : "text";
  if (!serverId || !channel || !text) {
    return Response.json({ error: "Сообщение пустое" }, { status: 400 });
  }
  if (kind === "sticker" ? !isSticker(text) : text.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: kind === "sticker" ? "Неизвестный стикер" : "Сообщение слишком длинное" }, { status: 400 });
  }

  const [message] = await getDb()
    .insert(messages)
    .values({ userId: user.id, serverId, channel, content: text, kind })
    .returning({ id: messages.id, text: messages.content, kind: messages.kind, createdAt: messages.createdAt });

  return Response.json({
    message: { ...message, userId: user.id, author: user.displayName, username: user.username, avatarPath: user.avatarPath },
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const payload = (await request.json()) as { id?: number; text?: string };
  const id = Number(payload.id);
  const text = payload.text?.trim() ?? "";
  if (!Number.isInteger(id) || id < 1 || !text || text.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "Некорректное сообщение" }, { status: 400 });
  }

  const [message] = await getDb()
    .update(messages)
    .set({ content: text })
    .where(and(eq(messages.id, id), eq(messages.userId, user.id)))
    .returning({ id: messages.id, text: messages.content });

  if (!message) return Response.json({ error: "Сообщение не найдено" }, { status: 404 });
  return Response.json({ message });
}
