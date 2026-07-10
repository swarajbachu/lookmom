-- First-class GitHub orgs: linked orgs + org-level member roster + artifact home.
ALTER TABLE `artifacts` ADD COLUMN `org_slug` text;
--> statement-breakpoint
CREATE INDEX `idx_artifacts_org` ON `artifacts` (`org_slug`);
--> statement-breakpoint
CREATE TABLE `github_org_links` (
	`org_slug` text PRIMARY KEY NOT NULL,
	`linked_by_email` text NOT NULL,
	`github_login` text NOT NULL,
	`access_token` text NOT NULL,
	`last_synced_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_github_org_links_linker` ON `github_org_links` (`linked_by_email`);
--> statement-breakpoint
CREATE TABLE `github_org_members` (
	`org_slug` text NOT NULL,
	`github_login` text NOT NULL,
	`email` text,
	`synced_at` integer NOT NULL,
	PRIMARY KEY (`org_slug`, `github_login`)
);
--> statement-breakpoint
CREATE INDEX `idx_github_org_members_org` ON `github_org_members` (`org_slug`);
--> statement-breakpoint
CREATE INDEX `idx_github_org_members_email` ON `github_org_members` (`org_slug`, `email`);
