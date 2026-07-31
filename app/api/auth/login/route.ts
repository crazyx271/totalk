import { eq } from "drizzle-orm";
import { createSession, verifyPassword } from "../../../auth";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";

export async function POST(request: Request) {
  const payload = (await request.json()) as { username?: string; password?: string };
  const username = payload.username?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";

  const [record] = await getDb()
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!record || !(await verifyPassword(password, record.passwordSalt, record.passwordHash))) {
    return Response.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const session = await createSession(record.id, request);
  return Response.json({
    user: { id: record.id, username: record.username, displayName: record.displayName },
  }, { headers: { "set-cookie": session.cookie } });
}
