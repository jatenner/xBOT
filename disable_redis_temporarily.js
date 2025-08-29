/**
 * 🚨 DISABLE REDIS TEMPORARILY
 * Stop the Redis retry loops that are flooding the logs
 */

const fs = require('fs');
const path = require('path');

// Find all files that might be causing Redis issues
const filesToCheck = [
  'src/lib/smartCacheManager.ts',
  'src/lib/redisManager.ts', 
  'src/lib/dualStoreManager.ts'
];

console.log('🚨 TEMPORARILY DISABLING REDIS RETRY LOOPS...');

filesToCheck.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (fs.existsSync(fullPath)) {
    console.log(`🔧 Processing ${filePath}...`);
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Reduce Redis retry attempts to prevent log flooding
    content = content.replace(/maxRetries.*?(\d+)/g, 'maxRetries: 2');
    content = content.replace(/retryDelayOnFailover.*?(\d+)/g, 'retryDelayOnFailover: 100');
    content = content.replace(/connectTimeout.*?(\d+)/g, 'connectTimeout: 2000');
    
    // Add early exit for Redis failures
    if (content.includes('redis')) {
      const earlyExitPattern = `
      // Emergency Redis disable
      if (process.env.DISABLE_REDIS === 'true') {
        console.log('⚠️ Redis disabled via environment variable');
        return null;
      }
      `;
      
      // Add early exit at the beginning of Redis initialization
      if (content.includes('constructor') && !content.includes('Emergency Redis disable')) {
        content = content.replace(/constructor\(\)\s*{/, `constructor() {${earlyExitPattern}`);
      }
    }
    
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Updated ${filePath}`);
  } else {
    console.log(`⚠️ File not found: ${filePath}`);
  }
});

// Create environment override
const envOverride = `
# Temporary Redis disable to stop log flooding
DISABLE_REDIS=true
`;

fs.appendFileSync('.env', envOverride);

console.log('✅ REDIS TEMPORARILY DISABLED');
console.log('🔄 This will stop the retry loops and allow normal operation');
console.log('📝 Added DISABLE_REDIS=true to .env file');

process.exit(0);
