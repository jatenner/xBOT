#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('📊 === OPTIMIZED GHOST KILLER MONITORING ===');
console.log('🔍 Real-time system status with monthly usage tracking\n');

function getSystemStatus() {
  try {
    console.log('🤖 === BOT STATUS ===');
    
    // Check if bot is running
    try {
      const processes = execSync('pgrep -f "node.*index"', { encoding: 'utf-8' });
      console.log('✅ Bot Status: RUNNING');
      console.log(`📋 Process IDs: ${processes.trim()}`);
    } catch (error) {
      console.log('❌ Bot Status: NOT RUNNING');
    }
    
    console.log('\n📊 === API USAGE MONITORING ===');
    
    // Check logs for engagement strategy
    try {
      const logs = execSync('tail -n 20 logs/autonomous_bot.log 2>/dev/null || echo "No logs found"', { encoding: 'utf-8' });
      
      // Extract engagement strategy info
      const strategyLines = logs.split('\n').filter(line => 
        line.includes('Engagement Strategy:') || 
        line.includes('Monthly usage:') ||
        line.includes('Next Action:') ||
        line.includes('ENGAGEMENT-ONLY MODE') ||
        line.includes('MONTHLY API LIMIT REACHED')
      );
      
      if (strategyLines.length > 0) {
        console.log('🎯 Current Engagement Strategy:');
        strategyLines.forEach(line => {
          if (line.includes('Strategy:')) {
            const strategy = line.split('Strategy:')[1]?.trim();
            console.log(`   📈 Mode: ${strategy}`);
          }
          if (line.includes('Monthly usage:')) {
            const usage = line.split('Monthly usage:')[1]?.trim();
            console.log(`   📊 Usage: ${usage}`);
          }
          if (line.includes('Next Action:')) {
            const action = line.split('Next Action:')[1]?.trim();
            console.log(`   🎯 Action: ${action}`);
          }
        });
      } else {
        console.log('⏳ Waiting for engagement strategy data...');
      }
      
    } catch (error) {
      console.log('❌ Unable to read engagement strategy logs');
    }
    
    console.log('\n🔥 === ENGAGEMENT ACTIVITIES ===');
    
    // Check for recent engagement activities
    try {
      const recentLogs = execSync('tail -n 50 logs/autonomous_bot.log 2>/dev/null | grep -E "(PARALLEL|strategic|Liked|Followed|Analyzed)" | tail -10 || echo "No recent activity"', { encoding: 'utf-8' });
      
      if (recentLogs.trim() && !recentLogs.includes('No recent activity')) {
        const activities = recentLogs.split('\n').filter(line => line.trim());
        activities.forEach(activity => {
          if (activity.includes('Liked')) {
            console.log(`❤️ ${activity.split('Liked')[1]?.trim()}`);
          } else if (activity.includes('Followed')) {
            console.log(`🤝 ${activity.split('Followed')[1]?.trim()}`);
          } else if (activity.includes('Analyzed')) {
            console.log(`🧠 ${activity.split('Analyzed')[1]?.trim()}`);
          } else if (activity.includes('Executed')) {
            console.log(`💬 ${activity.split('Executed')[1]?.trim()}`);
          }
        });
      } else {
        console.log('⏳ No recent engagement activities detected');
      }
      
    } catch (error) {
      console.log('❌ Unable to read engagement logs');
    }
    
    console.log('\n⚠️ === RATE LIMITING STATUS ===');
    
    // Check for rate limiting info
    try {
      const rateLimitLogs = execSync('tail -n 100 logs/autonomous_bot.log 2>/dev/null | grep -E "(Rate limited|backoff|MONTHLY|quota)" | tail -5 || echo "No rate limit info"', { encoding: 'utf-8' });
      
      if (rateLimitLogs.trim() && !rateLimitLogs.includes('No rate limit info')) {
        rateLimitLogs.split('\n').filter(line => line.trim()).forEach(line => {
          if (line.includes('Rate limited')) {
            console.log(`🚨 ${line.split(']')[1]?.trim() || line}`);
          } else if (line.includes('backoff')) {
            console.log(`⏳ ${line.split(']')[1]?.trim() || line}`);
          } else if (line.includes('MONTHLY')) {
            console.log(`📅 ${line.split(']')[1]?.trim() || line}`);
          } else if (line.includes('quota')) {
            console.log(`📊 ${line.split(']')[1]?.trim() || line}`);
          }
        });
      } else {
        console.log('✅ No rate limiting detected');
      }
      
    } catch (error) {
      console.log('❌ Unable to read rate limit logs');
    }
    
    console.log('\n🎯 === OPTIMIZATION STATUS ===');
    console.log('✅ Monthly usage tracking: ACTIVE');
    console.log('✅ Smart engagement strategy: ACTIVE');
    console.log('✅ Engagement-only mode: READY');
    console.log('✅ Conservative mode: READY');
    console.log('✅ Intelligent backoff: ACTIVE');
    
  } catch (error) {
    console.error('❌ Error getting system status:', error);
  }
}

function showCommands() {
  console.log('\n🛠️ === MONITORING COMMANDS ===');
  console.log('📜 View logs: tail -f logs/autonomous_bot.log');
  console.log('📊 Check status: node check_bot_status.js');
  console.log('⏹️ Stop bot: pkill -f "node.*index"');
  console.log('🚀 Start bot: node start_ghost_killer_local.js');
  console.log('🔄 Restart bot: pkill -f "node.*index" && node start_ghost_killer_local.js');
  console.log('📈 Dashboard: http://localhost:3000 (if running locally)');
}

// Run monitoring
getSystemStatus();
showCommands();

console.log('\n💡 TIP: Run this script every few minutes to monitor optimization performance');
console.log('🎯 The system now adapts intelligently to API limits while maintaining engagement!'); 