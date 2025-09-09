-- RLS Policies Migration for xBOT
-- Allow service role to bypass RLS or create explicit policies

-- Enable RLS on core tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejected_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_budget_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies that allow service role full access
-- Note: service_role has bypass_rls privilege by default, but explicit policies are safer

-- Posts table policies
CREATE POLICY "Service role can manage posts" ON public.posts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow service role insert posts" ON public.posts
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Post metrics table policies  
CREATE POLICY "Service role can manage post_metrics" ON public.post_metrics
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow service role insert post_metrics" ON public.post_metrics
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Rejected posts table policies
CREATE POLICY "Service role can manage rejected_posts" ON public.rejected_posts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow service role insert rejected_posts" ON public.rejected_posts
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- OpenAI usage log policies
CREATE POLICY "Service role can manage openai_usage_log" ON public.openai_usage_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow service role insert openai_usage_log" ON public.openai_usage_log
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- OpenAI budget tracking policies
CREATE POLICY "Service role can manage openai_budget_tracking" ON public.openai_budget_tracking
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow service role insert openai_budget_tracking" ON public.openai_budget_tracking
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- If service role should bypass RLS entirely (alternative approach)
-- GRANT USAGE ON SCHEMA public TO service_role;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- ALTER USER service_role SET row_security = OFF;

-- Verify policies
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('posts', 'post_metrics', 'rejected_posts', 'openai_usage_log', 'openai_budget_tracking')
ORDER BY tablename, policyname;
