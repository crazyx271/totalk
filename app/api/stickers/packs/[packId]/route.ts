import { and, eq } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionUser } from "../../../../auth";
import { getDb, messageFilesDir } from "../../../../../db";
import { stickerPacks, stickers } from "../../../../../db/schema";

const MAX_STICKER_BYTES = 1.5 * 1024 * 1024;
const MAX_STICKERS_PER_PACK = 60;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

async function requireOwnedPack(packId: number, userId: number) {
  const db = getDb();
  const [pack] = await db.select().from(stickerPacks).where(and(eq(stickerPacks.id, packId), eq(stickerPacks.creatorId, userId))).limit(1);
  return pack;
}

export async function POST(request: Request, context: { params: Promise<{ packId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const packId = Number((await context.params).packId);
  if (!Number.isInteger(packId)) return Response.json({ error: "Набор не найден" }, { status: 404 });
  const pack = await requireOwnedPack(packId, user.id);
  if (!pack) return Response.json({ error: "Набор не найден или вы не владелец" }, { status: 404 });

  const db = getDb();
  const existing = await db.select({ position: stickers.position }).from(stickers).where(eq(stickers.packId, packId));
  if (existing.length >= MAX_STICKERS_PER_PACK) {
    return Response.json({ error: `В наборе может быть не больше ${MAX_STICKERS_PER_PACK} стикеров` }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Файл не выбран" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) return Response.json({ error: "Поддерживаются PNG, JPEG, WebP и GIF" }, { status: 400 });
  if (file.size > MAX_STICKER_BYTES) return Response.json({ error: `Файл больше ${Math.round(MAX_STICKER_BYTES / 1024)} КБ` }, { status: 400 });

  const storedName = `${crypto.randomUUID()}.bin`;
  await mkdir(messageFilesDir(), { recursive: true });
  await writeFile(join(messageFilesDir(), storedName), Buffer.from(await file.arrayBuffer()));

  const nextPosition = existing.length ? Math.max(...existing.map((row) => row.position)) + 1 : 0;
  const [sticker] = await db.insert(stickers).values({ packId, storedName, mime: file.type, position: nextPosition }).returning({
    id: stickers.id,
    packId: stickers.packId,
  });
  return Response.json({ sticker }, { status: 201 });
}

export async function DELETE(request: Request, context: { params: Promise<{ packId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const packId = Number((await context.params).packId);
  if (!Number.isInteger(packId)) return Response.json({ error: "Набор не найден" }, { status: 404 });
  const pack = await requireOwnedPack(packId, user.id);
  if (!pack) return Response.json({ error: "Набор не найден или вы не владелец" }, { status: 404 });

  const db = getDb();
  const items = await db.select({ storedName: stickers.storedName }).from(stickers).where(eq(stickers.packId, packId));
  await db.delete(stickerPacks).where(eq(stickerPacks.id, packId));
  await Promise.all(items.map((item) => unlink(join(messageFilesDir(), item.storedName)).catch(() => undefined)));

  return Response.json({ ok: true });
}
