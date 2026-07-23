CREATE TABLE `voice_peers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`peer_id` text NOT NULL,
	`server_id` text NOT NULL,
	`channel` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_peers_peer_id_unique` ON `voice_peers` (`peer_id`);--> statement-breakpoint
CREATE INDEX `voice_peers_room_idx` ON `voice_peers` (`server_id`,`channel`,`updated_at`);--> statement-breakpoint
CREATE TABLE `voice_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_peer_id` text NOT NULL,
	`target_peer_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `voice_signals_target_idx` ON `voice_signals` (`target_peer_id`,`id`);--> statement-breakpoint
CREATE INDEX `voice_signals_created_idx` ON `voice_signals` (`created_at`);