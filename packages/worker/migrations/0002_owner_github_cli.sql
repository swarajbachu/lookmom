CREATE TABLE `owner_github` (
	`owner_email` text PRIMARY KEY NOT NULL,
	`github_login` text NOT NULL,
	`access_token` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `github_cli_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_token_hash` text NOT NULL,
	`user_code_hash` text NOT NULL,
	`owner_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`github_login` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_gh_cli_claim_token` ON `github_cli_claims` (`claim_token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_gh_cli_claim_code` ON `github_cli_claims` (`user_code_hash`);
