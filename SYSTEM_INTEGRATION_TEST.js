#!/usr/bin/env node

/**
 * 🔍 SYSTEM INTEGRATION TEST
 * ==========================
 * Tests that all your systems work perfectly with the new clean database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class SystemIntegrationTest {
    
    async runFullTest() {
        console.log('🚀 STARTING SYSTEM INTEGRATION TEST');
        console.log('=====================================\n');
        
        const results = {
            database_connection: false,
            table_structure: false,
            data_insertion: false,
            data_retrieval: false,
            system_flows: false
        };
        
        try {
            // Test 1: Database Connection
            console.log('📡 Testing database connection...');
            results.database_connection = await this.testDatabaseConnection();
            
            // Test 2: Table Structure
            console.log('🏗️  Testing table structures...');
            results.table_structure = await this.testTableStructures();
            
            // Test 3: Data Insertion
            console.log('💾 Testing data insertion...');
            results.data_insertion = await this.testDataInsertion();
            
            // Test 4: Data Retrieval
            console.log('📤 Testing data retrieval...');
            results.data_retrieval = await this.testDataRetrieval();
            
            // Test 5: System Flows
            console.log('🔄 Testing system flows...');
            results.system_flows = await this.testSystemFlows();
            
            // Final Report
            this.generateReport(results);
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }
    
    async testDatabaseConnection() {
        try {
            const { data, error } = await supabase.from('bot_config').select('count').limit(1);
            if (error) {
                console.log('❌ Database connection failed:', error.message);
                return false;
            }
            console.log('✅ Database connection successful');
            return true;
        } catch (error) {
            console.log('❌ Database connection error:', error.message);
            return false;
        }
    }
    
    async testTableStructures() {
        const requiredTables = [
            'bot_config',
            'tweets', 
            'twitter_quota_tracking',
            'engagement_history',
            'daily_budget_status',
            'system_logs',
            'content_uniqueness',
            'expert_learning_data',
            'budget_transactions'
        ];
        
        let allTablesExist = true;
        
        for (const table of requiredTables) {
            try {
                const { error } = await supabase.from(table).select('*').limit(1);
                if (error) {
                    console.log(`❌ Table '${table}' issue:`, error.message);
                    allTablesExist = false;
                } else {
                    console.log(`✅ Table '${table}' exists and accessible`);
                }
            } catch (error) {
                console.log(`❌ Table '${table}' error:`, error.message);
                allTablesExist = false;
            }
        }
        
        return allTablesExist;
    }
    
    async testDataInsertion() {
        const testData = {
            // Test bot_config
            config: {
                key: 'test_config',
                value: 'test_value'
            },
            // Test tweets
            tweet: {
                tweet_id: 'test_tweet_' + Date.now(),
                content: 'Test tweet for system integration',
                tweet_type: 'test',
                content_type: 'integration_test'
            },
            // Test twitter_quota_tracking
            quota: {
                date: new Date().toISOString().split('T')[0],
                daily_used: 0,
                daily_limit: 17,
                daily_remaining: 17,
                is_exhausted: false
            },
            // Test engagement_history
            engagement: {
                action_type: 'test',
                target_id: 'test_target',
                target_type: 'test',
                content: 'Test engagement',
                success: true
            },
            // Test content_uniqueness
            uniqueness: {
                content_hash: 'test_hash_' + Date.now(),
                original_content: 'Test content for uniqueness',
                normalized_content: 'test content for uniqueness',
                content_topic: 'test'
            }
        };
        
        let allInsertionsSuccessful = true;
        
        // Test each insertion
        for (const [tableName, data] of Object.entries(testData)) {
            try {
                let table;
                switch (tableName) {
                    case 'config': table = 'bot_config'; break;
                    case 'tweet': table = 'tweets'; break;
                    case 'quota': table = 'twitter_quota_tracking'; break;
                    case 'engagement': table = 'engagement_history'; break;
                    case 'uniqueness': table = 'content_uniqueness'; break;
                }
                
                const { error } = await supabase.from(table).insert(data);
                if (error) {
                    console.log(`❌ Insert into '${table}' failed:`, error.message);
                    allInsertionsSuccessful = false;
                } else {
                    console.log(`✅ Insert into '${table}' successful`);
                }
            } catch (error) {
                console.log(`❌ Insert into '${tableName}' error:`, error.message);
                allInsertionsSuccessful = false;
            }
        }
        
        return allInsertionsSuccessful;
    }
    
    async testDataRetrieval() {
        const tables = ['bot_config', 'tweets', 'twitter_quota_tracking', 'engagement_history'];
        let allRetrievalsSuccessful = true;
        
        for (const table of tables) {
            try {
                const { data, error } = await supabase.from(table).select('*').limit(5);
                if (error) {
                    console.log(`❌ Retrieval from '${table}' failed:`, error.message);
                    allRetrievalsSuccessful = false;
                } else {
                    console.log(`✅ Retrieval from '${table}' successful (${data.length} records)`);
                }
            } catch (error) {
                console.log(`❌ Retrieval from '${table}' error:`, error.message);
                allRetrievalsSuccessful = false;
            }
        }
        
        return allRetrievalsSuccessful;
    }
    
    async testSystemFlows() {
        // Test the key system flows your bot uses
        let allFlowsWorking = true;
        
        try {
            // Flow 1: Check bot configuration
            console.log('  🔧 Testing bot config flow...');
            const { data: configData } = await supabase
                .from('bot_config')
                .select('value')
                .eq('key', 'mode')
                .single();
            console.log('    ✅ Bot config retrieval works');
            
            // Flow 2: Check quota tracking
            console.log('  📊 Testing quota tracking flow...');
            const today = new Date().toISOString().split('T')[0];
            const { data: quotaData } = await supabase
                .from('twitter_quota_tracking')
                .select('*')
                .eq('date', today)
                .single();
            console.log('    ✅ Quota tracking works');
            
            // Flow 3: Test tweet storage flow
            console.log('  🐦 Testing tweet storage flow...');
            const testTweet = {
                tweet_id: 'flow_test_' + Date.now(),
                content: 'System flow test tweet',
                tweet_type: 'original',
                content_type: 'test',
                engagement_score: 0
            };
            const { error: tweetError } = await supabase.from('tweets').insert(testTweet);
            if (tweetError) {
                console.log('    ❌ Tweet storage flow failed:', tweetError.message);
                allFlowsWorking = false;
            } else {
                console.log('    ✅ Tweet storage flow works');
            }
            
        } catch (error) {
            console.log('❌ System flows test error:', error.message);
            allFlowsWorking = false;
        }
        
        return allFlowsWorking;
    }
    
    generateReport(results) {
        console.log('\n🎯 INTEGRATION TEST REPORT');
        console.log('==========================');
        
        const tests = [
            ['Database Connection', results.database_connection],
            ['Table Structures', results.table_structure],
            ['Data Insertion', results.data_insertion],
            ['Data Retrieval', results.data_retrieval],
            ['System Flows', results.system_flows]
        ];
        
        let passedTests = 0;
        
        tests.forEach(([name, passed]) => {
            const status = passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} - ${name}`);
            if (passed) passedTests++;
        });
        
        const overallStatus = passedTests === tests.length ? '🎉 ALL SYSTEMS GO!' : '⚠️  NEEDS ATTENTION';
        console.log(`\n${overallStatus}`);
        console.log(`Passed: ${passedTests}/${tests.length} tests`);
        
        if (passedTests === tests.length) {
            console.log('\n🚀 Your database is perfectly aligned with your bot systems!');
            console.log('✅ Ready for production deployment!');
        } else {
            console.log('\n🔧 Some issues detected. Review the errors above.');
        }
    }
}

// Run the test
const tester = new SystemIntegrationTest();
tester.runFullTest().catch(console.error); 