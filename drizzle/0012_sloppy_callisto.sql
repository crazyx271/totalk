CREATE TABLE `server_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `server_channels_server_idx` ON `server_channels` (`server_id`,`position`);--> statement-breakpoint
CREATE TABLE `server_members` (
	`server_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`server_id`, `user_id`),
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `server_members_user_idx` ON `server_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `servers_owner_idx` ON `servers` (`owner_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `banner_path` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_frame` text;--> statement-breakpoint
DELETE FROM `messages` WHERE `server_id` = 'totalk';--> statement-breakpoint
DELETE FROM `voice_peers` WHERE `server_id` = 'totalk';
