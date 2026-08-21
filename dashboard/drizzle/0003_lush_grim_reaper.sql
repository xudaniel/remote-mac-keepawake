ALTER TABLE `health_samples` ADD `sample_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `health_samples_sample_id_unique` ON `health_samples` (`sample_id`);--> statement-breakpoint
CREATE INDEX `health_samples_reported_at_idx` ON `health_samples` (`reported_at`);