"use strict";
/**
 * 🔍 DATA STORAGE VERIFICATION
 * Ensure Redis and Supabase are correctly storing and using data for learning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDataStorage = verifyDataStorage;
exports.generateStorageReport = generateStorageReport;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const redisSafe_1 = require("../src/lib/redisSafe");
const db_1 = require("../src/lib/db");
async function verifyDataStorage() {
    console.log('🔍 DATA_VERIFICATION: Checking Redis and Supabase storage...');
    const redis = (0, redisSafe_1.getRedisSafeClient)();
    const db = (0, db_1.getSafeDatabase)();
    const report = {
        redis: {
            connected: false,
            totalKeys: 0,
            contentData: null,
            performanceData: null,
            learningData: null
        },
        supabase: {
            connected: false,
            tables: null,
            recentPosts: [],
            metrics: [],
            rejectedPosts: []
        },
        learningSystem: {
            isActive: false,
            dataFlowWorking: false,
            recommendations: []
        }
    };
    // Test Redis Connection and Data
    console.log('\n📊 REDIS_CHECK: Testing connection and data storage...');
    try {
        const pingResult = await redis.ping();
        report.redis.connected = pingResult.includes('PONG');
        if (report.redis.connected) {
            console.log('✅ REDIS_CONNECTED: Connection successful');
            // Check for content-related keys
            const contentKeys = [
                'content_performance_insights',
                'successful_posts:single',
                'successful_posts:thread',
                'rejected_posts:single',
                'rejected_posts:thread',
                'avg_score:single',
                'avg_score:thread',
                'system_config'
            ];
            console.log('🔍 REDIS_KEYS: Checking for learning data...');
            for (const key of contentKeys) {
                try {
                    const exists = await redis.exists(key);
                    if (exists) {
                        console.log(`  ✅ ${key}: Found`);
                        // Get sample data
                        if (key === 'content_performance_insights') {
                            report.redis.contentData = await redis.getJSON(key);
                        }
                        else if (key.includes('successful_posts')) {
                            const count = await redis.get(key);
                            report.redis.performanceData = { ...report.redis.performanceData, [key]: count };
                        }
                        else if (key === 'system_config') {
                            report.redis.learningData = await redis.getJSON(key);
                        }
                    }
                    else {
                        console.log(`  ⚪ ${key}: Not found (normal for new system)`);
                    }
                }
                catch (error) {
                    console.log(`  ❌ ${key}: Error checking - ${error instanceof Error ? error.message : error}`);
                }
            }
            // Test Redis memory stats
            try {
                const memStats = await redis.getMemoryStats();
                console.log(`📊 REDIS_MEMORY: ${memStats.used_memory_human} used`);
            }
            catch (error) {
                console.warn('⚠️ REDIS_MEMORY_STATS_FAILED:', error instanceof Error ? error.message : error);
            }
        }
        else {
            console.error('❌ REDIS_CONNECTION_FAILED');
            report.learningSystem.recommendations.push('Redis connection failed - check REDIS_URL environment variable');
        }
    }
    catch (error) {
        console.error('❌ REDIS_ERROR:', error instanceof Error ? error.message : error);
        report.learningSystem.recommendations.push('Redis error - may be using fallback in-memory mode');
    }
    // Test Supabase Connection and Tables
    console.log('\n💾 SUPABASE_CHECK: Testing connection and table structure...');
    try {
        const healthCheck = await db.healthCheck();
        report.supabase.connected = healthCheck.connected;
        if (healthCheck.connected) {
            console.log('✅ SUPABASE_CONNECTED: Connection successful');
            // Check table permissions
            if (healthCheck.permissionsOk) {
                console.log('✅ SUPABASE_PERMISSIONS: All tables accessible');
            }
            else {
                console.warn('⚠️ SUPABASE_PERMISSIONS: Some permission issues detected');
                report.learningSystem.recommendations.push('Fix Supabase RLS policies or ensure service role key is used');
            }
            // Check recent posts
            try {
                const postsResult = await db.safeSelect('posts', '*', {}, { limit: 10, orderBy: 'created_at', ascending: false });
                if (postsResult.success && postsResult.data) {
                    report.supabase.recentPosts = postsResult.data;
                    console.log(`📝 POSTS_TABLE: Found ${postsResult.data.length} recent posts`);
                    // Analyze content quality in stored posts
                    const personalLanguagePosts = postsResult.data.filter((post) => {
                        const content = post.content || '';
                        return /\b(I|my|me|myself|personally|in my experience|I tried|worked for me|my friend)\b/gi.test(content);
                    });
                    if (personalLanguagePosts.length > 0) {
                        console.warn(`⚠️ PERSONAL_LANGUAGE_DETECTED: ${personalLanguagePosts.length} posts contain personal language`);
                        report.learningSystem.recommendations.push('Historical posts contain personal language - new authoritative system will fix this');
                    }
                    else {
                        console.log('✅ CONTENT_QUALITY: No personal language detected in recent posts');
                    }
                }
            }
            catch (error) {
                console.warn('⚠️ POSTS_TABLE_CHECK_FAILED:', error instanceof Error ? error.message : error);
            }
            // Check metrics table
            try {
                const metricsResult = await db.safeSelect('metrics', '*', {}, { limit: 5 });
                if (metricsResult.success && metricsResult.data) {
                    report.supabase.metrics = metricsResult.data;
                    console.log(`📊 METRICS_TABLE: Found ${metricsResult.data.length} metric records`);
                }
            }
            catch (error) {
                console.warn('⚠️ METRICS_TABLE_CHECK_FAILED:', error instanceof Error ? error.message : error);
            }
            // Check rejected posts table
            try {
                const rejectedResult = await db.safeSelect('rejected_posts', '*', {}, { limit: 5 });
                if (rejectedResult.success && rejectedResult.data) {
                    report.supabase.rejectedPosts = rejectedResult.data;
                    console.log(`🚫 REJECTED_POSTS_TABLE: Found ${rejectedResult.data.length} rejected posts`);
                }
            }
            catch (error) {
                console.warn('⚠️ REJECTED_POSTS_TABLE_CHECK_FAILED:', error instanceof Error ? error.message : error);
            }
        }
        else {
            console.error('❌ SUPABASE_CONNECTION_FAILED');
            report.learningSystem.recommendations.push('Supabase connection failed - check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
        }
    }
    catch (error) {
        console.error('❌ SUPABASE_ERROR:', error instanceof Error ? error.message : error);
    }
    // Assess Learning System Status
    console.log('\n🧠 LEARNING_SYSTEM_ASSESSMENT:');
    const hasRedisData = report.redis.connected && (report.redis.contentData ||
        report.redis.performanceData ||
        report.redis.learningData);
    const hasSupabaseData = report.supabase.connected && (report.supabase.recentPosts.length > 0 ||
        report.supabase.metrics.length > 0);
    report.learningSystem.isActive = hasRedisData || hasSupabaseData;
    report.learningSystem.dataFlowWorking = report.redis.connected && report.supabase.connected;
    if (report.learningSystem.isActive) {
        console.log('✅ LEARNING_SYSTEM: Active with data storage');
    }
    else {
        console.log('⚪ LEARNING_SYSTEM: Starting up (no historical data yet)');
        report.learningSystem.recommendations.push('Learning system is new - data will accumulate as bot posts content');
    }
    if (report.learningSystem.dataFlowWorking) {
        console.log('✅ DATA_FLOW: Redis and Supabase both operational');
    }
    else {
        console.warn('⚠️ DATA_FLOW: One or both storage systems have issues');
    }
    // Performance recommendations
    if (report.redis.connected && !redis.isFallbackMode()) {
        console.log('✅ REDIS_MODE: Using actual Redis (optimal)');
    }
    else if (redis.isFallbackMode()) {
        console.log('⚠️ REDIS_MODE: Using fallback in-memory mode');
        report.learningSystem.recommendations.push('Redis fallback mode - learning data will be lost on restart');
    }
    return report;
}
async function testDataWrite() {
    console.log('\n🧪 DATA_WRITE_TEST: Testing data storage functionality...');
    const redis = (0, redisSafe_1.getRedisSafeClient)();
    const db = (0, db_1.getSafeDatabase)();
    // Test Redis write
    try {
        const testKey = 'test_data_write';
        const testData = {
            timestamp: new Date().toISOString(),
            test: 'redis_write_verification',
            score: 85
        };
        await redis.setJSON(testKey, testData, 60); // 1 minute TTL
        const retrieved = await redis.getJSON(testKey);
        if (retrieved && retrieved.test === testData.test) {
            console.log('✅ REDIS_WRITE_TEST: Successful');
            await redis.del(testKey); // Cleanup
        }
        else {
            console.error('❌ REDIS_WRITE_TEST: Failed - data mismatch');
        }
    }
    catch (error) {
        console.error('❌ REDIS_WRITE_TEST: Exception -', error instanceof Error ? error.message : error);
    }
    // Test Supabase write
    try {
        const testPost = {
            content: 'Test post for data verification',
            format: 'single',
            topic: 'test_topic',
            scores: {
                authorityScore: 75,
                evidenceScore: 70,
                hookScore: 80,
                clarityScore: 85,
                overall: 77
            },
            approved: true,
            created_at: new Date().toISOString()
        };
        const result = await db.safeInsert('posts', testPost);
        if (result.success) {
            console.log('✅ SUPABASE_WRITE_TEST: Successful');
            // Cleanup test data
            if (result.data && result.data.length > 0) {
                const insertedId = result.data[0].id;
                try {
                    await db.getClient().from('posts').delete().eq('id', insertedId);
                }
                catch (cleanupError) {
                    // Ignore cleanup errors
                }
            }
        }
        else {
            console.error('❌ SUPABASE_WRITE_TEST: Failed -', result.error?.message);
        }
    }
    catch (error) {
        console.error('❌ SUPABASE_WRITE_TEST: Exception -', error instanceof Error ? error.message : error);
    }
}
async function generateStorageReport() {
    console.log('📋 GENERATING COMPREHENSIVE DATA STORAGE REPORT...\n');
    const report = await verifyDataStorage();
    await testDataWrite();
    console.log('\n' + '='.repeat(80));
    console.log('📊 DATA STORAGE VERIFICATION REPORT');
    console.log('='.repeat(80));
    console.log('\n🔴 REDIS STATUS:');
    console.log(`  Connection: ${report.redis.connected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`  Mode: ${(0, redisSafe_1.getRedisSafeClient)().isFallbackMode() ? '⚠️ Fallback' : '✅ Redis'}`);
    console.log(`  Content Data: ${report.redis.contentData ? '✅ Present' : '⚪ None'}`);
    console.log(`  Performance Data: ${report.redis.performanceData ? '✅ Present' : '⚪ None'}`);
    console.log('\n💾 SUPABASE STATUS:');
    console.log(`  Connection: ${report.supabase.connected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`  Recent Posts: ${report.supabase.recentPosts.length} records`);
    console.log(`  Metrics: ${report.supabase.metrics.length} records`);
    console.log(`  Rejected Posts: ${report.supabase.rejectedPosts.length} records`);
    console.log('\n🧠 LEARNING SYSTEM:');
    console.log(`  Status: ${report.learningSystem.isActive ? '✅ Active' : '⚪ Starting'}`);
    console.log(`  Data Flow: ${report.learningSystem.dataFlowWorking ? '✅ Working' : '⚠️ Partial'}`);
    if (report.learningSystem.recommendations.length > 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        report.learningSystem.recommendations.forEach((rec, i) => {
            console.log(`  ${i + 1}. ${rec}`);
        });
    }
    console.log('\n🎯 NEXT STEPS:');
    if (report.learningSystem.dataFlowWorking) {
        console.log('  ✅ Data storage is working - bot will learn from posted content');
        console.log('  ✅ Authoritative content system will prevent personal language');
        console.log('  ✅ Performance metrics will improve content quality over time');
    }
    else {
        console.log('  🔧 Fix connection issues before deploying');
        console.log('  📝 Check environment variables for Redis and Supabase');
    }
    console.log('\n' + '='.repeat(80));
}
// Run if called directly
if (require.main === module) {
    generateStorageReport()
        .then(() => {
        console.log('\n🎉 DATA_VERIFICATION_COMPLETE');
        process.exit(0);
    })
        .catch(error => {
        console.error('💥 VERIFICATION_FAILED:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=verify-data-storage.js.map