const { PostTweetAgent } = require('./dist/agents/postTweet');
const { EngagementMaximizerAgent } = require('./dist/agents/engagementMaximizerAgent');

async function demonstrateEngagementBot() {
  console.log('🚀 === ENGAGEMENT MAXIMIZATION BOT DEMO ===');
  console.log('🎯 Demonstrating VIRAL content generation for maximum reach\n');

  try {
    const engagementMaximizer = new EngagementMaximizerAgent();
    
    console.log('📊 === ENGAGEMENT ANALYSIS MODE ===');
    console.log('⚡ Analyzing viral patterns and engagement triggers...\n');

    // Generate multiple viral content examples
    const viralExamples = [];
    
    for (let i = 1; i <= 5; i++) {
      console.log(`🎯 Generating Viral Content Example ${i}:`);
      const result = await engagementMaximizer.generateMaxEngagementTweet();
      
      viralExamples.push(result);
      
      console.log(`📝 Content: "${result.content}"`);
      console.log(`📈 Predicted Engagement: ${result.predicted_engagement}%`);
      console.log(`🔥 Tactics: ${result.tactics_used.join(', ')}`);
      console.log(`⚡ Strategy: ${result.strategy}\n`);
    }

    // Show engagement tactics analysis
    console.log('🧠 === ENGAGEMENT TACTICS ANALYSIS ===');
    
    const allTactics = viralExamples.flatMap(ex => ex.tactics_used);
    const tacticCounts = {};
    allTactics.forEach(tactic => {
      tacticCounts[tactic] = (tacticCounts[tactic] || 0) + 1;
    });

    console.log('🏆 Most Used Viral Tactics:');
    Object.entries(tacticCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([tactic, count]) => {
        console.log(`   - ${tactic}: Used ${count} times`);
      });

    const avgEngagement = viralExamples.reduce((sum, ex) => sum + ex.predicted_engagement, 0) / viralExamples.length;
    console.log(`\n📊 Average Predicted Engagement: ${avgEngagement.toFixed(1)}%`);

    // Showcase viral pattern examples
    console.log('\n🔥 === VIRAL PATTERN SHOWCASE ===');
    
    const patterns = [
      {
        name: 'Contrarian Hot Take',
        example: '🤔 HOT TAKE: AI diagnosis isn\'t replacing doctors—it\'s making them lazy. Change my mind. 🧠'
      },
      {
        name: 'Shocking Statistic',
        example: '🚨 SHOCKING: AI can detect depression from your typing speed with 87% accuracy. Are we ready for this? 🤖'
      },
      {
        name: 'Future Prediction',
        example: '🔮 2025 PREDICTION: Your AI health assistant will know you\'re sick before you do. Screenshot this. 📸'
      },
      {
        name: 'Curiosity Gap',
        example: '💀 REALITY: What Big Tech doesn\'t want you to know about health AI... (Thread below) 🧵'
      },
      {
        name: 'Debate Starter',
        example: '⚡ CONTROVERSIAL: Digital therapeutics will replace therapy. Fight me. 🥊 #MentalHealth'
      }
    ];

    patterns.forEach((pattern, index) => {
      console.log(`${index + 1}. ${pattern.name}:`);
      console.log(`   "${pattern.example}"\n`);
    });

    console.log('🚀 === SYSTEM CAPABILITIES SUMMARY ===');
    console.log('✅ Real-time viral pattern recognition');
    console.log('✅ Psychological trigger optimization');
    console.log('✅ A/B testing for maximum engagement');
    console.log('✅ Controversy generation with safety limits');
    console.log('✅ Trend hijacking for viral reach');
    console.log('✅ Curiosity gap creation');
    console.log('✅ Social proof integration');
    console.log('✅ Urgency and FOMO tactics');

    console.log('\n🎯 === ENGAGEMENT OPTIMIZATION ACTIVE ===');
    console.log('💥 Bot is now optimized for MAXIMUM VIRAL REACH');
    console.log('🚀 Every tweet designed for engagement explosion');
    console.log('📈 Predicted engagement boost: 2-3x normal rates');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

demonstrateEngagementBot(); 