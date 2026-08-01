import { asc, eq } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { stickerPacks, stickers } from "../../../db/schema";

const MAX_PACK_NAME_LENGTH = 32;
const MAX_PACKS_PER_USER = 20;

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const db = getDb();
  const packs = await db.select().from(stickerPacks).orderBy(asc(stickerPacks.createdAt));
  const items = await db.select().from(stickers).orderBy(asc(stickers.position));

  const byPack = new Map<number, typeof items>();
  for (const item of items) {
    const bucket = byPack.get(item.packId);
    if (bucket) bucket.push(item);
    else byPack.set(item.packId, [item]);
  }

  return Response.json({
    packs: packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      creatorId: pack.creatorId,
      stickers: (byPack.get(pack.id) ?? []).map((item) => ({ id: item.id, packId: item.packId })),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const payload = await request.json() as { name?: string };
  const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
  if (name.length < 1 || name.length > MAX_PACK_NAME_LENGTH) {
    return Response.json({ error: `Название должно содержать 1–${MAX_PACK_NAME_LENGTH} символов` }, { status: 400 });
  }

  const db = getDb();
  const ownedCount = await db.select({ id: stickerPacks.id }).from(stickerPacks).where(eq(stickerPacks.creatorId, user.id));
  if (ownedCount.length >= MAX_PACKS_PER_USER) {
    return Response.json({ error: `Можно создать не больше ${MAX_PACKS_PER_USER} наборов` }, { status: 400 });
  }

  const [pack] = await db.insert(stickerPacks).values({ name, creatorId: user.id }).returning({
    id: stickerPacks.id,
    name: stickerPacks.name,
    creatorId: stickerPacks.creatorId,
  });
  return Response.json({ pack: { ...pack, stickers: [] } }, { status: 201 });
}
