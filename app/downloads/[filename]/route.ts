import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { downloadsDir } from "../../../db";

const CONTENT_TYPES: Record<string, string> = {
  ".exe": "application/x-msdownload",
  ".dmg": "application/x-apple-diskimage",
  ".yml": "application/x-yaml",
  ".blockmap": "application/octet-stream",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return new Response("Не найдено", { status: 404 });
  }
  const contentType = CONTENT_TYPES[extname(filename).toLowerCase()];
  if (!contentType) return new Response("Не найдено", { status: 404 });

  try {
    const path = join(downloadsDir(), filename);
    const info = await stat(path);
    const data = await readFile(path);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": contentType,
        "content-length": String(info.size),
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Не найдено", { status: 404 });
  }
}
