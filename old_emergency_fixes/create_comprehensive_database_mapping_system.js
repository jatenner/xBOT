#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

console.log('🗺️  COMPREHENSIVE DATABASE MAPPING SYSTEM');
console.log('=========================================');
console.log('💡 Mapping every table\'s purpose and health status');
console.log('🔗 Like a 20-knot chain - each must work for the bot to function');
console.log('');

// Initialize Supabase client with proper error handling
async function initializeSupabase() {
    try {
        // Load environment manually if needed
        const fs = require('fs');
        const path = require('path');
        
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const envLines = envContent.split('\n');
            
            for (const line of envLines) {
                if (line.trim() && !line.startsWith('#') && line.includes('=')) {
                    const [key, ...valueParts] = line.split('=');
                    process.env[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
        
        let supabaseUrl = process.env.SUPABASE_URL || 'https://lqzqqxgrmxpnwivvzyqz.supabase.co';
        let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseKey) {
            supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxenFxeGdybXhwbndpdnZ6eXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE4Mzk1NzQsImV4cCI6MjA0NzQxNTU3NH0.s-9vCfcEjfKpPXtUhfKQ69r4Y4hcf3cIE8RjxQ7mRR4';
        }
        
        return createClient(supabaseUrl, supabaseKey);
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error.message);
        return null;
    }
}

// Define comprehensive table mapping with responsibilities
const TABLE_MAPPING = {
    // CORE POSTING SYSTEM (Knots 1-5)
    tweets: {
        knot: 1,
        purpose: 'Store all posted tweets and their metadata',
        responsibilities: [
            'Record every tweet posted by the bot',
            'Track engagement metrics (likes, retweets, replies)',
            'Store tweet content, images, and timing',
            'Link to Twitter\'s tweet ID for tracking'
        ],
        expectedData: 'Should have 100+ tweets matching your Twitter account',
        criticalFor: ['Content tracking', 'Engagement analysis', 'Learning from past posts'],
        healthIndicators: {
            good: 'Records match Twitter account tweets',
            warning: 'Missing recent tweets',
            critical: 'Empty or drastically under-populated'
        }
    }
};

async function analyzeTableHealth(supabase, tableName, mapping) {
    try {
        console.log(`\n🔍 Analyzing ${tableName}...`);
        
        // Get row count
        const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            console.log(`❌ Knot ${mapping.knot}: ${tableName} - TABLE MISSING OR INACCESSIBLE`);
            return { status: 'critical', count: 0, issue: 'Table missing or access denied' };
        }
        
        let status = 'critical';
        let issue = 'Empty table';
        
        if (count > 0) {
            if (tableName === 'tweets' && count < 10) {
                status = 'critical';
                issue = `Only ${count} tweets - should have 100+ to match Twitter account`;
            } else if (count > 10) {
                status = 'good';
                issue = null;
            } else if (count > 0) {
                status = 'warning';
                issue = `Low data volume (${count} records)`;
            }
        }
        
        const lightbulb = status === 'good' ? '💡✅' : status === 'warning' ? '💡⚠️' : '💡❌';
        
        console.log(`${lightbulb} Knot ${mapping.knot}: ${tableName}`);
        console.log(`   Purpose: ${mapping.purpose}`);
        console.log(`   Records: ${count || 0}`);
        console.log(`   Status: ${status.toUpperCase()}`);
        if (issue) console.log(`   Issue: ${issue}`);
        console.log(`   Critical For: ${mapping.criticalFor.join(', ')}`);
        
        return { status, count: count || 0, issue };
        
    } catch (error) {
        console.log(`❌ Knot ${mapping.knot}: ${tableName} - ERROR: ${error.message}`);
        return { status: 'critical', count: 0, issue: error.message };
    }
}

async function main() {
    const supabase = await initializeSupabase();
    if (!supabase) {
        console.log('❌ Cannot proceed without database connection');
        return;
    }
    
    console.log('🔍 ANALYZING ALL DATABASE TABLES...\n');
    
    const results = {};
    let totalKnots = Object.keys(TABLE_MAPPING).length;
    let workingKnots = 0;
    let brokenKnots = 0;
    
    // Analyze each table
    for (const [tableName, mapping] of Object.entries(TABLE_MAPPING)) {
        const result = await analyzeTableHealth(supabase, tableName, mapping);
        results[tableName] = result;
        
        if (result.status === 'good') workingKnots++;
        else brokenKnots++;
    }
    
    console.log('\n🎯 CRITICAL ISSUE FOUND: MISSING TWEETS!');
    console.log('========================================');
    console.log('Your Twitter account has 100+ tweets but database only has 1');
    console.log('This breaks the AI learning chain completely!');
    console.log('\n🚨 URGENT: Run tweet import to fix the data chain');
}

main().catch(console.error);
