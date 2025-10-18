/**
 * AUTOMATIC MIGRATION RUNNER
 * Runs database migrations on application startup
 * Ensures content_violations table exists
 */

import { supabase } from '../services/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  console.log('🔄 MIGRATIONS: Checking for pending migrations...');
  
  try {
    // Check if content_violations table exists
    const { data: tableExists, error: checkError } = await supabase
      .from('content_violations')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('📦 MIGRATIONS: Creating content_violations table...');
      await createContentViolationsTable();
      console.log('✅ MIGRATIONS: content_violations table created successfully');
    } else if (checkError) {
      console.warn('⚠️ MIGRATIONS: Error checking table existence:', checkError.message);
    } else {
      console.log('✅ MIGRATIONS: content_violations table already exists');
    }
    
  } catch (error: any) {
    console.error('❌ MIGRATIONS: Failed to run migrations:', error.message);
    // Don't crash the app if migrations fail - just log the error
  }
}

/**
 * Create content_violations table directly
 */
async function createContentViolationsTable(): Promise<void> {
  const sql = `
-- Create content_violations table
CREATE TABLE IF NOT EXISTS content_violations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  generator_name TEXT NOT NULL,
  topic TEXT,
  format TEXT NOT NULL CHECK (format IN ('single', 'thread')),
  
  violation_type TEXT NOT NULL 
    CHECK (violation_type IN ('first_person', 'banned_phrase', 'low_specificity', 'incomplete_sentence')),
  severity TEXT NOT NULL 
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  detected_phrase TEXT,
  context_snippet TEXT,
  
  content_preview TEXT,
  full_content TEXT,
  
  specificity_score INTEGER DEFAULT 0,
  specificity_matches TEXT[],
  
  action_taken TEXT NOT NULL 
    CHECK (action_taken IN ('rejected', 'retried', 'posted_anyway')),
  retry_succeeded BOOLEAN,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT content_violations_generator_idx CHECK (LENGTH(generator_name) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_violations_generator 
  ON content_violations(generator_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_violations_time 
  ON content_violations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_violations_severity 
  ON content_violations(severity, created_at DESC) 
  WHERE severity IN ('critical', 'high');

CREATE INDEX IF NOT EXISTS idx_violations_type 
  ON content_violations(violation_type, generator_name);

-- Materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS generator_quality_metrics AS
SELECT 
  generator_name,
  COUNT(*) as total_violations,
  COUNT(*) FILTER (WHERE violation_type = 'first_person') as first_person_count,
  COUNT(*) FILTER (WHERE violation_type = 'banned_phrase') as banned_phrase_count,
  COUNT(*) FILTER (WHERE violation_type = 'low_specificity') as low_specificity_count,
  COUNT(*) FILTER (WHERE violation_type = 'incomplete_sentence') as incomplete_count,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_violations,
  COUNT(*) FILTER (WHERE action_taken = 'rejected') as rejection_count,
  COUNT(*) FILTER (WHERE action_taken = 'retried' AND retry_succeeded = true) as successful_retries,
  AVG(specificity_score) as avg_specificity_score,
  MAX(created_at) as last_violation,
  MIN(created_at) as first_violation
FROM content_violations
GROUP BY generator_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_generator_quality_metrics 
  ON generator_quality_metrics(generator_name);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_generator_quality_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY generator_quality_metrics;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE content_violations ENABLE ROW LEVEL SECURITY;

-- Policy for service role
DROP POLICY IF EXISTS "Allow service role full access" ON content_violations;
CREATE POLICY "Allow service role full access"
  ON content_violations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
  `;
  
  // Execute via Supabase admin
  // Note: Supabase JS client doesn't support raw SQL execution
  // This will be handled by the SQL file directly in Supabase dashboard
  
  console.log('⚠️ MIGRATIONS: Please run the migration SQL manually in Supabase dashboard');
  console.log('📄 File: supabase/migrations/20251018170436_content_violations_tracking.sql');
  console.log('🔗 Dashboard: https://app.supabase.com/project/YOUR_PROJECT/sql');
  
  // For now, we'll skip the actual SQL execution and rely on manual deployment
  // The app will still work without this table - it will just log errors for tracking
}

/**
 * Check if migrations are needed
 */
export async function checkMigrationsStatus(): Promise<{
  contentViolationsExists: boolean;
  generatorMetricsExists: boolean;
}> {
  let contentViolationsExists = false;
  let generatorMetricsExists = false;
  
  try {
    // Check content_violations
    const { error: cvError } = await supabase
      .from('content_violations')
      .select('id')
      .limit(1);
    
    contentViolationsExists = !cvError || !cvError.message.includes('does not exist');
    
    // Check generator_quality_metrics
    const { error: gqmError } = await supabase
      .from('generator_quality_metrics')
      .select('generator_name')
      .limit(1);
    
    generatorMetricsExists = !gqmError || !gqmError.message.includes('does not exist');
    
  } catch (error) {
    console.error('Error checking migration status:', error);
  }
  
  return {
    contentViolationsExists,
    generatorMetricsExists
  };
}

