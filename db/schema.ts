import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("users_username_unique").on(table.username),
]);

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  index("sessions_user_idx").on(table.userId),
]);

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serverId: text("server_id").notNull(),
  channel: text("channel").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("messages_room_created_idx").on(table.serverId, table.channel, table.createdAt),
]);

export const voicePeers = sqliteTable("voice_peers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  peerId: text("peer_id").notNull(),
  serverId: text("server_id").notNull(),
  channel: text("channel").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("voice_peers_peer_id_unique").on(table.peerId),
  index("voice_peers_room_idx").on(table.serverId, table.channel, table.updatedAt),
]);

export const voiceSignals = sqliteTable("voice_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderPeerId: text("sender_peer_id").notNull(),
  targetPeerId: text("target_peer_id").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("voice_signals_target_idx").on(table.targetPeerId, table.id),
  index("voice_signals_created_idx").on(table.createdAt),
]);
