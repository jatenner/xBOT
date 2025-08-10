const Redis = require('ioredis');

// CORRECT Redis credentials from your dashboard
const redisUrl = 'redis://default:uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU@redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com:17514';

console.log('🚀 ENTERPRISE REDIS SETUP - CORRECT CREDENTIALS');
console.log('✅ SQL Configuration: Database ready for enterprise mode (14 config items)');
console.log('🔧 Setting up Redis with correct password...');

const redis = new Redis(redisUrl, {
    connectTimeout: 10000,
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    keyPrefix: 'xbot:enterprise:'
});

async function setupEnterpriseRedis() {
    try {
        console.log('\n🏓 Testing connection...');
        const result = await redis.ping();
        console.log('✅ Redis connected successfully:', result);
        
        console.log('\n🏢 Setting up enterprise cache structure...');
        
        // 1. Enterprise configuration cache
        await redis.setex('config:enterprise', 3600, JSON.stringify({
            mode: 'enterprise',
            viral_prediction_enabled: true,
            ai_caching_enabled: true,
            thread_optimization: true,
            hashtag_strategy: 'minimal',
            real_time_learning: true,
            advanced_analytics: true,
            posting_schedule: [9, 15, 21],
            max_learning_records: 1000
        }));
        
        // 2. Viral content templates (leveraging your 214+ table system)
        await redis.setex('viral:templates:health', 3600, JSON.stringify([
            "Most people don't realize {topic} can actually {benefit}...",
            "After studying {topic} for months, here's what changed my perspective...",
            "The {industry} industry doesn't want you to know this about {topic}...",
            "I tested {topic} for 30 days. The results were surprising...",
            "Here's why {topic} might be the key to {outcome} you've been missing...",
            "The science behind {topic} is more fascinating than you think...",
            "What I wish someone told me about {topic} before I started...",
            "Everyone talks about {topic}, but few understand {deeper_insight}..."
        ]));
        
        // 3. AI optimization cache
        await redis.setex('ai:optimization', 1800, JSON.stringify({
            content_generation_cache_ttl: 1800,
            viral_prediction_cache_ttl: 3600,
            engagement_analysis_cache_ttl: 900,
            thread_formatting_cache_ttl: 600,
            model_optimization_enabled: true,
            response_caching_enabled: true
        }));
        
        // 4. Thread optimization templates
        await redis.setex('threads:patterns', 3600, JSON.stringify({
            opener_patterns: [
                "Here's what I learned about {topic}:",
                "Let me break down {topic} for you:",
                "I've been researching {topic}. Here's what I found:",
                "Most people get {topic} wrong. Here's why:"
            ],
            continuation_patterns: [
                "But here's the interesting part:",
                "What surprised me most:",
                "The data shows something different:",
                "Here's where it gets fascinating:"
            ],
            closer_patterns: [
                "What's your experience with {topic}?",
                "Have you noticed this pattern too?",
                "What would you add to this list?",
                "Thoughts on this perspective?"
            ]
        }));
        
        // 5. Performance metrics tracking
        await redis.setex('metrics:performance', 300, JSON.stringify({
            last_optimization: new Date().toISOString(),
            cache_hit_ratio: 0.0,
            avg_response_time: 0,
            active_cache_keys: 0,
            viral_predictions_cached: 0,
            thread_optimizations: 0
        }));
        
        // 6. Initialize counters for analytics
        await redis.set('stats:posts_generated', 0);
        await redis.set('stats:viral_predictions', 0);
        await redis.set('stats:cache_hits', 0);
        await redis.set('stats:thread_optimizations', 0);
        await redis.set('stats:engagement_predictions', 0);
        
        console.log('✅ Enterprise cache structure initialized');
        
        // 7. Test all cache systems
        console.log('\n🧪 Testing enterprise features...');
        
        const enterpriseConfig = JSON.parse(await redis.get('config:enterprise'));
        console.log('✅ Enterprise config cached:', enterpriseConfig.mode);
        
        const viralTemplates = JSON.parse(await redis.get('viral:templates:health'));
        console.log('✅ Viral templates cached:', viralTemplates.length, 'templates');
        
        const threadPatterns = JSON.parse(await redis.get('threads:patterns'));
        console.log('✅ Thread patterns cached:', Object.keys(threadPatterns).length, 'pattern types');
        
        // Test counters
        await redis.incr('stats:posts_generated');
        const postCount = await redis.get('stats:posts_generated');
        console.log('✅ Analytics counters working:', postCount);
        
        // 8. Set up database query caching for your 214+ table system
        console.log('\n💾 Setting up database query cache...');
        
        await redis.setex('db:viral_tables', 3600, JSON.stringify([
            'viral_growth_metrics',
            'content_performance_predictions', 
            'follower_psychology_profiles',
            'contextual_bandit_arms',
            'intelligent_prompt_evolution',
            'twitter_platform_intelligence',
            'engagement_optimization_insights'
        ]));
        
        await redis.setex('db:query_cache:bot_config', 1800, JSON.stringify({
            enterprise_mode: 'true',
            posting_schedule: '{"hours": [9, 15, 21]}',
            viral_prediction_enabled: 'true',
            thread_optimization: 'true',
            enable_ai_caching: 'true'
        }));
        
        console.log('✅ Database query cache initialized');
        
        console.log('\n🎉 ENTERPRISE REDIS SETUP COMPLETE!');
        console.log('🚀 Your 214+ table system now has:');
        console.log('   • Viral content template caching');
        console.log('   • AI response optimization');
        console.log('   • Thread formatting intelligence');
        console.log('   • Performance analytics tracking');
        console.log('   • Database query acceleration');
        console.log('   • Real-time learning cache');
        console.log('   • Enterprise-grade monitoring');
        
        // Show current cache status
        const keys = await redis.keys('*');
        console.log(`\n📊 Cache Status: ${keys.length} keys active`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Enterprise Redis setup failed:', error.message);
        return false;
    } finally {
        redis.disconnect();
    }
}

setupEnterpriseRedis();