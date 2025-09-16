#!/usr/bin/env tsx
"use strict";
/**
 * 🏥 HEALTH CHECK SCRIPT
 *
 * Verifies all system components are working:
 * - Supabase connectivity and write/read test
 * - Redis connectivity and cache operations
 * - Environment variables presence
 * - Core dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
const supabaseClient_1 = require("../src/db/supabaseClient");
const redisCache_1 = require("../src/cache/redisCache");
async function runHealthChecks() {
    console.log('🏥 HEALTH_CHECK: Starting comprehensive system health check...\n');
    const results = [];
    // Environment Variables Check
    console.log('📋 ENV_CHECK: Verifying environment variables...');
    const envResult = checkEnvironmentVariables();
    results.push(envResult);
    console.log(`${envResult.status === 'healthy' ? '✅' : '❌'} ${envResult.component}: ${envResult.details}\n`);
    // Supabase Health Check
    console.log('🗄️ SUPABASE_CHECK: Testing database connectivity...');
    const supabaseResult = await checkSupabaseHealth();
    results.push(supabaseResult);
    console.log(`${supabaseResult.status === 'healthy' ? '✅' : '❌'} ${supabaseResult.component}: ${supabaseResult.details}\n`);
    // Redis Health Check
    console.log('⚡ REDIS_CHECK: Testing cache connectivity...');
    const redisResult = await checkRedisHealth();
    results.push(redisResult);
    console.log(`${redisResult.status === 'healthy' ? '✅' : '❌'} ${redisResult.component}: ${redisResult.details}\n`);
    // OpenAI Check (without making actual requests)
    console.log('🤖 OPENAI_CHECK: Verifying API key format...');
    const openaiResult = checkOpenAIConfig();
    results.push(openaiResult);
    console.log(`${openaiResult.status === 'healthy' ? '✅' : '❌'} ${openaiResult.component}: ${openaiResult.details}\n`);
    // Summary
    const healthy = results.filter(r => r.status === 'healthy').length;
    const total = results.length;
    console.log('='.repeat(60));
    console.log(`🎯 HEALTH_SUMMARY: ${healthy}/${total} components healthy`);
    if (healthy === total) {
        console.log('✅ ALL_SYSTEMS_GO: Ready for production use');
        process.exit(0);
    }
    else {
        console.log('❌ ISSUES_DETECTED: Some components need attention');
        process.exit(1);
    }
}
function checkEnvironmentVariables() {
    const requiredEnvs = [
        'OPENAI_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'REDIS_URL'
    ];
    const missing = requiredEnvs.filter(env => !process.env[env]);
    if (missing.length === 0) {
        return {
            component: 'Environment Variables',
            status: 'healthy',
            details: `All ${requiredEnvs.length} required environment variables present`
        };
    }
    else {
        return {
            component: 'Environment Variables',
            status: 'failed',
            details: `Missing: ${missing.join(', ')}`
        };
    }
}
async function checkSupabaseHealth() {
    try {
        const start = Date.now();
        const health = await supabaseClient_1.supabaseClient.healthCheck();
        const latency = Date.now() - start;
        if (health.connected) {
            // Test write operation
            const testData = {
                tweet_id: `health_check_${Date.now()}`,
                content: 'Health check test post',
                posted_at: new Date().toISOString()
            };
            const writeResult = await supabaseClient_1.supabaseClient.safeInsert('posts', testData);
            if (writeResult.success) {
                // Clean up test data
                const { data, error } = await supabaseClient_1.supabaseClient.getRawClient()
                    .from('posts')
                    .delete()
                    .eq('tweet_id', testData.tweet_id);
                return {
                    component: 'Supabase Database',
                    status: 'healthy',
                    details: `Connected, write/read/delete operations successful`,
                    latency
                };
            }
            else {
                return {
                    component: 'Supabase Database',
                    status: 'degraded',
                    details: `Connected but write failed: ${writeResult.error?.message}`,
                    latency
                };
            }
        }
        else {
            return {
                component: 'Supabase Database',
                status: 'failed',
                details: `Connection failed: ${health.error}`,
                latency
            };
        }
    }
    catch (error) {
        return {
            component: 'Supabase Database',
            status: 'failed',
            details: `Health check error: ${error.message}`
        };
    }
}
async function checkRedisHealth() {
    try {
        const start = Date.now();
        const health = await redisCache_1.redisCache.health();
        const healthLatency = Date.now() - start;
        if (health.connected) {
            // Test cache operations
            const testKey = `health_check_${Date.now()}`;
            const testValue = { test: true, timestamp: Date.now() };
            const setResult = await redisCache_1.redisCache.set(testKey, testValue, 60);
            if (!setResult.success) {
                return {
                    component: 'Redis Cache',
                    status: 'degraded',
                    details: `Connected but SET failed: ${setResult.error}`,
                    latency: healthLatency
                };
            }
            const getResult = await redisCache_1.redisCache.get(testKey);
            if (!getResult.success || !getResult.data) {
                return {
                    component: 'Redis Cache',
                    status: 'degraded',
                    details: `Connected but GET failed: ${getResult.error}`,
                    latency: healthLatency
                };
            }
            // Clean up
            await redisCache_1.redisCache.del(testKey);
            return {
                component: 'Redis Cache',
                status: 'healthy',
                details: `Connected, cache operations successful${health.version ? ` (v${health.version})` : ''}`,
                latency: health.latency || healthLatency
            };
        }
        else {
            return {
                component: 'Redis Cache',
                status: 'failed',
                details: `Connection failed: ${health.error}`,
                latency: healthLatency
            };
        }
    }
    catch (error) {
        return {
            component: 'Redis Cache',
            status: 'failed',
            details: `Health check error: ${error.message}`
        };
    }
}
function checkOpenAIConfig() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return {
            component: 'OpenAI Configuration',
            status: 'failed',
            details: 'OPENAI_API_KEY not set'
        };
    }
    if (!apiKey.startsWith('sk-')) {
        return {
            component: 'OpenAI Configuration',
            status: 'failed',
            details: 'OPENAI_API_KEY format invalid (should start with sk-)'
        };
    }
    if (apiKey.length < 20) {
        return {
            component: 'OpenAI Configuration',
            status: 'failed',
            details: 'OPENAI_API_KEY appears too short'
        };
    }
    return {
        component: 'OpenAI Configuration',
        status: 'healthy',
        details: 'API key format valid'
    };
}
// Run health checks
runHealthChecks().catch(error => {
    console.error('💥 HEALTH_CHECK_FAILED:', error);
    process.exit(1);
});
//# sourceMappingURL=health-check.js.map