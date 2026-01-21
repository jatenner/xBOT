#!/usr/bin/env tsx
/**
 * 🎭 SHADOW CONTROLLER - ONE TIME RUN
 * 
 * Generates a single shadow plan (for testing)
 */

import 'dotenv/config';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🎭 SHADOW CONTROLLER (ONE TIME)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const { generateShadowPlan } = await import('../../src/jobs/shadowControllerJob');
    const plan = await generateShadowPlan();
    
    console.log('\n✅ Shadow plan generated!');
    console.log(`\n📊 Recommendations:`);
    console.log(`   Posts/Hour: ${plan.posts_per_hour_recommendation}`);
    console.log(`   Replies/Hour: ${plan.replies_per_hour_recommendation}`);
    console.log(`   Exploration Rate: ${(plan.exploration_rate * 100).toFixed(0)}%`);
    console.log(`\n💡 Explanation: ${plan.explanation}`);
    
    if (plan.strategy_weights.top_topics.length > 0) {
      console.log(`\n📈 Top Topics:`);
      plan.strategy_weights.top_topics.forEach(t => {
        console.log(`   - ${t.topic}: ${(t.weight * 100).toFixed(1)}%`);
      });
    }
    
    if (plan.strategy_weights.top_formats.length > 0) {
      console.log(`\n📝 Top Formats:`);
      plan.strategy_weights.top_formats.forEach(f => {
        console.log(`   - ${f.format}: ${(f.weight * 100).toFixed(1)}%`);
      });
    }
    
    if (plan.strategy_weights.top_generators.length > 0) {
      console.log(`\n🎭 Top Generators:`);
      plan.strategy_weights.top_generators.forEach(g => {
        console.log(`   - ${g.generator}: ${(g.weight * 100).toFixed(1)}%`);
      });
    }
    
    console.log(`\n📄 Report updated: docs/GROWTH_SHADOW_CONTROLLER_REPORT.md`);
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
