import { eq } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { getSessionUser } from "../../../auth";
import { avatarsDir, getDb } from "../../../../db";
import { users } from "../../../../db/schema";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_GIF_AVATAR_BYTES = 8 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const ULTRA_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/gif": "gif",
};

async function removeExistingAvatar(avatarPath: string | null) {
  if (!avatarPath) return;
  try {
    await unlink(join(avatarsDir(), basename(avatarPath)));
  } catch {
    // Already gone — nothing to clean up.
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return Response.json({ error: "Файл не найден" }, { status: 400 });
  }
  const extension = EXTENSION_BY_TYPE[file.type] ?? (user.isUltra ? ULTRA_EXTENSION_BY_TYPE[file.type] : undefined);
  if (!extension) {
    return Response.json({
      error: user.isUltra ? "Поддерживаются PNG, JPEG, WebP и GIF" : "Поддерживаются PNG, JPEG и WebP. GIF доступен с Talker Ultra",
    }, { status: 400 });
  }
  const maxBytes = extension === "gif" ? MAX_GIF_AVATAR_BYTES : MAX_AVATAR_BYTES;
  if (file.size > maxBytes) {
    return Response.json({ error: `Файл больше ${Math.round(maxBytes / (1024 * 1024))} МБ` }, { status: 400 });
  }

  const db = getDb();
  const [record] = await db.select({ avatarPath: users.avatarPath }).from(users).where(eq(users.id, user.id)).limit(1);

  const filename = `${user.id}-${crypto.randomUUID()}.${extension}`;
  await mkdir(avatarsDir(), { recursive: true });
  await writeFile(join(avatarsDir(), filename), Buffer.from(await file.arrayBuffer()));
  await removeExistingAvatar(record?.avatarPath ?? null);

  const avatarPath = `/avatars/${filename}`;
  await db.update(users).set({ avatarPath }).where(eq(users.id, user.id));

  return Response.json({ avatarPath });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const db = getDb();
  const [record] = await db.select({ avatarPath: users.avatarPath }).from(users).where(eq(users.id, user.id)).limit(1);
  await removeExistingAvatar(record?.avatarPath ?? null);
  await db.update(users).set({ avatarPath: null }).where(eq(users.id, user.id));

  return Response.json({ ok: true });
}
