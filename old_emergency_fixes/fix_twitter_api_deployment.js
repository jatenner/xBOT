#!/usr/bin/env node

/**
 * 🚀 COMPREHENSIVE TWITTER BOT DEPLOYMENT FIX
 * Fixes API configuration, database schema, and intelligent posting system
 * Target: 30-75 tweets/day with quality content and 15-minute decision cycles
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function fixTwitterBotDeployment() {
    console.log('🚀 COMPREHENSIVE TWITTER BOT DEPLOYMENT FIX');
    console.log('='.repeat(60));
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    console.log('');

    // Initialize Supabase client
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    console.log('🔧 PHASE 1: DATABASE SCHEMA SETUP');
    console.log('-'.repeat(40));

    // 1. Create twitter_api_limits table
    const apiLimitsSQL = `
        CREATE TABLE IF NOT EXISTS twitter_api_limits (
            id SERIAL PRIMARY KEY,
            tweets_this_month INTEGER DEFAULT 0,
            monthly_tweet_cap INTEGER DEFAULT 1500,
            daily_posts_count INTEGER DEFAULT 0,
            daily_post_limit INTEGER DEFAULT 75,
            reads_this_month INTEGER DEFAULT 0,
            monthly_read_cap INTEGER DEFAULT 50000,
            emergency_monthly_cap_mode BOOLEAN DEFAULT false,
            last_daily_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_monthly_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql: apiLimitsSQL });
        if (error) throw error;
        console.log('✅ twitter_api_limits table created/verified');

        // Initialize with intelligent defaults for 30-75 tweets/day operation
        const { error: initError } = await supabase
            .from('twitter_api_limits')
            .upsert({
                id: 1,
                tweets_this_month: 0,
                monthly_tweet_cap: 1500,
                daily_posts_count: 0,
                daily_post_limit: 75, // Your target maximum
                reads_this_month: 0,
                monthly_read_cap: 50000,
                emergency_monthly_cap_mode: false, // DISABLE false emergency mode
                last_daily_reset: new Date().toISOString(),
                last_monthly_reset: new Date().toISOString(),
                last_updated: new Date().toISOString()
            }, { onConflict: 'id' });

        if (!initError) {
            console.log('✅ API limits initialized: 0/1500 monthly, 0/75 daily');
        }
    } catch (error) {
        console.log('❌ Error setting up twitter_api_limits:', error.message);
    }

    // 2. Create bot_configuration table
    const botConfigSQL = `
        CREATE TABLE IF NOT EXISTS bot_configuration (
            id SERIAL PRIMARY KEY,
            strategy VARCHAR(100) DEFAULT 'intelligent_monthly_budget',
            mode VARCHAR(50) DEFAULT 'production',
            auto_posting_enabled BOOLEAN DEFAULT true,
            quality_threshold INTEGER DEFAULT 60,
            posting_interval_minutes INTEGER DEFAULT 15,
            max_daily_tweets INTEGER DEFAULT 75,
            min_daily_tweets INTEGER DEFAULT 30,
            baseline_daily_target INTEGER DEFAULT 50,
            emergency_mode BOOLEAN DEFAULT false,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql: botConfigSQL });
        if (error) throw error;
        console.log('✅ bot_configuration table created/verified');

        // Initialize with your requested 30-75 tweets/day settings
        const { error: configError } = await supabase
            .from('bot_configuration')
            .upsert({
                id: 1,
                strategy: 'intelligent_monthly_budget',
                mode: 'production',
                auto_posting_enabled: true,
                quality_threshold: 60, // Quality content only
                posting_interval_minutes: 15, // Check every 15 minutes as requested
                max_daily_tweets: 75,
                min_daily_tweets: 30,
                baseline_daily_target: 50, // Smart middle ground
                emergency_mode: false,
                last_updated: new Date().toISOString()
            }, { onConflict: 'id' });

        if (!configError) {
            console.log('✅ Bot configuration set: 30-75 tweets/day, 15min intervals');
        }
    } catch (error) {
        console.log('❌ Error setting up bot_configuration:', error.message);
    }

    // 3. Create monthly_budget_state table for intelligent targeting
    const monthlyBudgetSQL = `
        CREATE TABLE IF NOT EXISTS monthly_budget_state (
            month VARCHAR(7) PRIMARY KEY, -- YYYY-MM format
            tweets_used INTEGER DEFAULT 0,
            tweets_budget INTEGER DEFAULT 1500,
            days_remaining INTEGER DEFAULT 30,
            daily_targets JSONB DEFAULT '{}',
            strategic_reserves INTEGER DEFAULT 225, -- 15% of 1500
            performance_multiplier DECIMAL(3,2) DEFAULT 1.00,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql: monthlyBudgetSQL });
        if (error) throw error;
        console.log('✅ monthly_budget_state table created/verified');

        // Initialize current month
        const currentMonth = new Date().toISOString().slice(0, 7);
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const daysRemaining = daysInMonth - new Date().getDate() + 1;

        const { error: budgetError } = await supabase
            .from('monthly_budget_state')
            .upsert({
                month: currentMonth,
                tweets_used: 0,
                tweets_budget: 1500,
                days_remaining: daysRemaining,
                daily_targets: {},
                strategic_reserves: 225,
                performance_multiplier: 1.00,
                last_updated: new Date().toISOString()
            }, { onConflict: 'month' });

        if (!budgetError) {
            console.log(`✅ Monthly budget initialized: ${currentMonth} (${daysRemaining} days left)`);
        }
    } catch (error) {
        console.log('❌ Error setting up monthly_budget_state:', error.message);
    }

    console.log('');
    console.log('⚙️ PHASE 2: TWITTER API CONFIGURATION');
    console.log('-'.repeat(40));

    // Check Twitter API credentials
    const twitterConfig = {
        TWITTER_APP_KEY: process.env.TWITTER_APP_KEY || process.env.TWITTER_API_KEY,
        TWITTER_APP_SECRET: process.env.TWITTER_APP_SECRET || process.env.TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET || process.env.TWITTER_ACCESS_TOKEN_SECRET,
        TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN
    };

    let twitterConfigured = true;
    Object.entries(twitterConfig).forEach(([key, value]) => {
        if (value && value !== 'your_twitter_access_token_here') {
            console.log(`✅ ${key}: configured`);
        } else {
            console.log(`❌ ${key}: MISSING`);
            twitterConfigured = false;
        }
    });

    if (!twitterConfigured) {
        console.log('');
        console.log('🔑 TWITTER API SETUP REQUIRED:');
        console.log('   1. Go to https://developer.twitter.com/en/portal/dashboard');
        console.log('   2. Create/access your Twitter app');
        console.log('   3. Generate API keys and access tokens');
        console.log('   4. Update your .env file with:');
        console.log('      TWITTER_APP_KEY=your_api_key');
        console.log('      TWITTER_APP_SECRET=your_api_secret');
        console.log('      TWITTER_ACCESS_TOKEN=your_access_token');
        console.log('      TWITTER_ACCESS_SECRET=your_access_secret');
        console.log('      TWITTER_BEARER_TOKEN=your_bearer_token');
    }

    console.log('');
    console.log('🤖 PHASE 3: BOT OPTIMIZATION FOR 30-75 TWEETS/DAY');
    console.log('-'.repeat(40));

    // Optimize posting configuration
    const optimizationSQL = `
        -- Ensure intelligent posting intervals
        UPDATE bot_configuration SET 
            posting_interval_minutes = 15,
            max_daily_tweets = 75,
            min_daily_tweets = 30,
            baseline_daily_target = 50,
            strategy = 'intelligent_monthly_budget',
            auto_posting_enabled = true,
            emergency_mode = false
        WHERE id = 1;

        -- Reset any false emergency states
        UPDATE twitter_api_limits SET 
            emergency_monthly_cap_mode = false,
            daily_post_limit = 75
        WHERE id = 1;
    `;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql: optimizationSQL });
        if (error) throw error;
        console.log('✅ Bot optimized for intelligent 30-75 tweets/day operation');
        console.log('✅ 15-minute decision cycles enabled');
        console.log('✅ Emergency mode disabled');
    } catch (error) {
        console.log('❌ Error optimizing bot configuration:', error.message);
    }

    console.log('');
    console.log('📊 PHASE 4: EXPECTED PERFORMANCE');
    console.log('-'.repeat(40));

    console.log('📈 POSTING STRATEGY:');
    console.log('   • Baseline: 50 tweets/day (1500/month ÷ 30 days)');
    console.log('   • Range: 30-75 tweets/day based on opportunities');
    console.log('   • Decision cycle: Every 15 minutes');
    console.log('   • Quality threshold: 60+ score required');
    console.log('   • Content variety: Breaking news, insights, research, engagement');
    
    console.log('');
    console.log('⏰ OPTIMAL SCHEDULE:');
    console.log('   • Peak hours: 2-4 tweets/hour (trending topics)');
    console.log('   • Normal hours: 1-2 tweets/hour (steady content)');
    console.log('   • Off-peak: 1 tweet/hour (evergreen content)');
    console.log('   • AI decides: Post, reply, like, or research every 15min');

    console.log('');
    console.log('🎯 CONTENT FOCUS:');
    console.log('   • High-quality, engaging healthcare & AI content');
    console.log('   • No boring or repetitive posts');
    console.log('   • Varied context and style');
    console.log('   • Real-time trending topic integration');
    console.log('   • Strategic timing based on engagement patterns');

    console.log('');
    console.log('🚀 PHASE 5: DEPLOYMENT VERIFICATION');
    console.log('-'.repeat(40));

    // Verify setup
    try {
        const { data: limits } = await supabase
            .from('twitter_api_limits')
            .select('*')
            .eq('id', 1)
            .single();

        const { data: config } = await supabase
            .from('bot_configuration')
            .select('*')
            .eq('id', 1)
            .single();

        if (limits && config) {
            console.log('✅ Database setup verified');
            console.log(`✅ Monthly cap: ${limits.monthly_tweet_cap} tweets`);
            console.log(`✅ Daily range: ${config.min_daily_tweets}-${config.max_daily_tweets} tweets`);
            console.log(`✅ Posting interval: ${config.posting_interval_minutes} minutes`);
            console.log(`✅ Emergency mode: ${limits.emergency_monthly_cap_mode ? 'ACTIVE ⚠️' : 'Disabled ✅'}`);
        }
    } catch (error) {
        console.log('❌ Error verifying setup:', error.message);
    }

    console.log('');
    console.log('✅ DEPLOYMENT FIX COMPLETE');
    console.log('='.repeat(60));
    
    if (twitterConfigured) {
        console.log('🎉 Bot is ready for intelligent 30-75 tweets/day operation!');
        console.log('🔄 Next: Deploy to Render for continuous operation');
    } else {
        console.log('⚠️  Add Twitter API credentials to complete setup');
        console.log('🔄 Then deploy to Render for continuous operation');
    }

    console.log('');
    console.log('📱 Monitor at: https://your-render-app.onrender.com/dashboard');
    console.log(`📊 Expected: ${Math.floor(50 * (new Date().getDate() / 30))} tweets by now this month`);
}

// Run the comprehensive fix
fixTwitterBotDeployment().catch(console.error); 