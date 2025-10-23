-- Check what columns actually exist in post_attribution table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'post_attribution'
ORDER BY ordinal_position;
