CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`event` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`correlation_id` text NOT NULL,
	`result` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_events_owner_created_idx` ON `audit_events` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `repository_automation_controls` (
	`repository_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`paused_at` text,
	`paused_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `repository_automation_owner_status_idx` ON `repository_automation_controls` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `repository_write_leases` (
	`repository_id` text NOT NULL,
	`branch` text NOT NULL,
	`lease_owner` text NOT NULL,
	`fencing_token` integer NOT NULL,
	`lease_expires_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repository_write_leases_repository_branch_unique` ON `repository_write_leases` (`repository_id`,`branch`);--> statement-breakpoint
CREATE TABLE `schedule_times` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`local_time` text NOT NULL,
	`next_run_at` text,
	`last_occurrence_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_times_schedule_local_time_unique` ON `schedule_times` (`schedule_id`,`local_time`);--> statement-breakpoint
CREATE INDEX `schedule_times_due_idx` ON `schedule_times` (`status`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `scheduled_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`schedule_id` text NOT NULL,
	`schedule_time_id` text NOT NULL,
	`schedule_version` integer NOT NULL,
	`local_date` text NOT NULL,
	`local_time` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_time_id`) REFERENCES `schedule_times`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_occurrences_identity_unique` ON `scheduled_occurrences` (`schedule_id`,`schedule_version`,`local_date`,`local_time`);--> statement-breakpoint
CREATE INDEX `scheduled_occurrences_status_scheduled_idx` ON `scheduled_occurrences` (`status`,`scheduled_for`);--> statement-breakpoint
ALTER TABLE `runs` ADD `occurrence_id` text REFERENCES scheduled_occurrences(id);--> statement-breakpoint
ALTER TABLE `runs` ADD `schedule_version` integer;--> statement-breakpoint
ALTER TABLE `runs` ADD `scheduled_for` text;--> statement-breakpoint
CREATE UNIQUE INDEX `runs_occurrence_id_unique` ON `runs` (`occurrence_id`);--> statement-breakpoint
ALTER TABLE `schedules` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedules` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `schedules` ADD `paused_at` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `paused_by` text;
--> statement-breakpoint
INSERT OR IGNORE INTO `repository_automation_controls` (`repository_id`,`owner_id`,`status`,`version`,`paused_at`,`paused_by`,`created_at`,`updated_at`)
SELECT `id`,`owner_id`,'active',1,NULL,NULL,`created_at`,`updated_at` FROM `repositories`;
--> statement-breakpoint
INSERT OR IGNORE INTO `schedule_times` (`id`,`schedule_id`,`local_time`,`next_run_at`,`last_occurrence_id`,`status`,`created_at`,`updated_at`)
SELECT lower(hex(randomblob(16))),`id`,`local_time`,NULL,NULL,CASE WHEN `enabled`=1 THEN 'active' ELSE 'disabled' END,`created_at`,`updated_at` FROM `schedules`;
