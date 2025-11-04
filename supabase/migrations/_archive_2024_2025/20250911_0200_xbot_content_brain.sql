-- xBot Content Brain Schema - Complete System
-- Migration: 20250911_0200_xbot_content_brain.sql
-- Idempotent schema for health-first content generation and learning

BEGIN;

-- API usage tracking with enhanced cost and tagging
CREATE TABLE IF NOT EXISTS public.api_usage (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model TEXT,
    cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
    tag TEXT,
    payload JSONB
);

-- Create indexes for api_usage
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_tag ON public.api_usage(tag);
CREATE INDEX IF NOT EXISTS idx_api_usage_model ON public.api_usage(model) WHERE model IS NOT NULL;

-- Content generation and posting events
CREATE TABLE IF NOT EXISTS public.content_events (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event TEXT NOT NULL,  -- generated, posted, replied, skipped, failed
    post_id TEXT,
    kind TEXT,            -- single, thread, reply
    meta JSONB           -- topic, format, model_used, cost_usd, confidence, etc.
);

-- Create indexes for content_events
CREATE INDEX IF NOT EXISTS idx_content_events_event ON public.content_events(event);
CREATE INDEX IF NOT EXISTS idx_content_events_kind ON public.content_events(kind);
CREATE INDEX IF NOT EXISTS idx_content_events_created_at ON public.content_events(created_at);
CREATE INDEX IF NOT EXISTS idx_content_events_post_id ON public.content_events(post_id);

-- Learning metrics from post performance
CREATE TABLE IF NOT EXISTS public.learn_metrics (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    post_id TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    bookmarks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr NUMERIC(6,4),
    engagement_rate NUMERIC(6,4),
    reach_efficiency NUMERIC(6,4)
);

-- Create indexes for learn_metrics
CREATE INDEX IF NOT EXISTS idx_learn_metrics_post_created_at ON public.learn_metrics(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learn_metrics_created_at ON public.learn_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_learn_metrics_engagement ON public.learn_metrics(engagement_rate) WHERE engagement_rate IS NOT NULL;

-- AI decision logging for Thompson Sampling optimization
CREATE TABLE IF NOT EXISTS public.decision_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL,  -- choose_slot, pick_topic, format_decision, bandit_update
    reason TEXT,
    score NUMERIC(5,2),
    params JSONB          -- bandit arms, exploration vs exploit, etc.
);

-- Create indexes for decision_log
CREATE INDEX IF NOT EXISTS idx_decision_log_action ON public.decision_log(action);
CREATE INDEX IF NOT EXISTS idx_decision_log_created_at ON public.decision_log(created_at);
CREATE INDEX IF NOT EXISTS idx_decision_log_params ON public.decision_log USING GIN(params);

-- Bandit arms tracking for Thompson Sampling
CREATE TABLE IF NOT EXISTS public.bandit_arms (
    id BIGSERIAL PRIMARY KEY,
    arm_key TEXT NOT NULL UNIQUE,  -- topic:format:time_slot
    successes INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    alpha NUMERIC(8,4) DEFAULT 1.0,  -- Beta distribution parameters
    beta NUMERIC(8,4) DEFAULT 1.0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB  -- arm details: topic, format, time_slot, etc.
);

-- Create indexes for bandit_arms
CREATE INDEX IF NOT EXISTS idx_bandit_arms_key ON public.bandit_arms(arm_key);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_updated ON public.bandit_arms(last_updated);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_performance ON public.bandit_arms(successes, attempts);

-- Budget tracking for daily spend management
CREATE TABLE IF NOT EXISTS public.budget_tracking (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    spent_usd NUMERIC(8,4) DEFAULT 0,
    limit_usd NUMERIC(8,4) DEFAULT 5.0,
    hourly_breakdown JSONB,  -- spend by hour for pacing
    model_breakdown JSONB,   -- spend by model for optimization
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

-- Create indexes for budget_tracking
CREATE INDEX IF NOT EXISTS idx_budget_tracking_date ON public.budget_tracking(date);

-- Content quality metrics for regret checking
CREATE TABLE IF NOT EXISTS public.quality_metrics (
    id BIGSERIAL PRIMARY KEY,
    post_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    regret_check_passed BOOLEAN,
    fact_check_score NUMERIC(3,2),
    helpfulness_score NUMERIC(3,2),
    confidence_score NUMERIC(3,2),
    quality_gates JSONB,  -- detailed gate results
    human_feedback INTEGER,  -- -1, 0, 1 for bad, neutral, good
    UNIQUE(post_id)
);

-- Create indexes for quality_metrics
CREATE INDEX IF NOT EXISTS idx_quality_metrics_post_id ON public.quality_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_created_at ON public.quality_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_scores ON public.quality_metrics(fact_check_score, helpfulness_score, confidence_score);

-- Enable Row Level Security on all tables
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learn_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bandit_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_metrics ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies
DO $$
BEGIN
    -- Drop existing policies for clean setup
    DROP POLICY IF EXISTS "allow_all_api_usage" ON public.api_usage;
    DROP POLICY IF EXISTS "allow_all_content_events" ON public.content_events;
    DROP POLICY IF EXISTS "allow_all_learn_metrics" ON public.learn_metrics;
    DROP POLICY IF EXISTS "allow_all_decision_log" ON public.decision_log;
    DROP POLICY IF EXISTS "allow_all_bandit_arms" ON public.bandit_arms;
    DROP POLICY IF EXISTS "allow_all_budget_tracking" ON public.budget_tracking;
    DROP POLICY IF EXISTS "allow_all_quality_metrics" ON public.quality_metrics;
    
    -- Create permissive policies for service operations
    CREATE POLICY "allow_all_api_usage" ON public.api_usage FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_content_events" ON public.content_events FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_learn_metrics" ON public.learn_metrics FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_decision_log" ON public.decision_log FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_bandit_arms" ON public.bandit_arms FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_budget_tracking" ON public.budget_tracking FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_quality_metrics" ON public.quality_metrics FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Grant comprehensive permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Create helpful views for analytics
CREATE OR REPLACE VIEW public.daily_content_summary AS
SELECT 
    DATE(created_at) as date,
    event,
    kind,
    COUNT(*) as count,
    AVG((meta->>'cost_usd')::numeric) as avg_cost,
    SUM((meta->>'cost_usd')::numeric) as total_cost
FROM public.content_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), event, kind
ORDER BY date DESC, count DESC;

CREATE OR REPLACE VIEW public.top_performing_content AS
SELECT 
    ce.post_id,
    ce.meta->>'topic' as topic,
    ce.kind,
    lm.engagement_rate,
    lm.likes + lm.reposts + lm.comments as total_engagement,
    lm.impressions,
    ce.created_at as posted_at
FROM public.content_events ce
JOIN public.learn_metrics lm ON ce.post_id = lm.post_id
WHERE ce.event = 'posted' 
    AND lm.engagement_rate IS NOT NULL
    AND lm.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY lm.engagement_rate DESC
LIMIT 50;

-- Initialize budget tracking for today
INSERT INTO public.budget_tracking (date, limit_usd) 
VALUES (CURRENT_DATE, 5.0) 
ON CONFLICT (date) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.api_usage IS 'OpenAI API usage tracking with cost and model information';
COMMENT ON TABLE public.content_events IS 'Content generation, posting, and engagement events';
COMMENT ON TABLE public.learn_metrics IS 'Post performance metrics for learning optimization';
COMMENT ON TABLE public.decision_log IS 'AI decision tracking for bandit algorithm optimization';
COMMENT ON TABLE public.bandit_arms IS 'Thompson Sampling bandit arms for content strategy';
COMMENT ON TABLE public.budget_tracking IS 'Daily budget management and spend tracking';
COMMENT ON TABLE public.quality_metrics IS 'Content quality scores and regret checking results';

-- Create function to update bandit arms
CREATE OR REPLACE FUNCTION public.update_bandit_arm(
    p_arm_key TEXT,
    p_success BOOLEAN,
    p_meta JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO public.bandit_arms (arm_key, successes, attempts, meta, last_updated)
    VALUES (
        p_arm_key,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        1,
        p_meta,
        NOW()
    )
    ON CONFLICT (arm_key) DO UPDATE SET
        successes = bandit_arms.successes + CASE WHEN p_success THEN 1 ELSE 0 END,
        attempts = bandit_arms.attempts + 1,
        alpha = bandit_arms.successes + 1,
        beta = bandit_arms.attempts - bandit_arms.successes + 1,
        last_updated = NOW(),
        meta = CASE WHEN p_meta IS NOT NULL THEN p_meta ELSE bandit_arms.meta END;
END;
$$ LANGUAGE plpgsql;

-- Create function to get daily spend
CREATE OR REPLACE FUNCTION public.get_daily_spend(p_date DATE DEFAULT CURRENT_DATE) 
RETURNS NUMERIC AS $$
DECLARE
    total_spend NUMERIC;
BEGIN
    SELECT COALESCE(spent_usd, 0) INTO total_spend
    FROM public.budget_tracking
    WHERE date = p_date;
    
    RETURN COALESCE(total_spend, 0);
END;
$$ LANGUAGE plpgsql;

-- PostgREST schema reload notification
NOTIFY pgrst, 'reload schema';

-- Verification test with new schema
DO $$
DECLARE
    test_post_id TEXT := 'test_' || extract(epoch from now())::text;
    test_count INTEGER;
BEGIN
    -- Test content_events insert
    INSERT INTO public.content_events (event, post_id, kind, meta)
    VALUES (
        'generated', 
        test_post_id, 
        'single', 
        '{"topic": "nutrition", "model_used": "gpt-4", "cost_usd": 0.01, "confidence": 0.95}'::jsonb
    );
    
    -- Test learn_metrics insert
    INSERT INTO public.learn_metrics (post_id, likes, engagement_rate)
    VALUES (test_post_id, 5, 0.025);
    
    -- Test bandit arm update
    PERFORM public.update_bandit_arm(
        'nutrition:single:morning',
        true,
        '{"topic": "nutrition", "format": "single", "time_slot": "morning"}'::jsonb
    );
    
    -- Verify all inserts
    SELECT COUNT(*) INTO test_count 
    FROM public.content_events 
    WHERE post_id = test_post_id;
    
    IF test_count = 1 THEN
        RAISE NOTICE 'SUCCESS: Content brain schema verification passed (post_id: %)', test_post_id;
        -- Clean up test records
        DELETE FROM public.content_events WHERE post_id = test_post_id;
        DELETE FROM public.learn_metrics WHERE post_id = test_post_id;
        DELETE FROM public.bandit_arms WHERE arm_key = 'nutrition:single:morning';
    ELSE
        RAISE EXCEPTION 'FAILURE: Content brain schema verification failed';
    END IF;
END $$;

COMMIT;

-- Final success message
SELECT 'Content Brain schema migration completed successfully!' as status;
