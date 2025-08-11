// ===== RAILWAY SSL REDIS FIX =====
// Railway environment has SSL/TLS version issues with Redis Cloud

const Redis = require('ioredis');

console.log('🔧 FIXING REDIS SSL ISSUE FOR RAILWAY');

// The issue is SSL version incompatibility on Railway
// Solution: Use non-SSL connection or proper SSL config

const configs = [
    {
        name: 'Non-SSL Connection',
        config: {
            host: 'redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com',
            port: 17514,
            password: 'uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU',
            tls: false, // Disable TLS
            lazyConnect: true
        }
    },
    {
        name: 'Fixed SSL Config',
        config: {
            host: 'redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com',
            port: 17514,
            password: 'uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU',
            tls: {
                rejectUnauthorized: false,
                secureProtocol: 'TLSv1_2_method'
            },
            lazyConnect: true
        }
    },
    {
        name: 'Railway-Specific SSL',
        config: {
            host: 'redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com',
            port: 17514,
            password: 'uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU',
            tls: {
                rejectUnauthorized: false,
                servername: 'redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com'
            },
            lazyConnect: true
        }
    }
];

async function findWorkingConfig() {
    for (const config of configs) {
        console.log(`\n🧪 Testing ${config.name}...`);
        
        const redis = new Redis(config.config);
        
        try {
            await redis.ping();
            console.log('✅ SUCCESS! This config works on Railway');
            
            // Test basic operations
            await redis.set('railway_test', 'working');
            const result = await redis.get('railway_test');
            console.log('✅ Set/Get test:', result);
            await redis.del('railway_test');
            
            // This is the working config for Railway
            console.log('\n🎯 WORKING RAILWAY REDIS CONFIG:');
            console.log(JSON.stringify(config.config, null, 2));
            
            redis.disconnect();
            return config.config;
            
        } catch (error) {
            console.log('❌ Failed:', error.message.substring(0, 100));
            redis.disconnect();
        }
    }
    
    console.log('\n❌ No working config found. Redis Cloud instance may need different setup.');
    return null;
}

findWorkingConfig();