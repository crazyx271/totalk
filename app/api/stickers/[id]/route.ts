import { and, eq } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { getSessionUser } from "../../../auth";
import { getDb, messageFilesDir } from "../../../../db";
import { stickerPacks, stickers } from "../../../../db/schema";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Стикер не найден" }, { status: 404 });

  const db = getDb();
  const [row] = await db.select({ storedName: stickers.storedName, creatorId: stickerPacks.creatorId })
    .from(stickers).innerJoin(stickerPacks, eq(stickers.packId, stickerPacks.id))
    .where(eq(stickers.id, id)).limit(1);
  if (!row || row.creatorId !== user.id) return Response.json({ error: "Стикер не найден или вы не владелец" }, { status: 404 });

  await db.delete(stickers).where(and(eq(stickers.id, id)));
  await unlink(join(messageFilesDir(), row.storedName)).catch(() => undefined);

  return Response.json({ ok: true });
}
