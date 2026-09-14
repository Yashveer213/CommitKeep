CREATE TABLE `github_connection_states` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `github_connection_states_owner_id_idx` ON `github_connection_states` (`owner_id`);--> statement-breakpoint
CREATE TABLE `github_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`account_id` text NOT NULL,
	`account_login` text NOT NULL,
	`account_type` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_installations_installation_id_unique` ON `github_installations` (`installation_id`);--> statement-breakpoint
CREATE INDEX `github_installations_owner_id_idx` ON `github_installations` (`owner_id`);--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`github_repository_id` text NOT NULL,
	`full_name` text NOT NULL,
	`default_branch` text NOT NULL,
	`private` integer NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `github_installations`(`installation_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_owner_github_id_unique` ON `repositories` (`owner_id`,`github_repository_id`);--> statement-breakpoint
CREATE INDEX `repositories_owner_id_idx` ON `repositories` (`owner_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`schedule_id` text,
	`source` text NOT NULL,
	`outcome` text NOT NULL,
	`summary` text NOT NULL,
	`branch` text,
	`base_sha` text,
	`result_sha` text,
	`commit_url` text,
	`changed_paths_json` text NOT NULL,
	`error_code` text,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runs_idempotency_key_unique` ON `runs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `runs_owner_created_at_idx` ON `runs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`rule` text NOT NULL,
	`mode` text NOT NULL,
	`local_time` text NOT NULL,
	`timezone` text NOT NULL,
	`enabled` integer NOT NULL,
	`next_run_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedules_owner_id_idx` ON `schedules` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
