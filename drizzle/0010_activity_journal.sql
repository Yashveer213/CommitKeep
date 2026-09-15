ALTER TABLE `schedules` ADD `journal_acknowledged_at` text;
--> statement-breakpoint
ALTER TABLE `schedules` ADD `organization_journal_enabled` integer DEFAULT 0 NOT NULL;
