CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`path` text NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`committed_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `drafts_owner_status_idx` ON `drafts` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `drafts_repository_path_status_idx` ON `drafts` (`repository_id`,`path`,`status`);