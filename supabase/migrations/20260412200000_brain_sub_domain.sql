-- Add sub_domain column for granular niche classification
-- "health" is too broad — need "nutrition", "fitness", "mental_health", "longevity" etc.

DO $$ BEGIN
  ALTER TABLE brain_classifications ADD COLUMN IF NOT EXISTS sub_domain TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_brain_classifications_sub_domain ON brain_classifications(sub_domain) WHERE sub_domain IS NOT NULL;
