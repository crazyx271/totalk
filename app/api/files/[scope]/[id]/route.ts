import { and, eq, or } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionUser } from "../../../../auth";
import { getDb, messageFilesDir } from "../../../../../db";
import { directMessages, messages } from "../../../../../db/schema";

export async function GET(request: Request, context: { params: Promise<{ scope: string; id: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return new Response("Требуется вход", { status: 401 });
  const { scope, id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return new Response("Файл не найден", { status: 404 });

  let record: { fileName: string | null; fileStoredName: string | null; fileMime: string | null } | undefined;
  if (scope === "dm") {
    [record] = await getDb().select({ fileName: directMessages.fileName, fileStoredName: directMessages.fileStoredName, fileMime: directMessages.fileMime })
      .from(directMessages).where(and(eq(directMessages.id, id), or(eq(directMessages.senderId, user.id), eq(directMessages.recipientId, user.id)))).limit(1);
  } else if (scope === "channel") {
    [record] = await getDb().select({ fileName: messages.fileName, fileStoredName: messages.fileStoredName, fileMime: messages.fileMime })
      .from(messages).where(eq(messages.id, id)).limit(1);
  }
  if (!record?.fileStoredName || !record.fileName) return new Response("Файл не найден", { status: 404 });
  try {
    const bytes = await readFile(join(messageFilesDir(), record.fileStoredName));
    const safeName = record.fileName.replace(/[\r\n"]/g, "_");
    return new Response(new Uint8Array(bytes), { headers: {
      "content-type": record.fileMime || "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "cache-control": "private, max-age=3600",
    } });
  } catch {
    return new Response("Файл не найден", { status: 404 });
  }
}
