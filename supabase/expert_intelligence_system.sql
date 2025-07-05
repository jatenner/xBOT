-- 🧠 EXPERT INTELLIGENCE SYSTEM DATABASE SCHEMA
-- Creates comprehensive tables for building true expertise and knowledge

-- Expert Knowledge Base - Tracks expertise levels across domains
CREATE TABLE IF NOT EXISTS expert_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,
  expertise_level INTEGER NOT NULL DEFAULT 10 CHECK (expertise_level >= 0 AND expertise_level <= 100),
  knowledge_depth INTEGER NOT NULL DEFAULT 5 CHECK (knowledge_depth >= 0 AND knowledge_depth <= 100),
  recent_insights TEXT[] DEFAULT '{}',
  key_connections TEXT[] DEFAULT '{}',
  trend_predictions TEXT[] DEFAULT '{}',
  authority_indicators TEXT[] DEFAULT '{}',
  learning_velocity DECIMAL(4,2) DEFAULT 1.0,
  expertise_trajectory VARCHAR(50) DEFAULT 'rapid_growth' CHECK (expertise_trajectory IN ('rapid_growth', 'steady_growth', 'expert_level', 'thought_leader')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(domain)
);

-- Knowledge Connections - Tracks relationships between concepts
CREATE TABLE IF NOT EXISTS knowledge_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_a VARCHAR(200) NOT NULL,
  concept_b VARCHAR(200) NOT NULL,
  connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('causal', 'correlational', 'competitive', 'synergistic', 'evolutionary')),
  strength DECIMAL(3,2) NOT NULL CHECK (strength >= 0 AND strength <= 1),
  evidence TEXT[] DEFAULT '{}',
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'confirmed', 'refuted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expert Insights - Stores generated insights with validation tracking
CREATE TABLE IF NOT EXISTS expert_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id VARCHAR(100) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  domain VARCHAR(100) NOT NULL,
  insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN ('prediction', 'analysis', 'connection', 'trend', 'contrarian', 'synthesis')),
  confidence_level DECIMAL(3,2) NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 1),
  supporting_evidence TEXT[] DEFAULT '{}',
  market_implications TEXT[] DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'confirmed', 'refuted')),
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expert Learning Data - Comprehensive learning from each post
CREATE TABLE IF NOT EXISTS expert_learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  extracted_knowledge JSONB DEFAULT '{}',
  domains TEXT[] DEFAULT '{}',
  expert_insights JSONB DEFAULT '{}',
  engagement JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  learning_outcomes TEXT[] DEFAULT '{}',
  knowledge_connections_made INTEGER DEFAULT 0,
  expertise_boost DECIMAL(4,2) DEFAULT 0.0,
  learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation Threads - Tracks conversation building patterns
CREATE TABLE IF NOT EXISTS conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(200) NOT NULL,
  thread_content TEXT[] DEFAULT '{}',
  building_patterns JSONB DEFAULT '{}',
  engagement_progression JSONB DEFAULT '{}',
  thread_length INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(topic)
);

-- Trend Predictions - Stores and tracks prediction accuracy
CREATE TABLE IF NOT EXISTS trend_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,
  prediction_type VARCHAR(50) NOT NULL CHECK (prediction_type IN ('technology', 'market', 'regulatory')),
  prediction_content TEXT NOT NULL,
  confidence_level DECIMAL(3,2) NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 1),
  timeline VARCHAR(50) NOT NULL,
  indicators TEXT[] DEFAULT '{}',
  based_on_posts INTEGER DEFAULT 0,
  prediction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validation_date TIMESTAMP WITH TIME ZONE,
  accuracy_score DECIMAL(3,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Authority Building Metrics - Tracks authority development
CREATE TABLE IF NOT EXISTS authority_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,
  authority_score INTEGER DEFAULT 0 CHECK (authority_score >= 0 AND authority_score <= 100),
  thought_leadership_indicators TEXT[] DEFAULT '{}',
  expertise_demonstrations TEXT[] DEFAULT '{}',
  industry_recognition_signals TEXT[] DEFAULT '{}',
  content_authority_markers TEXT[] DEFAULT '{}',
  measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning Feedback Loop - Tracks learning effectiveness
CREATE TABLE IF NOT EXISTS learning_feedback_loop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_trigger VARCHAR(100) NOT NULL,
  learning_action TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  actual_outcome TEXT,
  effectiveness_score DECIMAL(3,2) CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
  feedback_data JSONB DEFAULT '{}',
  improvement_suggestions TEXT[] DEFAULT '{}',
  implemented_improvements TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validated_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_expert_knowledge_domain ON expert_knowledge_base(domain);
CREATE INDEX IF NOT EXISTS idx_expert_knowledge_expertise_level ON expert_knowledge_base(expertise_level DESC);
CREATE INDEX IF NOT EXISTS idx_expert_knowledge_trajectory ON expert_knowledge_base(expertise_trajectory);

CREATE INDEX IF NOT EXISTS idx_knowledge_connections_concepts ON knowledge_connections(concept_a, concept_b);
CREATE INDEX IF NOT EXISTS idx_knowledge_connections_type ON knowledge_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_connections_strength ON knowledge_connections(strength DESC);

CREATE INDEX IF NOT EXISTS idx_expert_insights_domain ON expert_insights(domain);
CREATE INDEX IF NOT EXISTS idx_expert_insights_type ON expert_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_expert_insights_confidence ON expert_insights(confidence_level DESC);
CREATE INDEX IF NOT EXISTS idx_expert_insights_generated ON expert_insights(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_expert_learning_domains ON expert_learning_data USING GIN(domains);
CREATE INDEX IF NOT EXISTS idx_expert_learning_learned_at ON expert_learning_data(learned_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_topic ON conversation_threads(topic);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_updated ON conversation_threads(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_trend_predictions_domain ON trend_predictions(domain);
CREATE INDEX IF NOT EXISTS idx_trend_predictions_type ON trend_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_trend_predictions_confidence ON trend_predictions(confidence_level DESC);

CREATE INDEX IF NOT EXISTS idx_authority_metrics_domain ON authority_metrics(domain);
CREATE INDEX IF NOT EXISTS idx_authority_metrics_score ON authority_metrics(authority_score DESC);

-- Functions for expert intelligence operations

-- Function to update expertise level based on performance
CREATE OR REPLACE FUNCTION update_expert_knowledge(
  p_domain VARCHAR(100),
  p_expertise_boost DECIMAL(4,2),
  p_knowledge_boost DECIMAL(4,2),
  p_new_insights TEXT[]
) RETURNS VOID AS $$
BEGIN
  INSERT INTO expert_knowledge_base (
    domain, 
    expertise_level, 
    knowledge_depth, 
    recent_insights,
    updated_at
  ) VALUES (
    p_domain,
    LEAST(100, 10 + p_expertise_boost),
    LEAST(100, 5 + p_knowledge_boost),
    p_new_insights,
    NOW()
  )
  ON CONFLICT (domain) DO UPDATE SET
    expertise_level = LEAST(100, expert_knowledge_base.expertise_level + p_expertise_boost),
    knowledge_depth = LEAST(100, expert_knowledge_base.knowledge_depth + p_knowledge_boost),
    recent_insights = array_cat(
      expert_knowledge_base.recent_insights[1:9], -- Keep last 9
      p_new_insights
    ),
    updated_at = NOW(),
    expertise_trajectory = CASE
      WHEN LEAST(100, expert_knowledge_base.expertise_level + p_expertise_boost) > 80 THEN 'thought_leader'
      WHEN LEAST(100, expert_knowledge_base.expertise_level + p_expertise_boost) > 60 THEN 'expert_level'
      WHEN p_expertise_boost > 2.0 THEN 'rapid_growth'
      ELSE 'steady_growth'
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to record knowledge connections
CREATE OR REPLACE FUNCTION record_knowledge_connection(
  p_concept_a VARCHAR(200),
  p_concept_b VARCHAR(200),
  p_connection_type VARCHAR(50),
  p_strength DECIMAL(3,2),
  p_evidence TEXT[]
) RETURNS UUID AS $$
DECLARE
  connection_id UUID;
BEGIN
  INSERT INTO knowledge_connections (
    concept_a,
    concept_b,
    connection_type,
    strength,
    evidence
  ) VALUES (
    p_concept_a,
    p_concept_b,
    p_connection_type,
    p_strength,
    p_evidence
  ) RETURNING id INTO connection_id;
  
  RETURN connection_id;
END;
$$ LANGUAGE plpgsql;

-- Function to store expert insights
CREATE OR REPLACE FUNCTION store_expert_insight(
  p_insight_id VARCHAR(100),
  p_content TEXT,
  p_domain VARCHAR(100),
  p_insight_type VARCHAR(50),
  p_confidence_level DECIMAL(3,2),
  p_supporting_evidence TEXT[],
  p_market_implications TEXT[]
) RETURNS UUID AS $$
DECLARE
  insight_uuid UUID;
BEGIN
  INSERT INTO expert_insights (
    insight_id,
    content,
    domain,
    insight_type,
    confidence_level,
    supporting_evidence,
    market_implications
  ) VALUES (
    p_insight_id,
    p_content,
    p_domain,
    p_insight_type,
    p_confidence_level,
    p_supporting_evidence,
    p_market_implications
  ) RETURNING id INTO insight_uuid;
  
  RETURN insight_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get current expertise summary
CREATE OR REPLACE FUNCTION get_expertise_summary()
RETURNS TABLE (
  domain VARCHAR(100),
  expertise_level INTEGER,
  knowledge_depth INTEGER,
  expertise_trajectory VARCHAR(50),
  recent_insights_count INTEGER,
  connections_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ekb.domain,
    ekb.expertise_level,
    ekb.knowledge_depth,
    ekb.expertise_trajectory,
    array_length(ekb.recent_insights, 1) as recent_insights_count,
    (SELECT COUNT(*)::INTEGER FROM knowledge_connections kc 
     WHERE kc.concept_a ILIKE '%' || ekb.domain || '%' 
        OR kc.concept_b ILIKE '%' || ekb.domain || '%') as connections_count
  FROM expert_knowledge_base ekb
  ORDER BY ekb.expertise_level DESC;
END;
$$ LANGUAGE plpgsql;

-- Initialize expert domains with baseline knowledge
INSERT INTO expert_knowledge_base (domain, expertise_level, knowledge_depth, recent_insights) VALUES
('ai_healthcare', 25, 20, ARRAY['Machine learning applications in medical imaging', 'Natural language processing for clinical documentation']),
('digital_therapeutics', 20, 15, ARRAY['FDA approval pathways for digital therapeutics', 'Evidence generation for DTx products']),
('precision_medicine', 30, 25, ARRAY['Genomic data integration challenges', 'Pharmacogenomics implementation in clinical practice']),
('telemedicine', 35, 30, ARRAY['Remote patient monitoring technology adoption', 'Telehealth reimbursement policy evolution']),
('health_data_analytics', 28, 22, ARRAY['Real-world evidence generation methodologies', 'Healthcare data interoperability standards']),
('medical_devices', 22, 18, ARRAY['IoT sensors in continuous health monitoring', 'Regulatory pathways for software as medical devices']),
('biotech_innovation', 26, 20, ARRAY['CRISPR applications in rare disease treatment', 'Cell therapy manufacturing scalability']),
('health_policy', 24, 19, ARRAY['Healthcare AI regulation frameworks', 'Data privacy in digital health applications']),
('clinical_informatics', 27, 21, ARRAY['Electronic health record optimization', 'Clinical decision support system implementation']),
('healthcare_cybersecurity', 18, 14, ARRAY['Medical device security vulnerabilities', 'Healthcare data breach prevention strategies']),
('global_health', 16, 12, ARRAY['Digital health solutions for low-resource settings', 'Global health equity in technology access']),
('mental_health_tech', 21, 16, ARRAY['Digital therapeutics for mental health conditions', 'AI-powered mental health screening tools']),
('wearable_technology', 23, 18, ARRAY['Continuous glucose monitoring accuracy improvements', 'Wearable device data integration with EHRs']),
('healthcare_ai_ethics', 19, 15, ARRAY['Bias mitigation in healthcare AI algorithms', 'Ethical frameworks for AI-assisted medical decisions'])
ON CONFLICT (domain) DO NOTHING;

-- Create configuration for expert intelligence system
INSERT INTO bot_config (key, value, description) VALUES
('expert_intelligence_enabled', 'true', 'Enable expert intelligence system'),
('expert_content_allocation', '30', 'Percentage of content from expert intelligence system'),
('expertise_learning_rate', '1.5', 'Rate of expertise accumulation'),
('knowledge_connection_threshold', '0.7', 'Minimum confidence for knowledge connections'),
('trend_prediction_confidence', '0.8', 'Minimum confidence for trend predictions'),
('authority_building_focus', 'true', 'Focus on authority building in content generation')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '🧠 EXPERT INTELLIGENCE SYSTEM DEPLOYED SUCCESSFULLY!';
  RAISE NOTICE '✅ 14 expert domains initialized with baseline knowledge';
  RAISE NOTICE '✅ Knowledge connection tracking enabled';
  RAISE NOTICE '✅ Expert insights storage ready';
  RAISE NOTICE '✅ Trend prediction system active';
  RAISE NOTICE '✅ Authority building metrics tracking enabled';
  RAISE NOTICE '✅ Learning feedback loop established';
  RAISE NOTICE '🎯 System ready to build true expertise and thought leadership!';
END $$; 