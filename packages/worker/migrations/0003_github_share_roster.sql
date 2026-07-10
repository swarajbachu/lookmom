-- Snapshot of org/team members when owner enables github_team share.
-- Viewers can match by github_login (GitHub sign-in) or email (if public/known).
CREATE TABLE `github_share_roster` (
	`artifact_id` text NOT NULL,
	`github_login` text NOT NULL,
	`email` text,
	`synced_at` integer NOT NULL,
	PRIMARY KEY (`artifact_id`, `github_login`)
);
--> statement-breakpoint
CREATE INDEX `idx_github_share_roster_artifact` ON `github_share_roster` (`artifact_id`);
--> statement-breakpoint
CREATE INDEX `idx_github_share_roster_email` ON `github_share_roster` (`artifact_id`, `email`);
--> statement-breakpoint
-- Prevent duplicate allowlist rows when syncing member emails.
CREATE UNIQUE INDEX `idx_allowlist_artifact_email` ON `allowlist` (`artifact_id`, `email`);
