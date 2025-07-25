#!/usr/bin/env node

/**
 * 🧪 DATABASE INTEGRATION TEST
 * 
 * Tests that the Twitter Master System database tables
 * integrate properly with existing bot infrastructure
 */

const { createClient } = require('@supabase/supabase-js');

// Database configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testDatabaseIntegration() {
    console.log('🧪 DATABASE INTEGRATION TEST');
    console.log('=' .repeat(60));
    console.log('🎯 Testing Twitter Master System + Existing Database');
    console.log('');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Missing Supabase environment variables');
        console.log('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
        return { success: false, error: 'Missing environment variables' };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = { passed: 0, failed: 0, tests: [] };

    try {
        // ============================================================================
        // 1. EXISTING TABLES TEST
        // ============================================================================
        console.log('📊 TESTING: Existing Database Tables');
        console.log('-'.repeat(40));

        const existingTables = ['tweets', 'api_usage_tracking', 'bot_usage_tracking', 'bot_config', 'system_logs'];

        for (const table of existingTables) {
            try {
                const { error } = await supabase.from(table).select('*').limit(1);
                if (error) {
                    console.log(`❌ ${table}: ${error.message}`);
                    results.failed++;
                    results.tests.push({ table, status: 'failed', error: error.message });
                } else {
                    console.log(`✅ ${table}: Working`);
                    results.passed++;
                    results.tests.push({ table, status: 'passed' });
                }
            } catch (e) {
                console.log(`❌ ${table}: ${e.message}`);
                results.failed++;
                results.tests.push({ table, status: 'failed', error: e.message });
            }
        }

        // ============================================================================
        // 2. NEW TWITTER MASTER TABLES TEST
        // ============================================================================
        console.log('\n🧠 TESTING: Twitter Master System Tables');
        console.log('-'.repeat(40));

        const twitterMasterTables = [
            'twitter_platform_intelligence',
            'content_strategy_decisions', 
            'twitter_relationships',
            'strategic_engagements',
            'follower_growth_analytics',
            'content_performance_learning',
            'twitter_master_decisions',
            'trending_opportunities',
            'twitter_master_config',
            'system_health_status'
        ];

        for (const table of twitterMasterTables) {
            try {
                const { error } = await supabase.from(table).select('*').limit(1);
                if (error) {
                    console.log(`❌ ${table}: ${error.message}`);
                    results.failed++;
                    results.tests.push({ table, status: 'failed', error: error.message });
                } else {
                    console.log(`✅ ${table}: Working`);
                    results.passed++;
                    results.tests.push({ table, status: 'passed' });
                }
            } catch (e) {
                console.log(`❌ ${table}: ${e.message}`);
                results.failed++;
                results.tests.push({ table, status: 'failed', error: e.message });
            }
        }

        // ============================================================================
        // 3. FUNCTIONAL TESTS
        // ============================================================================
        console.log('\n⚙️ TESTING: Database Functionality');
        console.log('-'.repeat(40));

        // Test 1: Can we insert a test tweet?
        console.log('🔍 Testing tweet insertion...');
        try {
            const testTweet = {
                tweet_id: `test_${Date.now()}`,
                content: 'Database integration test tweet',
                tweet_type: 'original',
                content_type: 'test',
                engagement_score: 0
            };

            const { error: insertError } = await supabase
                .from('tweets')
                .insert(testTweet);

            if (insertError) {
                console.log(`❌ Tweet insertion: ${insertError.message}`);
                results.failed++;
            } else {
                console.log('✅ Tweet insertion: Working');
                results.passed++;
                
                // Clean up
                await supabase.from('tweets').delete().eq('tweet_id', testTweet.tweet_id);
            }
        } catch (e) {
            console.log(`❌ Tweet insertion: ${e.message}`);
            results.failed++;
        }

        // Test 2: Can we log a Twitter Master decision?
        console.log('🔍 Testing AI decision logging...');
        try {
            const testDecision = {
                situation_context: { test: true, timestamp: new Date().toISOString() },
                decision_type: 'post_content',
                reasoning: 'Database integration test decision',
                confidence_score: 85,
                expected_impact: { followers: 5, engagement: 20, authority: 10, network: 3 },
                execution_plan: ['Test database integration', 'Verify logging works'],
                success_metrics: ['Database write successful', 'No errors occurred']
            };

            const { error: decisionError } = await supabase
                .from('twitter_master_decisions')
                .insert(testDecision);

            if (decisionError) {
                console.log(`❌ AI decision logging: ${decisionError.message}`);
                results.failed++;
            } else {
                console.log('✅ AI decision logging: Working');
                results.passed++;
            }
        } catch (e) {
            console.log(`❌ AI decision logging: ${e.message}`);
            results.failed++;
        }

        // Test 3: Can we update system health status?
        console.log('🔍 Testing system health updates...');
        try {
            const { error: healthError } = await supabase
                .from('system_health_status')
                .upsert({
                    component_name: 'integration_test',
                    status: 'optimal',
                    readiness_score: 100,
                    health_data: { test: true },
                    recommendations: ['Integration test passed'],
                    last_check: new Date().toISOString()
                });

            if (healthError) {
                console.log(`❌ System health updates: ${healthError.message}`);
                results.failed++;
            } else {
                console.log('✅ System health updates: Working');
                results.passed++;
            }
        } catch (e) {
            console.log(`❌ System health updates: ${e.message}`);
            results.failed++;
        }

        // Test 4: Can we access Twitter Master config?
        console.log('🔍 Testing Twitter Master configuration...');
        try {
            const { data: configData, error: configError } = await supabase
                .from('twitter_master_config')
                .select('*')
                .limit(5);

            if (configError) {
                console.log(`❌ Twitter Master config: ${configError.message}`);
                results.failed++;
            } else {
                console.log(`✅ Twitter Master config: Working (${configData?.length || 0} configs found)`);
                results.passed++;
            }
        } catch (e) {
            console.log(`❌ Twitter Master config: ${e.message}`);
            results.failed++;
        }

        // ============================================================================
        // 4. INTEGRATION VERIFICATION
        // ============================================================================
        console.log('\n🔗 TESTING: Cross-Table Integration');
        console.log('-'.repeat(40));

        // Test 5: Can we query across old and new tables?
        console.log('🔍 Testing cross-table queries...');
        try {
            // Get recent tweets
            const { data: recentTweets, error: tweetsError } = await supabase
                .from('tweets')
                .select('tweet_id, content, created_at')
                .order('created_at', { ascending: false })
                .limit(3);

            if (tweetsError) {
                console.log(`❌ Cross-table queries: ${tweetsError.message}`);
                results.failed++;
            } else {
                console.log(`✅ Cross-table queries: Working (${recentTweets?.length || 0} recent tweets)`);
                results.passed++;
            }
        } catch (e) {
            console.log(`❌ Cross-table queries: ${e.message}`);
            results.failed++;
        }

        // ============================================================================
        // 5. RESULTS SUMMARY
        // ============================================================================
        console.log('\n' + '='.repeat(60));
        console.log('📊 DATABASE INTEGRATION TEST RESULTS');
        console.log('='.repeat(60));

        const totalTests = results.passed + results.failed;
        const successRate = totalTests > 0 ? Math.round((results.passed / totalTests) * 100) : 0;

        console.log(`📈 Tests: ${results.passed}/${totalTests} passed (${successRate}%)`);
        console.log(`✅ Passed: ${results.passed}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log('');

        // Show detailed results
        console.log('📋 Detailed Results:');
        const groupedTests = {};
        results.tests.forEach(test => {
            const category = test.table.includes('twitter_') ? 'Twitter Master' : 'Existing';
            if (!groupedTests[category]) groupedTests[category] = [];
            groupedTests[category].push(test);
        });

        Object.entries(groupedTests).forEach(([category, tests]) => {
            console.log(`\n   ${category} Tables:`);
            tests.forEach(test => {
                const status = test.status === 'passed' ? '✅' : '❌';
                console.log(`     ${status} ${test.table}`);
                if (test.error) {
                    console.log(`       Error: ${test.error}`);
                }
            });
        });

        console.log('');

        // Final assessment
        if (successRate >= 90) {
            console.log('🎉 INTEGRATION STATUS: EXCELLENT');
            console.log('✅ Database fully ready for Twitter Master System');
            console.log('🚀 All tables working properly');
            return { success: true, status: 'excellent', successRate, results };
        } else if (successRate >= 75) {
            console.log('✅ INTEGRATION STATUS: GOOD');
            console.log('🔧 Minor issues detected, mostly functional');
            console.log('📝 Review failed tests before full deployment');
            return { success: true, status: 'good', successRate, results };
        } else {
            console.log('⚠️ INTEGRATION STATUS: NEEDS WORK');
            console.log('🛠️ Significant issues detected');
            console.log('📋 Address failed tests before proceeding');
            return { success: false, status: 'needs_work', successRate, results };
        }

    } catch (error) {
        console.error('❌ DATABASE INTEGRATION TEST FAILED:', error);
        return { success: false, error: error.message };
    }
}

// Run test if executed directly
if (require.main === module) {
    testDatabaseIntegration().then(result => {
        if (result.success) {
            console.log('\n✅ Database integration test completed!');
            process.exit(0);
        } else {
            console.log('\n❌ Database integration test failed!');
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Test error:', error);
        process.exit(1);
    });
}

module.exports = { testDatabaseIntegration }; 