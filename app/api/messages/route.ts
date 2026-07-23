import { and, desc, eq } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { messages, users } from "../../../db/schema";

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
      text: messages.content,
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
  };
  const serverId = payload.serverId?.trim().slice(0, 40) ?? "";
  const channel = payload.channel?.trim().slice(0, 80) ?? "";
  const text = payload.text?.trim() ?? "";
  if (!serverId || !channel || !text) {
    return Response.json({ error: "Сообщение пустое" }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "Сообщение слишком длинное" }, { status: 400 });
  }

  const [message] = await getDb()
    .insert(messages)
    .values({ userId: user.id, serverId, channel, content: text })
    .returning({ id: messages.id, text: messages.content, createdAt: messages.createdAt });

  return Response.json({
    message: { ...message, userId: user.id, author: user.displayName, username: user.username },
  }, { status: 201 });
}
