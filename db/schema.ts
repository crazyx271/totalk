import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  avatarPath: text("avatar_path"),
  bio: text("bio"),
  bannerColor: text("banner_color"),
  bannerPath: text("banner_path"),
  avatarFrame: text("avatar_frame"),
  lastActiveAt: integer("last_active_at"),
  isUltra: integer("is_ultra", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("users_username_unique").on(table.username),
]);

export const servers = sqliteTable("servers", {
  id: text("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("servers_owner_idx").on(table.ownerId),
]);

export const serverMembers = sqliteTable("server_members", {
  serverId: text("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.serverId, table.userId] }),
  index("server_members_user_idx").on(table.userId),
]);

export const serverChannels = sqliteTable("server_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serverId: text("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("text"),
  position: integer("position").notNull().default(0),
}, (table) => [
  index("server_channels_server_idx").on(table.serverId, table.position),
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
  kind: text("kind").notNull().default("text"),
  fileName: text("file_name"),
  fileStoredName: text("file_stored_name"),
  fileMime: text("file_mime"),
  fileSize: integer("file_size"),
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

export const friendships = sqliteTable("friendships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pairKey: text("pair_key").notNull(),
  requesterId: integer("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addresseeId: integer("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("friendships_pair_unique").on(table.pairKey),
  index("friendships_requester_idx").on(table.requesterId, table.status),
  index("friendships_addressee_idx").on(table.addresseeId, table.status),
]);

export const directMessages = sqliteTable("direct_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  kind: text("kind").notNull().default("text"),
  fileName: text("file_name"),
  fileStoredName: text("file_stored_name"),
  fileMime: text("file_mime"),
  fileSize: integer("file_size"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("direct_messages_sender_recipient_idx").on(table.senderId, table.recipientId, table.createdAt),
  index("direct_messages_recipient_sender_idx").on(table.recipientId, table.senderId, table.createdAt),
]);

export const directCalls = sqliteTable("direct_calls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  callerId: integer("caller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  calleeId: integer("callee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  room: text("room").notNull(),
  status: text("status").notNull().default("ringing"),
  acceptedAt: integer("accepted_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("direct_calls_caller_idx").on(table.callerId, table.status, table.updatedAt),
  index("direct_calls_callee_idx").on(table.calleeId, table.status, table.updatedAt),
]);

export const stickerPacks = sqliteTable("sticker_packs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  creatorId: integer("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("sticker_packs_creator_idx").on(table.creatorId),
]);

export const stickers = sqliteTable("stickers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  packId: integer("pack_id").notNull().references(() => stickerPacks.id, { onDelete: "cascade" }),
  storedName: text("stored_name").notNull(),
  mime: text("mime").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("stickers_pack_idx").on(table.packId, table.position),
]);

export const pushTokens = sqliteTable("push_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: text("platform").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("push_tokens_token_unique").on(table.token),
  index("push_tokens_user_idx").on(table.userId, table.platform),
]);
