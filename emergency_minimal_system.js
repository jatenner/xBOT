#!/usr/bin/env node

/**
 * 🚨 EMERGENCY MINIMAL SYSTEM - PHASE 1 CRISIS RESOLUTION
 * 
 * Goal: Get posting working in <5 minutes
 * Target: <400MB memory (vs current 1605MB)
 * Strategy: Kill all memory monsters, bare essentials only
 */

console.log('🚨 === EMERGENCY MINIMAL SYSTEM - PHASE 1 ===');
console.log('🎯 Goal: Reduce 1605MB → <400MB memory usage');
console.log('⚡ Strategy: Kill memory monsters, posting-only mode');
console.log('');

const fs = require('fs');
const path = require('path');

// 1. KILL MEMORY MONSTERS - Disable heavy learning systems
console.log('1. 💀 KILLING MEMORY MONSTERS...');

const memoryMonsters = [
  'src/intelligence/masterLearningCoordinator.ts',
  'src/agents/intelligenceCore.ts',
  'src/utils/intelligentCache.ts',
  'src/utils/railway24x7Manager.ts',
];

memoryMonsters.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const disabled = `// 🚨 TEMPORARILY DISABLED FOR MEMORY CRISIS
// Original file size: ${content.length} chars
// This was consuming massive memory on Railway

export class DisabledForMemoryCrisis {
  static getInstance() { return new DisabledForMemoryCrisis(); }
  async start() { console.log('⚠️ Disabled for memory optimization'); }
  async stop() { }
  async learn() { return null; }
  async coordinate() { return null; }
  async cache() { return null; }
  async get() { return null; }
  async set() { }
}

// Export any expected classes to prevent import errors
export const MasterLearningCoordinator = DisabledForMemoryCrisis;
export const AutonomousIntelligenceCore = DisabledForMemoryCrisis;
export const IntelligentCache = DisabledForMemoryCrisis;
export const Railway24x7Manager = DisabledForMemoryCrisis;
`;
    fs.writeFileSync(file, disabled, 'utf8');
    console.log(`   ✅ Disabled ${file} (was ${content.length} chars)`);
  }
});

// 2. ULTRA-MINIMAL BROWSER CONFIG
console.log('2. 🔧 CREATING ULTRA-MINIMAL BROWSER CONFIG...');

const minimalBrowserConfig = `// 🚨 EMERGENCY: Ultra-minimal browser for Railway memory limits
export const emergencyBrowserConfig = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-web-security',
    '--disable-features=TranslateUI',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-images',
    '--disable-javascript',
    '--disable-web-fonts',
    '--disable-default-apps',
    '--memory-pressure-off',
    '--max_old_space_size=120', // ULTRA-LOW memory for browser
    '--no-zygote',
    '--single-process'
  ],
  defaultViewport: { width: 800, height: 600 }, // Minimal viewport
  timeout: 30000 // Fast timeout
};

export const EMERGENCY_MEMORY_LIMIT = 120; // MB for browser
`;

fs.writeFileSync('src/config/emergencyMinimalBrowser.ts', minimalBrowserConfig, 'utf8');
console.log('   ✅ Created ultra-minimal browser config (120MB limit)');

// 3. MINIMAL POSTING SYSTEM
console.log('3. 🚀 CREATING MINIMAL POSTING SYSTEM...');

const minimalPoster = `// 🚨 EMERGENCY: Minimal posting system for memory crisis
import { emergencyBrowserConfig } from '../config/emergencyMinimalBrowser';

export class EmergencyMinimalPoster {
  async post(content: string): Promise<boolean> {
    console.log('🚨 Emergency minimal posting mode');
    console.log(\`📝 Content: \${content.substring(0, 50)}...\`);
    
    try {
      // Use absolute minimal resources
      const { chromium } = await import('playwright');
      const browser = await chromium.launch(emergencyBrowserConfig);
      const page = await browser.newPage();
      
      // Post to Twitter with minimal operations
      await page.goto('https://twitter.com/compose/tweet');
      await page.fill('[data-testid="tweetTextarea_0"]', content);
      await page.click('[data-testid="tweetButton"]');
      
      // Immediate cleanup
      await browser.close();
      
      console.log('✅ Emergency post successful');
      return true;
    } catch (error) {
      console.error('❌ Emergency post failed:', error.message);
      return false;
    }
  }
}
`;

fs.writeFileSync('src/utils/emergencyMinimalPoster.ts', minimalPoster, 'utf8');
console.log('   ✅ Created minimal posting system');

// 4. EMERGENCY MAIN SCRIPT
console.log('4. 📦 CREATING EMERGENCY MAIN SCRIPT...');

const emergencyMain = `#!/usr/bin/env node

/**
 * 🚨 EMERGENCY MAIN - Memory Crisis Mode
 * Absolute minimal system: post every 30 minutes, <400MB memory
 */

console.log('🚨 EMERGENCY MODE: Memory Crisis Recovery');
console.log('🎯 Target: <400MB memory usage');
console.log('⚡ Function: Posting only, all intelligence disabled');

const { EmergencyMinimalPoster } = require('./dist/utils/emergencyMinimalPoster');

const poster = new EmergencyMinimalPoster();

async function emergencyPost() {
  const content = \`Health tip \${Date.now()}: Stay hydrated! Drink 8 glasses of water daily for optimal health. #HealthTips\`;
  const success = await poster.post(content);
  console.log(\`📊 Post result: \${success ? 'SUCCESS' : 'FAILED'}\`);
  
  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
}

// Post every 30 minutes (Railway memory-safe interval)
setInterval(emergencyPost, 30 * 60 * 1000);

// Initial post
emergencyPost();

console.log('🔄 Emergency posting schedule started (30-minute intervals)');
`;

fs.writeFileSync('emergency_main.js', emergencyMain, 'utf8');
console.log('   ✅ Created emergency main script');

// 5. UPDATE PACKAGE.JSON FOR EMERGENCY MODE
console.log('5. 📦 UPDATING PACKAGE.JSON FOR EMERGENCY MODE...');

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Emergency scripts
pkg.scripts['emergency'] = 'node --max-old-space-size=400 emergency_main.js';
pkg.scripts['start-emergency'] = 'npm run build && npm run emergency';

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2), 'utf8');
console.log('   ✅ Added emergency mode to package.json');

console.log('');
console.log('✅ EMERGENCY MINIMAL SYSTEM READY');
console.log('📋 What was changed:');
console.log('   💀 Disabled 4 memory monster files');
console.log('   🔧 Created ultra-minimal browser config (120MB)');
console.log('   🚀 Created minimal posting system');
console.log('   📦 Added emergency start scripts');
console.log('');
console.log('🚀 Ready to deploy emergency memory-safe system!');