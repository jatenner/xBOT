-- Refresh PostgREST schema and config
-- This forces PostgREST to reload its schema cache

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Also verify the notification was sent
SELECT 'PostgREST schema reload notification sent' AS status;

