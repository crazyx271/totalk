ALTER TABLE `direct_messages` ADD `file_name` text;--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `file_stored_name` text;--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `file_mime` text;--> statement-breakpoint
ALTER TABLE `direct_messages` ADD `file_size` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `file_name` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `file_stored_name` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `file_mime` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `file_size` integer;