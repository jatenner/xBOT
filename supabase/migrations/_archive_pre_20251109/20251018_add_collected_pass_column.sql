-- Add collected_pass column to outcomes table for tracking analytics collection passes
-- Pass 1 = T+1h collection, Pass 2 = T+24h collection

ALTER TABLE outcomes 
ADD COLUMN IF NOT EXISTS collected_pass INTEGER DEFAULT 0;

COMMENT ON COLUMN outcomes.collected_pass IS 'Tracks which analytics collection pass completed: 0=none, 1=T+1h, 2=T+24h';

-- Create index for efficient querying of collection status
CREATE INDEX IF NOT EXISTS idx_outcomes_collected_pass 
ON outcomes(collected_pass, decision_id);

