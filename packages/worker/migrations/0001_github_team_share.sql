ALTER TABLE `artifacts` ADD `github_org` text;--> statement-breakpoint
ALTER TABLE `artifacts` ADD `github_team` text;--> statement-breakpoint
CREATE TABLE `github_membership_cache` (
	`github_login` text NOT NULL,
	`org` text NOT NULL,
	`team` text DEFAULT '' NOT NULL,
	`is_member` integer NOT NULL,
	`checked_at` integer NOT NULL,
	PRIMARY KEY(`github_login`, `org`, `team`)
);
