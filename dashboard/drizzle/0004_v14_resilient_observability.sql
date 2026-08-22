ALTER TABLE `health_samples` ADD `battery_condition` text;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `battery_cycle_count` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `battery_design_capacity_mah` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `battery_full_charge_capacity_mah` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `battery_health_percent` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `thermal_state` text;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_diagnostics_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_route_available` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_gateway_reachable` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_dns_available` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_https_available` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_ingest_reachable` integer;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_gateway_latency_ms` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_gateway_jitter_ms` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_gateway_packet_loss_percent` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_fault` text;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `network_diagnostics_measured_at` text;--> statement-breakpoint
ALTER TABLE `alert_settings` ADD `alert_battery_health` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_settings` ADD `alert_thermal` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_settings` ADD `battery_health_threshold` integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_settings` ADD `battery_degradation_threshold` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_events` ADD `delivery_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_events` ADD `last_attempt_at` text;--> statement-breakpoint
ALTER TABLE `alert_events` ADD `next_attempt_at` text;--> statement-breakpoint
ALTER TABLE `alert_events` ADD `delivery_target` text;--> statement-breakpoint
ALTER TABLE `alert_events` ADD `delivered_at` text;--> statement-breakpoint
CREATE INDEX `alert_events_retry_idx` ON `alert_events` (`delivered`,`next_attempt_at`,`id`);--> statement-breakpoint
CREATE TABLE `scheduler_runtime` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_run_at` text,
	`last_success_at` text,
	`last_error` text,
	`lease_until` text,
	`last_canary_at` text
);--> statement-breakpoint
CREATE TABLE `auth_failures` (
	`bucket` text PRIMARY KEY NOT NULL,
	`window_started_at` text NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL
);
