import { eq } from "drizzle-orm";
import { createSession, hashPassword } from "../../../auth";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    username?: string;
    displayName?: string;
    password?: string;
  };
  const username = payload.username?.trim().toLowerCase() ?? "";
  const displayName = payload.displayName?.trim() ?? "";
  const password = payload.password ?? "";

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return Response.json({ error: "Логин: 3–24 латинских символа, цифры или _" }, { status: 400 });
  }
  if (displayName.length < 2 || displayName.length > 32) {
    return Response.json({ error: "Имя должно содержать 2–32 символа" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return Response.json({ error: "Пароль должен содержать минимум 8 символов" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing) {
    return Response.json({ error: "Такой логин уже занят" }, { status: 409 });
  }

  const credentials = await hashPassword(password);
  const [user] = await db.insert(users).values({
    username,
    displayName,
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
  }).returning({ id: users.id, username: users.username, displayName: users.displayName, avatarPath: users.avatarPath });

  const session = await createSession(user.id, request);
  return Response.json({ user }, {
    status: 201,
    headers: { "set-cookie": session.cookie },
  });
}
