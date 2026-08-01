import { eq } from "drizzle-orm";
import { getSessionUser } from "../../auth";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  await getDb().update(users).set({ lastActiveAt: Date.now() }).where(eq(users.id, user.id));
  return Response.json({ ok: true });
}
