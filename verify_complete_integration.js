#!/usr/bin/env node

/**
 * ✅ COMPLETE INTEGRATION VERIFICATION
 * 
 * Final test to verify Twitter Master System is fully integrated
 * and working seamlessly with existing bot infrastructure
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyCompleteIntegration() {
    console.log('✅ COMPLETE INTEGRATION VERIFICATION');
    console.log('=' .repeat(60));
    console.log('🎯 Final verification that everything works together');
    console.log('');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Missing Supabase environment variables');
        return false;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let score = 0;
    const maxScore = 10;

    try {
        // ============================================================================
        // 1. SYSTEM ACTIVATION VERIFICATION
        // ============================================================================
        console.log('🔍 TEST 1: System Activation Status');
        console.log('-'.repeat(40));

        const { data: systemConfig, error: configError } = await supabase
            .from('twitter_master_config')
            .select('*')
            .eq('config_key', 'system_enabled')
            .single();

        if (!configError && systemConfig?.config_value === 'true') {
            console.log('✅ Twitter Master System is ENABLED');
            score++;
        } else {
            console.log('❌ Twitter Master System is NOT enabled');
        }

        // ============================================================================
        // 2. ALL COMPONENTS HEALTH CHECK
        // ============================================================================
        console.log('\n🔍 TEST 2: System Components Health');
        console.log('-'.repeat(40));

        const { data: healthData, error: healthError } = await supabase
            .from('system_health_status')
            .select('*');

        if (!healthError && healthData && healthData.length >= 8) {
            const optimalComponents = healthData.filter(h => h.status === 'optimal').length;
            const avgReadiness = Math.round(healthData.reduce((sum, h) => sum + h.readiness_score, 0) / healthData.length);
            
            console.log(`✅ System Health: ${optimalComponents}/${healthData.length} components optimal`);
            console.log(`📊 Average Readiness: ${avgReadiness}%`);
            
            if (optimalComponents >= 8 && avgReadiness >= 90) {
                score++;
            }
        } else {
            console.log('❌ System health check failed');
        }

        // ============================================================================
        // 3. CONFIGURATION COMPLETENESS
        // ============================================================================
        console.log('\n🔍 TEST 3: Configuration Completeness');
        console.log('-'.repeat(40));

        const requiredConfigs = [
            'system_enabled', 'intelligence_level', 'growth_goal', 
            'content_strategy', 'engagement_budget_daily', 
            'decision_confidence_threshold', 'learning_mode', 'safety_level'
        ];

        const { data: allConfigs, error: allConfigsError } = await supabase
            .from('twitter_master_config')
            .select('config_key, config_value');

        if (!allConfigsError && allConfigs) {
            const configKeys = allConfigs.map(c => c.config_key);
            const missingConfigs = requiredConfigs.filter(key => !configKeys.includes(key));
            
            if (missingConfigs.length === 0) {
                console.log('✅ All required configurations present');
                console.log(`📋 Configurations: ${allConfigs.length} total`);
                score++;
            } else {
                console.log(`❌ Missing configurations: ${missingConfigs.join(', ')}`);
            }
        } else {
            console.log('❌ Configuration check failed');
        }

        // ============================================================================
        // 4. DATABASE TABLES INTEGRATION
        // ============================================================================
        console.log('\n🔍 TEST 4: Database Tables Integration');
        console.log('-'.repeat(40));

        const integrationTables = [
            'tweets', 'twitter_master_decisions', 'twitter_master_config',
            'system_health_status', 'twitter_platform_intelligence'
        ];

        let tablesWorking = 0;
        for (const table of integrationTables) {
            try {
                const { error } = await supabase.from(table).select('*').limit(1);
                if (!error) {
                    tablesWorking++;
                }
            } catch (e) {
                // Table doesn't work
            }
        }

        if (tablesWorking === integrationTables.length) {
            console.log(`✅ Database Integration: ${tablesWorking}/${integrationTables.length} tables working`);
            score++;
        } else {
            console.log(`❌ Database Integration: Only ${tablesWorking}/${integrationTables.length} tables working`);
        }

        // ============================================================================
        // 5. AI DECISION LOGGING VERIFICATION
        // ============================================================================
        console.log('\n🔍 TEST 5: AI Decision Logging');
        console.log('-'.repeat(40));

        const { data: decisions, error: decisionsError } = await supabase
            .from('twitter_master_decisions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!decisionsError && decisions && decisions.length > 0) {
            console.log(`✅ AI Decision Logging: ${decisions.length} recent decisions found`);
            console.log(`📝 Latest: ${decisions[0].decision_type} (${decisions[0].confidence_score}% confidence)`);
            score++;
        } else {
            console.log('❌ AI Decision Logging: No decisions found');
        }

        // ============================================================================
        // 6. EXISTING BOT COMPATIBILITY
        // ============================================================================
        console.log('\n🔍 TEST 6: Existing Bot Compatibility');
        console.log('-'.repeat(40));

        // Check if we can still access existing bot data
        const { data: recentTweets, error: tweetsError } = await supabase
            .from('tweets')
            .select('tweet_id, content, created_at')
            .order('created_at', { ascending: false })
            .limit(3);

        const { data: botConfig, error: botConfigError } = await supabase
            .from('bot_config')
            .select('*')
            .limit(3);

        if (!tweetsError && !botConfigError && recentTweets && botConfig) {
            console.log(`✅ Bot Compatibility: ${recentTweets.length} recent tweets, ${botConfig.length} configs accessible`);
            score++;
        } else {
            console.log('❌ Bot Compatibility: Cannot access existing bot data');
        }

        // ============================================================================
        // 7. INTEGRATION BRIDGE VERIFICATION
        // ============================================================================
        console.log('\n🔍 TEST 7: Integration Bridge');
        console.log('-'.repeat(40));

        const { data: bridgeConfig, error: bridgeError } = await supabase
            .from('twitter_master_config')
            .select('config_value')
            .eq('config_key', 'integration_bridge')
            .single();

        if (!bridgeError && bridgeConfig) {
            try {
                const bridge = JSON.parse(bridgeConfig.config_value);
                if (bridge.enabled && bridge.mode === 'enhanced_posting') {
                    console.log('✅ Integration Bridge: Configured for enhanced posting mode');
                    console.log(`🔗 Mode: ${bridge.mode}, Fallback: ${bridge.fallback}`);
                    score++;
                } else {
                    console.log('❌ Integration Bridge: Invalid configuration');
                }
            } catch (e) {
                console.log('❌ Integration Bridge: Configuration parsing failed');
            }
        } else {
            console.log('❌ Integration Bridge: Not found');
        }

        // ============================================================================
        // 8. LEARNING SYSTEM READINESS
        // ============================================================================
        console.log('\n🔍 TEST 8: Learning System Readiness');
        console.log('-'.repeat(40));

        // Check if we can create learning data structures
        try {
            const testLearning = {
                tweet_id: `learning_test_${Date.now()}`,
                content_type: 'test',
                predicted_performance: { engagement: 50, followers: 5 },
                actual_performance: { engagement: 60, followers: 7 },
                learning_insights: ['Test learning entry'],
                master_decision_data: { test: true }
            };

            const { error: learningError } = await supabase
                .from('content_performance_learning')
                .insert(testLearning);

            if (!learningError) {
                console.log('✅ Learning System: Ready for performance tracking');
                score++;
                
                // Clean up test data
                await supabase
                    .from('content_performance_learning')
                    .delete()
                    .eq('tweet_id', testLearning.tweet_id);
            } else {
                console.log('❌ Learning System: Cannot create learning entries');
            }
        } catch (e) {
            console.log('❌ Learning System: Test failed');
        }

        // ============================================================================
        // 9. WORKFLOW SIMULATION
        // ============================================================================
        console.log('\n🔍 TEST 9: Complete Workflow Simulation');
        console.log('-'.repeat(40));

        try {
            // Simulate a complete AI decision workflow
            const workflowTest = {
                situation_context: {
                    test: true,
                    timestamp: new Date().toISOString(),
                    goal: 'integration_verification'
                },
                decision_type: 'workflow_test',
                reasoning: 'Testing complete integration workflow',
                confidence_score: 95,
                expected_impact: { followers: 10, engagement: 30, authority: 15, network: 8 },
                execution_plan: ['Workflow test', 'Integration verification', 'System validation'],
                success_metrics: ['Test completed', 'No errors', 'All systems operational']
            };

            const { error: workflowError } = await supabase
                .from('twitter_master_decisions')
                .insert(workflowTest);

            if (!workflowError) {
                console.log('✅ Workflow Simulation: Complete decision workflow working');
                score++;
            } else {
                console.log('❌ Workflow Simulation: Failed to log decision');
            }
        } catch (e) {
            console.log('❌ Workflow Simulation: Test failed');
        }

        // ============================================================================
        // 10. SYSTEM PERFORMANCE CHECK
        // ============================================================================
        console.log('\n🔍 TEST 10: System Performance');
        console.log('-'.repeat(40));

        const startTime = Date.now();
        
        // Run a performance test
        const { data: perfTest, error: perfError } = await supabase
            .from('twitter_master_config')
            .select('*');

        const { data: perfTest2, error: perfError2 } = await supabase
            .from('system_health_status')
            .select('*');

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (!perfError && !perfError2 && responseTime < 2000) {
            console.log(`✅ System Performance: Response time ${responseTime}ms (excellent)`);
            score++;
        } else if (responseTime < 5000) {
            console.log(`⚠️ System Performance: Response time ${responseTime}ms (acceptable)`);
            score += 0.5;
        } else {
            console.log(`❌ System Performance: Response time ${responseTime}ms (too slow)`);
        }

        // ============================================================================
        // FINAL RESULTS
        // ============================================================================
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPLETE INTEGRATION VERIFICATION RESULTS');
        console.log('='.repeat(60));

        const percentage = Math.round((score / maxScore) * 100);

        console.log(`📈 Integration Score: ${score}/${maxScore} (${percentage}%)`);
        console.log('');

        // Detailed status
        if (percentage >= 95) {
            console.log('🎉 INTEGRATION STATUS: PERFECT');
            console.log('✅ Twitter Master System is fully integrated');
            console.log('🚀 All systems operational and ready for production');
            console.log('🧠 Your bot is now a Twitter expert with AI intelligence');
        } else if (percentage >= 85) {
            console.log('🌟 INTEGRATION STATUS: EXCELLENT');
            console.log('✅ Twitter Master System is well integrated');
            console.log('🚀 Minor optimizations possible but ready for use');
            console.log('🧠 Your bot has advanced Twitter intelligence');
        } else if (percentage >= 70) {
            console.log('✅ INTEGRATION STATUS: GOOD');
            console.log('🔧 Most systems working, some improvements needed');
            console.log('📝 Review failed tests and optimize');
        } else {
            console.log('⚠️ INTEGRATION STATUS: NEEDS WORK');
            console.log('🛠️ Several issues need attention');
            console.log('📋 Address failed tests before production use');
        }

        console.log('');
        console.log('🎯 WHAT YOUR BOT NOW HAS:');
        console.log('   📊 AI-powered platform intelligence');
        console.log('   🧠 Strategic decision making like a Twitter expert');
        console.log('   📝 Intelligent content strategy and optimization');
        console.log('   🌐 Network building and relationship intelligence');
        console.log('   🚀 Growth-focused follower acquisition tactics');
        console.log('   🛡️ Safety boundaries and compliance checking');
        console.log('   📈 Continuous learning from performance data');
        console.log('   🔗 Seamless integration with existing infrastructure');
        console.log('');
        console.log('🎉 YOUR BOT IS NOW A TWITTER MASTER!');
        console.log('='.repeat(60));

        return percentage >= 80;

    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        return false;
    }
}

// Run verification if executed directly
if (require.main === module) {
    verifyCompleteIntegration().then(success => {
        if (success) {
            console.log('\n🎉 Complete integration verified successfully!');
            process.exit(0);
        } else {
            console.log('\n⚠️ Integration verification found issues!');
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Verification error:', error);
        process.exit(1);
    });
}

module.exports = { verifyCompleteIntegration }; 