// ===== RAILWAY-COMPATIBLE REDIS CONFIGURATION =====
// Update all Redis connections to work on Railway

const fs = require('fs');
const path = require('path');

console.log('🔧 UPDATING ALL REDIS CONNECTIONS FOR RAILWAY COMPATIBILITY');

// 1. Update the main database manager
const dbManagerPath = 'src/lib/db.ts';
if (fs.existsSync(dbManagerPath)) {
    console.log('📝 Updating database manager...');
    let content = fs.readFileSync(dbManagerPath, 'utf8');
    
    // Replace Redis connection with Railway-compatible config
    const railwayRedisConfig = `
        // Railway-compatible Redis configuration
        this.redis = new Redis({
            host: 'redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com',
            port: 17514,
            password: 'uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU',
            tls: false, // Disable TLS for Railway compatibility
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            connectTimeout: 10000,
            retryDelayOnFailover: 100
        });`;
    
    // Update the Redis initialization
    content = content.replace(
        /this\.redis = new Redis\([^}]+\}\);?/s,
        railwayRedisConfig
    );
    
    fs.writeFileSync(dbManagerPath, content);
    console.log('✅ Database manager updated');
}

// 2. Update advanced database manager
const advancedDbPath = 'src/lib/advancedDatabaseManager.ts';
if (fs.existsSync(advancedDbPath)) {
    console.log('📝 Updating advanced database manager...');
    let content = fs.readFileSync(advancedDbPath, 'utf8');
    
    // Update Redis configuration in advanced manager
    const railwayRedisOptions = `
            const redisOptions = {
                host: 'redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com',
                port: 17514,
                password: 'uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU',
                tls: false, // Railway compatibility
                connectTimeout: this.config.redis.connectTimeout,
                lazyConnect: this.config.redis.lazyConnect,
                maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
                retryDelayOnFailover: 100,
                keyPrefix: this.config.redis.keyPrefix
            };`;
    
    // Replace redisOptions definition
    content = content.replace(
        /const redisOptions[^}]+\};/s,
        railwayRedisOptions
    );
    
    fs.writeFileSync(advancedDbPath, content);
    console.log('✅ Advanced database manager updated');
}

// 3. Create Railway environment update script
const railwayEnvUpdate = `
# ===== RAILWAY REDIS FIX =====
# Replace your REDIS_URL with this non-SSL version:

REDIS_URL=redis://uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU@redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com:17514

# Add this for Redis SSL configuration:
REDIS_TLS_DISABLED=true
REDIS_SSL_REJECT_UNAUTHORIZED=false

# Enterprise features (keep existing):
ENABLE_ENTERPRISE_MODE=true
DATABASE_POOL_SIZE=15
AI_RESPONSE_CACHE_TTL=1800
VIRAL_PREDICTION_CACHE_TTL=3600
THREAD_OPTIMIZATION=true
`;

fs.writeFileSync('railway_redis_fix_env.txt', railwayEnvUpdate);
console.log('✅ Railway environment update created');

// 4. Test the new configuration
console.log('\n🧪 Testing Railway-compatible Redis...');

const Redis = require('ioredis');
const redis = new Redis({
    host: 'redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com',
    port: 17514,
    password: 'uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU',
    tls: false,
    lazyConnect: true
});

redis.ping()
    .then(() => {
        console.log('✅ Railway Redis configuration confirmed working');
        redis.disconnect();
    })
    .catch(error => {
        console.error('❌ Test failed:', error.message);
        redis.disconnect();
    });

console.log('\n🎯 RAILWAY FIX SUMMARY:');
console.log('1. Updated database managers for Railway compatibility');
console.log('2. Created railway_redis_fix_env.txt with correct REDIS_URL');
console.log('3. Disabled TLS for Railway environment');
console.log('4. Maintained all enterprise features');
console.log('\nNext: Update REDIS_URL in Railway with the new non-SSL version!');