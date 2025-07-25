-- 🚨 EMERGENCY CONTENT DIVERSITY FIX
-- ===================================
-- Stop repetitive content immediately and force diversity

-- 1. CREATE BLACKLIST OF OVERUSED CONTENT PATTERNS
CREATE TABLE IF NOT EXISTS content_blacklist (
    id SERIAL PRIMARY KEY,
    pattern TEXT NOT NULL,
    pattern_type VARCHAR(50), -- 'exact', 'substring', 'regex'
    reason TEXT,
    times_blocked INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. POPULATE BLACKLIST WITH REPETITIVE PATTERNS FROM TWITTER
INSERT INTO content_blacklist (pattern, pattern_type, reason) VALUES
-- Exact phrases that have been repeated
('Industry secret they don''t want you to know', 'substring', 'Overused opening phrase'),
('Shocking discovery from Stanford study', 'substring', 'Repetitive study reference'),
('Medical breakthrough everyone missed', 'substring', 'Overused breakthrough phrase'),
('Billion dollar companies hide this fact', 'substring', 'Repetitive conspiracy opening'),
('Plot twist nobody saw coming', 'substring', 'Overused plot twist opener'),
('Your doctor probably', 'substring', 'Overused doctor reference'),
('Most people think', 'substring', 'Overused assumption starter'),
('The truth is', 'substring', 'Generic truth claim'),
('Here''s what they don''t tell you', 'substring', 'Conspiracy theory language'),
('New research reveals', 'substring', 'Overused research intro'),

-- Specific content that was repeated
('statins prevent heart attacks but may increase overall mortality', 'substring', 'Repeated statins content'),
('16:8 intermittent fasting can disrupt women''s hormones', 'substring', 'Repeated fasting content'),
('anxiety and depression has metabolic roots', 'substring', 'Repeated anxiety content'),
('working out fasted can backfire', 'substring', 'Repeated fasted workout content'),
('caloric restriction extends lifespan', 'substring', 'Repeated caloric restriction'),
('expensive skincare routines often cause the problems', 'substring', 'Repeated skincare content'),
('8 glasses of water daily can actually dehydrate you', 'substring', 'Repeated water content'),
('blue light glasses are mostly placebo', 'substring', 'Repeated blue light content'),
('Mediterranean diet studies were flawed', 'substring', 'Repeated diet content'),
('HIIT training is overrated', 'substring', 'Repeated HIIT content'),

-- Overused sentence structures
('How it works:', 'substring', 'Overused explanation structure'),
('The mechanism:', 'substring', 'Overused science language'),
('The biological reason:', 'substring', 'Overused biology explanation'),
('The science behind it:', 'substring', 'Overused science reference'),
('based on average population data, not your unique', 'substring', 'Repeated Fitbit criticism'),
('cholesterol is essential for hormone production', 'substring', 'Repeated cholesterol content');

-- 3. CREATE CONTENT DIVERSITY ENFORCEMENT FUNCTION
CREATE OR REPLACE FUNCTION check_content_diversity(new_content TEXT)
RETURNS TABLE(
    is_diverse BOOLEAN,
    rejection_reason TEXT,
    similarity_score DECIMAL(5,2)
) AS $$
DECLARE
    blacklist_record RECORD;
    recent_content_record RECORD;
    content_lower TEXT;
    similarity DECIMAL(5,2);
BEGIN
    content_lower := lower(new_content);
    
    -- Check against blacklist
    FOR blacklist_record IN 
        SELECT pattern, reason FROM content_blacklist 
        WHERE pattern_type = 'substring'
    LOOP
        IF content_lower LIKE '%' || lower(blacklist_record.pattern) || '%' THEN
            -- Update blacklist usage count
            UPDATE content_blacklist 
            SET times_blocked = times_blocked + 1 
            WHERE pattern = blacklist_record.pattern;
            
            RETURN QUERY SELECT false, 'Blacklisted pattern: ' || blacklist_record.reason, 100.0::DECIMAL(5,2);
            RETURN;
        END IF;
    END LOOP;
    
    -- Check against recent content (last 50 tweets)
    FOR recent_content_record IN 
        SELECT content FROM tweets 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC 
        LIMIT 50
    LOOP
        -- Simple similarity check (length of common substrings)
        similarity := (
            SELECT COUNT(*) * 100.0 / GREATEST(LENGTH(new_content), LENGTH(recent_content_record.content))
            FROM (
                SELECT unnest(string_to_array(lower(new_content), ' ')) AS word
                INTERSECT
                SELECT unnest(string_to_array(lower(recent_content_record.content), ' ')) AS word
            ) common_words
        );
        
        IF similarity > 70 THEN
            RETURN QUERY SELECT false, 'Too similar to recent content: ' || similarity || '% match', similarity;
            RETURN;
        END IF;
    END LOOP;
    
    -- Content is diverse
    RETURN QUERY SELECT true, 'Content passed diversity check', 0.0::DECIMAL(5,2);
END;
$$ LANGUAGE plpgsql;

-- 4. CREATE DIVERSE CONTENT TEMPLATE ROTATION SYSTEM
CREATE TABLE IF NOT EXISTS content_template_rotation (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    template_structure TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    performance_score DECIMAL(5,2) DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    cooldown_hours INTEGER DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. POPULATE WITH DIVERSE TEMPLATES
INSERT INTO content_template_rotation (template_name, template_structure, cooldown_hours) VALUES
('research_finding', 'Recent [UNIVERSITY] research: [FINDING]. Key insight: [PRACTICAL_APPLICATION].', 12),
('contrarian_insight', 'Unpopular opinion: [CONTRARIAN_VIEW]. Why this matters: [EXPLANATION].', 24),
('practical_tip', 'Simple health hack: [ACTION]. Results: [MEASURABLE_OUTCOME] in [TIMEFRAME].', 8),
('myth_busting', 'Common myth: [MYTH]. Reality: [TRUTH]. The difference: [IMPACT].', 18),
('personal_experiment', 'Tried [EXPERIMENT] for [DURATION]. Surprising result: [OUTCOME].', 36),
('data_insight', '[STATISTIC] of people don''t know: [FACT]. This explains why [CONSEQUENCE].', 16),
('expert_insight', 'Learned from [EXPERT_TYPE]: [INSIGHT]. Game changer: [APPLICATION].', 20),
('trend_analysis', 'Notice the trend: [OBSERVATION]. Behind the scenes: [ROOT_CAUSE].', 14),
('evolutionary_perspective', 'From evolutionary biology: [PRINCIPLE]. Modern application: [RELEVANCE].', 30),
('biochemistry_simplified', 'Your body does this: [PROCESS]. Optimization: [METHOD]. Timeline: [RESULTS].', 10);

-- 6. CREATE TOPIC DIVERSITY TRACKER
CREATE TABLE IF NOT EXISTS topic_diversity_tracker (
    id SERIAL PRIMARY KEY,
    topic_category VARCHAR(100) NOT NULL,
    subtopic VARCHAR(200),
    last_covered_at TIMESTAMPTZ,
    coverage_count INTEGER DEFAULT 0,
    engagement_avg DECIMAL(10,2) DEFAULT 0,
    is_trending BOOLEAN DEFAULT false,
    cooldown_hours INTEGER DEFAULT 48,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. POPULATE TOPIC DIVERSITY
INSERT INTO topic_diversity_tracker (topic_category, subtopic, cooldown_hours) VALUES
('sleep_optimization', 'temperature_regulation', 24),
('sleep_optimization', 'light_exposure', 36),
('sleep_optimization', 'supplements', 18),
('nutrition_science', 'meal_timing', 30),
('nutrition_science', 'micronutrients', 24),
('nutrition_science', 'gut_health', 48),
('exercise_physiology', 'recovery_methods', 36),
('exercise_physiology', 'training_protocols', 24),
('exercise_physiology', 'movement_quality', 48),
('cognitive_enhancement', 'focus_techniques', 30),
('cognitive_enhancement', 'memory_optimization', 36),
('cognitive_enhancement', 'stress_management', 18),
('longevity_research', 'cellular_health', 72),
('longevity_research', 'hormone_optimization', 48),
('longevity_research', 'inflammation_control', 36),
('biohacking_tools', 'wearable_insights', 24),
('biohacking_tools', 'environmental_factors', 48),
('biohacking_tools', 'measurement_methods', 36);

-- 8. CONTENT DIVERSITY VERIFICATION FUNCTION
CREATE OR REPLACE FUNCTION verify_content_diversity()
RETURNS TABLE(
    total_unique_content INTEGER,
    blacklisted_patterns INTEGER,
    template_diversity_score DECIMAL(5,2),
    topic_diversity_score DECIMAL(5,2),
    overall_diversity_health VARCHAR(20)
) AS $$
DECLARE
    unique_count INTEGER;
    blacklist_count INTEGER;
    template_score DECIMAL(5,2);
    topic_score DECIMAL(5,2);
    health_status VARCHAR(20);
BEGIN
    -- Count unique content
    SELECT COUNT(DISTINCT content_hash) INTO unique_count FROM tweets;
    
    -- Count blacklisted attempts
    SELECT SUM(times_blocked) INTO blacklist_count FROM content_blacklist;
    
    -- Calculate template diversity (how evenly templates are used)
    SELECT 
        100 - (STDDEV(usage_count) * 100.0 / NULLIF(AVG(usage_count), 0))
    INTO template_score
    FROM content_template_rotation;
    
    -- Calculate topic diversity
    SELECT 
        100 - (STDDEV(coverage_count) * 100.0 / NULLIF(AVG(coverage_count), 0))
    INTO topic_score
    FROM topic_diversity_tracker;
    
    -- Determine overall health
    IF COALESCE(template_score, 0) > 80 AND COALESCE(topic_score, 0) > 80 THEN
        health_status := 'EXCELLENT';
    ELSIF COALESCE(template_score, 0) > 60 AND COALESCE(topic_score, 0) > 60 THEN
        health_status := 'GOOD';
    ELSIF COALESCE(template_score, 0) > 40 AND COALESCE(topic_score, 0) > 40 THEN
        health_status := 'FAIR';
    ELSE
        health_status := 'POOR';
    END IF;
    
    RETURN QUERY SELECT 
        unique_count,
        COALESCE(blacklist_count, 0),
        COALESCE(template_score, 0),
        COALESCE(topic_score, 0),
        health_status;
END;
$$ LANGUAGE plpgsql;

-- 9. TEST THE DIVERSITY SYSTEM
SELECT 'TESTING CONTENT DIVERSITY SYSTEM:' as test_phase;

-- Test blacklist detection
SELECT * FROM check_content_diversity('Industry secret they don''t want you to know about sleep');

-- Test similarity detection (using existing content)
SELECT * FROM check_content_diversity('System integration test tweet for verification');

-- Test diverse content (should pass)
SELECT * FROM check_content_diversity('Magnesium deficiency affects 80% of adults. Simple test: crave chocolate? Low magnesium. Solution: 400mg before bed improves sleep quality within 3 days.');

-- 10. VERIFY SYSTEM STATUS
SELECT * FROM verify_content_diversity();

SELECT '🚨 EMERGENCY CONTENT DIVERSITY FIX COMPLETE!' as final_status;
SELECT 'System now actively prevents repetitive content!' as next_step; 