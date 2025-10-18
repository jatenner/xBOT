-- Fix posted_decisions table to accept 'single', 'thread', 'reply'
-- Currently only accepts 'content', 'reply' which causes archive failures

BEGIN;

-- Drop the old constraint
ALTER TABLE posted_decisions 
DROP CONSTRAINT IF EXISTS posted_decisions_decision_type_check;

-- Add new constraint with correct values
ALTER TABLE posted_decisions
ADD CONSTRAINT posted_decisions_decision_type_check 
CHECK (decision_type IN ('single', 'thread', 'reply'));

COMMIT;
