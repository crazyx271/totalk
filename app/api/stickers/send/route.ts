import { eq } from "drizzle-orm";
import { getSessionUser } from "../../../auth";
import { getDb } from "../../../../db";
import { directMessages, messages, stickers } from "../../../../db/schema";
import { areFriends } from "../../../social";
import { canAccessServerChannel } from "../../../serverAccess";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const payload = await request.json() as {
    stickerId?: number;
    scope?: string;
    serverId?: string;
    channel?: string;
    friendId?: number;
  };
  const stickerId = Number(payload.stickerId);
  if (!Number.isInteger(stickerId)) return Response.json({ error: "Стикер не найден" }, { status: 400 });

  const db = getDb();
  const [sticker] = await db.select({ storedName: stickers.storedName, mime: stickers.mime }).from(stickers).where(eq(stickers.id, stickerId)).limit(1);
  if (!sticker) return Response.json({ error: "Стикер не найден" }, { status: 404 });

  const common = {
    content: "Стикер",
    kind: "sticker",
    fileName: "sticker",
    fileStoredName: sticker.storedName,
    fileMime: sticker.mime,
    fileSize: null,
  };

  if (payload.scope === "dm") {
    const friendId = Number(payload.friendId);
    if (!Number.isInteger(friendId) || !await areFriends(user.id, friendId)) {
      return Response.json({ error: "Личная переписка недоступна" }, { status: 403 });
    }
    const [message] = await db.insert(directMessages).values({ ...common, senderId: user.id, recipientId: friendId })
      .returning({ id: directMessages.id, kind: directMessages.kind, createdAt: directMessages.createdAt });
    return Response.json({ message: { ...message, senderId: user.id, author: user.displayName, username: user.username, avatarPath: user.avatarPath, avatarFrame: user.avatarFrame } }, { status: 201 });
  }

  if (payload.scope === "channel") {
    const serverId = payload.serverId?.trim().slice(0, 40) ?? "";
    const channel = payload.channel?.trim().slice(0, 80) ?? "";
    if (!serverId || !channel) return Response.json({ error: "Канал не указан" }, { status: 400 });
    if (!await canAccessServerChannel(user.id, serverId, channel, "text")) return Response.json({ error: "Канал недоступен" }, { status: 403 });
    const [message] = await db.insert(messages).values({ ...common, userId: user.id, serverId, channel })
      .returning({ id: messages.id, kind: messages.kind, createdAt: messages.createdAt });
    return Response.json({ message: { ...message, userId: user.id, author: user.displayName, username: user.username, avatarPath: user.avatarPath, avatarFrame: user.avatarFrame } }, { status: 201 });
  }

  return Response.json({ error: "Неизвестный тип переписки" }, { status: 400 });
}
