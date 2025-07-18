ALTER TABLE `jobs` ADD `messages` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `ai_provider` text DEFAULT 'openai' NOT NULL;