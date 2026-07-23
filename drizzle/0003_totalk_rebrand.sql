UPDATE `messages` SET `server_id` = 'totalk' WHERE `server_id` = 'bosus';
--> statement-breakpoint
UPDATE `voice_peers` SET `server_id` = 'totalk' WHERE `server_id` = 'bosus';
--> statement-breakpoint
UPDATE `users`
SET `username` = 'totalk_bot'
WHERE `username` = 'bosus_bot'
  AND NOT EXISTS (SELECT 1 FROM `users` AS `candidate` WHERE `candidate`.`username` = 'totalk_bot');
--> statement-breakpoint
UPDATE `users`
SET `display_name` = 'ToTalk Bot'
WHERE `username` IN ('bosus_bot', 'totalk_bot');
--> statement-breakpoint
UPDATE `messages`
SET `content` = replace(`content`, 'Bosus', 'ToTalk')
WHERE `content` LIKE '%Bosus%';
