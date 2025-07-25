#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE DATABASE DIAGNOSTIC
 * 
 * This script will identify ALL database integration issues
 * and provide detailed analysis of what's missing and broken
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runComprehensiveDatabaseDiagnostic() {
    console.log('🔍 COMPREHENSIVE DATABASE DIAGNOSTIC');
    console.log('=' .repeat(80));
    console.log('🎯 IDENTIFYING ALL DATABASE INTEGRATION ISSUES');
    console.log('');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ CRITICAL: Missing Supabase environment variables');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const diagnostics = {
        connectivity: { score: 0, issues: [], recommendations: [] },
        schema: { score: 0, issues: [], recommendations: [] },
        dataIntegrity: { score: 0, issues: [], recommendations: [] },
        realTimeSync: { score: 0, issues: [], recommendations: [] },
        dateTime: { score: 0, issues: [], recommendations: [] },
        apiTracking: { score: 0, issues: [], recommendations: [] },
        overall: { score: 0, criticalIssues: [], urgentFixes: [] }
    };

    try {
        // ============================================================================
        // 1. CONNECTIVITY & AUTHENTICATION TEST
        // ============================================================================
        console.log('🔌 TESTING: Database Connectivity & Authentication');
        console.log('-'.repeat(60));

        const startTime = Date.now();
        const { data: connectionTest, error: connectionError } = await supabase
            .from('tweets')
            .select('count')
            .limit(1);

        const connectionTime = Date.now() - startTime;

        if (!connectionError) {
            console.log(`✅ Database connection: SUCCESS (${connectionTime}ms)`);
            diagnostics.connectivity.score = 100;
        } else {
            console.log(`❌ Database connection: FAILED - ${connectionError.message}`);
            diagnostics.connectivity.issues.push('Database connection failed');
            diagnostics.connectivity.recommendations.push('Check Supabase credentials');
            diagnostics.overall.criticalIssues.push('Database connection broken');
        }

        // ============================================================================
        // 2. SCHEMA VALIDATION & TABLE STRUCTURE
        // ============================================================================
        console.log('\n📋 TESTING: Database Schema & Table Structure');
        console.log('-'.repeat(60));

        const expectedTables = [
            'tweets', 'api_usage_tracking', 'bot_usage_tracking', 'bot_config', 'system_logs',
            'twitter_master_config', 'twitter_master_decisions', 'system_health_status'
        ];

        let tablesExist = 0;
        const missingTables = [];

        for (const table of expectedTables) {
            try {
                const { error } = await supabase.from(table).select('*').limit(1);
                if (!error) {
                    console.log(`✅ ${table}: Available`);
                    tablesExist++;
                } else {
                    console.log(`❌ ${table}: Missing or inaccessible - ${error.message}`);
                    missingTables.push(table);
                }
            } catch (e) {
                console.log(`❌ ${table}: Exception - ${e.message}`);
                missingTables.push(table);
            }
        }

        diagnostics.schema.score = Math.round((tablesExist / expectedTables.length) * 100);
        
        if (missingTables.length > 0) {
            diagnostics.schema.issues.push(`Missing tables: ${missingTables.join(', ')}`);
            diagnostics.schema.recommendations.push('Run database migrations to create missing tables');
        }

        console.log(`📊 Schema Health: ${tablesExist}/${expectedTables.length} tables (${diagnostics.schema.score}%)`);

        // ============================================================================
        // 3. DATA INTEGRITY ANALYSIS
        // ============================================================================
        console.log('\n📊 TESTING: Data Integrity & Consistency');
        console.log('-'.repeat(60));

        // Check tweets table structure
        const { data: tweetsColumns, error: tweetsError } = await supabase
            .rpc('exec_sql', { sql: `
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = 'tweets' 
                ORDER BY ordinal_position;
            ` }).catch(() => ({ data: null, error: 'Cannot check columns' }));

        if (tweetsColumns && Array.isArray(tweetsColumns)) {
            console.log('✅ Tweets table structure accessible');
            const requiredColumns = ['id', 'tweet_id', 'content', 'created_at'];
            const existingColumns = tweetsColumns.map(col => col.column_name);
            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
            
            if (missingColumns.length === 0) {
                console.log('✅ All required columns present');
                diagnostics.dataIntegrity.score += 25;
            } else {
                console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
                diagnostics.dataIntegrity.issues.push(`Missing columns in tweets: ${missingColumns.join(', ')}`);
            }
        } else {
            console.log('❌ Cannot check tweets table structure');
            diagnostics.dataIntegrity.issues.push('Cannot access table structure');
        }

        // Check for duplicate tweet IDs
        const { data: duplicates } = await supabase
            .rpc('exec_sql', { sql: `
                SELECT tweet_id, COUNT(*) as count 
                FROM tweets 
                GROUP BY tweet_id 
                HAVING COUNT(*) > 1 
                LIMIT 10;
            ` }).catch(() => ({ data: [] }));

        if (duplicates && duplicates.length > 0) {
            console.log(`❌ Found ${duplicates.length} duplicate tweet IDs`);
            diagnostics.dataIntegrity.issues.push(`${duplicates.length} duplicate tweet IDs found`);
            diagnostics.dataIntegrity.recommendations.push('Clean up duplicate tweet entries');
        } else {
            console.log('✅ No duplicate tweet IDs found');
            diagnostics.dataIntegrity.score += 25;
        }

        // ============================================================================
        // 4. REAL-TIME SYNC ANALYSIS
        // ============================================================================
        console.log('\n🔄 TESTING: Real-Time Data Sync');
        console.log('-'.repeat(60));

        // Check recent tweet insertions
        const { data: recentTweets } = await supabase
            .from('tweets')
            .select('tweet_id, content, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        if (recentTweets && recentTweets.length > 0) {
            const recentCount = recentTweets.filter(tweet => 
                new Date(tweet.created_at) > oneHourAgo
            ).length;

            console.log(`📊 Tweets in last hour: ${recentCount}`);
            console.log(`📊 Total recent tweets: ${recentTweets.length}`);

            if (recentCount === 0) {
                console.log('⚠️ No tweets inserted in last hour');
                diagnostics.realTimeSync.issues.push('No recent tweet insertions detected');
                diagnostics.realTimeSync.recommendations.push('Check if bot is actually running and saving to database');
            } else {
                console.log('✅ Recent tweet activity detected');
                diagnostics.realTimeSync.score += 50;
            }

            // Show latest tweets
            console.log('\n📋 Latest tweets in database:');
            recentTweets.slice(0, 3).forEach((tweet, i) => {
                const time = new Date(tweet.created_at).toLocaleString();
                console.log(`  ${i + 1}. ${time} - ${tweet.content.substring(0, 60)}...`);
            });

        } else {
            console.log('❌ No tweets found in database');
            diagnostics.realTimeSync.issues.push('No tweets found in database');
            diagnostics.overall.criticalIssues.push('Tweet table is empty');
        }

        // ============================================================================
        // 5. DATE/TIME CONSISTENCY CHECK
        // ============================================================================
        console.log('\n🕐 TESTING: Date/Time Consistency');
        console.log('-'.repeat(60));

        const { data: timeTest } = await supabase
            .rpc('exec_sql', { sql: `SELECT NOW() as server_time, CURRENT_DATE as server_date;` })
            .catch(() => ({ data: null }));

        if (timeTest && timeTest.length > 0) {
            const serverTime = timeTest[0].server_time;
            const serverDate = timeTest[0].server_date;
            
            console.log(`🕐 Database server time: ${serverTime}`);
            console.log(`📅 Database server date: ${serverDate}`);
            
            const dbDate = new Date(serverTime);
            const localDate = new Date();
            const timeDiff = Math.abs(dbDate.getTime() - localDate.getTime()) / (1000 * 60); // minutes
            
            console.log(`⏰ Time difference: ${Math.round(timeDiff)} minutes`);
            
            if (timeDiff > 60) { // More than 1 hour difference
                console.log('⚠️ Significant time difference detected');
                diagnostics.dateTime.issues.push(`${Math.round(timeDiff)} minute time difference`);
                diagnostics.dateTime.recommendations.push('Check timezone settings and clock synchronization');
            } else {
                console.log('✅ Time synchronization within acceptable range');
                diagnostics.dateTime.score += 50;
            }

            // Check for future dates in tweets
            const { data: futureTweets } = await supabase
                .from('tweets')
                .select('tweet_id, created_at')
                .gt('created_at', new Date().toISOString())
                .limit(5);

            if (futureTweets && futureTweets.length > 0) {
                console.log(`⚠️ Found ${futureTweets.length} tweets with future timestamps`);
                diagnostics.dateTime.issues.push(`${futureTweets.length} tweets with future dates`);
                futureTweets.forEach(tweet => {
                    console.log(`  Future: ${tweet.created_at} (ID: ${tweet.tweet_id})`);
                });
            } else {
                console.log('✅ No tweets with future timestamps');
                diagnostics.dateTime.score += 50;
            }

        } else {
            console.log('❌ Cannot check database time');
            diagnostics.dateTime.issues.push('Cannot access database time functions');
        }

        // ============================================================================
        // 6. API USAGE TRACKING ANALYSIS
        // ============================================================================
        console.log('\n📈 TESTING: API Usage Tracking');
        console.log('-'.repeat(60));

        const today = new Date().toISOString().split('T')[0];
        const { data: apiUsage } = await supabase
            .from('api_usage_tracking')
            .select('*')
            .eq('date', today);

        if (apiUsage && apiUsage.length > 0) {
            console.log(`✅ API usage tracked for today: ${apiUsage.length} entries`);
            apiUsage.forEach(usage => {
                console.log(`  ${usage.api_type}: ${usage.count} calls`);
            });
            diagnostics.apiTracking.score = 100;
        } else {
            console.log('❌ No API usage tracked for today');
            diagnostics.apiTracking.issues.push('API usage tracking not working');
            diagnostics.apiTracking.recommendations.push('Check API usage logging in bot code');
            diagnostics.overall.criticalIssues.push('API usage tracking broken');
        }

        // Check historical API usage
        const { data: historicalUsage } = await supabase
            .from('api_usage_tracking')
            .select('date, api_type, count')
            .order('date', { ascending: false })
            .limit(10);

        if (historicalUsage && historicalUsage.length > 0) {
            console.log('\n📊 Recent API usage history:');
            historicalUsage.forEach(usage => {
                console.log(`  ${usage.date}: ${usage.api_type} - ${usage.count} calls`);
            });
        } else {
            console.log('\n❌ No historical API usage data');
            diagnostics.apiTracking.issues.push('No historical API usage data');
        }

        // ============================================================================
        // 7. BOT INTEGRATION ANALYSIS  
        // ============================================================================
        console.log('\n🤖 TESTING: Bot Integration Status');
        console.log('-'.repeat(60));

        // Check bot usage tracking
        const { data: botActivity } = await supabase
            .from('bot_usage_tracking')
            .select('*')
            .eq('date', today);

        if (botActivity && botActivity.length > 0) {
            console.log(`✅ Bot activity tracked: ${botActivity.length} entries`);
            diagnostics.realTimeSync.score += 50;
        } else {
            console.log('❌ No bot activity tracked for today');
            diagnostics.realTimeSync.issues.push('Bot activity tracking not working');
        }

        // Check AI decisions vs actual tweets
        const { data: aiDecisions } = await supabase
            .from('twitter_master_decisions')
            .select('decision_type, created_at')
            .gte('created_at', today)
            .eq('decision_type', 'post_content');

        const tweetsToday = recentTweets ? recentTweets.filter(tweet => 
            tweet.created_at.startsWith(today)
        ).length : 0;

        console.log(`🧠 AI posting decisions today: ${aiDecisions?.length || 0}`);
        console.log(`📝 Actual tweets in database today: ${tweetsToday}`);

        if ((aiDecisions?.length || 0) > tweetsToday) {
            const gap = (aiDecisions?.length || 0) - tweetsToday;
            console.log(`⚠️ Gap detected: ${gap} AI decisions not resulting in database tweets`);
            diagnostics.realTimeSync.issues.push(`${gap} AI decisions not saved as tweets`);
            diagnostics.overall.criticalIssues.push('AI decisions not syncing to database');
        }

        // ============================================================================
        // 8. CALCULATE OVERALL SCORES
        // ============================================================================
        const scores = [
            diagnostics.connectivity.score,
            diagnostics.schema.score,
            diagnostics.dataIntegrity.score,
            diagnostics.realTimeSync.score,
            diagnostics.dateTime.score,
            diagnostics.apiTracking.score
        ];

        diagnostics.overall.score = Math.round(scores.reduce((a, b) => a + b) / scores.length);

        // ============================================================================
        // 9. FINAL DIAGNOSTIC REPORT
        // ============================================================================
        console.log('\n' + '='.repeat(80));
        console.log('🏥 COMPREHENSIVE DATABASE DIAGNOSTIC REPORT');
        console.log('='.repeat(80));

        console.log(`📊 OVERALL DATABASE HEALTH: ${diagnostics.overall.score}%`);
        console.log('');

        console.log('📋 Detailed Breakdown:');
        console.log(`   🔌 Connectivity:     ${diagnostics.connectivity.score}%`);
        console.log(`   📋 Schema:           ${diagnostics.schema.score}%`);
        console.log(`   📊 Data Integrity:   ${diagnostics.dataIntegrity.score}%`);
        console.log(`   🔄 Real-Time Sync:   ${diagnostics.realTimeSync.score}%`);
        console.log(`   🕐 Date/Time:        ${diagnostics.dateTime.score}%`);
        console.log(`   📈 API Tracking:     ${diagnostics.apiTracking.score}%`);
        console.log('');

        // Critical Issues
        if (diagnostics.overall.criticalIssues.length > 0) {
            console.log('🚨 CRITICAL ISSUES:');
            diagnostics.overall.criticalIssues.forEach((issue, i) => {
                console.log(`   ${i + 1}. ${issue}`);
            });
            console.log('');
        }

        // All Issues Summary
        const allIssues = [
            ...diagnostics.connectivity.issues,
            ...diagnostics.schema.issues,
            ...diagnostics.dataIntegrity.issues,
            ...diagnostics.realTimeSync.issues,
            ...diagnostics.dateTime.issues,
            ...diagnostics.apiTracking.issues
        ];

        if (allIssues.length > 0) {
            console.log('⚠️ ALL IDENTIFIED ISSUES:');
            allIssues.forEach((issue, i) => {
                console.log(`   ${i + 1}. ${issue}`);
            });
            console.log('');
        }

        // Recommendations
        const allRecommendations = [
            ...diagnostics.connectivity.recommendations,
            ...diagnostics.schema.recommendations,
            ...diagnostics.dataIntegrity.recommendations,
            ...diagnostics.realTimeSync.recommendations,
            ...diagnostics.dateTime.recommendations,
            ...diagnostics.apiTracking.recommendations
        ];

        if (allRecommendations.length > 0) {
            console.log('🔧 URGENT RECOMMENDATIONS:');
            allRecommendations.forEach((rec, i) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
            console.log('');
        }

        // Status Assessment
        if (diagnostics.overall.score >= 90) {
            console.log('🎉 DATABASE STATUS: EXCELLENT - Minor optimizations only');
        } else if (diagnostics.overall.score >= 75) {
            console.log('✅ DATABASE STATUS: GOOD - Some improvements needed');
        } else if (diagnostics.overall.score >= 50) {
            console.log('⚠️ DATABASE STATUS: POOR - Major issues need immediate attention');
        } else {
            console.log('🚨 DATABASE STATUS: CRITICAL - System requires urgent repair');
        }

        console.log('='.repeat(80));

        return diagnostics;

    } catch (error) {
        console.error('❌ DIAGNOSTIC FAILED:', error);
        diagnostics.overall.criticalIssues.push('Diagnostic process failed');
        return diagnostics;
    }
}

// Run diagnostic if executed directly
if (require.main === module) {
    runComprehensiveDatabaseDiagnostic().then(results => {
        const exitCode = results.overall.score >= 75 ? 0 : 1;
        console.log(`\n${results.overall.score >= 75 ? '✅' : '❌'} Diagnostic completed with ${results.overall.score}% health`);
        process.exit(exitCode);
    }).catch(error => {
        console.error('❌ Diagnostic error:', error);
        process.exit(1);
    });
}

module.exports = { runComprehensiveDatabaseDiagnostic }; 