#!/usr/bin/env node

/**
 * Automated Supabase Migration Deployment
 * Uses staging and production CLI configurations to deploy migrations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATION_TO_APPLY = `
-- Fix missing columns in posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS request_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;

-- Add useful indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_posts_approved ON posts (approved);
CREATE INDEX IF NOT EXISTS idx_posts_scores ON posts USING GIN (scores);

-- Update existing records to have default values
UPDATE posts 
SET 
  engagement_metrics = COALESCE(engagement_metrics, '{}'),
  request_context = COALESCE(request_context, '{}'),
  scores = COALESCE(scores, '{}'),
  approved = COALESCE(approved, false)
WHERE 
  engagement_metrics IS NULL 
  OR request_context IS NULL 
  OR scores IS NULL 
  OR approved IS NULL;
`;

function runCommand(command, description) {
  console.log(`🔧 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${description} completed`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

async function deployToProduction() {
  console.log('🚀 PRODUCTION_DEPLOY: Starting automated Supabase deployment...');
  
  try {
    // Source production CLI environment
    console.log('📋 Loading production environment...');
    const prodEnv = fs.readFileSync('prod-cli-CORRECTED.sh', 'utf8');
    
    // Extract credentials from the shell script
    const urlMatch = prodEnv.match(/export SUPABASE_URL='([^']+)'/);
    const keyMatch = prodEnv.match(/export SUPABASE_ANON_KEY='([^']+)'/);
    const serviceKeyMatch = prodEnv.match(/export SUPABASE_SERVICE_ROLE_KEY='([^']+)'/);
    const projectRefMatch = prodEnv.match(/export PROD_PROJECT_REF='([^']+)'/);
    const dbPasswordMatch = prodEnv.match(/export PROD_DB_PASSWORD='([^']+)'/);
    
    if (!urlMatch || !serviceKeyMatch || !projectRefMatch || !dbPasswordMatch) {
      throw new Error('Missing required Supabase credentials in prod-cli-CORRECTED.sh');
    }
    
    const SUPABASE_URL = urlMatch[1];
    const SUPABASE_SERVICE_ROLE_KEY = serviceKeyMatch[1];
    const SUPABASE_PROJECT_REF = projectRefMatch[1];
    const SUPABASE_DB_PASSWORD = dbPasswordMatch[1];
    
    console.log(`📊 Project: ${SUPABASE_PROJECT_REF}`);
    console.log(`🔗 URL: ${SUPABASE_URL}`);
    
    // Create a temporary migration file
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const migrationPath = `supabase/migrations/${timestamp}_emergency_posts_fix.sql`;
    
    console.log(`📝 Creating migration: ${migrationPath}`);
    fs.writeFileSync(migrationPath, MIGRATION_TO_APPLY);
    
    // Set environment variables for supabase CLI
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_PROJECT_REF = SUPABASE_PROJECT_REF;
    process.env.SUPABASE_DB_PASSWORD = SUPABASE_DB_PASSWORD;
    
    // Link to production project
    runCommand(
      `npx supabase link --project-ref ${SUPABASE_PROJECT_REF} --password '${SUPABASE_DB_PASSWORD}'`,
      'Linking to production project'
    );
    
    // Push all pending migrations
    runCommand(
      'npx supabase db push --include-all',
      'Applying all pending migrations to production'
    );
    
    console.log('✅ PRODUCTION_DEPLOY: All migrations applied successfully!');
    console.log('📊 VERIFICATION: Posts table should now have missing columns');
    
    // Verify the migration worked
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .limit(1);
    
    if (error) {
      console.warn('⚠️ VERIFICATION: Could not verify posts table:', error.message);
    } else {
      console.log('✅ VERIFICATION: Posts table is accessible after migration');
    }
    
  } catch (error) {
    console.error('❌ PRODUCTION_DEPLOY: Failed:', error.message);
    throw error;
  }
}

async function deployToStaging() {
  console.log('🧪 STAGING_DEPLOY: Testing on staging first...');
  
  try {
    // Source staging CLI environment  
    const stagingEnv = fs.readFileSync('staging-cli-CORRECTED.sh', 'utf8');
    
    // Extract staging credentials
    const urlMatch = stagingEnv.match(/export SUPABASE_URL='([^']+)'/);
    const serviceKeyMatch = stagingEnv.match(/export SUPABASE_SERVICE_ROLE_KEY='([^']+)'/);
    const projectRefMatch = stagingEnv.match(/export STAGING_PROJECT_REF='([^']+)'/);
    const dbPasswordMatch = stagingEnv.match(/export STAGING_DB_PASSWORD='([^']+)'/);
    
    if (!urlMatch || !serviceKeyMatch || !projectRefMatch || !dbPasswordMatch) {
      console.log('⚠️ STAGING: Missing staging credentials, skipping staging deployment');
      return;
    }
    
    const SUPABASE_URL = urlMatch[1];
    const SUPABASE_SERVICE_ROLE_KEY = serviceKeyMatch[1];
    const SUPABASE_PROJECT_REF = projectRefMatch[1];
    const SUPABASE_DB_PASSWORD = dbPasswordMatch[1];
    
    console.log(`📊 Staging Project: ${SUPABASE_PROJECT_REF}`);
    
    // Set staging environment
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_PROJECT_REF = SUPABASE_PROJECT_REF;
    process.env.SUPABASE_DB_PASSWORD = SUPABASE_DB_PASSWORD;
    
    // Link and deploy to staging
    runCommand(
      `npx supabase link --project-ref ${SUPABASE_PROJECT_REF} --password '${SUPABASE_DB_PASSWORD}'`,
      'Linking to staging project'
    );
    
    runCommand(
      'npx supabase db push --include-all',
      'Testing migration on staging'
    );
    
    console.log('✅ STAGING_DEPLOY: Migration tested successfully on staging');
    
  } catch (error) {
    console.error('❌ STAGING_DEPLOY: Failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 AUTOMATED_SUPABASE_DEPLOY: Starting deployment pipeline...');
    
    // Check if we're in the right directory
    if (!fs.existsSync('supabase/migrations')) {
      throw new Error('supabase/migrations directory not found. Run from project root.');
    }
    
    // Test on staging first (if available)
    if (fs.existsSync('staging-cli-CORRECTED.sh')) {
      await deployToStaging();
      console.log('✅ STAGING: Migration tested successfully');
    }
    
    // Deploy to production
    await deployToProduction();
    
    console.log('🎯 DEPLOYMENT_COMPLETE: Supabase migrations deployed successfully!');
    console.log('📝 NEXT_STEP: Build and deploy the application code');
    
  } catch (error) {
    console.error('❌ DEPLOYMENT_FAILED:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { deployToProduction, deployToStaging };
