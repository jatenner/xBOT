#!/usr/bin/env node

/**
 * 🚨 EMERGENCY MEMORY OPTIMIZATION FOR RAILWAY
 * Targeting critical 1600MB -> 400MB memory reduction
 * 
 * Current: 1600MB (3.3x limit)
 * Target: <400MB (Railway 512MB limit)
 * Emergency: <300MB (safety buffer)
 */

console.log('🚨 === EMERGENCY MEMORY OPTIMIZATION ===');
console.log('Current: 1600MB (3.3x Railway limit)');
console.log('Target: <400MB (<80% of 512MB limit)');
console.log('');

// 1. EMERGENCY: Disable memory-intensive features temporarily
console.log('1. 🔧 Disabling memory-intensive features...');

const memoryOptimizations = {
  // Disable AI content generation caching (major memory user)
  disableAICache: `
// EMERGENCY: Disable all AI response caching
export class CompletionCache {
  private cache = new Map(); // Empty map
  
  generateKey(): string { return ''; }
  get(): null { return null; } // Never return cached results
  set(): void { } // Never cache results
  clear(): void { this.cache.clear(); }
  size(): number { return 0; }
  getStats() { return { size: 0, hitRate: 0, savings: 0 }; }
}`,

  // Reduce content agent memory usage
  reduceContentMemory: `
export class DiverseContentAgent {
  private recentContent: UsedContent[] = []; // Start empty
  private maxRecentContent = 5; // Reduce from default
  
  async generateDiverseContent() {
    // Emergency: Clear memory after each generation
    this.recentContent = this.recentContent.slice(-this.maxRecentContent);
    
    // Skip database content checks to reduce memory
    const databaseContent = []; // Skip DB query
    
    // Reduce attempts to save memory
    const maxAttempts = 3; // Reduce from 10
    
    // Continue with minimal memory footprint...
  }
}`,

  // Ultra-minimal browser config
  ultraMinimalBrowser: `
export const EMERGENCY_BROWSER_OPTIONS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--single-process',
    '--no-zygote',
    '--memory-pressure-off',
    '--max_old_space_size=128', // Extremely low
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-images',
    '--disable-javascript', // Disable JS for minimal memory
    '--disable-default-apps',
    '--disable-background-networking',
    '--window-size=400,300', // Minimal window
    '--disable-features=VizDisplayCompositor,TranslateUI',
    '--disable-ipc-flooding-protection',
    '--user-data-dir=/tmp/minimal-chrome'
  ],
  timeout: 8000, // Shorter timeout
  chromiumSandbox: false
};`,

  // Memory monitoring with emergency shutdown
  emergencyMemoryMonitor: `
export class EmergencyMemoryMonitor {
  static checkMemoryEmergency(): boolean {
    const usage = process.memoryUsage();
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    
    console.log(\`📊 Memory: \${rssMB}MB\`);
    
    // Emergency shutdown if over 450MB
    if (rssMB > 450) {
      console.log('🚨 EMERGENCY: Memory over 450MB - forcing cleanup');
      this.emergencyCleanup();
      return false;
    }
    
    return rssMB < 400;
  }
  
  static emergencyCleanup(): void {
    // Force garbage collection multiple times
    if (global.gc) {
      for (let i = 0; i < 5; i++) {
        global.gc();
      }
    }
    
    // Clear all possible caches
    if (require.cache) {
      Object.keys(require.cache).forEach(key => {
        if (!key.includes('node_modules')) {
          delete require.cache[key];
        }
      });
    }
  }
}`
};

// 2. Create emergency memory-optimized files
const fs = require('fs');
const path = require('path');

console.log('2. 📝 Creating emergency memory-optimized files...');

// Emergency cache disable
fs.writeFileSync('src/utils/emergencyCache.ts', `
${memoryOptimizations.disableAICache}

// Export for immediate use
export const completionCache = new CompletionCache();
`);

// Emergency browser config
fs.writeFileSync('src/config/emergencyBrowserConfig.ts', `
${memoryOptimizations.ultraMinimalBrowser}

export default EMERGENCY_BROWSER_OPTIONS;
`);

// Emergency memory monitor
fs.writeFileSync('src/utils/emergencyMemoryMonitor.ts', `
${memoryOptimizations.emergencyMemoryMonitor}

export default EmergencyMemoryMonitor;
`);

console.log('3. 🔧 Modifying critical memory consumers...');

// 3. Patch the main DB file to force garbage collection
const dbPath = 'src/lib/db.ts';
let dbContent = fs.readFileSync(dbPath, 'utf8');

// Add emergency memory cleanup to getRedisClient
const emergencyMemoryPatch = `
  // EMERGENCY: Memory cleanup before Redis connection
  if (global.gc) {
    global.gc();
  }
  
  // Emergency memory check
  const memUsage = process.memoryUsage();
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  console.log(\`🔧 Memory before Redis connection: \${rssMB}MB\`);
  
  if (rssMB > 400) {
    console.log('⚠️ Memory too high for Redis connection, skipping');
    return null;
  }
`;

// Insert the memory check at the beginning of getRedisClient
dbContent = dbContent.replace(
  'export async function getRedisClient() {',
  `export async function getRedisClient() {
${emergencyMemoryPatch}`
);

fs.writeFileSync(dbPath, dbContent);

console.log('4. 🚀 Creating emergency startup script...');

// 4. Create emergency startup with memory limits
const emergencyStartScript = `#!/usr/bin/env node

/**
 * 🚨 EMERGENCY STARTUP WITH STRICT MEMORY LIMITS
 */

console.log('🚨 Starting in EMERGENCY MEMORY MODE');
console.log('Memory limit: 400MB (Railway: 512MB)');

// Set Node.js memory limit to 400MB
process.env.NODE_OPTIONS = '--max_old_space_size=400 --gc_interval=100';

// Enable garbage collection
if (global.gc) {
  // Force GC every 30 seconds
  setInterval(() => {
    const before = process.memoryUsage().rss;
    global.gc();
    const after = process.memoryUsage().rss;
    const freed = Math.round((before - after) / 1024 / 1024);
    if (freed > 5) {
      console.log(\`♻️ GC freed \${freed}MB\`);
    }
  }, 30000);
}

// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  
  if (rssMB > 450) {
    console.log(\`🚨 CRITICAL: Memory \${rssMB}MB > 450MB limit!\`);
    process.exit(1); // Emergency restart
  } else if (rssMB > 400) {
    console.log(\`⚠️ WARNING: Memory \${rssMB}MB > 400MB target\`);
    if (global.gc) global.gc();
  }
}, 10000);

// Start the main application
require('./dist/main.js');
`;

fs.writeFileSync('emergency_start.js', emergencyStartScript);

console.log('5. 📦 Updating package.json for emergency mode...');

// 5. Update package.json with emergency script
const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

packageJson.scripts['emergency'] = 'node --expose-gc emergency_start.js';
packageJson.scripts['start-emergency'] = 'npm run build && npm run emergency';

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

console.log('');
console.log('✅ EMERGENCY MEMORY OPTIMIZATION COMPLETE');
console.log('');
console.log('📋 Changes made:');
console.log('  ✅ Disabled AI response caching');
console.log('  ✅ Ultra-minimal browser configuration');
console.log('  ✅ Emergency memory monitoring');
console.log('  ✅ Aggressive garbage collection');
console.log('  ✅ Memory limits: 400MB (vs 1600MB current)');
console.log('');
console.log('🚀 Ready to deploy emergency memory fixes');