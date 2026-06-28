CREATE TABLE `agent_tokens` (
	`jti` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`scopes` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_tokens_owner` ON `agent_tokens` (`owner_email`);--> statement-breakpoint
CREATE TABLE `allowlist` (
	`artifact_id` text NOT NULL,
	`email` text NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_allowlist_artifact` ON `allowlist` (`artifact_id`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`title` text DEFAULT 'Untitled artifact' NOT NULL,
	`emoji` text DEFAULT '📄' NOT NULL,
	`current_version` integer DEFAULT 0 NOT NULL,
	`share_mode` text DEFAULT 'private' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_owner` ON `artifacts` (`owner_email`);--> statement-breakpoint
CREATE TABLE `claim_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_token_hash` text NOT NULL,
	`user_code_hash` text NOT NULL,
	`owner_email` text,
	`scopes` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_claim_token` ON `claim_attempts` (`claim_token_hash`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`artifact_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`r2_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_versions_artifact` ON `versions` (`artifact_id`,`version_no`);