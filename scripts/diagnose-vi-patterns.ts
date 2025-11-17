#!/usr/bin/env tsx
/**
 * Diagnose why no VI patterns are being built
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function diagnoseVIPatterns() {
  const supabase = getSupabaseClient();

  console.log('🔍 Diagnosing VI pattern building...\n');

  try {
    // Check if tweets have both classification AND visual formatting
    const { data: readyTweets, error: readyError } = await supabase
      .from('vi_collected_tweets')
      .select('tweet_id, classified, analyzed')
      .eq('classified', true)
      .eq('analyzed', true)
      .limit(100);

    if (readyError) throw readyError;

    console.log(`✅ Tweets with both classification AND analysis: ${readyTweets?.length || 0}\n`);

    // Check combinations that could build patterns
    const { data: combos, error: comboError } = await supabase
      .from('vi_content_classification')
      .select('topic, angle, tone, structure, tweet_id')
      .gte('topic_confidence', 0.6);

    if (comboError) throw comboError;

    // Get analyzed tweet IDs
    const { data: analyzedTweets, error: analyzedError } = await supabase
      .from('vi_collected_tweets')
      .select('tweet_id')
      .eq('analyzed', true);

    if (analyzedError) throw analyzedError;
    const analyzedIds = new Set((analyzedTweets || []).map((t: any) => t.tweet_id));

    // Count tweets per combination (only if analyzed)
    const comboMap = new Map<string, number>();
    (combos || []).forEach((c: any) => {
      if (analyzedIds.has(c.tweet_id)) {
        const key = `${c.topic}|${c.angle || 'null'}|${c.tone || 'null'}|${c.structure || 'null'}`;
        comboMap.set(key, (comboMap.get(key) || 0) + 1);
      }
    });

    // Find combinations with 5+ tweets (minimum for pattern building)
    const viableCombos = Array.from(comboMap.entries())
      .filter(([_, count]) => count >= 5)
      .sort((a, b) => b[1] - a[1]);

    console.log('📊 COMBINATION ANALYSIS:\n');
    console.log(`Total unique combinations: ${comboMap.size}`);
    console.log(`Combinations with 5+ tweets (viable for patterns): ${viableCombos.length}\n`);

    if (viableCombos.length > 0) {
      console.log('🔥 TOP 10 VIABLE COMBINATIONS:\n');
      viableCombos.slice(0, 10).forEach(([combo, count], idx) => {
        const [topic, angle, tone, structure] = combo.split('|');
        console.log(`${idx + 1}. ${topic} | ${angle} | ${tone} | ${structure}`);
        console.log(`   Count: ${count} tweets (ready for pattern building)\n`);
      });
    } else {
      console.log('⚠️  NO VIABLE COMBINATIONS FOUND');
      console.log('   Need at least 5 tweets per combination to build patterns\n');
    }

    // Check if pattern building job is enabled
    const viEnabled = process.env.VISUAL_INTELLIGENCE_ENABLED === 'true';
    console.log(`🔧 SYSTEM STATUS:`);
    console.log(`   VISUAL_INTELLIGENCE_ENABLED: ${viEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n`);

    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');
    
    if (!viEnabled) {
      console.log('1. ⚠️  Enable VI system:');
      console.log('   Set VISUAL_INTELLIGENCE_ENABLED=true in .env\n');
    }

    if (viableCombos.length === 0) {
      console.log('2. ⚠️  Need more data per combination:');
      console.log('   - Current: Most combinations have < 5 tweets');
      console.log('   - Target: 5+ tweets per combination for pattern building');
      console.log('   - Action: Continue collecting for 1-2 more weeks\n');
    } else {
      console.log('2. ✅ Ready to build patterns:');
      console.log(`   - ${viableCombos.length} combinations ready`);
      console.log('   - Pattern building should run automatically');
      console.log('   - Check if viProcessor.buildIntelligence() is being called\n');
    }

    if ((readyTweets?.length || 0) < 50) {
      console.log('3. ⚠️  Need more analyzed tweets:');
      console.log(`   - Current: ${readyTweets?.length || 0} tweets fully processed`);
      console.log('   - Target: 200+ tweets with both classification and analysis');
      console.log('   - Action: Ensure analysis job is running\n');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

diagnoseVIPatterns();

