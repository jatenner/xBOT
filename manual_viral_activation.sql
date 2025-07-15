-- 🚀 MANUAL VIRAL ACTIVATION - Direct SQL Commands
-- ================================================
-- This manually activates viral content mode and disables academic emergency mode

-- 1. DISABLE EMERGENCY MODE
INSERT INTO bot_config (key, value, description) VALUES 
('emergency_mode_disabled', '{
  "emergency_mode": false,
  "disable_learning_agents": false,
  "disable_autonomous_learning": false,
  "normal_operation": true,
  "daily_budget_limit": 3.00,
  "max_posts_per_day": 15,
  "enable_viral_agents": true,
  "enable_growth_optimization": true,
  "timestamp": "2025-07-15T10:00:00.000Z"
}', 'Emergency mode disabled - viral growth system activated')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 2. ACTIVATE VIRAL CONTENT MODE (50% viral vs 10% academic)
INSERT INTO bot_config (key, value, description) VALUES 
('content_mode_override', '{
  "mode": "viral_follower_growth",
  "academic_content_percentage": 10,
  "viral_content_percentage": 50,
  "controversial_percentage": 20,
  "personality_percentage": 20,
  "enabled": true,
  "priority": "HIGHEST"
}', 'VIRAL MODE: Optimized for maximum follower growth')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 3. VIRAL CONTENT TYPE WEIGHTS
INSERT INTO bot_config (key, value, description) VALUES 
('viral_content_weights', '{
  "hot_takes": 25,
  "behind_scenes": 20,
  "personal_stories": 20,
  "trend_jacking": 15,
  "value_bombs": 15,
  "controversy": 5
}', 'Content type distribution for viral growth')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. ENABLE ALL VIRAL AGENTS
INSERT INTO bot_config (key, value, description) VALUES 
('viral_agents_enabled', '{
  "viral_follower_growth_agent": true,
  "viral_health_theme_agent": true,
  "engagement_maximizer_agent": true,
  "streamlined_post_agent": true,
  "ultra_viral_generator": true,
  "aggressive_engagement_agent": true,
  "audience_engagement_engine": true,
  "all_systems_active": true
}', 'All viral growth agents activated')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 5. SWITCH TO VIRAL POSTING AGENT
INSERT INTO bot_config (key, value, description) VALUES 
('main_posting_agent', '{
  "agent": "StreamlinedPostAgent",
  "mode": "viral_follower_growth",
  "priority": "HIGHEST",
  "academic_mode_disabled": true,
  "viral_mode_active": true
}', 'Switched to StreamlinedPostAgent for viral growth')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 6. ENABLE LEARNING AGENTS
INSERT INTO bot_config (key, value, description) VALUES 
('learning_agents_enabled', '{
  "adaptive_content_learner": true,
  "autonomous_learning_agent": true,
  "engagement_feedback_agent": true,
  "strategy_learner": true,
  "competitive_intelligence_learner": true,
  "real_time_engagement_tracker": true,
  "learning_from_engagement": true,
  "self_optimization": true
}', 'All learning agents enabled for follower growth')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 7. ENGAGEMENT OPTIMIZATION
INSERT INTO bot_config (key, value, description) VALUES 
('engagement_optimization', '{
  "target_engagement_rate": 5.0,
  "follower_growth_priority": true,
  "learn_from_viral_posts": true,
  "optimize_posting_times": true,
  "track_engagement_patterns": true,
  "adapt_content_strategy": true,
  "viral_content_boost": true,
  "engagement_triggers_enabled": true
}', 'Engagement optimization for follower growth')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 8. GROWTH METRICS TRACKING
INSERT INTO bot_config (key, value, description) VALUES 
('growth_metrics_tracking', '{
  "track_follower_growth": true,
  "track_engagement_rates": true,
  "track_viral_content_performance": true,
  "daily_growth_targets": {
    "followers": 5,
    "likes": 50,
    "retweets": 10,
    "replies": 20
  },
  "optimize_for_growth": true
}', 'Growth metrics and targets for viral success')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 9. DELETE EMERGENCY BLOCKS
DELETE FROM bot_config WHERE key IN (
  'emergency_search_block',
  'emergency_timing',
  'emergency_rate_limits',
  'emergency_posting_disabled',
  'monthly_cap_emergency_mode'
);

-- 10. VERIFY VIRAL ACTIVATION
SELECT 
  '🚀 VIRAL GROWTH SYSTEM STATUS' as section,
  key,
  value->>'mode' as mode,
  value->>'enabled' as enabled,
  value->>'priority' as priority
FROM bot_config 
WHERE key IN (
  'content_mode_override',
  'viral_agents_enabled',
  'main_posting_agent',
  'learning_agents_enabled'
)
ORDER BY key;

-- 11. SHOW CURRENT POSTING SCHEDULE
SELECT 
  '📅 POSTING SCHEDULE STATUS' as section,
  date,
  tweets_posted,
  max_daily_tweets,
  strategy,
  emergency_mode,
  anti_burst_active
FROM daily_posting_state 
WHERE date = CURRENT_DATE;

-- SUCCESS MESSAGE
SELECT '✅ VIRAL GROWTH SYSTEM MANUALLY ACTIVATED!' as final_status; 