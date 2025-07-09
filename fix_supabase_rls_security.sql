-- 🔒 SUPABASE ROW LEVEL SECURITY (RLS) FIX
-- ===============================================
-- Enables RLS on all public tables to resolve Supabase Security Advisor warnings
-- This prevents unauthorized access while maintaining bot functionality

-- Enable RLS on all main tables
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timing_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_content_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tweets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on intelligent posting decision tables
ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timing_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_guidance_tracking ENABLE ROW LEVEL SECURITY;

-- Create service role policy that allows full access for our bot
-- This maintains functionality while securing against unauthorized access

-- Service Role Policies (Full access for bot operations)
CREATE POLICY "Service role full access" ON public.ai_decisions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.learning_insights
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.content_themes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.timing_insights
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.style_performance
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.api_usage_tracking
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.engagement_patterns
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.competitor_intelligence
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.trend_correlations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.ai_experiments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.viral_content_analysis
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.tweets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Intelligent posting decision tables
CREATE POLICY "Service role full access" ON public.decision_outcomes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.performance_patterns
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.timing_effectiveness
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.content_guidance_tracking
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Optional: Create more restrictive policies for authenticated users (read-only)
-- Uncomment these if you want to allow authenticated users to read data

/*
CREATE POLICY "Authenticated read access" ON public.tweets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read access" ON public.decision_outcomes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read access" ON public.performance_patterns
  FOR SELECT TO authenticated
  USING (true);
*/

-- Summary comment
COMMENT ON SCHEMA public IS 'Row Level Security enabled on all tables for enhanced security while maintaining bot functionality';

-- Log the security enhancement
INSERT INTO public.system_logs (action, data, source) VALUES
('rls_security_enabled', jsonb_build_object(
  'tables_secured', 16,
  'policies_created', 16,
  'security_level', 'service_role_access',
  'enhanced_at', NOW()::text
), 'security_enhancement'); 