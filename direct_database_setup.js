const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Direct Supabase client setup
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing environment variables:');
  console.log('   SUPABASE_URL:', !!supabaseUrl);
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.log('\n💡 Please set these environment variables first.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTablesDirectly() {
  console.log('🚀 === CREATING AUTONOMOUS AI AGENT TABLES DIRECTLY ===');
  
  const tablesToCreate = [
    {
      name: 'api_usage_tracking',
      sql: `
        CREATE TABLE IF NOT EXISTS api_usage_tracking (
          id BIGSERIAL PRIMARY KEY,
          endpoint VARCHAR(100) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INTEGER,
          response_time_ms INTEGER,
          tokens_used INTEGER DEFAULT 0,
          cost_usd DECIMAL(10,6) DEFAULT 0.000000,
          user_agent TEXT,
          ip_address INET,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          daily_date DATE DEFAULT CURRENT_DATE
        );
      `
    },
    {
      name: 'bot_usage_tracking',
      sql: `
        CREATE TABLE IF NOT EXISTS bot_usage_tracking (
          id BIGSERIAL PRIMARY KEY,
          action VARCHAR(50) NOT NULL,
          success BOOLEAN DEFAULT false,
          execution_time_ms INTEGER,
          memory_used_mb DECIMAL(8,2),
          cpu_usage_percent DECIMAL(5,2),
          error_message TEXT,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          daily_date DATE DEFAULT CURRENT_DATE
        );
      `
    },
    {
      name: 'twitter_master_config',
      sql: `
        CREATE TABLE IF NOT EXISTS twitter_master_config (
          id BIGSERIAL PRIMARY KEY,
          config_key VARCHAR(100) UNIQUE NOT NULL,
          config_value JSONB NOT NULL,
          config_type VARCHAR(50) DEFAULT 'general',
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          last_updated_by VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'twitter_master_decisions',
      sql: `
        CREATE TABLE IF NOT EXISTS twitter_master_decisions (
          id BIGSERIAL PRIMARY KEY,
          decision_type VARCHAR(50) NOT NULL,
          context JSONB NOT NULL,
          decision JSONB NOT NULL,
          confidence_score DECIMAL(5,4) DEFAULT 0.0000,
          reasoning TEXT,
          execution_status VARCHAR(20) DEFAULT 'pending',
          actual_outcome JSONB,
          performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 10),
          learning_feedback JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          executed_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE
        );
      `
    },
    {
      name: 'system_health_status',
      sql: `
        CREATE TABLE IF NOT EXISTS system_health_status (
          id BIGSERIAL PRIMARY KEY,
          component VARCHAR(100) NOT NULL,
          status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'offline')),
          health_score DECIMAL(5,2) DEFAULT 100.00,
          last_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          error_count INTEGER DEFAULT 0,
          uptime_seconds BIGINT DEFAULT 0,
          performance_metrics JSONB,
          alerts JSONB,
          auto_recovery_attempts INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'follower_growth_predictions',
      sql: `
        CREATE TABLE IF NOT EXISTS follower_growth_predictions (
          id BIGSERIAL PRIMARY KEY,
          tweet_id BIGINT,
          content TEXT NOT NULL,
          content_hash VARCHAR(64) UNIQUE,
          followers_predicted INTEGER DEFAULT 0,
          engagement_rate_predicted DECIMAL(5,4) DEFAULT 0.0000,
          viral_score_predicted DECIMAL(5,4) DEFAULT 0.0000,
          quality_score DECIMAL(5,4) DEFAULT 0.0000,
          boring_score DECIMAL(5,4) DEFAULT 0.0000,
          niche_score DECIMAL(5,4) DEFAULT 0.0000,
          confidence DECIMAL(5,4) DEFAULT 0.0000,
          followers_actual INTEGER,
          engagement_rate_actual DECIMAL(5,4),
          viral_score_actual DECIMAL(5,4),
          prediction_accuracy DECIMAL(5,4),
          issues JSONB,
          improvements JSONB,
          audience_appeal JSONB,
          optimal_timing TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          validated_at TIMESTAMP WITH TIME ZONE
        );
      `
    },
    {
      name: 'autonomous_decisions',
      sql: `
        CREATE TABLE IF NOT EXISTS autonomous_decisions (
          id BIGSERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          content_hash VARCHAR(64),
          action VARCHAR(20) NOT NULL CHECK (action IN ('post', 'improve', 'reject', 'delay')),
          confidence DECIMAL(5,4) DEFAULT 0.0000,
          reasoning JSONB,
          suggested_improvements JSONB,
          expected_followers INTEGER,
          expected_engagement_rate DECIMAL(5,4),
          expected_viral_potential DECIMAL(5,4),
          optimal_timing TIMESTAMP WITH TIME ZONE,
          decision_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          was_posted BOOLEAN DEFAULT false,
          posted_tweet_id BIGINT,
          actual_performance JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'follower_growth_patterns',
      sql: `
        CREATE TABLE IF NOT EXISTS follower_growth_patterns (
          id BIGSERIAL PRIMARY KEY,
          pattern_identifier VARCHAR(100) NOT NULL,
          pattern_type VARCHAR(50) NOT NULL,
          pattern_data JSONB NOT NULL,
          times_used INTEGER DEFAULT 0,
          total_followers_gained INTEGER DEFAULT 0,
          average_followers_gained DECIMAL(8,2) DEFAULT 0.00,
          success_rate DECIMAL(5,4) DEFAULT 0.0000,
          average_engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
          content_themes JSONB,
          timing_patterns JSONB,
          audience_segments JSONB,
          is_active BOOLEAN DEFAULT true,
          confidence_score DECIMAL(5,4) DEFAULT 0.0000,
          last_used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(pattern_identifier, pattern_type)
        );
      `
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const table of tablesToCreate) {
    try {
      console.log(`📊 Creating table: ${table.name}`);
      
      // Use raw SQL query
      const { data, error } = await supabase.rpc('exec_sql', { sql: table.sql });
      
      if (error) {
        console.log(`⚠️  ${table.name}: ${error.message} (may already exist)`);
        errorCount++;
      } else {
        console.log(`✅ ${table.name}: Created successfully`);
        successCount++;
      }
      
    } catch (error) {
      console.log(`❌ ${table.name}: ${error.message}`);
      errorCount++;
    }
  }

  // Insert initial configuration data
  console.log('\n📝 === INSERTING INITIAL CONFIGURATION ===');
  
  try {
    const configs = [
      {
        config_key: 'follower_growth_target',
        config_value: { daily: 10, weekly: 70, monthly: 300 },
        config_type: 'growth',
        description: 'Target follower growth rates'
      },
      {
        config_key: 'content_quality_thresholds',
        config_value: { viral_score: 0.7, quality_score: 0.8, boring_score: 0.3 },
        config_type: 'content',
        description: 'Content quality thresholds for posting decisions'
      },
      {
        config_key: 'autonomous_operation',
        config_value: { enabled: true, learning_mode: true, auto_posting: true },
        config_type: 'system',
        description: 'Autonomous operation settings'
      }
    ];

    for (const config of configs) {
      const { data, error } = await supabase
        .from('twitter_master_config')
        .upsert(config, { onConflict: 'config_key' });
      
      if (error) {
        console.log(`⚠️  Config ${config.config_key}: ${error.message}`);
      } else {
        console.log(`✅ Config ${config.config_key}: Inserted`);
      }
    }

    // Insert initial system health status
    const healthComponents = [
      { component: 'autonomous_growth_master', status: 'healthy', health_score: 100.00 },
      { component: 'posting_engine', status: 'healthy', health_score: 100.00 },
      { component: 'learning_system', status: 'healthy', health_score: 100.00 },
      { component: 'prediction_engine', status: 'healthy', health_score: 100.00 }
    ];

    for (const component of healthComponents) {
      const { data, error } = await supabase
        .from('system_health_status')
        .upsert(component, { onConflict: 'component' });
      
      if (error) {
        console.log(`⚠️  Health ${component.component}: ${error.message}`);
      } else {
        console.log(`✅ Health ${component.component}: Initialized`);
      }
    }

  } catch (configError) {
    console.log('⚠️  Configuration insertion had issues (tables may not exist yet)');
  }

  console.log('\n🏁 === SETUP SUMMARY ===');
  console.log(`✅ Tables created: ${successCount}`);
  console.log(`⚠️  Issues encountered: ${errorCount}`);
  
  console.log('\n🤖 === AUTONOMOUS AI AGENT DATABASE STATUS ===');
  if (successCount > 0) {
    console.log('🎯 Database is ready for autonomous operation!');
    console.log('🚀 Your AI agent can now learn and grow followers autonomously!');
  } else {
    console.log('❌ Database setup needs attention. Check Supabase permissions.');
  }
}

// Run the setup
createTablesDirectly().catch(console.error); 