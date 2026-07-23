CREATE TABLE `direct_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`caller_id` integer NOT NULL,
	`callee_id` integer NOT NULL,
	`room` text NOT NULL,
	`status` text DEFAULT 'ringing' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`caller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`callee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `direct_calls_caller_idx` ON `direct_calls` (`caller_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `direct_calls_callee_idx` ON `direct_calls` (`callee_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `direct_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` integer NOT NULL,
	`recipient_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `direct_messages_sender_recipient_idx` ON `direct_messages` (`sender_id`,`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `direct_messages_recipient_sender_idx` ON `direct_messages` (`recipient_id`,`sender_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pair_key` text NOT NULL,
	`requester_id` integer NOT NULL,
	`addressee_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_pair_unique` ON `friendships` (`pair_key`);--> statement-breakpoint
CREATE INDEX `friendships_requester_idx` ON `friendships` (`requester_id`,`status`);--> statement-breakpoint
CREATE INDEX `friendships_addressee_idx` ON `friendships` (`addressee_id`,`status`);