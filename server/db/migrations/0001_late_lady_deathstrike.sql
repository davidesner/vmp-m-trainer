ALTER TABLE `attempts` ADD `test_id` text DEFAULT 'M' NOT NULL;--> statement-breakpoint
CREATE INDEX `attempts_user_test_idx` ON `attempts` (`user_id`,`test_id`);--> statement-breakpoint
ALTER TABLE `test_history` ADD `test_id` text DEFAULT 'M' NOT NULL;--> statement-breakpoint
CREATE INDEX `test_history_user_test_idx` ON `test_history` (`user_id`,`test_id`);