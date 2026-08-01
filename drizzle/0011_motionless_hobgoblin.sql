CREATE TABLE `push_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`platform` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_tokens_token_unique` ON `push_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `push_tokens_user_idx` ON `push_tokens` (`user_id`,`platform`);