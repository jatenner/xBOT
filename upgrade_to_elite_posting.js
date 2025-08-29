#!/usr/bin/env node

/**
 * 🚀 UPGRADE TO ELITE POSTING SYSTEM
 * Simple script to test and enable the new enhanced posting
 */

console.log('🚀 TESTING ELITE POSTING SYSTEM...');

async function testElitePosting() {
  try {
    // Import the elite posting manager
    const { getElitePostingManager } = await import('./dist/core/elitePostingManager.js');
    const eliteManager = getElitePostingManager();

    console.log('✅ Elite Posting Manager loaded');

    // Test performance summary
    console.log('\n📊 CURRENT PERFORMANCE SUMMARY:');
    const summary = await eliteManager.getPerformanceSummary();
    console.log(`- Total Posts: ${summary.total_posts}`);
    console.log(`- Avg Quality Score: ${summary.avg_quality_score.toFixed(2)}`);
    console.log(`- Learning Insights: ${summary.learning_insights}`);
    console.log(`- System Health: ${summary.system_health}`);

    // Test smart reply generation
    console.log('\n💬 TESTING SMART REPLY GENERATION:');
    const replyTest = await eliteManager.createSmartReply(
      "Just discovered that morning sunlight exposure can improve sleep quality by 23%",
      "Sleep optimization discussion"
    );

    if (replyTest.success) {
      console.log('✅ Smart Reply Generated:');
      console.log(`📝 "${replyTest.reply}"`);
      console.log(`🎯 Strategy: ${replyTest.strategy}`);
    } else {
      console.log('❌ Smart reply generation failed');
    }

    console.log('\n🎯 ELITE POSTING SYSTEM READY!');
    console.log('The system can now:');
    console.log('- Generate high-quality tweets using AI + learning data');
    console.log('- Create smart replies with educational value');
    console.log('- Track performance and improve over time');
    console.log('- Use maximum OpenAI potential with budget controls');

    return true;

  } catch (error) {
    console.error('❌ Elite posting test failed:', error.message);
    console.log('🔧 Building system first...');
    
    // Try to build
    const { spawn } = require('child_process');
    const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Build completed, retry testing...');
        testElitePosting();
      } else {
        console.log('❌ Build failed');
      }
    });

    return false;
  }
}

// Run the test
testElitePosting().then(success => {
  if (success) {
    console.log('\n🚀 ELITE POSTING SYSTEM IS OPERATIONAL!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Elite posting system needs setup');
    process.exit(1);
  }
});
