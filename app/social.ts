import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { friendships } from "../db/schema";

// Presence is a heartbeat (see app/api/presence/route.ts), not a live
// connection — this window needs to comfortably outlast normal polling
// gaps and background-tab timer throttling, or people will flicker offline.
const ONLINE_THRESHOLD_MS = 90_000;

export function isOnline(lastActiveAt: number | null) {
  return lastActiveAt !== null && Date.now() - lastActiveAt < ONLINE_THRESHOLD_MS;
}

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
