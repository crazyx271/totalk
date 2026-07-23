import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { friendships } from "../db/schema";

export function friendPairKey(firstUserId: number, secondUserId: number) {
  return firstUserId < secondUserId
    ? `${firstUserId}:${secondUserId}`
    : `${secondUserId}:${firstUserId}`;
}

export async function areFriends(firstUserId: number, secondUserId: number) {
  if (firstUserId === secondUserId) return false;
  const [friendship] = await getDb()
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(
      eq(friendships.pairKey, friendPairKey(firstUserId, secondUserId)),
      eq(friendships.status, "accepted"),
    ))
    .limit(1);
  return Boolean(friendship);
}
