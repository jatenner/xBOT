-- 🔍 DATABASE STRUCTURE CHECK
-- ============================
-- Run this first to understand the current database structure

-- Check what tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check migration_history table structure specifically
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'migration_history'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check what migrations have been applied
SELECT 
  filename,
  applied_at
FROM migration_history 
ORDER BY applied_at DESC
LIMIT 10;