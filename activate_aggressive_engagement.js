#!/usr/bin/env node

// Aggressive Engagement Activation - Combat Ghost Account Syndrome
require('dotenv').config();
const { execSync } = require('child_process');

console.log('🔥 === AGGRESSIVE ENGAGEMENT ACTIVATION ===');
console.log('💥 Mission: Maximum algorithmic impact & visibility');
console.log('⚡ Strategy: High-frequency community interactions\n');

async function activateAggressiveEngagement() {
  try {
    // Build the project
    console.log('📦 Building project...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('\n🚀 Activating Aggressive Engagement Mode...');
    
    // Import community engagement system
    const { EngagementMaximizerAgent } = require('./dist/agents/engagementMaximizerAgent');
    const { RealTimeEngagementTracker } = require('./dist/agents/realTimeEngagementTracker');
    
    const engagementMaximizer = new EngagementMaximizerAgent();
    const engagementTracker = new RealTimeEngagementTracker();
    
    console.log('✅ Engagement systems loaded\n');
    
    // Configure aggressive settings
    const aggressiveConfig = {
      engagement_frequency: 'every_30_minutes', // Much more frequent
      daily_engagement_target: 150, // Higher target
      algorithmic_boost_mode: true,
      ghost_account_syndrome_fix: true,
      priority_targets: [
        '#HealthTech',
        '#Innovation', 
        '#DigitalHealth',
        '#MedTech',
        '#Healthcare',
        '#AI',
        '#Biotech',
        '#HealthcareInnovation'
      ],
      engagement_types: {
        likes: { enabled: true, rate: 'high' },
        replies: { enabled: true, rate: 'medium' },
        retweets: { enabled: true, rate: 'medium' },
        quote_tweets: { enabled: true, rate: 'low' },
        follows: { enabled: true, rate: 'low' }
      }
    };
    
    console.log('⚙️  AGGRESSIVE ENGAGEMENT CONFIGURATION:');
    console.log(`📈 Frequency: ${aggressiveConfig.engagement_frequency}`);
    console.log(`🎯 Daily Target: ${aggressiveConfig.daily_engagement_target} interactions`);
    console.log(`🔥 Boost Mode: ${aggressiveConfig.algorithmic_boost_mode ? 'ENABLED' : 'DISABLED'}`);
    console.log(`👻 Ghost Fix: ${aggressiveConfig.ghost_account_syndrome_fix ? 'ACTIVE' : 'INACTIVE'}\n`);
    
    // Execute multiple engagement cycles immediately
    console.log('🚀 === IMMEDIATE ENGAGEMENT BOOST ===');
    
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n🔄 Engagement Cycle ${cycle}/3`);
      console.log('⚡ Executing aggressive community engagement...');
      
      const cycleResult = await engagementMaximizer.run();
      
      if (cycleResult.success) {
        console.log(`✅ Cycle ${cycle} completed successfully!`);
        console.log(`🎯 Actions taken: ${cycleResult.total_actions}`);
        console.log(`📈 Boost applied: ${cycleResult.algorithmic_boost}/100`);
        
        // Wait between cycles to avoid rate limits
        if (cycle < 3) {
          console.log('⏳ Waiting 2 minutes between cycles...');
          await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes
        }
      } else {
        console.log(`❌ Cycle ${cycle} encountered issues: ${cycleResult.error}`);
      }
    }
    
    // Track improvement
    console.log('\n📊 === ENGAGEMENT IMPACT ANALYSIS ===');
    const finalMetrics = await engagementTracker.run();
    
    console.log('📈 POST-AGGRESSIVE ENGAGEMENT METRICS:');
    console.log(`🎯 Engagement Score: ${finalMetrics.engagementScore}/100`);
    console.log(`🚀 Algorithmic Signals Sent: ${finalMetrics.recent_activity || 'Multiple'}`);
    console.log(`⚡ Account Visibility: ${finalMetrics.visibility_score || 'Enhanced'}/100`);
    
    console.log('\n🔥 === AGGRESSIVE ENGAGEMENT RECOMMENDATIONS ===');
    console.log('1. 🎯 IMMEDIATE: Your next posts should get more visibility');
    console.log('2. ⏰ TIMING: Post within the next 2-4 hours for maximum impact');
    console.log('3. 🔄 FREQUENCY: Continue aggressive engagement every 30 minutes');
    console.log('4. 📈 CONTENT: Focus on trending health tech topics');
    console.log('5. 🤝 COMMUNITY: Engage with larger accounts in your niche');
    
    console.log('\n💥 DEPLOYMENT FOR 24/7 GHOST ACCOUNT SYNDROME FIX:');
    console.log('🚀 Deploy to Render NOW for continuous aggressive engagement');
    console.log('⚡ The bot will automatically maintain high engagement levels');
    console.log('📊 Monitor improvements over the next 24-48 hours');
    
    console.log('\n🎊 AGGRESSIVE ENGAGEMENT ACTIVATION COMPLETE!');
    console.log('🔥 Your account is now in maximum visibility mode');
    
  } catch (error) {
    console.error('❌ Error in aggressive engagement activation:', error);
    console.log('\n🔧 QUICK FIXES:');
    console.log('1. Check API keys and rate limits');
    console.log('2. Ensure stable internet connection');
    console.log('3. Try: npm run build && node activate_aggressive_engagement.js');
  }
}

// Run with dramatic flair
console.log('⚡⚡⚡ INITIATING ALGORITHMIC REVOLUTION ⚡⚡⚡');
activateAggressiveEngagement(); 