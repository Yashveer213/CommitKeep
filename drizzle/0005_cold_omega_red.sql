DELETE FROM `schedules`
WHERE EXISTS (
	SELECT 1
	FROM `schedules` AS `older`
	WHERE `older`.`owner_id` = `schedules`.`owner_id`
		AND `older`.`repository_id` = `schedules`.`repository_id`
		AND `older`.`rule` = `schedules`.`rule`
		AND (`older`.`created_at` < `schedules`.`created_at` OR (`older`.`created_at` = `schedules`.`created_at` AND `older`.`id` < `schedules`.`id`))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedules_owner_repository_rule_unique` ON `schedules` (`owner_id`,`repository_id`,`rule`);
