const Redis = require('ioredis');

// CORRECTED Redis URL with proper password
const redisUrl = 'redis://default:Jatjat26!@redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com:17514';

console.log('🔧 Testing CORRECTED Redis credentials...');
console.log('📍 URL:', redisUrl.replace(/Jatjat26!/, '***'));

const redis = new Redis(redisUrl, {
    connectTimeout: 10000,
    lazyConnect: false,
    maxRetriesPerRequest: 3
});

async function testCorrectedRedis() {
    try {
        console.log('\n🏓 Testing ping...');
        const result = await redis.ping();
        console.log('✅ Ping successful:', result);
        
        console.log('\n💾 Testing set/get...');
        await redis.set('test_enterprise', 'xbot_ready');
        const value = await redis.get('test_enterprise');
        console.log('✅ Set/Get successful:', value);
        
        console.log('\n🧹 Cleaning up...');
        await redis.del('test_enterprise');
        
        console.log('\n🎉 REDIS CONNECTION SUCCESSFUL!');
        console.log('✅ Your Redis is ready for enterprise features');
        
    } catch (error) {
        console.error('❌ Redis test failed:', error.message);
    } finally {
        redis.disconnect();
    }
}

testCorrectedRedis();