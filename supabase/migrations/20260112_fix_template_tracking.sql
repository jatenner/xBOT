-- Fix template tracking: Remove "pending" strings, add template_status column

-- Step 1: Add template_status column
ALTER TABLE reply_decisions
  ADD COLUMN IF NOT EXISTS template_status text CHECK (template_status IN ('PENDING', 'SET', 'FAILED')) DEFAULT 'PENDING';

-- Step 2: Clean existing "pending" values
UPDATE reply_decisions
SET 
  template_id = NULL,
  prompt_version = NULL,
  template_status = 'PENDING'
WHERE template_id = 'pending' OR prompt_version = 'pending';

-- Step 3: Set template_status='SET' for rows that have actual template_id
UPDATE reply_decisions
SET template_status = 'SET'
WHERE template_id IS NOT NULL 
  AND template_id != 'pending'
  AND template_status = 'PENDING';

-- Step 4: Add index for analytics
CREATE INDEX IF NOT EXISTS idx_reply_decisions_template_status ON reply_decisions(template_status, created_at);

-- Step 5: Add comment
COMMENT ON COLUMN reply_decisions.template_status IS 'Template selection status: PENDING=not selected yet, SET=selected successfully, FAILED=selection failed';
