#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚨 === EMERGENCY RENDER DEPLOYMENT ===');
console.log('🔧 Forcing complete rebuild and deployment to fix 404 issues');

async function emergencyDeploy() {
  try {
    console.log('1. 📦 Building local project...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('2. 🧹 Cleaning git state...');
    execSync('git add .', { stdio: 'inherit' });

    console.log('3. 📝 Creating deployment trigger...');
    const timestamp = new Date().toISOString();
    const deployTrigger = `# Emergency deployment trigger: ${timestamp}\n# Bot was offline for 136+ hours - forcing restart\n# Fixes: posting frequency, strategist optimization\n`;
    
    fs.writeFileSync('.render-deploy-trigger', deployTrigger);

    console.log('4. 🔄 Committing deployment trigger...');
    execSync('git add .render-deploy-trigger', { stdio: 'inherit' });
    execSync('git commit -m "🚨 EMERGENCY DEPLOY: Bot offline 136h - forcing Render restart"', { stdio: 'inherit' });

    console.log('5. 🚀 Force pushing to trigger deployment...');
    execSync('git push origin main --force-with-lease', { stdio: 'inherit' });

    console.log('6. ⏳ Waiting for deployment to start...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('7. 🔍 Checking deployment status...');
    for (let i = 0; i < 10; i++) {
      try {
        const response = execSync('curl -s -o /dev/null -w "%{http_code}" https://snap2health-xbot.onrender.com', { encoding: 'utf8' });
        console.log(`   Attempt ${i + 1}: HTTP ${response.trim()}`);
        
        if (response.trim() === '200') {
          console.log('✅ DEPLOYMENT SUCCESS! Bot is back online!');
          return;
        }
        
        if (i < 9) {
          console.log('   ⏳ Waiting 30s for next check...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      } catch (error) {
        console.log(`   Attempt ${i + 1}: Connection failed`);
      }
    }

    console.log('⚠️ Deployment status unclear after 5 minutes');
    console.log('📊 Next steps:');
    console.log('   1. Check Render dashboard manually');
    console.log('   2. Look for deployment logs');
    console.log('   3. Verify environment variables');
    console.log('   4. Check if the service is sleeping');

  } catch (error) {
    console.error('❌ Emergency deployment failed:', error.message);
    
    console.log('\n🔧 MANUAL TROUBLESHOOTING STEPS:');
    console.log('1. Go to https://render.com dashboard');
    console.log('2. Find your xBOT service');
    console.log('3. Click "Manual Deploy" -> "Clear build cache & deploy"');
    console.log('4. Check logs for errors');
    console.log('5. Verify environment variables are set');
    
    process.exit(1);
  }
}

emergencyDeploy(); 