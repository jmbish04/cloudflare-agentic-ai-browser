-- Migration to add AI provider column
ALTER TABLE jobs ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'openai';