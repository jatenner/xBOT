#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE SYSTEM TEST
 * Tests all components of the Twitter bot system
 */

import fs from 'fs';

async function testBudgetSystem() {
    console.log('💰 === TESTING BUDGET SYSTEM ===');
    
    try {
        const { EmergencyBudgetLockdown } = await import('./dist/src/utils/emergencyBudgetLockdown.js');
        const lockdown = new EmergencyBudgetLockdown();
        
        const status = lockdown.getBudgetStatus();
        console.log(`   Daily Limit: $${status.dailyLimit}`);
        console.log(`   Current Spending: $${status.currentSpending}`);
        console.log(`   Remaining: $${status.remaining}`);
        console.log(`   Status: ${status.isLockedDown ? '🔒 LOCKED' : '✅ OK'}`);
        
        if (status.remaining < 1.0) {
            console.log('   ⚠️ WARNING: Low budget remaining');
        }
        
        return { success: true, status: 'Budget system operational' };
        
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testSessionSystem() {
    console.log('\n🔑 === TESTING SESSION SYSTEM ===');
    
    try {
        const { TwitterSessionValidator } = await import('./dist/src/utils/twitterSessionValidator.js');
        const validator = new TwitterSessionValidator();
        
        const healthReport = validator.getSessionHealthReport();
        console.log(`   Status: ${healthReport.status}`);
        console.log(`   Health: ${healthReport.health}%`);
        console.log(`   Message: ${healthReport.message}`);
        
        if (healthReport.health < 50) {
            console.log('   ⚠️ WARNING: Session needs attention');
            return { success: false, error: 'Session unhealthy' };
        }
        
        return { success: true, status: 'Session system operational' };
        
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testContentGeneration() {
    console.log('\n🧠 === TESTING CONTENT GENERATION ===');
    
    try {
        // Test if OpenAI services are accessible
        const { BudgetAwareOpenAI } = await import('./dist/src/utils/budgetAwareOpenAI.js');
        const openai = new BudgetAwareOpenAI();
        
        console.log('   ✅ OpenAI service loaded');
        console.log('   ✅ Budget wrapper active');
        
        return { success: true, status: 'Content generation ready' };
        
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testPostingPipeline() {
    console.log('\n🚀 === TESTING POSTING PIPELINE ===');
    
    try {
        const { SinglePostingManager } = await import('./dist/src/core/singlePostingManager.js');
        console.log('   ✅ SinglePostingManager loaded');
        
        const { EnhancedEmergencyPoster } = await import('./dist/src/utils/enhancedEmergencyPoster.js');
        console.log('   ✅ Enhanced Emergency Poster loaded');
        
        const { EmergencyBrowserPoster } = await import('./dist/src/utils/emergencyBrowserPoster.js');
        console.log('   ✅ Emergency Browser Poster loaded');
        
        return { success: true, status: 'Posting pipeline ready' };
        
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testDatabaseConnection() {
    console.log('\n🗄️ === TESTING DATABASE CONNECTION ===');
    
    try {
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase environment variables');
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        console.log('   ✅ Supabase client created');
        
        // Test connection with a simple query
        const { data, error } = await supabase
            .from('tweets')
            .select('id')
            .limit(1);
            
        if (error) {
            throw error;
        }
        
        console.log('   ✅ Database connection successful');
        return { success: true, status: 'Database operational' };
        
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testEnvironmentVariables() {
    console.log('\n🔧 === TESTING ENVIRONMENT VARIABLES ===');
    
    const requiredVars = [
        'OPENAI_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'TWITTER_USERNAME',
        'TWITTER_PASSWORD'
    ];
    
    const optionalVars = [
        'TWITTER_SESSION_DATA',
        'RAILWAY_ENVIRONMENT_NAME',
        'DAILY_BUDGET_LIMIT'
    ];
    
    let missingRequired = [];
    let missingOptional = [];
    
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            missingRequired.push(varName);
            console.log(`   ❌ MISSING: ${varName}`);
        } else {
            console.log(`   ✅ OK: ${varName}`);
        }
    }
    
    for (const varName of optionalVars) {
        if (!process.env[varName]) {
            missingOptional.push(varName);
            console.log(`   ⚠️ OPTIONAL: ${varName}`);
        } else {
            console.log(`   ✅ OK: ${varName}`);
        }
    }
    
    if (missingRequired.length > 0) {
        return { 
            success: false, 
            error: `Missing required variables: ${missingRequired.join(', ')}` 
        };
    }
    
    return { success: true, status: 'Environment variables OK' };
}

async function generateSystemReport() {
    console.log('\n📊 === SYSTEM PERFORMANCE REPORT ===');
    
    // Memory usage
    const memUsage = process.memoryUsage();
    console.log('💾 Memory Usage:');
    console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
    console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`   External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
    
    // Node.js info
    console.log('\n🔧 Runtime Info:');
    console.log(`   Node.js: ${process.version}`);
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Architecture: ${process.arch}`);
    
    // Environment
    console.log('\n🌍 Environment:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   Railway: ${process.env.RAILWAY_ENVIRONMENT_NAME ? 'Yes' : 'No'}`);
    
    // Disk space check
    console.log('\n💾 File System:');
    try {
        const stats = fs.statSync('./');
        console.log(`   Working Directory: ${process.cwd()}`);
        console.log(`   Directory accessible: ✅`);
    } catch (error) {
        console.log(`   Directory accessible: ❌ ${error.message}`);
    }
}

async function main() {
    console.log('🔍 === COMPREHENSIVE SYSTEM TEST ===');
    console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
    
    const tests = [
        { name: 'Environment Variables', test: testEnvironmentVariables },
        { name: 'Budget System', test: testBudgetSystem },
        { name: 'Session System', test: testSessionSystem },
        { name: 'Database Connection', test: testDatabaseConnection },
        { name: 'Content Generation', test: testContentGeneration },
        { name: 'Posting Pipeline', test: testPostingPipeline }
    ];
    
    const results = [];
    
    for (const { name, test } of tests) {
        try {
            const result = await test();
            results.push({ name, ...result });
        } catch (error) {
            results.push({ name, success: false, error: error.message });
        }
    }
    
    // Generate performance report
    await generateSystemReport();
    
    // Summary
    console.log('\n🏁 === TEST SUMMARY ===');
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`📊 Results: ${passed}/${total} tests passed\n`);
    
    results.forEach(result => {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status} ${result.name}`);
        if (!result.success) {
            console.log(`       Error: ${result.error}`);
        }
    });
    
    console.log('\n🎯 RECOMMENDATIONS:');
    
    if (passed === total) {
        console.log('   🎉 All systems operational!');
        console.log('   💡 Bot should be ready for autonomous operation');
        console.log('   📋 Next: Monitor Railway logs for posting activity');
    } else {
        console.log('   ⚠️ System issues detected:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`     • Fix ${result.name}: ${result.error}`);
        });
        console.log('\n   📋 Priority fixes:');
        console.log('     1. Refresh Twitter session (if session test failed)');
        console.log('     2. Check environment variables (if env test failed)');
        console.log('     3. Verify database schema (if database test failed)');
    }
    
    console.log('\n🔧 HELPFUL COMMANDS:');
    console.log('   Session check: node session_health_check.js');
    console.log('   Refresh session: node refresh_twitter_session.js');
    console.log('   Test posting: node trigger_immediate_post.js');
    console.log('   View logs: npm run logs');
    
    console.log(`\n⏰ Completed at: ${new Date().toISOString()}`);
    
    // Exit with appropriate code
    process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
    console.error('❌ System test failed:', error);
    process.exit(1);
});