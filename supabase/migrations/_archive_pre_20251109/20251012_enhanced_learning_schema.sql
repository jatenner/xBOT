-- Enhanced Learning System Database Schema
-- Creates all necessary tables for the advanced learning components

-- Enhanced Performance Data Table
CREATE TABLE IF NOT EXISTS public.enhanced_performance (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id text NOT NULL UNIQUE,
    timestamp timestamptz DEFAULT now() NOT NULL,
    
    -- Basic metrics
    engagement_rate double precision DEFAULT 0.0 NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    retweets integer DEFAULT 0 NOT NULL,
    replies integer DEFAULT 0 NOT NULL,
    saves integer DEFAULT 0,
    follower_growth integer DEFAULT 0,
    
    -- Enhanced metrics
    time_to_peak_engagement integer,
    engagement_decay_rate double precision,
    audience_retention double precision,
    click_through_rate double precision,
    save_to_engagement_ratio double precision,
    reply_sentiment text,
    viral_coefficient double precision,
    topic_saturation_effect double precision,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Content Patterns Table
CREATE TABLE IF NOT EXISTS public.content_patterns (
    pattern_id text PRIMARY KEY,
    pattern_type text NOT NULL,
    pattern_description text NOT NULL,
    avg_performance double precision NOT NULL,
    sample_size integer NOT NULL,
    confidence_score double precision NOT NULL,
    discovered_at timestamptz DEFAULT now() NOT NULL,
    last_validated timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Discovered Patterns Table
CREATE TABLE IF NOT EXISTS public.discovered_patterns (
    id text PRIMARY KEY,
    type text NOT NULL,
    description text NOT NULL,
    confidence double precision NOT NULL,
    impact_score double precision NOT NULL,
    sample_size integer NOT NULL,
    discovered_at timestamptz DEFAULT now() NOT NULL,
    validation_status text DEFAULT 'pending',
    conditions jsonb,
    outcomes jsonb,
    recommendations jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Prediction Errors Table
CREATE TABLE IF NOT EXISTS public.prediction_errors (
    id text PRIMARY KEY,
    post_id text NOT NULL,
    prediction_type text NOT NULL,
    predicted_value double precision NOT NULL,
    actual_value double precision NOT NULL,
    error_magnitude double precision NOT NULL,
    error_direction text NOT NULL,
    prediction_context jsonb,
    error_analysis jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    learned_from boolean DEFAULT false
);

-- Learning Adjustments Table
CREATE TABLE IF NOT EXISTS public.learning_adjustments (
    id text PRIMARY KEY,
    adjustment_type text NOT NULL,
    target_component text NOT NULL,
    adjustment_description text NOT NULL,
    expected_improvement double precision NOT NULL,
    confidence double precision NOT NULL,
    source_errors jsonb,
    implementation jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Hook DNA Table (for genetic algorithm)
CREATE TABLE IF NOT EXISTS public.hook_dna (
    hook_id text PRIMARY KEY,
    hook_text text NOT NULL,
    hook_category text NOT NULL,
    engagement_gene double precision NOT NULL,
    viral_gene double precision NOT NULL,
    follower_gene double precision NOT NULL,
    authority_gene double precision NOT NULL,
    word_count integer NOT NULL,
    has_statistics boolean DEFAULT false,
    has_controversy boolean DEFAULT false,
    has_question boolean DEFAULT false,
    has_emotional_trigger boolean DEFAULT false,
    generation integer DEFAULT 0,
    parent_hooks jsonb,
    mutation_rate double precision DEFAULT 0.1,
    times_used integer DEFAULT 0,
    avg_engagement_rate double precision DEFAULT 0.0,
    avg_viral_coefficient double precision DEFAULT 0.0,
    avg_followers_gained double precision DEFAULT 0.0,
    success_rate double precision DEFAULT 0.5,
    best_topics jsonb,
    best_audiences jsonb,
    optimal_timing jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    last_used timestamptz,
    last_evolved timestamptz
);

-- Viral Patterns Table
CREATE TABLE IF NOT EXISTS public.viral_patterns (
    pattern_id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    hook_template text NOT NULL,
    content_flow jsonb NOT NULL,
    evidence_requirements jsonb,
    engagement_triggers jsonb,
    viral_success_rate double precision NOT NULL,
    avg_follower_conversion double precision DEFAULT 0.0,
    avg_engagement_multiplier double precision DEFAULT 1.0,
    avg_viral_coefficient double precision DEFAULT 0.0,
    sample_size integer DEFAULT 0,
    confidence_score double precision DEFAULT 0.5,
    last_updated timestamptz DEFAULT now() NOT NULL,
    discovery_method text DEFAULT 'manual',
    best_topics jsonb,
    optimal_timing jsonb,
    target_audiences jsonb,
    avoid_conditions jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_enhanced_performance_post_id ON public.enhanced_performance (post_id);
CREATE INDEX IF NOT EXISTS idx_content_patterns_type ON public.content_patterns (pattern_type);
CREATE INDEX IF NOT EXISTS idx_discovered_patterns_type ON public.discovered_patterns (type);
CREATE INDEX IF NOT EXISTS idx_prediction_errors_post_id ON public.prediction_errors (post_id);
CREATE INDEX IF NOT EXISTS idx_hook_dna_category ON public.hook_dna (hook_category);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_success_rate ON public.viral_patterns (viral_success_rate);
