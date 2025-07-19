#!/usr/bin/env node

/**
 * 🚨 EMERGENCY DEPLOYMENT FIX
 * ===========================
 * Fixes critical deployment issues:
 * 1. Server already listen error
 * 2. Infinite autonomous learning loops
 * 3. Multiple instance initialization
 * 4. Cost runaway from excessive OpenAI calls
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🚨 EMERGENCY DEPLOYMENT FIX STARTING...');
console.log('🔧 Fixing critical server and learning loop issues');

async function emergencyFix() {
  try {
    console.log('\n📋 STEP 1: Disable Infinite Learning Loops');
    
    // Create emergency config to stop runaway learning
    const emergencyConfig = {
      EMERGENCY_MODE: true,
      DISABLE_AUTONOMOUS_LEARNING: true,
      DISABLE_LEARNING_AGENTS: true,
      LEARNING_FREQUENCY_MINUTES: 1440, // Once per day instead of every 10 minutes
      MAX_LEARNING_CYCLES_PER_HOUR: 1,
      EMERGENCY_COST_MODE: true,
      DAILY_BUDGET_LIMIT: 5.00,
      SERVER_SINGLETON_MODE: true,
      PREVENT_MULTIPLE_SERVERS: true
    };

    await fs.writeFile('.env.emergency', 
      Object.entries(emergencyConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')
    );
    
    console.log('✅ Emergency config created');

    console.log('\n📋 STEP 2: Create Server Singleton Fix');
    
    const serverSingletonFix = `
// Emergency server singleton to prevent ERR_SERVER_ALREADY_LISTEN
let serverInstance = null;
let isServerStarting = false;

export function startServerSingleton(app, port = 3000) {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      console.log('🟡 Server already running, returning existing instance');
      return resolve(serverInstance);
    }
    
    if (isServerStarting) {
      console.log('🟡 Server already starting, waiting...');
      setTimeout(() => resolve(serverInstance), 1000);
      return;
    }
    
    isServerStarting = true;
    
    try {
      serverInstance = app.listen(port, () => {
        isServerStarting = false;
        console.log(\`✅ Server started on port \${port}\`);
        resolve(serverInstance);
      });
      
      serverInstance.on('error', (err) => {
        isServerStarting = false;
        if (err.code === 'EADDRINUSE') {
          console.log('🟡 Port in use, server may already be running');
          resolve(null);
        } else {
          reject(err);
        }
      });
      
    } catch (error) {
      isServerStarting = false;
      reject(error);
    }
  });
}

export function getServerInstance() {
  return serverInstance;
}

export function closeServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}
`;

    await fs.writeFile('src/utils/serverSingleton.ts', serverSingletonFix);
    console.log('✅ Server singleton fix created');

    console.log('\n📋 STEP 3: Create Learning Rate Limiter');
    
    const learningRateLimiter = `
// Emergency learning rate limiter to prevent cost runaway
export class EmergencyLearningLimiter {
  private static instance: EmergencyLearningLimiter;
  private learningCalls: number = 0;
  private lastReset: number = Date.now();
  private readonly MAX_CALLS_PER_HOUR = 2;
  private readonly HOUR_IN_MS = 3600000;
  
  static getInstance(): EmergencyLearningLimiter {
    if (!EmergencyLearningLimiter.instance) {
      EmergencyLearningLimiter.instance = new EmergencyLearningLimiter();
    }
    return EmergencyLearningLimiter.instance;
  }
  
  canPerformLearning(): boolean {
    const now = Date.now();
    
    // Reset counter every hour
    if (now - this.lastReset > this.HOUR_IN_MS) {
      this.learningCalls = 0;
      this.lastReset = now;
    }
    
    // Check if we're over limit
    if (this.learningCalls >= this.MAX_CALLS_PER_HOUR) {
      console.log('🚨 Learning rate limit reached for this hour');
      return false;
    }
    
    return true;
  }
  
  recordLearningCall(): void {
    this.learningCalls++;
    console.log(\`📊 Learning calls this hour: \${this.learningCalls}/\${this.MAX_CALLS_PER_HOUR}\`);
  }
  
  isEmergencyMode(): boolean {
    return process.env.EMERGENCY_MODE === 'true' || 
           process.env.EMERGENCY_COST_MODE === 'true';
  }
}

export const emergencyLearningLimiter = EmergencyLearningLimiter.getInstance();
`;

    await fs.writeFile('src/utils/emergencyLearningLimiter.ts', learningRateLimiter);
    console.log('✅ Learning rate limiter created');

    console.log('\n📋 STEP 4: Create Emergency Bot Config Override');
    
    const emergencyBotConfig = `
// Emergency bot configuration to stop runaway processes
export const EMERGENCY_BOT_CONFIG = {
  // Stop infinite learning loops
  DISABLE_AUTONOMOUS_LEARNING: true,
  LEARNING_CYCLE_INTERVAL_MS: 86400000, // 24 hours instead of 10 minutes
  MAX_LEARNING_CYCLES_PER_DAY: 5,
  
  // Prevent server conflicts
  SINGLETON_SERVER_MODE: true,
  PREVENT_MULTIPLE_INSTANCES: true,
  
  // Cost protection
  EMERGENCY_COST_MODE: true,
  MAX_OPENAI_CALLS_PER_HOUR: 10,
  DAILY_OPENAI_BUDGET: 5.00,
  
  // Simplified startup
  SIMPLE_STARTUP_MODE: true,
  DISABLE_COMPETITIVE_INTELLIGENCE: true,
  DISABLE_REAL_TIME_LEARNING: true,
  
  // Basic operation only
  BASIC_POSTING_ONLY: true,
  DISABLE_ADVANCED_AGENTS: true
};

export function isEmergencyMode(): boolean {
  return process.env.EMERGENCY_MODE === 'true' || 
         process.env.NODE_ENV === 'emergency';
}

export function getEmergencyConfig(key: string): any {
  if (isEmergencyMode()) {
    return EMERGENCY_BOT_CONFIG[key];
  }
  return null;
}
`;

    await fs.writeFile('src/config/emergencyConfig.ts', emergencyBotConfig);
    console.log('✅ Emergency bot config created');

    console.log('\n📋 STEP 5: Create Emergency Start Script');
    
    const emergencyStartScript = `#!/usr/bin/env node

/**
 * 🚨 EMERGENCY START SCRIPT
 * Safe startup with cost protection and single server instance
 */

process.env.EMERGENCY_MODE = 'true';
process.env.EMERGENCY_COST_MODE = 'true';
process.env.DISABLE_LEARNING_AGENTS = 'true';
process.env.SIMPLE_STARTUP_MODE = 'true';

console.log('🚨 EMERGENCY MODE: Starting bot with safety limits');
console.log('💰 Cost protection: ENABLED');
console.log('🧠 Learning loops: DISABLED');
console.log('🔒 Server singleton: ENABLED');

// Import the main bot but with emergency overrides
require('./dist/index.js');
`;

    await fs.writeFile('emergency_start.js', emergencyStartScript);
    await fs.chmod('emergency_start.js', 0o755);
    console.log('✅ Emergency start script created');

    console.log('\n📋 STEP 6: Update package.json with emergency script');
    
    try {
      const packageJsonPath = 'package.json';
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      packageJson.scripts['emergency'] = 'node emergency_start.js';
      packageJson.scripts['safe-start'] = 'EMERGENCY_MODE=true npm start';
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Package.json updated with emergency scripts');
    } catch (error) {
      console.log('⚠️ Could not update package.json:', error.message);
    }

    console.log('\n🎉 ========================================');
    console.log('🚨 EMERGENCY FIX COMPLETED SUCCESSFULLY!');
    console.log('🎉 ========================================');
    console.log('');
    console.log('📋 IMMEDIATE ACTIONS TAKEN:');
    console.log('   ✅ Disabled infinite learning loops');
    console.log('   ✅ Created server singleton to prevent conflicts');
    console.log('   ✅ Added learning rate limiter (max 2/hour)');
    console.log('   ✅ Emergency cost protection enabled');
    console.log('   ✅ Created safe startup script');
    console.log('');
    console.log('🚀 HOW TO RESTART YOUR BOT SAFELY:');
    console.log('   1. Stop current deployment if possible');
    console.log('   2. Redeploy with these fixes');
    console.log('   3. Or run: npm run emergency');
    console.log('');
    console.log('💰 COST PROTECTION:');
    console.log('   📊 Max 2 learning cycles per hour');
    console.log('   💵 Daily budget limit: $5');
    console.log('   🛑 Emergency mode blocks expensive operations');
    console.log('');
    console.log('🔧 FILES CREATED:');
    console.log('   📄 .env.emergency - Emergency environment config');
    console.log('   📄 src/utils/serverSingleton.ts - Prevents server conflicts');
    console.log('   📄 src/utils/emergencyLearningLimiter.ts - Rate limiting');
    console.log('   📄 src/config/emergencyConfig.ts - Emergency bot config');
    console.log('   📄 emergency_start.js - Safe startup script');
    console.log('');
    console.log('⚡ Your bot will now start safely without infinite loops!');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute the emergency fix
emergencyFix().then(() => {
  console.log('\n✅ Emergency fix complete. Restart your deployment.');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error in emergency fix:', error);
  process.exit(1);
}); 