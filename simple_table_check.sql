-- Simple check to see if tables exist
SELECT 
    'tweets' as table_name, 
    (SELECT COUNT(*) FROM tweets) as row_count
UNION ALL
SELECT 
    'bot_config' as table_name, 
    (SELECT COUNT(*) FROM bot_config) as row_count
UNION ALL
SELECT 
    'daily_budgets' as table_name, 
    (SELECT COUNT(*) FROM daily_budgets) as row_count
UNION ALL
SELECT 
    'learning_posts' as table_name, 
    (SELECT COUNT(*) FROM learning_posts) as row_count
UNION ALL
SELECT 
    'engagement_metrics' as table_name, 
    (SELECT COUNT(*) FROM engagement_metrics) as row_count;