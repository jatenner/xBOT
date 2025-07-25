-- 🧠 ADD ADVANCED AI TABLES
-- ==========================
-- Adding 3 missing tables your advanced AI systems need

-- 1️⃣ CONTENT UNIQUENESS (prevents duplicate content)
CREATE TABLE IF NOT EXISTS content_uniqueness (
    id SERIAL PRIMARY KEY,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    original_content TEXT NOT NULL,
    normalized_content TEXT NOT NULL,
    content_topic VARCHAR(100),
    content_keywords TEXT[],
    tweet_ids INTEGER[],
    usage_count INTEGER DEFAULT 1,
    first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2️⃣ EXPERT LEARNING DATA (AI intelligence memory)
CREATE TABLE IF NOT EXISTS expert_learning_data (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    extracted_knowledge JSONB,
    domains TEXT[],
    expert_insights JSONB,
    engagement JSONB,
    learning_type VARCHAR(50) DEFAULT 'content_analysis',
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3️⃣ BUDGET TRANSACTIONS (detailed AI cost tracking)
CREATE TABLE IF NOT EXISTS budget_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_usd DECIMAL(8,6) NOT NULL,
    remaining_budget DECIMAL(8,6) NOT NULL,
    description TEXT,
    component VARCHAR(50),
    success BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 🚀 ESSENTIAL INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_hash ON content_uniqueness(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_topic ON content_uniqueness(content_topic);
CREATE INDEX IF NOT EXISTS idx_expert_learning_learned_at ON expert_learning_data(learned_at);
CREATE INDEX IF NOT EXISTS idx_expert_learning_domains ON expert_learning_data USING GIN(domains);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON budget_transactions(date);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_operation ON budget_transactions(operation_type);

-- ✅ VERIFICATION
SELECT '🧠 ADVANCED AI TABLES ADDED!' as status;

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name AND table_schema = 'public') as columns,
    CASE table_name
        WHEN 'bot_config' THEN '⚙️ Settings & Configuration'
        WHEN 'tweets' THEN '🐦 All Tweet Data & Metrics'
        WHEN 'twitter_quota_tracking' THEN '📊 Daily 17-Tweet Limit Tracking'
        WHEN 'engagement_history' THEN '❤️ Likes, Retweets, Replies Log'
        WHEN 'daily_budget_status' THEN '💰 Daily AI Budget Management'
        WHEN 'system_logs' THEN '🔍 Errors & Debug Information'
        WHEN 'content_uniqueness' THEN '🚫 Duplicate Content Prevention'
        WHEN 'expert_learning_data' THEN '🧠 AI Intelligence Memory'
        WHEN 'budget_transactions' THEN '💸 Detailed AI Cost Tracking'
        ELSE '❓ Unknown'
    END as purpose
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name; 