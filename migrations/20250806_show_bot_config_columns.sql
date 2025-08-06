-- Show EXACT bot_config table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'bot_config'
ORDER BY ordinal_position;