CREATE TABLE `domain_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host` text NOT NULL,
	`category` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`observed_count` integer DEFAULT 1 NOT NULL,
	`selected_count` integer DEFAULT 0 NOT NULL,
	`last_observed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_observations_host_category_idx` ON `domain_observations` (`host`,`category`);--> statement-breakpoint
CREATE TABLE `rule_exports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target` text NOT NULL,
	`rule_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
