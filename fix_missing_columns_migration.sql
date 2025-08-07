-- 🔧 STEP 1: FIX MISSING COLUMNS MIGRATION
-- ==========================================
-- This fixes the immediate database storage errors we're seeing in the logs
-- Date: 2025-08-06

-- First, let's see what tables and columns actually exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name IN ('tweet_analytics', 'post_history', 'tweets')
ORDER BY table_name, ordinal_position;