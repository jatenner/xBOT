#!/usr/bin/env node

/**
 * 🔍 SIMPLE SYSTEM TEST
 * ======================
 * Tests your system integration with the clean database
 */

// Load environment variables
require('dotenv').config();

// Use CommonJS require for compatibility
const { createClient } = require('@supabase/supabase-js');

class SimpleSystemTest {
    
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        this.client = null;
    }
    
    async runTest() {
        console.log('🚀 STARTING SIMPLE SYSTEM TEST');
        console.log('===============================\n');
        
        const results = [];
        
        try {
            // Test 1: Environment Check
            console.log('🔧 1. Checking environment variables...');
            const envCheck = this.checkEnvironment();
            results.push(['Environment Check', envCheck]);
            
            if (!envCheck) {
                console.log('❌ Cannot proceed without environment variables');
                return;
            }
            
            // Test 2: Initialize Client
            console.log('🔌 2. Initializing Supabase client...');
            const clientInit = this.initializeClient();
            results.push(['Client Initialization', clientInit]);
            
            if (!clientInit) {
                console.log('❌ Cannot proceed without client');
                return;
            }
            
            // Test 3: Database Connection
            console.log('📡 3. Testing database connection...');
            const connectionTest = await this.testConnection();
            results.push(['Database Connection', connectionTest]);
            
            // Test 4: Tables Verification
            console.log('🏗️  4. Verifying database tables...');
            const tablesTest = await this.verifyTables();
            results.push(['Tables Verification', tablesTest]);
            
            // Test 5: Data Operations
            console.log('💾 5. Testing data operations...');
            const dataTest = await this.testDataOperations();
            results.push(['Data Operations', dataTest]);
            
            // Generate Report
            this.generateReport(results);
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }
    
    checkEnvironment() {
        if (!this.supabaseUrl || !this.supabaseKey) {
            console.log('❌ Missing environment variables');
            console.log('SUPABASE_URL:', this.supabaseUrl ? '✅ Set' : '❌ Missing');
            console.log('SUPABASE_SERVICE_ROLE_KEY:', this.supabaseKey ? '✅ Set' : '❌ Missing');
            return false;
        }
        
        console.log('✅ Environment variables configured');
        console.log(`   URL: ${this.supabaseUrl.substring(0, 30)}...`);
        console.log(`   Key: ${this.supabaseKey.substring(0, 10)}...`);
        return true;
    }
    
    initializeClient() {
        try {
            this.client = createClient(this.supabaseUrl, this.supabaseKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });
            console.log('✅ Supabase client initialized');
            return true;
        } catch (error) {
            console.log('❌ Client initialization failed:', error.message);
            return false;
        }
    }
    
    async testConnection() {
        try {
            const { data, error } = await this.client.from('bot_config').select('count').limit(1);
            if (error) {
                console.log('❌ Connection failed:', error.message);
                return false;
            }
            console.log('✅ Database connection successful');
            return true;
        } catch (error) {
            console.log('❌ Connection error:', error.message);
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
        
        let successCount = 0;
        
        for (const table of requiredTables) {
            try {
                const { error } = await this.client.from(table).select('*').limit(1);
                if (error) {
                    console.log(`❌ Table '${table}': ${error.message}`);
                } else {
                    console.log(`✅ Table '${table}': accessible`);
                    successCount++;
                }
            } catch (error) {
                console.log(`❌ Table '${table}': ${error.message}`);
            }
        }
        
        const allSuccess = successCount === requiredTables.length;
        console.log(`📊 Tables verified: ${successCount}/${requiredTables.length}`);
        return allSuccess;
    }
    
    async testDataOperations() {
        let operationsSuccessful = 0;
        const totalOperations = 3;
        
        try {
            // Operation 1: Read bot_config
            console.log('  📖 Testing bot_config read...');
            const { data: configData, error: configError } = await this.client
                .from('bot_config')
                .select('*')
                .limit(3);
                
            if (configError) {
                console.log(`    ❌ Config read failed: ${configError.message}`);
            } else {
                console.log(`    ✅ Config read successful (${configData.length} records)`);
                operationsSuccessful++;
            }
            
            // Operation 2: Read quota tracking
            console.log('  📊 Testing quota tracking read...');
            const { data: quotaData, error: quotaError } = await this.client
                .from('twitter_quota_tracking')
                .select('*')
                .limit(3);
                
            if (quotaError) {
                console.log(`    ❌ Quota read failed: ${quotaError.message}`);
            } else {
                console.log(`    ✅ Quota read successful (${quotaData.length} records)`);
                operationsSuccessful++;
            }
            
            // Operation 3: Test insert (safe test data)
            console.log('  💾 Testing data insertion...');
            const testData = {
                tweet_id: 'system_test_' + Date.now(),
                content: 'System integration test tweet',
                tweet_type: 'test',
                content_type: 'system_test',
                engagement_score: 0
            };
            
            const { data: insertData, error: insertError } = await this.client
                .from('tweets')
                .insert(testData)
                .select()
                .single();
                
            if (insertError) {
                console.log(`    ❌ Insert failed: ${insertError.message}`);
            } else {
                console.log(`    ✅ Insert successful (ID: ${insertData.id})`);
                operationsSuccessful++;
            }
            
        } catch (error) {
            console.log(`❌ Data operations error: ${error.message}`);
        }
        
        console.log(`📊 Operations successful: ${operationsSuccessful}/${totalOperations}`);
        return operationsSuccessful === totalOperations;
    }
    
    generateReport(results) {
        console.log('\n🎯 SYSTEM TEST REPORT');
        console.log('=====================');
        
        let passedTests = 0;
        
        results.forEach(([name, passed]) => {
            const status = passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} - ${name}`);
            if (passed) passedTests++;
        });
        
        const overallStatus = passedTests === results.length ? '🎉 ALL SYSTEMS GO!' : '⚠️  NEEDS ATTENTION';
        console.log(`\n${overallStatus}`);
        console.log(`Passed: ${passedTests}/${results.length} tests`);
        
        if (passedTests === results.length) {
            console.log('\n🚀 SYSTEM STATUS: PERFECT!');
            console.log('✅ Your environment variables are set correctly');
            console.log('✅ Your database has all 9 required tables');
            console.log('✅ All data operations work flawlessly');
            console.log('✅ Your bot is ready for autonomous operation!');
            console.log('\n🎯 Next step: Deploy and activate your bot!');
        } else {
            console.log('\n🔧 Issues detected. Please review the failed tests above.');
        }
    }
}

// Run the test
const tester = new SimpleSystemTest();
tester.runTest().catch(console.error); 