#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://lqzqqxgrmxpnwivvzyqz.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxenFxeGdybXhwbndpdnZ6eXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE4Mzk1NzQsImV4cCI6MjA0NzQxNTU3NH0.s-9vCfcEjfKpPXtUhfKQ69r4Y4hcf3cIE8RjxQ7mRR4';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔗 XBOT DATA FLOW MAPPING SYSTEM');
console.log('================================');
console.log('💡 Like a string with 20 knots - each must work for the chain to function');
console.log('');

// Define the data flow chain - each "knot" in our system
const dataFlowChain = [
    {
        id: 1,
        name: "tweets",
        description: "Main tweet storage",
        requiredFields: ["content", "tweet_id", "created_at", "type"],
        expectedData: "All posted tweets with metadata",
        criticalFor: ["engagement tracking", "content analysis", "posting history"]
    },
    {
        id: 2, 
        name: "api_usage",
        description: "API call tracking",
        requiredFields: ["endpoint", "timestamp", "tokens_used"],
        expectedData: "Real-time API usage monitoring",
        criticalFor: ["rate limiting", "cost optimization", "quota management"]
    },
    {
        id: 3,
        name: "api_usage_tracking", 
        description: "Detailed usage analytics",
        requiredFields: ["api_type", "calls_count", "date"],
        expectedData: "Daily/hourly usage patterns",
        criticalFor: ["usage intelligence", "limit prediction"]
    },
    {
        id: 4,
        name: "bot_config",
        description: "Bot configuration settings", 
        requiredFields: ["config_key", "config_value", "updated_at"],
        expectedData: "Dynamic bot settings and parameters",
        criticalFor: ["behavior control", "feature toggles"]
    },
    {
        id: 5,
        name: "competitor_intelligence",
        description: "Competitor analysis data",
        requiredFields: ["account_handle", "analysis_data", "timestamp"],
        expectedData: "Competitor content and performance insights",
        criticalFor: ["content strategy", "competitive advantage"]
    },
    {
        id: 6,
        name: "content_themes",
        description: "Content categorization",
        requiredFields: ["theme_name", "keywords", "performance_score"],
        expectedData: "Viral content patterns and themes",
        criticalFor: ["content generation", "theme optimization"]
    },
    {
        id: 7,
        name: "engagement_patterns",
        description: "Engagement analytics",
        requiredFields: ["content_type", "avg_engagement", "best_times"],
        expectedData: "What content gets engagement when",
        criticalFor: ["posting optimization", "content strategy"]
    },
    {
        id: 8,
        name: "learning_insights",
        description: "AI learning data",
        requiredFields: ["insight_type", "data", "confidence_score"],
        expectedData: "Machine learning patterns and discoveries",
        criticalFor: ["autonomous improvement", "strategy evolution"]
    },
    {
        id: 9,
        name: "style_performance",
        description: "Writing style analytics",
        requiredFields: ["style_type", "engagement_rate", "examples"],
        expectedData: "Which writing styles perform best",
        criticalFor: ["content optimization", "voice consistency"]
    },
    {
        id: 10,
        name: "timing_insights",
        description: "Optimal timing data",
        requiredFields: ["time_slot", "engagement_multiplier", "audience_size"],
        expectedData: "Best times to post for maximum engagement",
        criticalFor: ["scheduling optimization", "reach maximization"]
    },
    {
        id: 11,
        name: "trend_correlations",
        description: "Trend analysis",
        requiredFields: ["trend_topic", "correlation_type", "strength"],
        expectedData: "How trends correlate with engagement",
        criticalFor: ["trend prediction", "viral opportunity detection"]
    },
    {
        id: 12,
        name: "viral_content_analysis",
        description: "Viral content patterns",
        requiredFields: ["content_id", "viral_score", "pattern_type"],
        expectedData: "What makes content go viral",
        criticalFor: ["viral content creation", "engagement maximization"]
    },
    {
        id: 13,
        name: "ai_decisions",
        description: "AI decision tracking",
        requiredFields: ["decision_type", "context_data", "outcome_success"],
        expectedData: "All AI decisions and their outcomes",
        criticalFor: ["learning improvement", "decision optimization"]
    },
    {
        id: 14,
        name: "ai_experiments",
        description: "A/B testing data",
        requiredFields: ["experiment_type", "variant", "results"],
        expectedData: "Experimental results for content optimization",
        criticalFor: ["continuous improvement", "strategy testing"]
    }
];

async function checkDataFlowHealth() {
    console.log('🔍 CHECKING DATA FLOW CHAIN HEALTH');
    console.log('==================================');
    
    let brokenChainPoint = null;
    let healthyKnots = 0;
    
    for (let i = 0; i < dataFlowChain.length; i++) {
        const knot = dataFlowChain[i];
        const lightBulb = await checkTableHealth(knot);
        
        if (lightBulb.isWorking) {
            healthyKnots++;
            console.log(`💡 Knot ${knot.id}: ${knot.name} ✅ WORKING (${lightBulb.recordCount} records)`);
        } else {
            console.log(`💥 Knot ${knot.id}: ${knot.name} ❌ BROKEN - ${lightBulb.issue}`);
            if (!brokenChainPoint) {
                brokenChainPoint = knot.id;
            }
        }
    }
    
    console.log('');
    console.log('📊 CHAIN HEALTH SUMMARY');
    console.log('=======================');
    console.log(`💡 Working knots: ${healthyKnots}/${dataFlowChain.length}`);
    
    if (brokenChainPoint) {
        console.log(`💥 Chain broken at knot ${brokenChainPoint}: ${dataFlowChain[brokenChainPoint-1].name}`);
        console.log(`⚠️  All knots after ${brokenChainPoint} may be affected`);
        
        // Show what's broken and what it affects
        const brokenKnot = dataFlowChain[brokenChainPoint-1];
        console.log('');
        console.log('🔧 REPAIR NEEDED:');
        console.log(`Table: ${brokenKnot.name}`);
        console.log(`Purpose: ${brokenKnot.description}`);
        console.log(`Critical for: ${brokenKnot.criticalFor.join(', ')}`);
        console.log(`Required fields: ${brokenKnot.requiredFields.join(', ')}`);
    } else {
        console.log('✅ All knots working - data flow is healthy!');
    }
    
    return { healthyKnots, totalKnots: dataFlowChain.length, brokenAt: brokenChainPoint };
}

async function checkTableHealth(knot) {
    try {
        // Check if table exists and has data
        const { data, error, count } = await supabase
            .from(knot.name)
            .select('*', { count: 'exact', head: true })
            .limit(1);
            
        if (error) {
            return {
                isWorking: false,
                issue: `Database error: ${error.message}`,
                recordCount: 0
            };
        }
        
        const recordCount = count || 0;
        
        // Special checks for critical tables
        if (knot.name === 'tweets' && recordCount === 0) {
            return {
                isWorking: false,
                issue: "No tweets found - need to import existing tweets",
                recordCount: 0
            };
        }
        
        if (knot.name === 'api_usage' && recordCount === 0) {
            return {
                isWorking: false,
                issue: "No API usage tracking - system not recording calls",
                recordCount: 0
            };
        }
        
        return {
            isWorking: true,
            issue: null,
            recordCount: recordCount
        };
        
    } catch (error) {
        return {
            isWorking: false,
            issue: `Connection error: ${error.message}`,
            recordCount: 0
        };
    }
}

async function generateRepairPlan() {
    console.log('');
    console.log('🔧 AUTOMATED REPAIR PLAN');
    console.log('========================');
    
    // Check for tweets - most critical
    const { data: tweets, error: tweetsError } = await supabase
        .from('tweets')
        .select('count', { count: 'exact', head: true });
        
    if (tweetsError || !tweets) {
        console.log('1. 🚨 CRITICAL: Import existing tweets from Twitter');
        console.log('   Command: node import_existing_tweets.js');
    }
    
    // Check API usage tracking
    const { data: apiUsage, error: apiError } = await supabase
        .from('api_usage')
        .select('count', { count: 'exact', head: true });
        
    if (apiError || !apiUsage) {
        console.log('2. 📊 Fix API usage tracking');
        console.log('   Command: node fix_api_usage_tracking.js');
    }
    
    console.log('3. 🔗 Re-establish data flow connections');
    console.log('4. 🧠 Populate AI learning tables');
    console.log('5. ✅ Verify full chain health');
}

async function main() {
    try {
        const health = await checkDataFlowHealth();
        await generateRepairPlan();
        
        console.log('');
        console.log('🎯 NEXT STEPS:');
        console.log('1. Fix database connection issues');
        console.log('2. Import existing tweets');
        console.log('3. Re-run this health check');
        console.log('4. Deploy fixes to production');
        
    } catch (error) {
        console.error('💥 Health check failed:', error.message);
        console.log('');
        console.log('🚨 DATABASE CONNECTION ISSUE DETECTED');
        console.log('====================================');
        console.log('This is likely the root cause of empty tables.');
        console.log('');
        console.log('IMMEDIATE FIXES NEEDED:');
        console.log('1. Check Supabase credentials');
        console.log('2. Verify network connectivity');
        console.log('3. Test database permissions');
    }
}

// Run the health check
main(); 