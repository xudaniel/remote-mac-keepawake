CREATE TABLE `alert_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`kind` text NOT NULL,
	`state` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`delivered` integer DEFAULT false NOT NULL,
	`delivery_error` text
);
--> statement-breakpoint
CREATE INDEX `alert_events_kind_id_idx` ON `alert_events` (`kind`,`id`);--> statement-breakpoint
CREATE TABLE `alert_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`offline_after_seconds` integer DEFAULT 180 NOT NULL,
	`battery_threshold` integer DEFAULT 25 NOT NULL,
	`alert_keepawake` integer DEFAULT true NOT NULL,
	`alert_power` integer DEFAULT true NOT NULL,
	`alert_network` integer DEFAULT true NOT NULL,
	`alert_chrome` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `health_samples_received_at_idx` ON `health_samples` (`received_at`);