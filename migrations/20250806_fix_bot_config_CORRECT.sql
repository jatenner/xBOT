-- CORRECT bot_config fix - Based on ACTUAL table structure
-- Table has: id, key (NOT NULL), value (NOT NULL), created_at, updated_at

-- Insert default configuration values using the ACTUAL column names
INSERT INTO bot_config (key, value) VALUES
    ('growth_metrics', '{"reset_count": 0, "last_reset": null}'),
    ('viral_mode', '{"enabled": false, "activated_at": null}'),
    ('posting_strategy', '{"current": "conservative", "updated_at": null}')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW()
WHERE bot_config.value IS NULL OR bot_config.value = '' OR bot_config.value = '{}';

-- Show what we inserted
SELECT key, value FROM bot_config WHERE key IN ('growth_metrics', 'viral_mode', 'posting_strategy');