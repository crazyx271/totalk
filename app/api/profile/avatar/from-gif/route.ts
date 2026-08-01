import { eq } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { getSessionUser } from "../../../../auth";
import { avatarsDir, getDb } from "../../../../../db";
import { users } from "../../../../../db/schema";
import { isGiphyUrl } from "../../../../giphy";

const MAX_GIF_AVATAR_BYTES = 8 * 1024 * 1024;

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
  if (!user.isUltra) return Response.json({ error: "GIF-аватар доступен только с Talker Ultra" }, { status: 403 });

  const payload = await request.json() as { url?: string };
  const url = payload.url?.trim() ?? "";
  if (!isGiphyUrl(url)) return Response.json({ error: "Некорректная ссылка на GIF" }, { status: 400 });

  let bytes: ArrayBuffer;
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error("fetch failed");
    if (!(upstream.headers.get("content-type") ?? "").startsWith("image/gif")) throw new Error("not a gif");
    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (contentLength && contentLength > MAX_GIF_AVATAR_BYTES) throw new Error("too large");
    bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_GIF_AVATAR_BYTES) throw new Error("too large");
  } catch {
    return Response.json({ error: "Не удалось загрузить GIF" }, { status: 502 });
  }

  const db = getDb();
  const [record] = await db.select({ avatarPath: users.avatarPath }).from(users).where(eq(users.id, user.id)).limit(1);
  const filename = `${user.id}-${crypto.randomUUID()}.gif`;
  await mkdir(avatarsDir(), { recursive: true });
  await writeFile(join(avatarsDir(), filename), Buffer.from(bytes));
  await removeExistingAvatar(record?.avatarPath ?? null);

  const avatarPath = `/avatars/${filename}`;
  await db.update(users).set({ avatarPath }).where(eq(users.id, user.id));
  return Response.json({ avatarPath });
}
