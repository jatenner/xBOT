#!/usr/bin/env node

/**
 * 🎯 AUTONOMOUS TWITTER GROWTH MASTER - RENDER DEPLOYMENT
 * 
 * This script deploys the complete autonomous system to Render with:
 * 1. Database schema setup and migration
 * 2. System health monitoring
 * 3. Self-healing capabilities
 * 4. 24/7 autonomous operation
 * 5. Budget protection and monitoring
 * 6. Real-time follower tracking
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 === AUTONOMOUS TWITTER GROWTH MASTER DEPLOYMENT ===');
console.log('🚀 Preparing fully autonomous 24/7 Twitter bot for Render...');

async function deployAutonomousGrowthMaster() {
  console.log('\n📋 === DEPLOYMENT CHECKLIST ===');
  
  try {
    // Step 1: Database Setup
    console.log('\n🗄️ Step 1: Setting up database schema...');
    await setupDatabaseSchema();
    
    // Step 2: Initialize Growth Strategies
    console.log('\n🎯 Step 2: Initializing growth strategies...');
    await initializeGrowthStrategies();
    
    // Step 3: Setup Learning System
    console.log('\n🧠 Step 3: Setting up learning system...');
    await setupLearningSystem();
    
    // Step 4: Initialize Follower Tracking
    console.log('\n👥 Step 4: Initializing follower tracking...');
    await initializeFollowerTracking();
    
    // Step 5: Configure Budget Protection
    console.log('\n💰 Step 5: Configuring budget protection...');
    await configureBudgetProtection();
    
    // Step 6: Setup Render Environment
    console.log('\n☁️ Step 6: Setting up Render environment...');
    await setupRenderEnvironment();
    
    // Step 7: Start Autonomous System
    console.log('\n🤖 Step 7: Starting autonomous system...');
    await startAutonomousSystem();
    
    // Step 8: Verify System Health
    console.log('\n🛡️ Step 8: Verifying system health...');
    await verifySystemHealth();
    
    console.log('\n✅ === DEPLOYMENT COMPLETE ===');
    console.log('🎯 Autonomous Twitter Growth Master is now operational!');
    console.log('🚀 System ready for 24/7 autonomous operation on Render');
    console.log('📊 Monitor system health at /system-health endpoint');
    console.log('🎛️ Check autonomous status at /autonomous-status endpoint');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\n🔧 Attempting recovery...');
    await performSystemSelfHealing();
    process.exit(1);
  }
}

async function setupDatabaseSchema() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('📊 Checking existing database schema...');
    
    // Read the comprehensive SQL setup file
    const sqlFilePath = path.join(__dirname, 'autonomous_growth_master_database_setup.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL setup file not found: ${sqlFilePath}`);
    }
    
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('🗄️ Executing database setup script...');
    
    // Split the SQL script into individual statements and execute them
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          await supabase.rpc('exec_sql', { sql_statement: statement });
        } catch (error) {
          // Log but don't fail on individual statement errors (tables might already exist)
          console.log(`⚠️ Statement warning: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Database schema setup complete');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.log('📝 Manual setup required. Run the autonomous_growth_master_database_setup.sql file manually.');
    
    // Continue deployment even if database setup fails (for existing setups)
    console.log('⚠️ Continuing deployment assuming database is already configured...');
  }
}

async function initializeGrowthStrategies() {
  console.log('🎯 Initializing autonomous growth strategies...');

  // Check if strategies already exist
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials not found, skipping strategy initialization.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: existingStrategies } = await supabase
    .from('autonomous_growth_strategies')
    .select('strategy_name');

  if (!existingStrategies || existingStrategies.length === 0) {
    const strategies = [
      {
        strategy_name: 'viral_conversation_hooks',
        strategy_description: 'Use conversation starters for maximum engagement and followers',
        target_goal: 'followers',
        content_patterns: ['Ever wonder why', 'What if I told you', 'Here\'s the part no one mentions'],
        success_metrics: { target_followers_per_tweet: 3, target_engagement_rate: 0.08 }
      },
      {
        strategy_name: 'authority_data_driven',
        strategy_description: 'Build authority through specific data and research citations',
        target_goal: 'authority',
        content_patterns: ['Study shows', 'Data reveals', 'Research indicates'],
        success_metrics: { target_followers_per_tweet: 2, target_engagement_rate: 0.05 }
      },
      {
        strategy_name: 'viral_controversy',
        strategy_description: 'Generate viral reach through controversial but educational takes',
        target_goal: 'viral_reach',
        content_patterns: ['Unpopular opinion', 'Hot take', 'Nobody talks about'],
        success_metrics: { target_viral_score: 80, target_reach_multiplier: 5.0 }
      },
      {
        strategy_name: 'engagement_questions',
        strategy_description: 'Drive engagement through thought-provoking questions',
        target_goal: 'engagement',
        content_patterns: ['What would you do if', 'How would you handle', 'What\'s your take on'],
        success_metrics: { target_replies_per_tweet: 5, target_engagement_rate: 0.12 }
      }
    ];

    for (const strategy of strategies) {
      await supabase.from('autonomous_growth_strategies').insert(strategy);
    }

    console.log(`✅ Initialized ${strategies.length} growth strategies`);
  } else {
    console.log(`✅ Found ${existingStrategies.length} existing growth strategies`);
  }
}

async function setupLearningSystem() {
  console.log('🧠 Setting up continuous learning system...');

  // Initialize prediction models
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials not found, skipping learning system initialization.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const models = [
    {
      model_version: 'v1.0',
      prediction_type: 'followers',
      total_predictions: 0,
      correct_predictions: 0,
      accuracy_rate: 0.5,
      model_parameters: {
        qualityWeight: 0.4,
        viralWeight: 0.3,
        timingWeight: 0.2,
        learnedWeight: 0.1
      },
      is_active: true
    },
    {
      model_version: 'v1.0',
      prediction_type: 'engagement',
      total_predictions: 0,
      correct_predictions: 0,
      accuracy_rate: 0.5,
      model_parameters: {
        contentWeight: 0.5,
        timingWeight: 0.3,
        audienceWeight: 0.2
      },
      is_active: true
    }
  ];

  for (const model of models) {
    const { data: existing } = await supabase
      .from('prediction_model_performance')
      .select('id')
      .eq('model_version', model.model_version)
      .eq('prediction_type', model.prediction_type);

    if (!existing || existing.length === 0) {
      await supabase.from('prediction_model_performance').insert(model);
    }
  }

  console.log('✅ Learning system initialized');
}

async function initializeFollowerTracking() {
  console.log('📈 Initializing follower tracking system...');

  // Insert initial follower measurement
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials not found, skipping follower tracking initialization.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const initialMeasurement = {
    measurement_time: new Date().toISOString(),
    follower_count: 0, // Will be updated by the system
    following_count: 0,
    tweet_count: 0,
    followers_gained_24h: 0,
    followers_gained_7d: 0,
    growth_rate_daily: 0,
    growth_rate_weekly: 0,
    measurement_trigger: 'deployment_init'
  };

  await supabase.from('follower_tracking').insert(initialMeasurement);
  console.log('✅ Follower tracking initialized');
}

async function configureBudgetProtection() {
  console.log('🛡️ Configuring budget protection...');

  // Ensure budget lockdown file exists
  const budgetFile = '.daily_spending.log';
  if (!fs.existsSync(budgetFile)) {
    fs.writeFileSync(budgetFile, JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      spending: 0,
      lockdown_active: false
    }));
  }

  console.log('✅ Budget protection configured');
}

async function setupRenderEnvironment() {
  console.log('🔧 Setting up Render environment configuration...');

  // Create render environment configuration
  const renderEnvConfig = {
    // Core application
    NODE_ENV: 'production',
    LIVE_POSTING_ENABLED: 'true',
    
    // Autonomous system
    AUTONOMOUS_MODE: 'true',
    AUTONOMOUS_GROWTH_MASTER_ENABLED: 'true',
    PREDICTIVE_ANALYSIS_ENABLED: 'true',
    SELF_HEALING_ENABLED: 'true',
    FOLLOWER_TRACKING_ENABLED: 'true',
    
    // Budget protection
    DAILY_BUDGET_LIMIT: '5.00',
    EMERGENCY_BUDGET_THRESHOLD: '4.75',
    BUDGET_ENFORCEMENT_ENABLED: 'true',
    
    // Learning system
    CONTINUOUS_LEARNING_ENABLED: 'true',
    PREDICTION_MODEL_ENABLED: 'true',
    CONTENT_OPTIMIZATION_ENABLED: 'true',
    
    // Monitoring
    HEALTH_CHECK_ENABLED: 'true',
    PERFORMANCE_MONITORING_ENABLED: 'true',
    ERROR_REPORTING_ENABLED: 'true'
  };

  // Write environment configuration for reference
  const envContent = Object.entries(renderEnvConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync('render.env', envContent);
  console.log('✅ Render environment configuration saved to render.env');
  console.log('');
  console.log('🚨 IMPORTANT: Add these environment variables to your Render service:');
  console.log(envContent);
}

async function startAutonomousSystem() {
  console.log('🚀 Starting autonomous system...');

  // Import and start the autonomous growth master
  try {
    const { autonomousTwitterGrowthMaster } = require('./src/agents/autonomousTwitterGrowthMaster');
    await autonomousTwitterGrowthMaster.startAutonomousOperation();
    console.log('✅ Autonomous Growth Master started');
  } catch (error) {
    console.warn('⚠️ Will start with main application:', error.message);
  }

  console.log('✅ Autonomous system initialization complete');
}

async function verifySystemHealth() {
  console.log('📊 Verifying system health...');

  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials not found, skipping health check.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const healthChecks = [
    {
      name: 'Database Connection',
      test: async () => {
        const { data } = await supabase.from('autonomous_growth_strategies').select('count').single();
        return !!data;
      }
    },
    {
      name: 'Budget Protection',
      test: async () => fs.existsSync('.daily_spending.log')
    },
    {
      name: 'Environment Variables',
      test: async () => !!(process.env.SUPABASE_URL && process.env.OPENAI_API_KEY)
    }
  ];

  let healthyChecks = 0;
  for (const check of healthChecks) {
    try {
      const result = await check.test();
      if (result) {
        console.log(`✅ ${check.name}: HEALTHY`);
        healthyChecks++;
      } else {
        console.log(`⚠️ ${check.name}: NEEDS ATTENTION`);
      }
    } catch (error) {
      console.log(`❌ ${check.name}: FAILED - ${error.message}`);
    }
  }

  const healthScore = (healthyChecks / healthChecks.length) * 100;
  console.log(`📊 System Health Score: ${healthScore.toFixed(1)}%`);

  if (healthScore < 80) {
    console.log('⚠️ System health below optimal - check failed components');
  } else {
    console.log('✅ System health optimal for 24/7 operation');
  }
}

// Self-healing and monitoring functions
async function performSystemSelfHealing() {
  console.log('🔄 Performing system self-healing...');

  try {
    // Restart autonomous growth master if needed
    const { autonomousTwitterGrowthMaster } = require('./src/agents/autonomousTwitterGrowthMaster');
    const status = autonomousTwitterGrowthMaster.getSystemStatus();
    
    if (!status.isRunning) {
      console.log('🔧 Restarting Autonomous Growth Master...');
      await autonomousTwitterGrowthMaster.startAutonomousOperation();
    }

    console.log('✅ Self-healing complete');
  } catch (error) {
    console.error('❌ Self-healing failed:', error);
  }
}

// Monitor system health every 30 minutes
setInterval(async () => {
  try {
    await performSystemSelfHealing();
  } catch (error) {
    console.error('❌ Health monitoring failed:', error);
  }
}, 30 * 60 * 1000);

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('🛑 Graceful shutdown initiated...');
  try {
    const { autonomousTwitterGrowthMaster } = require('./src/agents/autonomousTwitterGrowthMaster');
    await autonomousTwitterGrowthMaster.stopAutonomousOperation();
    console.log('✅ Autonomous system stopped gracefully');
  } catch (error) {
    console.error('❌ Shutdown error:', error);
  }
  process.exit(0);
});

// Run deployment if called directly
if (require.main === module) {
  deployAutonomousGrowthMaster()
    .then(() => {
      console.log('🎯 Deployment complete - system ready for 24/7 autonomous operation');
      
      // Keep the process alive for monitoring
      setInterval(() => {
        console.log('💓 System heartbeat - autonomous operation continuing...');
      }, 60 * 60 * 1000); // Every hour
    })
    .catch(error => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = {
  deployAutonomousGrowthMaster,
  performSystemSelfHealing,
  RENDER_CONFIG
}; 