ALTER TABLE `health_samples` ADD `internet_speed_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `internet_download_mbps` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `internet_upload_mbps` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `internet_latency_ms` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `internet_responsiveness_rpm` real;--> statement-breakpoint
ALTER TABLE `health_samples` ADD `internet_speed_measured_at` text;