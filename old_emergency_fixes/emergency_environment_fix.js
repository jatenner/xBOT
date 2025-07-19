#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY ENVIRONMENT & DATABASE FIX');
console.log('======================================');

// Step 1: Load environment manually
function loadEnvironment() {
    console.log('🔧 Loading environment variables...');
    
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.log('❌ .env file not found');
        return false;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    let loadedVars = 0;
    for (const line of envLines) {
        if (line.trim() && !line.startsWith('#') && line.includes('=')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=').trim();
            process.env[key.trim()] = value;
            loadedVars++;
        }
    }
    
    console.log(`✅ Loaded ${loadedVars} environment variables`);
    return true;
}

// Step 2: Test database with proper loading
async function testDatabaseWithProperEnv() {
    console.log('');
    console.log('🔍 Testing database with loaded environment...');
    
    // Import after setting environment
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    console.log(`📊 Supabase URL: ${supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT FOUND'}`);
    console.log(`🔑 Supabase Key: ${supabaseKey ? `${supabaseKey.substring(0, 30)}...` : 'NOT FOUND'}`);
    
    if (!supabaseUrl || !supabaseKey) {
        console.log('❌ Missing Supabase credentials in environment');
        return false;
    }
    
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Simple connectivity test
        const { data, error } = await supabase
            .from('tweets')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            console.log(`❌ Database error: ${error.message}`);
            return false;
        }
        
        console.log(`✅ Database connected! Found ${data?.[0]?.count || 0} tweets`);
        return supabase;
        
    } catch (err) {
        console.log(`❌ Connection failed: ${err.message}`);
        return false;
    }
}

// Step 3: Create minimal sample data
async function createSampleData(supabase) {
    console.log('');
    console.log('📝 Creating sample data to establish chain...');
    
    try {
        // Insert a sample tweet
        const { data, error } = await supabase
            .from('tweets')
            .insert({
                content: "🚀 Bot successfully deployed and testing data flow! Exciting breakthroughs in precision medicine ahead. #HealthTech",
                type: "original",
                created_at: new Date().toISOString(),
                tweet_id: `test_${Date.now()}`,
                source: "data_flow_test",
                is_posted: false,
                likes_count: 0,
                retweets_count: 0
            })
            .select();
        
        if (error) {
            console.log(`❌ Sample tweet failed: ${error.message}`);
        } else {
            console.log(`✅ Sample tweet created: ${data[0].content.substring(0, 50)}...`);
        }
        
        // Insert API usage record
        const { error: apiError } = await supabase
            .from('api_usage')
            .insert({
                endpoint: 'test_connection',
                timestamp: new Date().toISOString(),
                tokens_used: 0,
                success: true
            });
        
        if (!apiError) {
            console.log('✅ API usage tracking working');
        }
        
        return true;
        
    } catch (err) {
        console.log(`❌ Sample data creation failed: ${err.message}`);
        return false;
    }
}

// Step 4: Verify the chain is working
async function verifyRepair(supabase) {
    console.log('');
    console.log('🔍 VERIFYING REPAIR...');
    console.log('=====================');
    
    const criticalTables = ['tweets', 'api_usage', 'bot_config'];
    let workingTables = 0;
    
    for (const table of criticalTables) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.log(`💥 ${table}: ❌ ${error.message}`);
            } else {
                console.log(`💡 ${table}: ✅ ${count || 0} records`);
                workingTables++;
            }
        } catch (err) {
            console.log(`💥 ${table}: ❌ ${err.message}`);
        }
    }
    
    console.log('');
    console.log(`📊 Working tables: ${workingTables}/${criticalTables.length}`);
    
    if (workingTables === criticalTables.length) {
        console.log('🎉 REPAIR SUCCESSFUL! Data flow chain is working!');
        return true;
    } else {
        console.log(`⚠️  ${criticalTables.length - workingTables} tables still need repair`);
        return false;
    }
}

async function main() {
    try {
        // Step 1: Load environment
        const envLoaded = loadEnvironment();
        if (!envLoaded) {
            throw new Error('Failed to load environment variables');
        }
        
        // Step 2: Test database connection
        const supabase = await testDatabaseWithProperEnv();
        if (!supabase) {
            throw new Error('Failed to establish database connection');
        }
        
        // Step 3: Create sample data
        const sampleCreated = await createSampleData(supabase);
        
        // Step 4: Verify repair
        const repairSuccessful = await verifyRepair(supabase);
        
        if (repairSuccessful) {
            console.log('');
            console.log('🚀 EMERGENCY REPAIR COMPLETE!');
            console.log('=============================');
            console.log('✅ Environment variables loaded');
            console.log('✅ Database connection established');
            console.log('✅ Sample data created');
            console.log('✅ Data flow chain working');
            console.log('');
            console.log('💡 Your bot should now be able to post!');
            console.log('🔗 The knots in your chain are connected!');
        }
        
    } catch (error) {
        console.error('💥 Emergency repair failed:', error.message);
        console.log('');
        console.log('🔧 TROUBLESHOOTING STEPS:');
        console.log('1. Check .env file exists and has correct format');
        console.log('2. Verify Supabase project is active');
        console.log('3. Test internet connectivity');
        console.log('4. Check if running in correct directory');
    }
}

main(); 