import { eq } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { pushTokens } from "../../../db/schema";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { token?: string; platform?: string };
  const token = payload.token?.trim() ?? "";
  const platform = payload.platform === "ios" ? "ios" : payload.platform === "android" ? "android" : "";
  if (!platform || token.length < 16 || token.length > 4096) return Response.json({ error: "Некорректный push-токен" }, { status: 400 });
  await getDb().insert(pushTokens).values({ userId: user.id, token, platform, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: pushTokens.token, set: { userId: user.id, platform, updatedAt: Date.now() } });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { token?: string };
  const token = payload.token?.trim() ?? "";
  if (token) await getDb().delete(pushTokens).where(eq(pushTokens.token, token));
  return Response.json({ ok: true });
}
