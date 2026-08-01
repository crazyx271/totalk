import { eq } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { getSessionUser } from "../../../../auth";
import { bannersDir, getDb } from "../../../../../db";
import { users } from "../../../../../db/schema";
import { isGiphyUrl } from "../../../../giphy";

const MAX_BANNER_BYTES = 12 * 1024 * 1024;

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

  const payload = await request.json() as { url?: string };
  const url = payload.url?.trim() ?? "";
  if (!isGiphyUrl(url)) return Response.json({ error: "Некорректная ссылка на GIF" }, { status: 400 });

  let bytes: ArrayBuffer;
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error("fetch failed");
    if (!(upstream.headers.get("content-type") ?? "").startsWith("image/gif")) throw new Error("not a gif");
    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (contentLength && contentLength > MAX_BANNER_BYTES) throw new Error("too large");
    bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_BANNER_BYTES) throw new Error("too large");
  } catch {
    return Response.json({ error: "Не удалось загрузить GIF" }, { status: 502 });
  }

  const db = getDb();
  const [record] = await db.select({ bannerPath: users.bannerPath }).from(users).where(eq(users.id, user.id)).limit(1);
  const filename = `${user.id}-${crypto.randomUUID()}.gif`;
  await mkdir(bannersDir(), { recursive: true });
  await writeFile(join(bannersDir(), filename), Buffer.from(bytes));
  await removeExistingBanner(record?.bannerPath ?? null);

  const bannerPath = `/banners/${filename}`;
  await db.update(users).set({ bannerPath }).where(eq(users.id, user.id));
  return Response.json({ bannerPath });
}
