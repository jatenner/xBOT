# PURE SQL STATEMENTS FOR SUPABASE

Copy and paste each of these SQL statements ONE AT A TIME into your Supabase SQL Editor:

## Table 1:
```sql
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0.000000,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    daily_date DATE DEFAULT CURRENT_DATE
);
```

## Table 2:
```sql
CREATE TABLE IF NOT EXISTS bot_usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT false,
    execution_time_ms INTEGER,
    memory_used_mb DECIMAL(8,2),
    cpu_usage_percent DECIMAL(5,2),
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    daily_date DATE DEFAULT CURRENT_DATE
);
```

## Table 3:
```sql
CREATE TABLE IF NOT EXISTS twitter_master_config (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    config_type VARCHAR(50) DEFAULT 'general',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    last_updated_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Table 4:
```sql
CREATE TABLE IF NOT EXISTS twitter_master_decisions (
    id BIGSERIAL PRIMARY KEY,
    decision_type VARCHAR(50) NOT NULL,
    context JSONB NOT NULL,
    decision JSONB NOT NULL,
    confidence_score DECIMAL(5,4) DEFAULT 0.0000,
    reasoning TEXT,
    execution_status VARCHAR(20) DEFAULT 'pending',
    actual_outcome JSONB,
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 10),
    learning_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);
```

## Table 5:
```sql
CREATE TABLE IF NOT EXISTS system_health_status (
    id BIGSERIAL PRIMARY KEY,
    component VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'offline')),
    health_score DECIMAL(5,2) DEFAULT 100.00,
    last_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_count INTEGER DEFAULT 0,
    uptime_seconds BIGINT DEFAULT 0,
    performance_metrics JSONB,
    alerts JSONB,
    auto_recovery_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Table 6:
```sql
CREATE TABLE IF NOT EXISTS twitter_platform_intelligence (
    id BIGSERIAL PRIMARY KEY,
    intelligence_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL,
    confidence_level DECIMAL(5,4) DEFAULT 0.0000,
    validation_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    impact_score DECIMAL(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    learned_from_tweets INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Table 7:
```sql
CREATE TABLE IF NOT EXISTS content_strategy_decisions (
    id BIGSERIAL PRIMARY KEY,
    strategy_type VARCHAR(50) NOT NULL,
    content_theme VARCHAR(100),
    decision_data JSONB NOT NULL,
    expected_outcome JSONB,
    actual_outcome JSONB,
    performance_score DECIMAL(5,2),
    audience_segment VARCHAR(100),
    timing_factors JSONB,
    market_conditions JSONB,
    success_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    measured_at TIMESTAMP WITH TIME ZONE
);
```

## Table 8:
```sql
CREATE TABLE IF NOT EXISTS twitter_relationships (
    id BIGSERIAL PRIMARY KEY,
    twitter_user_id VARCHAR(50) NOT NULL,
    username VARCHAR(100),
    relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('following', 'follower', 'mutual', 'targeted')),
    follower_count INTEGER,
    following_count INTEGER,
    engagement_rate DECIMAL(5,4),
    influence_score DECIMAL(5,2),
    content_relevance DECIMAL(5,4),
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    interaction_history JSONB,
    strategic_value VARCHAR(20) DEFAULT 'low',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Table 9:
```sql
CREATE TABLE IF NOT EXISTS strategic_engagements (
    id BIGSERIAL PRIMARY KEY,
    target_user_id VARCHAR(50) NOT NULL,
    target_username VARCHAR(100),
    engagement_type VARCHAR(30) NOT NULL,
    content_id VARCHAR(50),
    strategy_reasoning TEXT,
    expected_outcome JSONB,
    actual_outcome JSONB,
    engagement_success BOOLEAN,
    response_received BOOLEAN DEFAULT false,
    response_content TEXT,
    strategic_value_realized DECIMAL(5,2),
    follow_up_actions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    measured_at TIMESTAMP WITH TIME ZONE
);
```

## Table 10:
```sql
CREATE TABLE IF NOT EXISTS follower_growth_analytics (
    id BIGSERIAL PRIMARY KEY,
    measurement_date DATE DEFAULT CURRENT_DATE,
    follower_count INTEGER NOT NULL,
    followers_gained_daily INTEGER DEFAULT 0,
    followers_lost_daily INTEGER DEFAULT 0,
    net_growth_daily INTEGER DEFAULT 0,
    growth_rate_percent DECIMAL(5,4) DEFAULT 0.0000,
    growth_attribution JSONB,
    engagement_metrics JSONB,
    quality_metrics JSONB,
    strategic_analysis JSONB,
    ai_insights JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Table 11:
```sql
CREATE TABLE IF NOT EXISTS content_performance_learning (
    id BIGSERIAL PRIMARY KEY,
    content_id VARCHAR(50),
    content_type VARCHAR(50),
    content_features JSONB NOT NULL,
    performance_metrics JSONB NOT NULL,
    audience_response JSONB,
    timing_factors JSONB,
    engagement_patterns JSONB,
    viral_indicators JSONB,
    learning_insights JSONB,
    predictive_accuracy DECIMAL(5,4),
    confidence_level DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE
);
```

## Table 12:
```sql
CREATE TABLE IF NOT EXISTS trending_opportunities (
    id BIGSERIAL PRIMARY KEY,
    trend_type VARCHAR(50) NOT NULL,
    trend_data JSONB NOT NULL,
    opportunity_score DECIMAL(5,2) DEFAULT 0.00,
    time_sensitivity VARCHAR(20) DEFAULT 'medium',
    target_audience JSONB,
    content_suggestions JSONB,
    competition_analysis JSONB,
    risk_assessment JSONB,
    expected_roi DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'identified',
    exploited_at TIMESTAMP WITH TIME ZONE,
    results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);
```

## After all tables are created, add constraints:
```sql
ALTER TABLE twitter_master_config ADD CONSTRAINT twitter_master_config_config_key_key UNIQUE (config_key);
```

```sql
ALTER TABLE system_health_status ADD CONSTRAINT system_health_status_component_key UNIQUE (component);
```

## Insert initial data:
```sql
INSERT INTO twitter_master_config (config_key, config_value, config_type, description) VALUES ('follower_growth_target', '{"daily": 10, "weekly": 70, "monthly": 300}', 'growth', 'Target follower growth rates');
```

```sql
INSERT INTO twitter_master_config (config_key, config_value, config_type, description) VALUES ('content_quality_thresholds', '{"viral_score": 0.7, "quality_score": 0.8, "boring_score": 0.3}', 'content', 'Content quality thresholds');
```

```sql
INSERT INTO twitter_master_config (config_key, config_value, config_type, description) VALUES ('autonomous_operation', '{"enabled": true, "learning_mode": true, "auto_posting": true}', 'system', 'Autonomous operation settings');
```

```sql
INSERT INTO system_health_status (component, status, health_score) VALUES ('autonomous_growth_master', 'healthy', 100.00);
```

```sql
INSERT INTO system_health_status (component, status, health_score) VALUES ('posting_engine', 'healthy', 100.00);
```

```sql
INSERT INTO system_health_status (component, status, health_score) VALUES ('learning_system', 'healthy', 100.00);
```

```sql
INSERT INTO system_health_status (component, status, health_score) VALUES ('prediction_engine', 'healthy', 100.00);
``` 