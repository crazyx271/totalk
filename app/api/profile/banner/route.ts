import { eq } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { getSessionUser } from "../../../auth";
import { bannersDir, getDb } from "../../../../db";
import { users } from "../../../../db/schema";

const MAX_BANNER_BYTES = 12 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function removeExistingBanner(bannerPath: string | null) {
  if (!bannerPath) return;
  try {
    await unlink(join(bannersDir(), basename(bannerPath)));
  } catch {
    // The previous asset may already have been removed.
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  if (!user.isUltra) return Response.json({ error: "Свои баннеры доступны только с Talker Ultra" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("banner");
  if (!(file instanceof File)) return Response.json({ error: "Файл не найден" }, { status: 400 });
  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) return Response.json({ error: "Поддерживаются PNG, JPEG, WebP и GIF" }, { status: 400 });
  if (file.size > MAX_BANNER_BYTES) return Response.json({ error: "Баннер больше 12 МБ" }, { status: 400 });

  const db = getDb();
  const [record] = await db.select({ bannerPath: users.bannerPath }).from(users).where(eq(users.id, user.id)).limit(1);
  const filename = `${user.id}-${crypto.randomUUID()}.${extension}`;
  await mkdir(bannersDir(), { recursive: true });
  await writeFile(join(bannersDir(), filename), Buffer.from(await file.arrayBuffer()));
  await removeExistingBanner(record?.bannerPath ?? null);

  const bannerPath = `/banners/${filename}`;
  await db.update(users).set({ bannerPath }).where(eq(users.id, user.id));
  return Response.json({ bannerPath });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  if (!user.isUltra) return Response.json({ error: "Доступно только с Talker Ultra" }, { status: 403 });
  const db = getDb();
  const [record] = await db.select({ bannerPath: users.bannerPath }).from(users).where(eq(users.id, user.id)).limit(1);
  await removeExistingBanner(record?.bannerPath ?? null);
  await db.update(users).set({ bannerPath: null }).where(eq(users.id, user.id));
  return Response.json({ ok: true });
}
