// ===== VERIFY BOT CODE MATCHES DATABASE SCHEMA =====
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verifyBotDatabaseMatch() {
    console.log('🔍 VERIFYING BOT CODE MATCHES DATABASE SCHEMA');
    console.log('='.repeat(50));

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test the exact queries the bot code uses
    const tests = [
        {
            name: 'tweets table - basic query',
            test: () => supabase.from('tweets').select('count').limit(1)
        },
        {
            name: 'daily_budgets - check date column',
            test: () => supabase.from('daily_budgets').select('date, budget_used, budget_limit').limit(1)
        },
        {
            name: 'bot_config - check structure',
            test: () => supabase.from('bot_config').select('config_key, config_value').limit(1)
        },
        {
            name: 'engagement_metrics - check recorded_at',
            test: () => supabase.from('engagement_metrics').select('recorded_at, tweet_id').limit(1)
        },
        {
            name: 'learning_posts - check structure',
            test: () => supabase.from('learning_posts').select('content, performance_score').limit(1)
        }
    ];

    let allPassed = true;

    for (const test of tests) {
        try {
            console.log(`🧪 Testing: ${test.name}`);
            const { error } = await test.test();
            
            if (error) {
                console.log(`❌ FAILED: ${test.name}`);
                console.log(`   Error: ${error.message}`);
                allPassed = false;
            } else {
                console.log(`✅ PASSED: ${test.name}`);
            }
        } catch (err) {
            console.log(`❌ FAILED: ${test.name}`);
            console.log(`   Exception: ${err.message}`);
            allPassed = false;
        }
    }

    console.log('\n' + '='.repeat(50));
    
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED - Bot code matches database schema!');
        console.log('✅ Bot should now work without database errors');
    } else {
        console.log('⚠️ SOME TESTS FAILED - Schema mismatch detected');
        console.log('🔧 Run permanent_schema_fix.sql to fix the issues');
    }

    // Test a typical bot operation
    console.log('\n🤖 Testing typical bot operations...');
    
    try {
        // Test inserting a tweet
        const { error: insertError } = await supabase
            .from('tweets')
            .insert({
                content: 'Test tweet from schema verification',
                tweet_id: 'test_' + Date.now(),
                posted_at: new Date().toISOString(),
                platform: 'twitter',
                status: 'posted'
            });
            
        if (insertError) {
            console.log('❌ Tweet insert test failed:', insertError.message);
        } else {
            console.log('✅ Tweet insert test passed');
            
            // Clean up test data
            await supabase
                .from('tweets')
                .delete()
                .like('tweet_id', 'test_%');
        }
        
        // Test budget check
        const { error: budgetError } = await supabase
            .from('daily_budgets')
            .select('date, budget_used, budget_limit')
            .eq('date', new Date().toISOString().split('T')[0]);
            
        if (budgetError) {
            console.log('❌ Budget check test failed:', budgetError.message);
        } else {
            console.log('✅ Budget check test passed');
        }
        
    } catch (err) {
        console.log('❌ Bot operation test failed:', err.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎯 SCHEMA VERIFICATION COMPLETE');
}

verifyBotDatabaseMatch().catch(console.error);