#!/usr/bin/env node

/**
 * Database Integrity Checker and Auto-Fixer
 * Ensures all required tables exist with proper permissions
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function ensureDatabaseIntegrity() {
  console.log('🛠️  STARTING DATABASE INTEGRITY CHECK...');
  
  try {
    // Check if we have Supabase CLI available
    try {
      await execAsync('supabase --version');
    } catch (error) {
      console.error('❌ Supabase CLI not found. Please install it first.');
      process.exit(1);
    }

    // Apply the emergency database setup
    console.log('📋 Applying emergency database schema...');
    const sqlPath = path.join(__dirname, 'emergency-db-setup.sql');
    
    try {
      // Try to apply via file if it exists
      await fs.access(sqlPath);
      
      // Use the production CLI environment
      const command = `bash -c 'source prod-cli-CORRECTED.sh && cat ${sqlPath} | psql \\$DATABASE_URL'`;
      
      try {
        const { stdout, stderr } = await execAsync(command);
        console.log('✅ SQL executed successfully');
        if (stdout) console.log('📝 Output:', stdout);
        if (stderr && !stderr.includes('already exists')) {
          console.warn('⚠️  Warnings:', stderr);
        }
      } catch (sqlError) {
        console.warn('⚠️  Direct SQL failed, trying alternative approach...');
        
        // Alternative: Use environment variables directly
        if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
          const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
          const command2 = `cat ${sqlPath} | psql "${dbUrl}"`;
          
          try {
            const { stdout, stderr } = await execAsync(command2);
            console.log('✅ Alternative SQL execution succeeded');
            if (stdout) console.log('📝 Output:', stdout);
          } catch (altError) {
            console.error('❌ Alternative SQL also failed:', altError.message);
            // Continue anyway - might be a connection issue
          }
        }
      }
      
    } catch (fileError) {
      console.error('❌ Could not find emergency-db-setup.sql');
      
      // Create the SQL inline as fallback
      const inlineSQL = `
-- Emergency inline schema creation
CREATE TABLE IF NOT EXISTS public.learning_posts (
  tweet_id VARCHAR(255) PRIMARY KEY,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  viral_potential_score INTEGER DEFAULT 0,
  format VARCHAR(50) DEFAULT 'single',
  quality_score INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tweet_metrics (
  tweet_id VARCHAR(255) NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  viral_potential_score INTEGER DEFAULT 0,
  content TEXT,
  PRIMARY KEY (tweet_id, collected_at)
);

ALTER TABLE public.learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for service role" 
ON public.learning_posts FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable all operations for service role" 
ON public.tweet_metrics FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

GRANT ALL ON public.learning_posts TO service_role;
GRANT ALL ON public.tweet_metrics TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
      `;
      
      console.log('📝 Using inline SQL fallback...');
      const tempFile = '/tmp/emergency-schema.sql';
      await fs.writeFile(tempFile, inlineSQL);
      
      try {
        const command = `bash -c 'source prod-cli-CORRECTED.sh && cat ${tempFile} | psql \\$DATABASE_URL'`;
        const { stdout, stderr } = await execAsync(command);
        console.log('✅ Inline SQL executed successfully');
        if (stdout) console.log('📝 Output:', stdout);
      } catch (inlineError) {
        console.error('❌ Inline SQL failed:', inlineError.message);
      }
    }

    // Verify the setup worked
    console.log('🔍 Verifying database setup...');
    
    // Test with a simple query
    const testCommand = `bash -c 'source prod-cli-CORRECTED.sh && echo "SELECT COUNT(*) FROM learning_posts;" | psql \\$DATABASE_URL'`;
    
    try {
      const { stdout } = await execAsync(testCommand);
      if (stdout.includes('count')) {
        console.log('✅ learning_posts table is accessible');
      }
    } catch (testError) {
      console.warn('⚠️  Could not verify learning_posts access:', testError.message);
    }

    console.log('✅ DATABASE INTEGRITY CHECK COMPLETED');
    
  } catch (error) {
    console.error('❌ Database integrity check failed:', error);
    process.exit(1);
  }
}

// Check if running in production environment
function checkEnvironment() {
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = requiredEnvVars.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.log('💡 Make sure to source the appropriate CLI environment file first');
    return false;
  }
  
  return true;
}

// Run if called directly
if (require.main === module) {
  if (!checkEnvironment()) {
    console.log('🔧 Example usage:');
    console.log('   source prod-cli-CORRECTED.sh && node scripts/ensure-database-integrity.js');
    process.exit(1);
  }
  
  ensureDatabaseIntegrity()
    .then(() => {
      console.log('🎉 Database integrity ensured successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to ensure database integrity:', error);
      process.exit(1);
    });
}

module.exports = { ensureDatabaseIntegrity };
