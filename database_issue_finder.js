#!/usr/bin/env node

/**
 * 🔍 DATABASE ISSUE FINDER
 * 
 * Identifies specific database integration problems
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function findDatabaseIssues() {
    console.log('🔍 DATABASE ISSUE FINDER');
    console.log('=' .repeat(60));
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const issues = [];
    const criticalIssues = [];

    try {
        // ============================================================================
        // 1. CHECK RECENT TWEET ACTIVITY
        // ============================================================================
        console.log('📝 CHECKING: Recent Tweet Activity');
        console.log('-'.repeat(40));

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

        // Check tweets from last 24 hours
        const { data: recentTweets } = await supabase
            .from('tweets')
            .select('tweet_id, content, created_at')
            .gte('created_at', yesterdayStart.toISOString())
            .order('created_at', { ascending: false });

        console.log(`📊 Tweets in last 24h: ${recentTweets?.length || 0}`);

        if (!recentTweets || recentTweets.length === 0) {
            criticalIssues.push('NO TWEETS in last 24 hours');
            console.log('❌ NO TWEETS found in last 24 hours');
        } else {
            console.log('✅ Recent tweets found');
            
            // Show recent tweets
            recentTweets.slice(0, 3).forEach((tweet, i) => {
                const time = new Date(tweet.created_at).toLocaleString();
                console.log(`  ${i + 1}. ${time} - ${tweet.content.substring(0, 50)}...`);
            });

            // Check for date issues
            const futureTweets = recentTweets.filter(tweet => 
                new Date(tweet.created_at) > now
            );
            
            if (futureTweets.length > 0) {
                issues.push(`${futureTweets.length} tweets have FUTURE timestamps`);
                console.log(`⚠️ ${futureTweets.length} tweets have future timestamps`);
            }
        }

        // ============================================================================
        // 2. CHECK API USAGE TRACKING
        // ============================================================================
        console.log('\n📈 CHECKING: API Usage Tracking');
        console.log('-'.repeat(40));

        const today = now.toISOString().split('T')[0];
        const { data: apiUsage } = await supabase
            .from('api_usage_tracking')
            .select('*')
            .eq('date', today);

        if (!apiUsage || apiUsage.length === 0) {
            criticalIssues.push('NO API usage tracked for today');
            console.log('❌ NO API usage tracked for today');
        } else {
            console.log('✅ API usage tracking working');
            apiUsage.forEach(usage => {
                console.log(`  ${usage.api_type}: ${usage.count} calls`);
            });
        }

        // ============================================================================
        // 3. CHECK BOT ACTIVITY TRACKING
        // ============================================================================
        console.log('\n🤖 CHECKING: Bot Activity Tracking');
        console.log('-'.repeat(40));

        const { data: botActivity } = await supabase
            .from('bot_usage_tracking')
            .select('*')
            .eq('date', today);

        if (!botActivity || botActivity.length === 0) {
            issues.push('NO bot activity tracked for today');
            console.log('❌ NO bot activity tracked for today');
        } else {
            console.log(`✅ Bot activity: ${botActivity.length} entries`);
        }

        // ============================================================================
        // 4. CHECK AI DECISIONS VS ACTUAL TWEETS
        // ============================================================================
        console.log('\n🧠 CHECKING: AI Decisions vs Database Storage');
        console.log('-'.repeat(40));

        const { data: aiDecisions } = await supabase
            .from('twitter_master_decisions')
            .select('decision_type, created_at, reasoning')
            .gte('created_at', todayStart.toISOString())
            .order('created_at', { ascending: false });

        const postDecisions = aiDecisions?.filter(d => d.decision_type === 'post_content') || [];
        const tweetsToday = recentTweets?.filter(tweet => 
            new Date(tweet.created_at) >= todayStart
        ) || [];

        console.log(`🧠 AI posting decisions today: ${postDecisions.length}`);
        console.log(`📝 Actual tweets stored today: ${tweetsToday.length}`);

        if (postDecisions.length > tweetsToday.length) {
            const gap = postDecisions.length - tweetsToday.length;
            criticalIssues.push(`${gap} AI decisions NOT stored as tweets`);
            console.log(`❌ GAP: ${gap} AI decisions not resulting in stored tweets`);
        } else if (postDecisions.length === tweetsToday.length && tweetsToday.length > 0) {
            console.log('✅ AI decisions matching tweet storage');
        }

        // ============================================================================
        // 5. CHECK DATE/TIME CONSISTENCY
        // ============================================================================
        console.log('\n🕐 CHECKING: Date/Time Issues');
        console.log('-'.repeat(40));

        // Check database time
        const { data: dbTime } = await supabase
            .from('tweets')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);

        if (dbTime && dbTime.length > 0) {
            const latestTweetTime = new Date(dbTime[0].created_at);
            const timeDiff = Math.abs(now.getTime() - latestTweetTime.getTime()) / (1000 * 60);
            
            console.log(`🕐 Latest tweet: ${latestTweetTime.toLocaleString()}`);
            console.log(`⏰ Time difference: ${Math.round(timeDiff)} minutes ago`);
            
            if (latestTweetTime > now) {
                issues.push('Latest tweet has FUTURE timestamp');
                console.log('⚠️ Latest tweet has FUTURE timestamp');
            }
        }

        // ============================================================================
        // 6. CHECK FOR SPECIFIC INTEGRATION PROBLEMS
        // ============================================================================
        console.log('\n🔗 CHECKING: Integration Problems');
        console.log('-'.repeat(40));

        // Check for empty required fields
        const { data: emptyFields } = await supabase
            .from('tweets')
            .select('tweet_id, content')
            .or('tweet_id.is.null,content.is.null')
            .limit(5);

        if (emptyFields && emptyFields.length > 0) {
            issues.push(`${emptyFields.length} tweets with empty required fields`);
            console.log(`⚠️ ${emptyFields.length} tweets with empty required fields`);
        }

        // Check for duplicate tweet IDs
        const { data: duplicateCheck } = await supabase
            .from('tweets')
            .select('tweet_id')
            .order('created_at', { ascending: false })
            .limit(100);

        if (duplicateCheck) {
            const tweetIds = duplicateCheck.map(t => t.tweet_id);
            const duplicateIds = tweetIds.filter((id, index) => tweetIds.indexOf(id) !== index);
            
            if (duplicateIds.length > 0) {
                issues.push(`${duplicateIds.length} duplicate tweet IDs found`);
                console.log(`⚠️ ${duplicateIds.length} duplicate tweet IDs found`);
            } else {
                console.log('✅ No duplicate tweet IDs in recent data');
            }
        }

        // ============================================================================
        // 7. CHECK SYSTEM HEALTH STATUS
        // ============================================================================
        console.log('\n🏥 CHECKING: System Health Status');
        console.log('-'.repeat(40));

        const { data: systemHealth } = await supabase
            .from('system_health_status')
            .select('component_name, status, readiness_score')
            .order('readiness_score', { ascending: false });

        if (systemHealth) {
            const optimalComponents = systemHealth.filter(h => h.status === 'optimal').length;
            console.log(`🏥 System Health: ${optimalComponents}/${systemHealth.length} components optimal`);
            
            if (optimalComponents < systemHealth.length) {
                const degradedComponents = systemHealth.filter(h => h.status !== 'optimal');
                issues.push(`${degradedComponents.length} system components not optimal`);
            }
        }

        // ============================================================================
        // 8. FINAL REPORT
        // ============================================================================
        console.log('\n' + '='.repeat(60));
        console.log('🚨 DATABASE ISSUE REPORT');
        console.log('='.repeat(60));

        console.log(`📊 CRITICAL ISSUES: ${criticalIssues.length}`);
        console.log(`⚠️ OTHER ISSUES: ${issues.length}`);
        console.log('');

        if (criticalIssues.length > 0) {
            console.log('🚨 CRITICAL ISSUES (MUST FIX IMMEDIATELY):');
            criticalIssues.forEach((issue, i) => {
                console.log(`   ${i + 1}. ${issue}`);
            });
            console.log('');
        }

        if (issues.length > 0) {
            console.log('⚠️ OTHER ISSUES:');
            issues.forEach((issue, i) => {
                console.log(`   ${i + 1}. ${issue}`);
            });
            console.log('');
        }

        // Status assessment
        if (criticalIssues.length === 0 && issues.length === 0) {
            console.log('🎉 DATABASE STATUS: HEALTHY - No major issues detected');
        } else if (criticalIssues.length === 0) {
            console.log('✅ DATABASE STATUS: GOOD - Minor issues only');
        } else if (criticalIssues.length <= 2) {
            console.log('⚠️ DATABASE STATUS: POOR - Critical issues need immediate attention');
        } else {
            console.log('🚨 DATABASE STATUS: BROKEN - Multiple critical failures');
        }

        console.log('='.repeat(60));

        return {
            criticalIssues,
            issues,
            healthy: criticalIssues.length === 0
        };

    } catch (error) {
        console.error('❌ DATABASE DIAGNOSTIC FAILED:', error);
        return {
            criticalIssues: ['Diagnostic process failed'],
            issues: [error.message],
            healthy: false
        };
    }
}

// Run if executed directly
if (require.main === module) {
    findDatabaseIssues().then(results => {
        const exitCode = results.healthy ? 0 : 1;
        process.exit(exitCode);
    }).catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
}

module.exports = { findDatabaseIssues }; 