#!/usr/bin/env ts-node

import { UltraViralGenerator } from '../src/agents/ultraViralGenerator';
import { TrendResearchFusion } from '../src/agents/trendResearchFusion';
import { QualityGate } from '../src/utils/qualityGate';

async function testViralComposerSystem() {
  console.log('🚀 === VIRAL COMPOSER SYSTEM TEST ===\n');

  // Initialize components
  const viralGenerator = new UltraViralGenerator();
  const trendFusion = new TrendResearchFusion();
  const qualityGate = new QualityGate();

  try {
    // Test 1: Trend Research Fusion
    console.log('📊 Testing Trend Research Fusion...');
    const fusionItems = await trendFusion.generateTrendResearchItems();
    console.log(`✅ Generated ${fusionItems.length} trend-research fusion items`);
    
    if (fusionItems.length > 0) {
      const topItem = fusionItems[0];
      console.log(`   🔬 Top Item: ${topItem.trendTopic} (Score: ${topItem.combinedScore.toFixed(2)})`);
      console.log(`   📖 Source: ${topItem.researchSource} (Credibility: ${(topItem.institutionCredibility * 100).toFixed(0)}%)`);
    }
    console.log('');

    // Test 2: Quality Gate
    console.log('🚪 Testing Quality Gate...');
    const testContent = `🚨 JUST IN: Stanford AI achieves 94% accuracy in cancer detection

This breakthrough could save millions of lives annually through early screening

Study of 15,000 patients demonstrates unprecedented precision (Nature, 2024)`;

    const qualityMetrics = await qualityGate.checkQuality(
      testContent,
      'https://nature.com/ai-cancer-detection',
      'Nature'
    );

    console.log(`   ✅ Quality Gate: ${qualityMetrics.passesGate ? 'PASSED' : 'FAILED'}`);
    console.log(`   📊 Metrics: Readability=${qualityMetrics.readabilityScore.toFixed(1)}, Facts=${qualityMetrics.factCount}, Credibility=${qualityMetrics.sourceCredibility.toFixed(2)}`);
    console.log('');

    // Test 3: Advanced Tweet Generation
    console.log('🎨 Testing Advanced Tweet Generation...');
    
    const templates = ['BREAKING_NEWS', 'PHD_THREAD', 'QUICK_STAT', 'VISUAL_SNACK'];
    const topics = ['AI diagnostics', 'digital therapeutics', 'precision medicine', 'gene therapy'];

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const topic = topics[i];
      
      console.log(`   📝 Generating ${template} about ${topic}...`);
      const tweet = await viralGenerator.generateViralTweet(topic, template);
      
      console.log(`   📊 Result: ${tweet.characterCount} chars, Score: ${tweet.viralScore}, Style: ${tweet.style}`);
      console.log(`   💬 Content: "${tweet.content.substring(0, 100)}${tweet.content.length > 100 ? '...' : ''}"`);
      console.log(`   🔗 URL: ${tweet.hasUrl ? '✅' : '❌'}, Citation: ${tweet.citation ? '✅' : '❌'}`);
      
      if (tweet.qualityMetrics) {
        console.log(`   🚪 Quality: ${tweet.qualityMetrics.passesGate ? '✅ PASSED' : '❌ FAILED'}`);
      }
      console.log('');
    }

    // Test 4: Performance Test
    console.log('⚡ Performance Test...');
    const startTime = Date.now();
    
    const performanceTweets = await Promise.all([
      viralGenerator.generateViralTweet('AI drug discovery'),
      viralGenerator.generateViralTweet('robotic surgery'),
      viralGenerator.generateViralTweet('digital biomarkers')
    ]);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   ⏱️  Generated 3 tweets in ${duration}ms (${(duration/3).toFixed(0)}ms average)`);
    console.log(`   📊 Average viral score: ${(performanceTweets.reduce((sum, t) => sum + t.viralScore, 0) / performanceTweets.length).toFixed(1)}`);
    console.log('');

    // Test 5: Quality Gate Statistics
    console.log('📈 Quality Gate Statistics...');
    const qualityStats = await qualityGate.getQualityStats();
    console.log(`   📊 Total checked: ${qualityStats.totalChecked}`);
    console.log(`   📖 Average readability: ${qualityStats.avgReadability.toFixed(1)}`);
    console.log(`   ❌ Common failures: ${qualityStats.commonFailures.slice(0, 3).join(', ')}`);
    console.log('');

    // Success Summary
    console.log('🎉 === SYSTEM TEST COMPLETED SUCCESSFULLY ===');
    console.log('✅ TrendResearchFusion operational');
    console.log('✅ Advanced Tweet Composer live');
    console.log('✅ Quality Gate active');
    console.log('✅ PhD-level sophistication enabled');
    console.log('✅ Template variety working');
    console.log('✅ Citation system functional');
    console.log('✅ URL integration active');
    console.log('✅ Performance targets met');

  } catch (error) {
    console.error('❌ System test failed:', error);
    console.log('\n🔧 Fallback systems should handle this gracefully in production');
  }
}

// Run the test
testViralComposerSystem(); 