console.log('🚨 === COMPREHENSIVE ENGAGEMENT AUDIT ===');
console.log('🔍 Diagnosing why bot is not engaging with other accounts\n');

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

async function auditEngagementIssues() {
    console.log('📋 === ENGAGEMENT AUDIT CHECKLIST ===\n');
    
    // 1. Check if engagement table exists
    console.log('1️⃣ DATABASE TABLE STATUS:');
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
            .from('engagement_history')
            .select('count')
            .limit(1);
            
        if (error) {
            console.log('   ❌ CRITICAL: engagement_history table does not exist!');
            console.log(`   📋 Error: ${error.message}`);
            console.log('   🔧 Solution: Create table in Supabase dashboard');
        } else {
            console.log('   ✅ engagement_history table exists');
            
            // Check for recent engagement records
            const { data: recentData } = await supabase
                .from('engagement_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);
                
            if (recentData && recentData.length > 0) {
                console.log(`   ✅ Found ${recentData.length} recent engagement records`);
                recentData.forEach((record, i) => {
                    console.log(`      ${i+1}. ${record.action_type} - ${record.created_at}`);
                });
            } else {
                console.log('   ❌ No engagement records found - bot not engaging');
            }
        }
    } catch (error) {
        console.log('   ❌ Database connection failed:', error.message);
    }
    
    // 2. Check environment variables
    console.log('\n2️⃣ ENVIRONMENT VARIABLES:');
    const requiredEnvs = [
        'TWITTER_BEARER_TOKEN',
        'TWITTER_API_KEY', 
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET',
        'OPENAI_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY'
    ];
    
    requiredEnvs.forEach(env => {
        if (process.env[env]) {
            console.log(`   ✅ ${env}: SET (${process.env[env].substring(0, 10)}...)`);
        } else {
            console.log(`   ❌ ${env}: MISSING`);
        }
    });
    
    // 3. Check scheduler configuration
    console.log('\n3️⃣ SCHEDULER STATUS:');
    try {
        const fs = require('fs');
        const schedulerPath = './dist/agents/scheduler.js';
        
        if (fs.existsSync(schedulerPath)) {
            console.log('   ✅ Scheduler compiled successfully');
            
            // Check if engagement agent is in scheduler
            const schedulerContent = fs.readFileSync(schedulerPath, 'utf8');
            if (schedulerContent.includes('RateLimitedEngagementAgent')) {
                console.log('   ✅ RateLimitedEngagementAgent found in scheduler');
            } else {
                console.log('   ❌ RateLimitedEngagementAgent NOT found in scheduler');
            }
            
            if (schedulerContent.includes('performEngagement')) {
                console.log('   ✅ performEngagement method found');
            } else {
                console.log('   ❌ performEngagement method NOT found');
            }
        } else {
            console.log('   ❌ Scheduler not compiled - TypeScript build issue');
        }
    } catch (error) {
        console.log('   ❌ Error checking scheduler:', error.message);
    }
    
    // 4. Check engagement agent compilation
    console.log('\n4️⃣ ENGAGEMENT AGENT STATUS:');
    try {
        const fs = require('fs');
        const agentPath = './dist/agents/rateLimitedEngagementAgent.js';
        
        if (fs.existsSync(agentPath)) {
            const agentContent = fs.readFileSync(agentPath, 'utf8');
            const agentSize = (agentContent.length / 1024).toFixed(1);
            
            if (agentContent.length > 1000) {
                console.log(`   ✅ RateLimitedEngagementAgent compiled (${agentSize}KB)`);
                
                // Check for key methods
                const methods = [
                    'performStrategicLikes',
                    'performIntelligentReplies', 
                    'performStrategicFollows',
                    'performQualityRetweets'
                ];
                
                methods.forEach(method => {
                    if (agentContent.includes(method)) {
                        console.log(`      ✅ ${method} method present`);
                    } else {
                        console.log(`      ❌ ${method} method MISSING`);
                    }
                });
            } else {
                console.log(`   ❌ RateLimitedEngagementAgent too small (${agentSize}KB) - likely empty stub`);
            }
        } else {
            console.log('   ❌ RateLimitedEngagementAgent not compiled');
        }
    } catch (error) {
        console.log('   ❌ Error checking engagement agent:', error.message);
    }
    
    // 5. Check bot deployment status
    console.log('\n5️⃣ DEPLOYMENT STATUS:');
    try {
        const https = require('https');
        
        // Try to ping Render deployment (replace with actual URL)
        console.log('   🌐 Checking Render deployment...');
        console.log('   ⚠️  Cannot check deployment without Render URL');
        console.log('   📋 Manual check: Visit Render dashboard to verify deployment');
    } catch (error) {
        console.log('   ❌ Deployment check failed:', error.message);
    }
    
    // 6. Check API rate limits
    console.log('\n6️⃣ API RATE LIMITS:');
    console.log('   🐦 Twitter API v2 Free Tier Limits:');
    console.log('      • 1,000 likes per day');
    console.log('      • 400 follows per day'); 
    console.log('      • 300 replies per day');
    console.log('      • 300 retweets per day');
    console.log('   📊 Current usage: Unknown (need real-time monitoring)');
    
    console.log('\n🎯 === DIAGNOSTIC SUMMARY ===');
    console.log('Most likely issues preventing engagement:');
    console.log('1. ❌ Missing engagement_history table in Supabase');
    console.log('2. ❌ Environment variables not set on Render');
    console.log('3. ❌ Scheduler not calling engagement agent');
    console.log('4. ❌ Engagement agent not properly deployed');
    console.log('\n🔧 Next steps: Create database table and verify deployment');
}

auditEngagementIssues().catch(console.error);
