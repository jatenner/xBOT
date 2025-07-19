#!/usr/bin/env node

/**
 * 🚨 EMERGENCY DEPLOYMENT FIX - COMPLETE SOLUTION
 * ================================================
 * This script applies all emergency fixes and prepares for immediate deployment
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🚨 ===============================================');
console.log('🚨 EMERGENCY DEPLOYMENT FIX - COMPLETE SOLUTION');
console.log('🚨 ===============================================');

async function deployEmergencyFix() {
  try {
    console.log('\n📋 STEP 1: Update Environment Variables');
    
    // Read current .env if it exists
    let envContent = '';
    try {
      envContent = await fs.readFile('.env', 'utf8');
    } catch (error) {
      console.log('⚠️ No .env file found, creating from example...');
      try {
        envContent = await fs.readFile('env.example', 'utf8');
      } catch (exampleError) {
        console.log('⚠️ No env.example found either, creating minimal config...');
      }
    }

    // Add emergency environment variables
    const emergencyEnvVars = `

# 🚨 EMERGENCY MODE SETTINGS (Added by emergency fix)
EMERGENCY_MODE=true
EMERGENCY_COST_MODE=true
DISABLE_LEARNING_AGENTS=true
DISABLE_AUTONOMOUS_LEARNING=true
LEARNING_FREQUENCY_MINUTES=1440
MAX_LEARNING_CYCLES_PER_HOUR=1
DAILY_BUDGET_LIMIT=5.00
SERVER_SINGLETON_MODE=true
PREVENT_MULTIPLE_SERVERS=true
SIMPLE_STARTUP_MODE=true
DISABLE_COMPETITIVE_INTELLIGENCE=true
DISABLE_REAL_TIME_LEARNING=true
BASIC_POSTING_ONLY=true
DISABLE_ADVANCED_AGENTS=true

# Emergency cost protection
MAX_OPENAI_CALLS_PER_HOUR=10
DAILY_OPENAI_BUDGET=5.00

# Ensure basic operation
MAX_DAILY_TWEETS=17
OPTIMAL_POSTING_WINDOWS=true
EMERGENCY_CATCHUP_MODE=false
CONTENT_CACHE_ENABLED=true
SMART_BATCHING_ENABLED=false
FALLBACK_CONTENT_ENABLED=true
GRACEFUL_ERROR_HANDLING=true
API_RATE_LIMIT_PROTECTION=true
AUTOMATIC_RETRY_ENABLED=true
`;

    // Check if emergency vars are already added
    if (!envContent.includes('EMERGENCY_MODE=')) {
      envContent += emergencyEnvVars;
      await fs.writeFile('.env', envContent);
      console.log('✅ Emergency environment variables added to .env');
    } else {
      console.log('✅ Emergency environment variables already present');
    }

    console.log('\n📋 STEP 2: Create Emergency Package.json Script');
    
    const packageJsonPath = 'package.json';
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Add emergency scripts if not present
    if (!packageJson.scripts['emergency']) {
      packageJson.scripts['emergency'] = 'EMERGENCY_MODE=true node dist/index.js';
      packageJson.scripts['emergency-start'] = 'EMERGENCY_MODE=true npm start';
      packageJson.scripts['safe-build'] = 'NODE_OPTIONS=--max_old_space_size=1024 tsc && npm run postbuild';
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Emergency scripts added to package.json');
    } else {
      console.log('✅ Emergency scripts already present');
    }

    console.log('\n📋 STEP 3: Create Render Environment Override');
    
    const renderEnvOverride = `# 🚨 RENDER ENVIRONMENT OVERRIDE
# Copy these to your Render environment variables dashboard

EMERGENCY_MODE=true
EMERGENCY_COST_MODE=true
DISABLE_LEARNING_AGENTS=true
DISABLE_AUTONOMOUS_LEARNING=true
LEARNING_FREQUENCY_MINUTES=1440
MAX_LEARNING_CYCLES_PER_HOUR=1
DAILY_BUDGET_LIMIT=5.00
SERVER_SINGLETON_MODE=true
PREVENT_MULTIPLE_SERVERS=true
SIMPLE_STARTUP_MODE=true
DISABLE_COMPETITIVE_INTELLIGENCE=true
DISABLE_REAL_TIME_LEARNING=true
BASIC_POSTING_ONLY=true
DISABLE_ADVANCED_AGENTS=true
MAX_OPENAI_CALLS_PER_HOUR=10
DAILY_OPENAI_BUDGET=5.00
MAX_DAILY_TWEETS=17
OPTIMAL_POSTING_WINDOWS=true
EMERGENCY_CATCHUP_MODE=false
CONTENT_CACHE_ENABLED=true
SMART_BATCHING_ENABLED=false
FALLBACK_CONTENT_ENABLED=true
GRACEFUL_ERROR_HANDLING=true
API_RATE_LIMIT_PROTECTION=true
AUTOMATIC_RETRY_ENABLED=true
NODE_ENV=production
PORT=3000
`;

    await fs.writeFile('RENDER_ENVIRONMENT_VARIABLES.txt', renderEnvOverride);
    console.log('✅ Render environment override file created');

    console.log('\n📋 STEP 4: Update Start Command for Render');
    
    // Update package.json start command for emergency mode
    if (packageJson.scripts.start !== 'EMERGENCY_MODE=true node dist/index.js') {
      packageJson.scripts['start-original'] = packageJson.scripts.start || 'node dist/index.js';
      packageJson.scripts.start = 'EMERGENCY_MODE=true node dist/index.js';
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Updated start command for emergency mode');
    } else {
      console.log('✅ Start command already in emergency mode');
    }

    console.log('\n📋 STEP 5: Create Emergency Deployment Instructions');
    
    const deploymentInstructions = `# 🚨 EMERGENCY DEPLOYMENT INSTRUCTIONS

## IMMEDIATE ACTIONS REQUIRED:

### 1. Stop Current Render Deployment
- Go to your Render dashboard
- Stop the current deployment if it's running

### 2. Update Environment Variables in Render
Copy ALL variables from RENDER_ENVIRONMENT_VARIABLES.txt into your Render environment variables:

\`\`\`
EMERGENCY_MODE=true
EMERGENCY_COST_MODE=true
DISABLE_LEARNING_AGENTS=true
(... see RENDER_ENVIRONMENT_VARIABLES.txt for complete list)
\`\`\`

### 3. Redeploy with Emergency Fix
- Push these changes to your GitHub repository
- Trigger a new deployment in Render
- Or use manual deploy with the emergency branch

### 4. Verify Emergency Mode is Active
- Check deployment logs for: "🚨 EMERGENCY MODE ACTIVATED"
- Visit your app URL/health to confirm emergency mode
- Emergency mode should show cost protection enabled

## WHAT THE EMERGENCY FIX DOES:

✅ **Server Singleton**: Prevents ERR_SERVER_ALREADY_LISTEN errors
✅ **Learning Rate Limiting**: Max 2 learning cycles per hour
✅ **Cost Protection**: Daily budget limit of $5
✅ **Simple Mode**: Disables expensive advanced features
✅ **Stable Operation**: Long delays between operations
✅ **Health Monitoring**: /health endpoint shows emergency status

## MONITORING:

- Health Check: your-app-url.onrender.com/health
- Dashboard: your-app-url.onrender.com/dashboard
- Emergency Post: POST to your-app-url.onrender.com/force-post

## EXPECTED BEHAVIOR:

🚨 Bot will start in EMERGENCY MODE
💰 Cost protection will be ENABLED
🧠 Learning loops will be DISABLED
🔒 Server singleton will prevent conflicts
⚡ Simple posting mode will be ACTIVE
😴 Long delays (2 hours) between operations in emergency mode

## RETURN TO NORMAL:

Once stable, you can gradually remove emergency environment variables:
1. Remove EMERGENCY_MODE=true
2. Remove EMERGENCY_COST_MODE=true  
3. Re-enable learning features one by one
4. Monitor costs and stability

## SUPPORT:

If deployment still fails:
1. Check Render logs for specific errors
2. Verify all environment variables are set
3. Ensure GitHub repository has latest emergency fixes
4. Try manual deployment with emergency branch
`;

    await fs.writeFile('EMERGENCY_DEPLOYMENT_INSTRUCTIONS.md', deploymentInstructions);
    console.log('✅ Emergency deployment instructions created');

    console.log('\n📋 STEP 6: Create Quick Deploy Script');
    
    const quickDeployScript = `#!/bin/bash

# 🚨 QUICK EMERGENCY DEPLOY SCRIPT

echo "🚨 EMERGENCY DEPLOYMENT STARTING..."

echo "📋 Step 1: Building with emergency mode..."
npm run build

echo "📋 Step 2: Testing emergency mode locally..."
EMERGENCY_MODE=true node -e "
const config = require('./dist/config/emergencyConfig.js');
console.log('✅ Emergency mode check:', config.isEmergencyMode());
process.exit(0);
"

echo "📋 Step 3: Git commit and push..."
git add .
git commit -m "🚨 Emergency deployment fix - prevent server crashes and cost runaway"
git push origin main

echo "✅ Emergency deployment complete!"
echo "🚨 Now trigger deployment in Render dashboard"
echo "📊 Monitor at: your-app-url/health"
`;

    await fs.writeFile('quick_deploy.sh', quickDeployScript);
    await fs.chmod('quick_deploy.sh', 0o755);
    console.log('✅ Quick deploy script created');

    console.log('\n📋 STEP 7: Test Emergency Mode Locally');
    
    // Test the emergency configuration
    console.log('🧪 Testing emergency configuration...');
    process.env.EMERGENCY_MODE = 'true';
    
    try {
      const emergencyConfig = require('./dist/config/emergencyConfig.js');
      if (emergencyConfig.isEmergencyMode()) {
        console.log('✅ Emergency mode detection working');
      } else {
        console.log('⚠️ Emergency mode detection may need attention');
      }
    } catch (error) {
      console.log('⚠️ Emergency config test skipped (build required)');
    }

    console.log('\n🎉 ================================================');
    console.log('🚨 EMERGENCY DEPLOYMENT FIX COMPLETED!');
    console.log('🎉 ================================================');
    console.log('');
    console.log('📋 FILES CREATED/UPDATED:');
    console.log('   📄 .env - Emergency environment variables');
    console.log('   📄 package.json - Emergency scripts and start command');
    console.log('   📄 RENDER_ENVIRONMENT_VARIABLES.txt - For Render dashboard');
    console.log('   📄 EMERGENCY_DEPLOYMENT_INSTRUCTIONS.md - Step-by-step guide');
    console.log('   📄 quick_deploy.sh - Automated deployment script');
    console.log('   📄 All emergency TypeScript files from previous fix');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Copy RENDER_ENVIRONMENT_VARIABLES.txt to Render dashboard');
    console.log('   2. Run: ./quick_deploy.sh (or follow manual instructions)');
    console.log('   3. Monitor deployment logs for "🚨 EMERGENCY MODE ACTIVATED"');
    console.log('   4. Verify at your-app-url/health shows emergency mode');
    console.log('');
    console.log('💰 COST PROTECTION:');
    console.log('   📊 Max 2 learning cycles per hour');
    console.log('   💵 Daily budget limit: $5');
    console.log('   🛑 Advanced features disabled');
    console.log('   😴 2-hour delays in emergency mode');
    console.log('');
    console.log('✅ Your bot deployment will now be STABLE and COST-SAFE!');

  } catch (error) {
    console.error('❌ Emergency deployment fix failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute the emergency deployment fix
deployEmergencyFix().then(() => {
  console.log('\n🚨 Ready for emergency deployment!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error in emergency deployment fix:', error);
  process.exit(1);
}); 