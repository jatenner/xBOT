-- Add bio_features JSONB column to brain_accounts
-- Stores structured features: has_cta, has_credentials, has_social_proof, etc.

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS bio_features JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
