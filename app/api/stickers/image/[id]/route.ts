import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionUser } from "../../../../auth";
import { getDb, messageFilesDir } from "../../../../../db";
import { stickers } from "../../../../../db/schema";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return new Response("Требуется вход", { status: 401 });

  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return new Response("Стикер не найден", { status: 404 });

  const [sticker] = await getDb().select({ storedName: stickers.storedName, mime: stickers.mime }).from(stickers).where(eq(stickers.id, id)).limit(1);
  if (!sticker) return new Response("Стикер не найден", { status: 404 });

  try {
    const bytes = await readFile(join(messageFilesDir(), sticker.storedName));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": sticker.mime,
        "content-disposition": "inline",
        "cache-control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Стикер не найден", { status: 404 });
  }
}
