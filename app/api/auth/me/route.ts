import { eq } from "drizzle-orm";
import { getSessionUser, hashPassword, verifyPassword } from "../../../auth";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  return Response.json({ user }, { status: user ? 200 : 401 });
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const payload = (await request.json()) as {
    displayName?: string;
    username?: string;
    currentPassword?: string;
    newPassword?: string;
    bio?: string;
    bannerColor?: string | null;
  };

  const db = getDb();
  const [record] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
  if (!record) return Response.json({ error: "Пользователь не найден" }, { status: 404 });

  const updates: Partial<typeof users.$inferInsert> = {};

  if (payload.displayName !== undefined) {
    const displayName = payload.displayName.trim();
    if (displayName.length < 2 || displayName.length > 32) {
      return Response.json({ error: "Имя должно содержать 2–32 символа" }, { status: 400 });
    }
    updates.displayName = displayName;
  }

  if (payload.username !== undefined) {
    const username = payload.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return Response.json({ error: "Логин: 3–24 латинских символа, цифры или _" }, { status: 400 });
    }
    if (username !== record.username) {
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (existing) return Response.json({ error: "Такой логин уже занят" }, { status: 409 });
    }
    updates.username = username;
  }

  if (payload.newPassword !== undefined) {
    const newPassword = payload.newPassword;
    if (newPassword.length < 8 || newPassword.length > 128) {
      return Response.json({ error: "Пароль должен содержать минимум 8 символов" }, { status: 400 });
    }
    if (!payload.currentPassword || !await verifyPassword(payload.currentPassword, record.passwordSalt, record.passwordHash)) {
      return Response.json({ error: "Текущий пароль указан неверно" }, { status: 403 });
    }
    const credentials = await hashPassword(newPassword);
    updates.passwordHash = credentials.hash;
    updates.passwordSalt = credentials.salt;
  }

  if (payload.bio !== undefined) {
    const bio = payload.bio.trim().slice(0, 190);
    updates.bio = bio || null;
  }

  if (payload.bannerColor !== undefined) {
    const bannerColor = payload.bannerColor?.trim() ?? "";
    if (bannerColor && !/^#[0-9a-fA-F]{6}$/.test(bannerColor)) {
      return Response.json({ error: "Некорректный цвет баннера" }, { status: 400 });
    }
    updates.bannerColor = bannerColor || null;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Нечего сохранять" }, { status: 400 });
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, sessionUser.id))
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
      bio: users.bio,
      bannerColor: users.bannerColor,
      isUltra: users.isUltra,
      createdAt: users.createdAt,
    });

  return Response.json({ user: updated });
}
