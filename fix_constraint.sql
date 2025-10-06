-- Quick fix for database constraint
ALTER TABLE content_metadata DROP CONSTRAINT IF EXISTS content_metadata_decision_type_check;
ALTER TABLE content_metadata ADD CONSTRAINT content_metadata_decision_type_check CHECK (decision_type IN ('content', 'reply', 'thread'));
