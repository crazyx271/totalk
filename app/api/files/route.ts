import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionUser } from "../../auth";
import { getDb, messageFilesDir } from "../../../db";
import { directMessages, messages } from "../../../db/schema";
import { areFriends } from "../../social";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const scope = form.get("scope");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Файл не выбран" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: "Максимальный размер файла — 25 МБ" }, { status: 413 });

  const storedName = `${crypto.randomUUID()}.bin`;
  await mkdir(messageFilesDir(), { recursive: true });
  await writeFile(join(messageFilesDir(), storedName), Buffer.from(await file.arrayBuffer()));
  const common = {
    content: file.name.slice(0, 240) || "Файл",
    kind: "file",
    fileName: file.name.slice(0, 240) || "file",
    fileStoredName: storedName,
    fileMime: file.type.slice(0, 120) || "application/octet-stream",
    fileSize: file.size,
  };
  try {
    if (scope === "dm") {
      const friendId = Number(form.get("friendId"));
      if (!Number.isInteger(friendId) || !await areFriends(user.id, friendId)) {
        return Response.json({ error: "Личная переписка недоступна" }, { status: 403 });
      }
      const [row] = await getDb().insert(directMessages).values({ ...common, senderId: user.id, recipientId: friendId }).returning({ id: directMessages.id });
      return Response.json({ id: row.id, scope: "dm" }, { status: 201 });
    }
    if (scope === "channel") {
      const serverId = String(form.get("serverId") ?? "").trim().slice(0, 40);
      const channel = String(form.get("channel") ?? "").trim().slice(0, 80);
      if (!serverId || !channel) return Response.json({ error: "Канал не указан" }, { status: 400 });
      const [row] = await getDb().insert(messages).values({ ...common, userId: user.id, serverId, channel }).returning({ id: messages.id });
      return Response.json({ id: row.id, scope: "channel" }, { status: 201 });
    }
  } catch (error) {
    await unlink(join(messageFilesDir(), storedName)).catch(() => undefined);
    throw error;
  }
  await unlink(join(messageFilesDir(), storedName)).catch(() => undefined);
  return Response.json({ error: "Неизвестный тип переписки" }, { status: 400 });
}
