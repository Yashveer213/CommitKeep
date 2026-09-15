ALTER TABLE `schedule_times` ADD `schedule_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `schedule_times` ADD `disabled_at` text;
--> statement-breakpoint
ALTER TABLE `scheduled_occurrences` ADD `dispatch_owner` text;
--> statement-breakpoint
ALTER TABLE `scheduled_occurrences` ADD `dispatch_expires_at` text;
--> statement-breakpoint
ALTER TABLE `scheduled_occurrences` ADD `execution_attempt_id` text;
--> statement-breakpoint
ALTER TABLE `scheduled_occurrences` ADD `execution_expires_at` text;
--> statement-breakpoint
CREATE INDEX `scheduled_occurrences_execution_idx` ON `scheduled_occurrences` (`status`,`execution_expires_at`);
--> statement-breakpoint
UPDATE `schedule_times`
SET `schedule_version` = COALESCE((SELECT `version` FROM `schedules` WHERE `schedules`.`id` = `schedule_times`.`schedule_id`), 1);
--> statement-breakpoint
UPDATE `schedules` SET `mode` = 'update' WHERE `mode` IN ('save', 'both');
