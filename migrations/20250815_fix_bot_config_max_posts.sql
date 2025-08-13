-- Update max_daily_posts in bot_config to 100
UPDATE bot_config 
SET value = '100' 
WHERE key = 'max_daily_posts' AND value IS DISTINCT FROM '100';

-- Insert if it doesn't exist
INSERT INTO bot_config (key, value) 
VALUES ('max_daily_posts', '100')
ON CONFLICT (key) DO NOTHING;