-- Drop the old tier constraint
ALTER TABLE reply_opportunities DROP CONSTRAINT IF EXISTS reply_opportunities_tier_check;

-- Add new constraint with updated tier values
ALTER TABLE reply_opportunities ADD CONSTRAINT reply_opportunities_tier_check 
  CHECK (tier IN ('FRESH', 'FRESH+', 'TRENDING', 'TRENDING+', 'VIRAL', 'VIRAL+', 'MEGA', 'MEGA+', 'HEALTH KEYWORD (300+)', 'HEALTH KEYWORD (500+)', 'golden', 'good', 'acceptable', 'TEST', 'TEST+'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'reply_opportunities'::regclass 
AND conname = 'reply_opportunities_tier_check';
