#!/usr/bin/env tsx
/**
 * Analyze if we have enough VI data to learn from
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function analyzeVISufficiency() {
  const supabase = getSupabaseClient();

  console.log('🔍 Analyzing VI data sufficiency for learning...\n');

  try {
    // Get pattern intelligence count
    const { count: patternCount, error: patternError } = await supabase
      .from('vi_format_intelligence')
      .select('*', { count: 'exact', head: true });

    if (patternError) throw patternError;

    // Get pattern breakdown by confidence
    const { data: patterns, error: patternsError } = await supabase
      .from('vi_format_intelligence')
      .select('confidence_level, based_on_count, topic, angle, tone, structure');

    if (patternsError) throw patternsError;

    // Analyze classification diversity
    const { data: classifications, error: classError } = await supabase
      .from('vi_content_classification')
      .select('topic, angle, tone, structure, topic_confidence');

    if (classError) throw classError;

    // Count unique combinations
    const topicSet = new Set<string>();
    const angleSet = new Set<string>();
    const toneSet = new Set<string>();
    const structureSet = new Set<string>();
    const combinationMap = new Map<string, number>();

    (classifications || []).forEach((c: any) => {
      if (c.topic) topicSet.add(c.topic);
      if (c.angle) angleSet.add(c.angle);
      if (c.tone) toneSet.add(c.tone);
      if (c.structure) structureSet.add(c.structure);
      
      const combo = `${c.topic || 'unknown'}|${c.angle || 'unknown'}|${c.tone || 'unknown'}|${c.structure || 'unknown'}`;
      combinationMap.set(combo, (combinationMap.get(combo) || 0) + 1);
    });

    // High-confidence classifications
    const highConfidence = (classifications || []).filter((c: any) => 
      (c.topic_confidence || 0) >= 0.7
    ).length;

    // Pattern quality analysis
    const highConfPatterns = (patterns || []).filter((p: any) => 
      p.confidence_level === 'high'
    ).length;
    const mediumConfPatterns = (patterns || []).filter((p: any) => 
      p.confidence_level === 'medium'
    ).length;
    const lowConfPatterns = (patterns || []).filter((p: any) => 
      p.confidence_level === 'low'
    ).length;

    // Patterns with sufficient data
    const sufficientDataPatterns = (patterns || []).filter((p: any) => 
      (p.based_on_count || 0) >= 50
    ).length;

    // Get engagement distribution
    const { data: engagementData, error: engError } = await supabase
      .from('vi_collected_tweets')
      .select('engagement_rate, views')
      .gt('views', 0)
      .gt('engagement_rate', 0);

    if (engError) throw engError;

    const engagementRates = (engagementData || []).map((e: any) => e.engagement_rate || 0);
    const avgER = engagementRates.length > 0 
      ? engagementRates.reduce((a: number, b: number) => a + b, 0) / engagementRates.length 
      : 0;
    const highERTweets = engagementRates.filter((er: number) => er >= 0.05).length; // 5%+ ER

    // Calculate coverage
    const totalPossibleCombinations = topicSet.size * angleSet.size * toneSet.size * structureSet.size;
    const coveredCombinations = combinationMap.size;
    const coveragePercent = totalPossibleCombinations > 0 
      ? (coveredCombinations / totalPossibleCombinations) * 100 
      : 0;

    console.log('📊 DATA SUFFICIENCY ANALYSIS\n');
    console.log('=== CURRENT STATE ===');
    console.log(`Total tweets: 1,067`);
    console.log(`Unique topics: ${topicSet.size}`);
    console.log(`Unique angles: ${angleSet.size}`);
    console.log(`Unique tones: ${toneSet.size}`);
    console.log(`Unique structures: ${structureSet.size}`);
    console.log(`Unique combinations: ${coveredCombinations}`);
    console.log(`High-confidence classifications: ${highConfidence} (${Math.round((highConfidence / (classifications?.length || 1)) * 100)}%)\n`);

    console.log('=== PATTERN INTELLIGENCE ===');
    console.log(`Total patterns built: ${patternCount}`);
    console.log(`High confidence: ${highConfPatterns}`);
    console.log(`Medium confidence: ${mediumConfPatterns}`);
    console.log(`Low confidence: ${lowConfPatterns}`);
    console.log(`Patterns with 50+ samples: ${sufficientDataPatterns}\n`);

    console.log('=== DATA QUALITY ===');
    console.log(`Average engagement rate: ${(avgER * 100).toFixed(2)}%`);
    console.log(`High-performing tweets (5%+ ER): ${highERTweets} (${Math.round((highERTweets / (engagementData?.length || 1)) * 100)}%)\n`);

    console.log('=== COVERAGE ANALYSIS ===');
    console.log(`Topic coverage: ${topicSet.size} unique topics`);
    console.log(`Combination coverage: ${coveredCombinations} / ${totalPossibleCombinations} (${coveragePercent.toFixed(1)}%)\n`);

    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');
    
    const needsMoreData = patternCount < 50 || highConfPatterns < 20 || sufficientDataPatterns < 30;
    const needsMoreDiversity = topicSet.size < 10 || coveredCombinations < 50;
    const needsMoreHighQuality = highERTweets < 200;

    if (needsMoreData) {
      console.log('⚠️  NEED MORE DATA FOR PATTERNS:');
      console.log('   - Target: 50+ patterns with high/medium confidence');
      console.log('   - Current: Only building patterns from limited combinations');
      console.log('   - Action: Continue collecting for 2-3 more weeks\n');
    }

    if (needsMoreDiversity) {
      console.log('⚠️  NEED MORE DIVERSITY:');
      console.log('   - Target: 15+ topics, 100+ unique combinations');
      console.log('   - Current: Limited topic/angle/tone coverage');
      console.log('   - Action: Expand scrape targets to more niche accounts\n');
    }

    if (needsMoreHighQuality) {
      console.log('⚠️  NEED MORE HIGH-PERFORMING EXAMPLES:');
      console.log('   - Target: 200+ tweets with 5%+ engagement rate');
      console.log('   - Current: Limited high-ER examples for learning');
      console.log('   - Action: Focus scraping on viral accounts\n');
    }

    if (!needsMoreData && !needsMoreDiversity && !needsMoreHighQuality) {
      console.log('✅ DATA SUFFICIENT FOR LEARNING:');
      console.log('   - Good pattern coverage');
      console.log('   - Sufficient high-confidence patterns');
      console.log('   - Adequate diversity across topics/angles/tones');
      console.log('   - Can start applying patterns to content generation\n');
    } else {
      console.log('📈 RECOMMENDED COLLECTION TARGETS:');
      console.log(`   - Continue to ~2,000-3,000 tweets for robust patterns`);
      console.log(`   - Focus on accounts with proven viral content`);
      console.log(`   - Prioritize diverse topics and angles`);
      console.log(`   - Target: 100+ high-confidence patterns\n`);
    }

  } catch (error: any) {
    console.error('❌ Error analyzing data:', error.message);
    process.exit(1);
  }
}

analyzeVISufficiency();





