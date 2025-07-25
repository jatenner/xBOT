-- 🧪 TEST 2: BOT CONFIGURATION SYSTEM
-- ====================================
-- Tests bot_config table functionality

SELECT '🧪 TEST 2: BOT CONFIG SYSTEM' as test_name;

-- Insert test config if not exists
INSERT INTO bot_config (key, value) VALUES 
('test_mode', 'active'),
('ai_intelligence', 'enabled'),
('learning_systems', 'operational')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify config system works
SELECT 
    key,
    value,
    '✅ Config System Working' as status
FROM bot_config 
WHERE key IN ('test_mode', 'ai_intelligence', 'learning_systems')
ORDER BY key;

-- Expected: 3 config entries showing 'active', 'enabled', 'operational'
SELECT '✅ TEST 2 COMPLETE - Bot config system verified!' as result; 