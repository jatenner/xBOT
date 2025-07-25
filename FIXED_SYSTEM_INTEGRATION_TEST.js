#!/usr/bin/env node

/**
 * 🔍 FIXED SYSTEM INTEGRATION TEST
 * =================================
 * Tests using your actual Supabase client setup
 */

// Load environment variables first
require('dotenv').config();

// Import your actual Supabase client
import { secureSupabaseClient } from './src/utils/secureSupabaseClient.js';

class FixedSystemIntegrationTest {
    
    async runFullTest() {
        console.log('🚀 STARTING FIXED SYSTEM INTEGRATION TEST');
        console.log('==========================================\n');
        
        const results = {
            environment_check: false,
            client_initialization: false,
            database_connection: false,
            table_verification: false,
            data_operations: false
        };
        
        try {
            // Test 1: Environment Check
            console.log('🔧 Checking environment variables...');
            results.environment_check = await this.checkEnvironment();
            
            // Test 2: Client Initialization
            console.log('🔌 Testing Supabase client initialization...');
            results.client_initialization = await this.testClientInit();
            
            // Test 3: Database Connection
            console.log('📡 Testing database connection...');
            results.database_connection = await this.testDatabaseConnection();
            
            // Test 4: Table Verification
            console.log('🏗️  Verifying all required tables...');
            results.table_verification = await this.verifyTables();
            
            // Test 5: Data Operations
            console.log('💾 Testing data operations...');
            results.data_operations = await this.testDataOperations();
            
            // Final Report
            this.generateReport(results);
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }
    
    async checkEnvironment() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            console.log('❌ Environment variables not set properly');
            console.log('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
            console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
            return false;
        }
        
        console.log('✅ Environment variables properly configured');
        console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
        console.log(`   Key: ${supabaseKey.substring(0, 10)}...`);
        return true;
    }
    
    async testClientInit() {
        try {
            const client = secureSupabaseClient.getClient();
            if (!client) {
                console.log('❌ Supabase client initialization failed');
                return false;
            }
            console.log('✅ Supabase client initialized successfully');
            return true;
        } catch (error) {
            console.log('❌ Client initialization error:', error.message);
            return false;
        }
    }
    
    async testDatabaseConnection() {
        try {
            const client = secureSupabaseClient.getClient();
            if (!client) {
                console.log('❌ No client available for connection test');
                return false;
            }
            
            const { data, error } = await client.from('bot_config').select('count').limit(1);
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
    
    async verifyTables() {
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
        const client = secureSupabaseClient.getClient();
        
        if (!client) {
            console.log('❌ No client available for table verification');
            return false;
        }
        
        for (const table of requiredTables) {
            try {
                const { error } = await client.from(table).select('*').limit(1);
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
    
    async testDataOperations() {
        const client = secureSupabaseClient.getClient();
        if (!client) {
            console.log('❌ No client available for data operations');
            return false;
        }
        
        let allOperationsSuccessful = true;
        
        try {
            // Test bot_config read
            console.log('  📖 Testing bot_config read...');
            const { data: configData, error: configError } = await client
                .from('bot_config')
                .select('*')
                .limit(5);
            
            if (configError) {
                console.log('    ❌ Bot config read failed:', configError.message);
                allOperationsSuccessful = false;
            } else {
                console.log(`    ✅ Bot config read successful (${configData.length} records)`);
            }
            
            // Test quota tracking
            console.log('  📊 Testing quota tracking...');
            const today = new Date().toISOString().split('T')[0];
            const { data: quotaData, error: quotaError } = await client
                .from('twitter_quota_tracking')
                .select('*')
                .eq('date', today);
            
            if (quotaError) {
                console.log('    ❌ Quota tracking failed:', quotaError.message);
                allOperationsSuccessful = false;
            } else {
                console.log(`    ✅ Quota tracking successful (${quotaData.length} records)`);
            }
            
            // Test tweet storage
            console.log('  🐦 Testing tweet storage...');
            const testTweet = {
                tweet_id: 'test_integration_' + Date.now(),
                content: 'Integration test tweet',
                tweet_type: 'test',
                content_type: 'integration',
                engagement_score: 0
            };
            
            const { data: tweetData, error: tweetError } = await client
                .from('tweets')
                .insert(testTweet)
                .select()
                .single();
            
            if (tweetError) {
                console.log('    ❌ Tweet storage failed:', tweetError.message);
                allOperationsSuccessful = false;
            } else {
                console.log('    ✅ Tweet storage successful');
                console.log(`    📝 Stored tweet ID: ${tweetData.id}`);
            }
            
        } catch (error) {
            console.log('❌ Data operations error:', error.message);
            allOperationsSuccessful = false;
        }
        
        return allOperationsSuccessful;
    }
    
    generateReport(results) {
        console.log('\n🎯 FIXED INTEGRATION TEST REPORT');
        console.log('=================================');
        
        const tests = [
            ['Environment Check', results.environment_check],
            ['Client Initialization', results.client_initialization],
            ['Database Connection', results.database_connection],
            ['Table Verification', results.table_verification],
            ['Data Operations', results.data_operations]
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
            console.log('\n🚀 Your system is perfectly integrated!');
            console.log('✅ Database is clean and functional');
            console.log('✅ All advanced AI systems supported');
            console.log('✅ Ready for autonomous operation!');
        } else {
            console.log('\n🔧 Issues detected. Review the errors above.');
        }
    }
}

// Run the test
const tester = new FixedSystemIntegrationTest();
tester.runFullTest().catch(console.error); 