#!/usr/bin/env node

// xBOT Health Check - Test Supabase connection and bot_config table
// Usage: node health_check_bot.js

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function runHealthCheck() {
    console.log('🏥 xBOT HEALTH CHECK');
    console.log('===================');
    
    try {
        // Step 1: Check environment variables
        console.log('📋 Checking environment variables...');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl) {
            throw new Error('SUPABASE_URL environment variable not set');
        }
        
        if (!supabaseKey) {
            throw new Error('Neither SUPABASE_ANON_KEY nor SUPABASE_SERVICE_ROLE_KEY environment variable is set');
        }
        
        const keyType = process.env.SUPABASE_ANON_KEY ? 'anon' : 'service_role';
        
        console.log('✅ Environment variables OK');
        console.log(`📍 Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
        console.log(`🔑 Using ${keyType} key`);
        
        // Step 2: Connect to Supabase
        console.log(`🔗 Connecting to Supabase with ${keyType} key...`);
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Step 3: Try to select 1 row from bot_config
        console.log('📊 Testing bot_config table access...');
        
        const { data, error } = await supabase
            .from('bot_config')
            .select('*')
            .limit(1);
        
        if (error) {
            throw new Error(`Supabase query failed: ${error.message}`);
        }
        
        if (!data) {
            throw new Error('No data returned from bot_config query');
        }
        
        console.log('✅ Supabase read OK');
        console.log(`📈 Found ${data.length} config record(s)`);
        
        if (data.length > 0) {
            console.log('📋 Sample config:');
            console.log(`   Key: ${data[0].key}`);
            console.log(`   Value: ${JSON.stringify(data[0].value)}`);
        }
        
        // Step 4: Test additional tables
        console.log('🔍 Testing other critical tables...');
        
        const tables = ['tweet_topics', 'tweet_images'];
        
        for (const table of tables) {
            try {
                const { data: tableData, error: tableError } = await supabase
                    .from(table)
                    .select('*')
                    .limit(1);
                
                if (tableError) {
                    console.log(`❌ ${table}: ${tableError.message}`);
                } else {
                    console.log(`✅ ${table}: ${tableData ? tableData.length : 0} records accessible`);
                }
            } catch (err) {
                console.log(`❌ ${table}: ${err.message}`);
            }
        }
        
        console.log('');
        console.log('🎉 HEALTH CHECK COMPLETE');
        console.log('✅ xBOT database connection is healthy!');
        
        return true;
        
    } catch (error) {
        console.log('');
        console.log('❌ HEALTH CHECK FAILED');
        console.log(`💥 Error: ${error.message}`);
        
        // Provide helpful debugging info
        console.log('');
        console.log('🔧 Debugging tips:');
        console.log('1. Check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
        console.log('2. Verify that the bot_config table exists in Supabase');
        console.log('3. Run SIMPLE_FIX.sql in Supabase SQL Editor if tables are missing');
        console.log('4. Check if Row Level Security is blocking access');
        
        return false;
    }
}

// Run the health check
if (require.main === module) {
    runHealthCheck()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { runHealthCheck }; 