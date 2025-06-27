-- Migration: Add missing core tables for tweet categorization and image tracking
-- Date: 2025-06-27
-- Purpose: Add tweet_topics and tweet_images tables that are referenced in health checks but missing

-- Tweet Topics Table: Stores content categories and topics for organizational purposes
CREATE TABLE IF NOT EXISTS tweet_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'health_tech',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  tweet_count INTEGER DEFAULT 0,
  avg_engagement DECIMAL(5,2) DEFAULT 0,
  last_used TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique topic names per category
  UNIQUE(topic_name, category)
);

-- Tweet Images Table: Tracks image usage to prevent repetition
CREATE TABLE IF NOT EXISTS tweet_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  image_id VARCHAR(255), -- External API image ID (Pexels, Unsplash, etc.)
  source VARCHAR(50) NOT NULL DEFAULT 'pexels', -- 'pexels', 'unsplash', 'custom'
  alt_text TEXT,
  keywords TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  first_used_at TIMESTAMPTZ,
  associated_tweet_ids TEXT[] DEFAULT '{}', -- Array of tweet IDs that used this image
  search_terms TEXT[] DEFAULT '{}',
  file_size INTEGER, -- In bytes
  dimensions JSONB, -- {"width": 1920, "height": 1080}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique image URLs
  UNIQUE(image_url)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_topics_category ON tweet_topics(category);
CREATE INDEX IF NOT EXISTS idx_tweet_topics_active ON tweet_topics(is_active);
CREATE INDEX IF NOT EXISTS idx_tweet_topics_last_used ON tweet_topics(last_used);
CREATE INDEX IF NOT EXISTS idx_tweet_topics_engagement ON tweet_topics(avg_engagement);

CREATE INDEX IF NOT EXISTS idx_tweet_images_source ON tweet_images(source);
CREATE INDEX IF NOT EXISTS idx_tweet_images_last_used ON tweet_images(last_used_at);
CREATE INDEX IF NOT EXISTS idx_tweet_images_usage_count ON tweet_images(usage_count);
CREATE INDEX IF NOT EXISTS idx_tweet_images_keywords ON tweet_images USING gin(keywords);

-- Insert initial health tech topics
INSERT INTO tweet_topics (topic_name, category, keywords, description) VALUES
('AI Drug Discovery', 'ai_innovation', ARRAY['AI', 'drug discovery', 'pharmaceutical', 'machine learning'], 'AI applications in pharmaceutical research and drug development'),
('Digital Therapeutics', 'health_tech', ARRAY['digital therapeutics', 'DTx', 'FDA approval', 'app-based therapy'], 'Software-based therapeutic interventions'),
('Telemedicine', 'healthcare_delivery', ARRAY['telemedicine', 'telehealth', 'remote healthcare', 'virtual consultations'], 'Remote healthcare delivery systems'),
('Medical AI Diagnostics', 'ai_innovation', ARRAY['AI diagnostics', 'medical imaging', 'radiology AI', 'computer vision'], 'AI-powered medical diagnostic tools'),
('Healthcare Cybersecurity', 'health_tech', ARRAY['healthcare security', 'medical data protection', 'HIPAA', 'cyber threats'], 'Security challenges in healthcare technology'),
('Precision Medicine', 'medical_innovation', ARRAY['precision medicine', 'personalized healthcare', 'genomics', 'biomarkers'], 'Tailored medical treatments based on individual characteristics'),
('Health Wearables', 'consumer_health', ARRAY['wearables', 'fitness trackers', 'health monitoring', 'IoT health'], 'Consumer health monitoring devices'),
('Medical Robotics', 'medical_innovation', ARRAY['medical robots', 'surgical robots', 'robot-assisted surgery'], 'Robotic applications in healthcare and surgery'),
('Healthcare Data Analytics', 'health_tech', ARRAY['health analytics', 'big data', 'population health', 'predictive analytics'], 'Data-driven insights in healthcare delivery'),
('Mental Health Tech', 'digital_health', ARRAY['mental health apps', 'digital wellness', 'mental health AI', 'therapy apps'], 'Technology solutions for mental health and wellness')
ON CONFLICT (topic_name, category) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE tweet_topics IS 'Stores content topics and categories for tweet organization and performance tracking';
COMMENT ON TABLE tweet_images IS 'Tracks image usage to prevent repetition and optimize content diversity';
COMMENT ON COLUMN tweet_topics.keywords IS 'Array of keywords associated with this topic for content matching';
COMMENT ON COLUMN tweet_topics.avg_engagement IS 'Average engagement score for tweets in this topic';
COMMENT ON COLUMN tweet_images.usage_count IS 'Number of times this image has been used';
COMMENT ON COLUMN tweet_images.associated_tweet_ids IS 'Array of tweet IDs that have used this image';
