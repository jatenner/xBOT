#!/usr/bin/env node

/**
 * 🧠 DEPLOY AI LEARNING BRAIN DATABASE
 * 
 * This adds comprehensive learning and memory capabilities to your clean backend
 * Your AI agents will be able to learn, remember, and improve autonomously!
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in your environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployAILearningBrain() {
  console.log('🧠 DEPLOYING AI LEARNING BRAIN DATABASE');
  console.log('======================================');
  console.log('🎯 Adding memory and learning capabilities to your AI agents');
  console.log('📚 Your agents will be able to learn from every post and decision');
  
  try {
    // Read the AI Learning Brain SQL
    console.log('\n📖 Reading AI Learning Brain schema...');
    const sqlContent = fs.readFileSync('supabase/ai_learning_brain_database.sql', 'utf8');
    
    // Execute the SQL using Supabase RPC
    console.log('\n🚀 Deploying AI Learning Brain to Supabase...');
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sqlContent 
    });
    
    if (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
    
    console.log('✅ AI Learning Brain deployed successfully!');
    
    // Verify the deployment
    console.log('\n🔍 Verifying AI Learning Brain deployment...');
    await verifyLearningBrain();
    
    console.log('\n🎉 DEPLOYMENT COMPLETE!');
    console.log('======================');
    console.log('🧠 Your AI agents now have comprehensive memory and learning capabilities!');
    
  } catch (error) {
    console.error('❌ Failed to deploy AI Learning Brain:', error);
    process.exit(1);
  }
}

async function verifyLearningBrain() {
  const tables = [
    'ai_decisions',
    'learning_insights', 
    'content_themes',
    'timing_insights',
    'style_performance'
  ];
  
  console.log('🔍 Checking core learning brain tables...');
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Ready for AI learning`);
      }
    } catch (err) {
      console.log(`⚠️ ${table}: Could not verify`);
    }
  }
}

// Run the deployment
if (require.main === module) {
  deployAILearningBrain().catch(console.error);
}

module.exports = { deployAILearningBrain };
