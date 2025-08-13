-- Fix Max Daily Posts Configuration
-- Set to 100 to allow bot freedom to choose optimal posting frequency

-- Update existing config if it exists
UPDATE bot_config 
SET value = '100' 
WHERE key = 'max_daily_posts';

-- Insert if it doesn't exist
INSERT INTO bot_config (key, value) 
VALUES ('max_daily_posts', '100')
ON CONFLICT (key) DO UPDATE SET value = '100';

-- Verify the change
SELECT key, value FROM bot_config WHERE key = 'max_daily_posts';

-- Also clean up any conflicting config keys
UPDATE bot_config 
SET value = '100' 
WHERE key IN ('MAX_DAILY_POSTS', 'max_posts_per_day', 'daily_post_limit');