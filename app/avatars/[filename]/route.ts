import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { avatarsDir } from "../../../db";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return new Response("Не найдено", { status: 404 });
  }
  const contentType = CONTENT_TYPES[extname(filename).toLowerCase()];
  if (!contentType) return new Response("Не найдено", { status: 404 });

  try {
    const data = await readFile(join(avatarsDir(), filename));
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Не найдено", { status: 404 });
  }
}
