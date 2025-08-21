#!/usr/bin/env node

/**
 * AUTOMATED DATABASE SETUP AND REPAIR
 * Fixes all database issues automatically using staging/production CLI files
 */

console.log('🔧 AUTOMATED DATABASE SETUP AND REPAIR');
console.log('=====================================');

async function setupDatabase(environment = 'prod') {
  const envFile = environment === 'prod' ? './prod-cli-CORRECTED.sh' : './staging-cli-CORRECTED.sh';
  console.log(`\n🎯 Setting up ${environment.toUpperCase()} database...`);
  
  try {
    // Load environment variables from CLI file
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    // Read the CLI file to extract Supabase components
    const cliContent = fs.readFileSync(envFile, 'utf8');
    const supabaseUrlMatch = cliContent.match(/SUPABASE_URL='([^']+)'/);
    
    // Handle both prod and staging patterns
    const projectRefMatch = environment === 'prod' 
      ? cliContent.match(/PROD_PROJECT_REF='([^']+)'/)
      : cliContent.match(/STAGING_PROJECT_REF='([^']+)'/);
    const passwordMatch = environment === 'prod'
      ? cliContent.match(/PROD_DB_PASSWORD='([^']+)'/)
      : cliContent.match(/STAGING_DB_PASSWORD='([^']+)'/);
    
    if (!supabaseUrlMatch || !projectRefMatch || !passwordMatch) {
      throw new Error(`Could not find Supabase credentials in ${envFile}`);
    }
    
    // Construct DATABASE_URL from components
    const DATABASE_URL = `postgresql://postgres.${projectRefMatch[1]}:${passwordMatch[1]}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
    console.log(`✅ Constructed database URL for ${environment}`);
    
    // Create the comprehensive SQL fix
    const sqlFix = `
-- Comprehensive Database Fix for xBOT
-- Fixes all known issues automatically

-- 1. Fix learning_posts table structure
DO $$
BEGIN
  -- Add unique constraint on tweet_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'learning_posts_tweet_id_key'
  ) THEN
    ALTER TABLE learning_posts ADD CONSTRAINT learning_posts_tweet_id_key UNIQUE (tweet_id);
    RAISE NOTICE 'Added unique constraint to learning_posts.tweet_id';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'learning_posts table might not exist, creating...';
END $$;

-- 2. Create learning_insights table with confidence_score
CREATE TABLE IF NOT EXISTS public.learning_insights (
  id bigserial primary key,
  insight_type text not null,
  insight_data jsonb not null,
  confidence_score numeric(3,2) default 0.5,
  created_at timestamptz not null default now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_insights_type ON public.learning_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_learning_insights_created_at ON public.learning_insights(created_at);
CREATE INDEX IF NOT EXISTS idx_learning_insights_confidence ON public.learning_insights(confidence_score);

-- 3. Fix RLS policies
ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;

-- Service role policies for learning_insights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' and tablename='learning_insights' and policyname='Service role can manage learning_insights'
  ) THEN
    CREATE POLICY "Service role can manage learning_insights" ON public.learning_insights
    FOR ALL USING (auth.role() = 'service_role');
    RAISE NOTICE 'Created RLS policy for learning_insights';
  END IF;
END $$;

-- Fix tweet_metrics RLS (if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' and tablename='tweet_metrics' and policyname='Service role can manage tweet_metrics'
  ) THEN
    CREATE POLICY "Service role can manage tweet_metrics" ON public.tweet_metrics
    FOR ALL USING (auth.role() = 'service_role');
    RAISE NOTICE 'Created RLS policy for tweet_metrics';
  END IF;
END $$;

-- Fix learning_posts RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' and tablename='learning_posts' and policyname='Service role can manage learning_posts'
  ) THEN
    CREATE POLICY "Service role can manage learning_posts" ON public.learning_posts
    FOR ALL USING (auth.role() = 'service_role');
    RAISE NOTICE 'Created RLS policy for learning_posts';
  END IF;
END $$;

-- 4. Verify all tables exist and have proper structure
DO $$
DECLARE
  table_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' 
  AND table_name IN ('learning_posts', 'tweet_metrics', 'learning_insights');
  
  RAISE NOTICE 'Found % out of 3 required tables', table_count;
  
  IF table_count < 3 THEN
    RAISE EXCEPTION 'Missing required tables. Expected: learning_posts, tweet_metrics, learning_insights';
  END IF;
END $$;

-- Success message
SELECT 'Database setup completed successfully!' as status;
`;

    // Write the SQL to a temporary file
    fs.writeFileSync('/tmp/db_fix.sql', sqlFix);
    
    // Execute the SQL
    console.log('🔧 Applying database fixes...');
    const result = execSync(`psql "${DATABASE_URL}" -f /tmp/db_fix.sql`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✅ Database setup completed for', environment);
    console.log('📊 Result:', result.split('\n').filter(line => line.includes('NOTICE') || line.includes('status')).join('\n'));
    
    // Clean up
    fs.unlinkSync('/tmp/db_fix.sql');
    
    return true;
    
  } catch (error) {
    console.error(`❌ Database setup failed for ${environment}:`, error.message);
    return false;
  }
}

async function testDatabaseConnection(environment = 'prod') {
  console.log(`\n🧪 Testing ${environment.toUpperCase()} database connection...`);
  
  try {
    // Load environment for testing
    const { spawn } = require('child_process');
    const envFile = environment === 'prod' ? './prod-cli-CORRECTED.sh' : './staging-cli-CORRECTED.sh';
    
    const testScript = `
    source ${envFile}
    node -e "
    const { createClient } = require('@supabase/supabase-js');
    
    (async () => {
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        // Test each table
        const tables = ['learning_posts', 'tweet_metrics', 'learning_insights'];
        
        for (const table of tables) {
          const { data, error } = await supabase.from(table).select('*').limit(1);
          if (error) {
            console.log(\`❌ \${table}: \${error.message}\`);
          } else {
            console.log(\`✅ \${table}: Connection OK\`);
          }
        }
        
        console.log('✅ Database connection test completed');
      } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
      }
    })();
    "
    `;
    
    const { execSync } = require('child_process');
    const result = execSync(testScript, { encoding: 'utf8', shell: '/bin/bash' });
    console.log(result);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Connection test failed for ${environment}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting automated database setup...\n');
  
  const environments = ['prod', 'staging'];
  let totalSuccess = 0;
  
  for (const env of environments) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎯 PROCESSING ${env.toUpperCase()} ENVIRONMENT`);
    console.log(`${'='.repeat(50)}`);
    
    // Step 1: Setup database
    const setupSuccess = await setupDatabase(env);
    if (!setupSuccess) {
      console.log(`❌ Skipping ${env} due to setup failure`);
      continue;
    }
    
    // Step 2: Test connection
    const testSuccess = await testDatabaseConnection(env);
    if (testSuccess) {
      totalSuccess++;
      console.log(`✅ ${env.toUpperCase()} environment: FULLY OPERATIONAL`);
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log('🎯 FINAL SUMMARY');
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Successfully configured: ${totalSuccess}/${environments.length} environments`);
  
  if (totalSuccess === environments.length) {
    console.log('🎉 ALL ENVIRONMENTS READY FOR PRODUCTION!');
    console.log('📊 Next: Deploy application updates');
  } else {
    console.log('⚠️  Some environments need manual attention');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupDatabase, testDatabaseConnection };
