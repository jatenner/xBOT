#!/usr/bin/env node

/**
 * 🏥 COMPREHENSIVE DATABASE HEALTH CHECK
 * 
 * This test performs a complete health assessment of the database
 * including Twitter Master System integration and performance
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function databaseHealthCheck() {
    console.log('🏥 COMPREHENSIVE DATABASE HEALTH CHECK');
    console.log('=' .repeat(70));
    console.log('🎯 Testing all database functionality and performance');
    console.log('');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Missing Supabase environment variables');
        return false;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = {
        connectivity: 0,
        schema: 0,
        functionality: 0,
        performance: 0,
        integration: 0
    };

    try {
        // ============================================================================
        // 1. CONNECTIVITY & AUTHENTICATION
        // ============================================================================
        console.log('🔌 TESTING: Database Connectivity & Authentication');
        console.log('-'.repeat(50));

        const startTime = Date.now();
        const { data: connectionTest, error: connectionError } = await supabase
            .from('tweets')
            .select('count')
            .limit(1);

        const connectionTime = Date.now() - startTime;

        if (!connectionError) {
            console.log(`✅ Database connection: SUCCESS (${connectionTime}ms)`);
            results.connectivity = 100;
        } else {
            console.log(`❌ Database connection: FAILED - ${connectionError.message}`);
            return false;
        }

        // ============================================================================
        // 2. SCHEMA VALIDATION
        // ============================================================================
        console.log('\n📋 TESTING: Database Schema Validation');
        console.log('-'.repeat(50));

        const requiredTables = [
            // Core bot tables
            { name: 'tweets', type: 'core' },
            { name: 'api_usage_tracking', type: 'core' },
            { name: 'bot_usage_tracking', type: 'core' },
            { name: 'bot_config', type: 'core' },
            { name: 'system_logs', type: 'core' },
            
            // Twitter Master System tables
            { name: 'twitter_master_config', type: 'master' },
            { name: 'twitter_master_decisions', type: 'master' },
            { name: 'system_health_status', type: 'master' },
            { name: 'twitter_platform_intelligence', type: 'master' },
            { name: 'content_strategy_decisions', type: 'master' },
            { name: 'twitter_relationships', type: 'master' },
            { name: 'strategic_engagements', type: 'master' },
            { name: 'follower_growth_analytics', type: 'master' },
            { name: 'content_performance_learning', type: 'master' },
            { name: 'trending_opportunities', type: 'master' }
        ];

        let schemaScore = 0;
        const maxSchemaScore = requiredTables.length;

        for (const table of requiredTables) {
            try {
                const { error } = await supabase.from(table.name).select('*').limit(1);
                if (!error) {
                    console.log(`✅ ${table.name} (${table.type}): Available`);
                    schemaScore++;
                } else {
                    console.log(`❌ ${table.name} (${table.type}): ${error.message}`);
                }
            } catch (e) {
                console.log(`❌ ${table.name} (${table.type}): Exception - ${e.message}`);
            }
        }

        results.schema = Math.round((schemaScore / maxSchemaScore) * 100);
        console.log(`📊 Schema Health: ${schemaScore}/${maxSchemaScore} tables (${results.schema}%)`);

        // ============================================================================
        // 3. FUNCTIONAL TESTING
        // ============================================================================
        console.log('\n⚙️ TESTING: Database Functionality');
        console.log('-'.repeat(50));

        let functionalityScore = 0;
        const maxFunctionalityScore = 8;

        // Test 1: Basic CRUD operations
        console.log('🔍 Testing basic CRUD operations...');
        try {
            const testData = {
                tweet_id: `health_test_${Date.now()}`,
                content: 'Database health check test tweet',
                tweet_type: 'test',
                content_type: 'health_check',
                engagement_score: 0
            };

            // CREATE
            const { error: insertError } = await supabase
                .from('tweets')
                .insert(testData);

            if (!insertError) {
                functionalityScore++;
                console.log('  ✅ INSERT: Working');

                // READ
                const { data: readData, error: readError } = await supabase
                    .from('tweets')
                    .select('*')
                    .eq('tweet_id', testData.tweet_id)
                    .single();

                if (!readError && readData) {
                    functionalityScore++;
                    console.log('  ✅ SELECT: Working');

                    // UPDATE
                    const { error: updateError } = await supabase
                        .from('tweets')
                        .update({ engagement_score: 100 })
                        .eq('tweet_id', testData.tweet_id);

                    if (!updateError) {
                        functionalityScore++;
                        console.log('  ✅ UPDATE: Working');
                    } else {
                        console.log('  ❌ UPDATE: Failed');
                    }

                    // DELETE
                    const { error: deleteError } = await supabase
                        .from('tweets')
                        .delete()
                        .eq('tweet_id', testData.tweet_id);

                    if (!deleteError) {
                        functionalityScore++;
                        console.log('  ✅ DELETE: Working');
                    } else {
                        console.log('  ❌ DELETE: Failed');
                    }
                } else {
                    console.log('  ❌ SELECT: Failed');
                }
            } else {
                console.log('  ❌ INSERT: Failed');
            }
        } catch (e) {
            console.log('  ❌ CRUD Operations: Exception');
        }

        // Test 2: Twitter Master System functionality
        console.log('🔍 Testing Twitter Master System operations...');
        try {
            // Test AI decision logging
            const testDecision = {
                situation_context: { test: true, health_check: Date.now() },
                decision_type: 'health_check',
                reasoning: 'Database health check test decision',
                confidence_score: 95,
                expected_impact: { followers: 1, engagement: 5 },
                execution_plan: ['Test database health'],
                success_metrics: ['Health check completed']
            };

            const { error: decisionError } = await supabase
                .from('twitter_master_decisions')
                .insert(testDecision);

            if (!decisionError) {
                functionalityScore++;
                console.log('  ✅ AI Decision Logging: Working');
            } else {
                console.log('  ❌ AI Decision Logging: Failed');
            }

            // Test system health status
            const { error: healthError } = await supabase
                .from('system_health_status')
                .update({
                    last_check: new Date().toISOString(),
                    health_data: { health_check: true }
                })
                .eq('component_name', 'database_health_check');

            if (!healthError) {
                functionalityScore++;
                console.log('  ✅ System Health Updates: Working');
            } else {
                console.log('  ❌ System Health Updates: Failed');
            }

            // Test configuration access
            const { data: configData, error: configError } = await supabase
                .from('twitter_master_config')
                .select('*')
                .limit(3);

            if (!configError && configData) {
                functionalityScore++;
                console.log(`  ✅ Configuration Access: Working (${configData.length} configs)`);
            } else {
                console.log('  ❌ Configuration Access: Failed');
            }

            // Test learning system
            const testLearning = {
                tweet_id: `learning_health_${Date.now()}`,
                content_type: 'health_check',
                predicted_performance: { engagement: 30 },
                actual_performance: { engagement: 35 },
                learning_insights: ['Health check learning test']
            };

            const { error: learningError } = await supabase
                .from('content_performance_learning')
                .insert(testLearning);

            if (!learningError) {
                functionalityScore++;
                console.log('  ✅ Learning System: Working');
                
                // Clean up
                await supabase
                    .from('content_performance_learning')
                    .delete()
                    .eq('tweet_id', testLearning.tweet_id);
            } else {
                console.log('  ❌ Learning System: Failed');
            }

        } catch (e) {
            console.log('  ❌ Twitter Master System: Exception');
        }

        results.functionality = Math.round((functionalityScore / maxFunctionalityScore) * 100);
        console.log(`📊 Functionality Health: ${functionalityScore}/${maxFunctionalityScore} tests (${results.functionality}%)`);

        // ============================================================================
        // 4. PERFORMANCE TESTING
        // ============================================================================
        console.log('\n⚡ TESTING: Database Performance');
        console.log('-'.repeat(50));

        let performanceScore = 0;
        const maxPerformanceScore = 4;

        // Test 1: Query response time
        console.log('🔍 Testing query response times...');
        const queryStartTime = Date.now();
        const { data: perfTestData, error: perfTestError } = await supabase
            .from('tweets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        const queryTime = Date.now() - queryStartTime;

        if (!perfTestError) {
            if (queryTime < 200) {
                performanceScore += 2;
                console.log(`  ✅ Query Speed: EXCELLENT (${queryTime}ms)`);
            } else if (queryTime < 500) {
                performanceScore += 1;
                console.log(`  ✅ Query Speed: GOOD (${queryTime}ms)`);
            } else {
                console.log(`  ⚠️ Query Speed: SLOW (${queryTime}ms)`);
            }
        } else {
            console.log('  ❌ Query Speed: FAILED');
        }

        // Test 2: Concurrent operations
        console.log('🔍 Testing concurrent operations...');
        const concurrentStartTime = Date.now();
        
        const concurrentPromises = [
            supabase.from('twitter_master_config').select('*').limit(3),
            supabase.from('system_health_status').select('*').limit(3),
            supabase.from('tweets').select('*').limit(3)
        ];

        try {
            const concurrentResults = await Promise.all(concurrentPromises);
            const concurrentTime = Date.now() - concurrentStartTime;
            
            if (concurrentResults.every(result => !result.error)) {
                if (concurrentTime < 300) {
                    performanceScore += 2;
                    console.log(`  ✅ Concurrent Operations: EXCELLENT (${concurrentTime}ms)`);
                } else {
                    performanceScore += 1;
                    console.log(`  ✅ Concurrent Operations: GOOD (${concurrentTime}ms)`);
                }
            } else {
                console.log('  ❌ Concurrent Operations: Some failed');
            }
        } catch (e) {
            console.log('  ❌ Concurrent Operations: Exception');
        }

        results.performance = Math.round((performanceScore / maxPerformanceScore) * 100);
        console.log(`📊 Performance Health: ${performanceScore}/${maxPerformanceScore} tests (${results.performance}%)`);

        // ============================================================================
        // 5. INTEGRATION TESTING
        // ============================================================================
        console.log('\n🔗 TESTING: System Integration');
        console.log('-'.repeat(50));

        let integrationScore = 0;
        const maxIntegrationScore = 3;

        // Test 1: Cross-table relationships
        console.log('🔍 Testing cross-table relationships...');
        try {
            const { data: recentTweets } = await supabase
                .from('tweets')
                .select('tweet_id, content, created_at')
                .order('created_at', { ascending: false })
                .limit(5);

            const { data: recentDecisions } = await supabase
                .from('twitter_master_decisions')
                .select('decision_type, confidence_score, created_at')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentTweets && recentDecisions) {
                integrationScore++;
                console.log(`  ✅ Cross-table queries: ${recentTweets.length} tweets, ${recentDecisions.length} decisions`);
            } else {
                console.log('  ❌ Cross-table queries: Failed');
            }
        } catch (e) {
            console.log('  ❌ Cross-table queries: Exception');
        }

        // Test 2: Configuration consistency
        console.log('🔍 Testing configuration consistency...');
        try {
            const { data: masterConfig } = await supabase
                .from('twitter_master_config')
                .select('*');

            const { data: botConfig } = await supabase
                .from('bot_config')
                .select('*');

            if (masterConfig && botConfig && masterConfig.length > 0 && botConfig.length > 0) {
                integrationScore++;
                console.log(`  ✅ Configuration consistency: ${masterConfig.length} master configs, ${botConfig.length} bot configs`);
            } else {
                console.log('  ❌ Configuration consistency: Missing configs');
            }
        } catch (e) {
            console.log('  ❌ Configuration consistency: Exception');
        }

        // Test 3: System status coherence
        console.log('🔍 Testing system status coherence...');
        try {
            const { data: systemHealth } = await supabase
                .from('system_health_status')
                .select('*');

            if (systemHealth && systemHealth.length >= 8) {
                const optimalComponents = systemHealth.filter(h => h.status === 'optimal').length;
                const healthPercentage = Math.round((optimalComponents / systemHealth.length) * 100);
                
                if (healthPercentage >= 90) {
                    integrationScore++;
                    console.log(`  ✅ System status: ${optimalComponents}/${systemHealth.length} optimal (${healthPercentage}%)`);
                } else {
                    console.log(`  ⚠️ System status: ${optimalComponents}/${systemHealth.length} optimal (${healthPercentage}%)`);
                }
            } else {
                console.log('  ❌ System status: Insufficient health data');
            }
        } catch (e) {
            console.log('  ❌ System status: Exception');
        }

        results.integration = Math.round((integrationScore / maxIntegrationScore) * 100);
        console.log(`📊 Integration Health: ${integrationScore}/${maxIntegrationScore} tests (${results.integration}%)`);

        // ============================================================================
        // FINAL HEALTH ASSESSMENT
        // ============================================================================
        console.log('\n' + '='.repeat(70));
        console.log('🏥 COMPREHENSIVE DATABASE HEALTH REPORT');
        console.log('='.repeat(70));

        const overallScore = Math.round(
            (results.connectivity + results.schema + results.functionality + 
             results.performance + results.integration) / 5
        );

        console.log(`📊 OVERALL HEALTH SCORE: ${overallScore}%`);
        console.log('');
        console.log('📋 Detailed Breakdown:');
        console.log(`   🔌 Connectivity:  ${results.connectivity}%`);
        console.log(`   📋 Schema:        ${results.schema}%`);
        console.log(`   ⚙️ Functionality: ${results.functionality}%`);
        console.log(`   ⚡ Performance:   ${results.performance}%`);
        console.log(`   🔗 Integration:   ${results.integration}%`);
        console.log('');

        // Health status assessment
        if (overallScore >= 95) {
            console.log('🎉 DATABASE STATUS: EXCELLENT');
            console.log('✅ Your database is in perfect health');
            console.log('🚀 All systems optimal for high-performance Twitter operations');
        } else if (overallScore >= 85) {
            console.log('🌟 DATABASE STATUS: VERY GOOD');
            console.log('✅ Your database is in very good health');
            console.log('🚀 Minor optimizations possible but ready for production');
        } else if (overallScore >= 75) {
            console.log('✅ DATABASE STATUS: GOOD');
            console.log('🔧 Your database is healthy with room for improvement');
            console.log('📝 Consider optimizing lower-scoring areas');
        } else if (overallScore >= 60) {
            console.log('⚠️ DATABASE STATUS: FAIR');
            console.log('🛠️ Your database needs attention in several areas');
            console.log('📋 Review and fix issues before heavy usage');
        } else {
            console.log('🚨 DATABASE STATUS: POOR');
            console.log('🆘 Your database has significant issues');
            console.log('🔧 Immediate attention required');
        }

        console.log('='.repeat(70));

        return overallScore >= 75;

    } catch (error) {
        console.error('❌ DATABASE HEALTH CHECK FAILED:', error);
        return false;
    }
}

// Run health check if executed directly
if (require.main === module) {
    databaseHealthCheck().then(healthy => {
        if (healthy) {
            console.log('\n🎉 Database health check completed - System is healthy!');
            process.exit(0);
        } else {
            console.log('\n⚠️ Database health check completed - Issues detected!');
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Health check error:', error);
        process.exit(1);
    });
}

module.exports = { databaseHealthCheck }; 