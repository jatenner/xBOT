#!/usr/bin/env npx tsx

/**
 * 🧪 VALIDATION SCRIPT: Diversity & Learning System
 * 
 * Verifies:
 * 1. Topics, angles, tones are truly random (not repeating)
 * 2. Generators are assigned randomly (equal chance)
 * 3. Banned lists are being used (diversity enforcement)
 * 4. Learning systems are tracking performance
 * 5. Performance data is being fed back to generators
 */

import { getSupabaseClient } from '../src/db/index';
import { getDiversityEnforcer } from '../src/intelligence/diversityEnforcer';

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 VALIDATION: Diversity & Learning System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();
  const diversityEnforcer = getDiversityEnforcer();

  // ═══════════════════════════════════════════════════════════
  // TEST 1: Diversity Enforcer - Banned Lists Working?
  // ═══════════════════════════════════════════════════════════
  console.log('📊 TEST 1: Diversity Enforcer (Banned Lists)');
  console.log('─────────────────────────────────────────────\n');

  const [bannedTopics, bannedAngles, bannedTones, bannedFormats] = await Promise.all([
    diversityEnforcer.getLast10Topics(),
    diversityEnforcer.getLast10Angles(),
    diversityEnforcer.getLast10Tones(),
    diversityEnforcer.getLast4FormatStrategies()
  ]);

  console.log(`✅ Banned Topics: ${bannedTopics.length} (should be 0-20)`);
  console.log(`✅ Banned Angles: ${bannedAngles.length} (should be 0-20)`);
  console.log(`✅ Banned Tones: ${bannedTones.length} (should be 0-20)`);
  console.log(`✅ Banned Formats: ${bannedFormats.length} (should be 0-4)\n`);

  // ═══════════════════════════════════════════════════════════
  // TEST 2: Recent Content - Are Topics/Angles/Tones Diverse?
  // ═══════════════════════════════════════════════════════════
  console.log('📊 TEST 2: Content Diversity (Last 20 Posts)');
  console.log('─────────────────────────────────────────────\n');

  const { data: recentContent, error: contentError } = await supabase
    .from('content_metadata')
    .select('raw_topic, angle, tone, generator_name, format_strategy')
    .not('raw_topic', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (contentError) {
    console.error(`❌ Failed to fetch content: ${contentError.message}`);
    return;
  }

  if (!recentContent || recentContent.length === 0) {
    console.log('⚠️  No content found yet (system is new)');
    return;
  }

  // Calculate diversity metrics
  const uniqueTopics = new Set(recentContent.map(c => c.raw_topic).filter(Boolean)).size;
  const uniqueAngles = new Set(recentContent.map(c => c.angle).filter(Boolean)).size;
  const uniqueTones = new Set(recentContent.map(c => c.tone).filter(Boolean)).size;
  const uniqueGenerators = new Set(recentContent.map(c => c.generator_name).filter(Boolean)).size;
  const uniqueFormats = new Set(recentContent.map(c => c.format_strategy).filter(Boolean)).size;

  const topicDiversity = (uniqueTopics / recentContent.length) * 100;
  const angleDiversity = (uniqueAngles / recentContent.length) * 100;
  const toneDiversity = (uniqueTones / recentContent.length) * 100;
  const generatorDiversity = (uniqueGenerators / recentContent.length) * 100;
  const formatDiversity = (uniqueFormats / recentContent.length) * 100;

  console.log(`📝 Total Posts Analyzed: ${recentContent.length}`);
  console.log(`\n🎯 TOPIC DIVERSITY:`);
  console.log(`   Unique: ${uniqueTopics}/${recentContent.length} (${topicDiversity.toFixed(0)}%)`);
  console.log(`   ${topicDiversity >= 80 ? '✅ EXCELLENT' : topicDiversity >= 60 ? '🟡 GOOD' : '🔴 POOR - Too much repetition'}`);

  console.log(`\n📐 ANGLE DIVERSITY:`);
  console.log(`   Unique: ${uniqueAngles}/${recentContent.length} (${angleDiversity.toFixed(0)}%)`);
  console.log(`   ${angleDiversity >= 80 ? '✅ EXCELLENT' : angleDiversity >= 60 ? '🟡 GOOD' : '🔴 POOR - Too much repetition'}`);

  console.log(`\n🎤 TONE DIVERSITY:`);
  console.log(`   Unique: ${uniqueTones}/${recentContent.length} (${toneDiversity.toFixed(0)}%)`);
  console.log(`   ${toneDiversity >= 80 ? '✅ EXCELLENT' : toneDiversity >= 60 ? '🟡 GOOD' : '🔴 POOR - Too much repetition'}`);

  console.log(`\n🎭 GENERATOR DIVERSITY:`);
  console.log(`   Unique: ${uniqueGenerators}/${recentContent.length} (${generatorDiversity.toFixed(0)}%)`);
  console.log(`   Expected: ~${Math.round(100 / 11)}% per generator (11 total)`);
  console.log(`   ${uniqueGenerators >= 8 ? '✅ EXCELLENT - All generators used' : uniqueGenerators >= 5 ? '🟡 GOOD - Most generators used' : '🔴 POOR - Some generators not used'}`);

  console.log(`\n🎨 FORMAT DIVERSITY:`);
  console.log(`   Unique: ${uniqueFormats}/${recentContent.length} (${formatDiversity.toFixed(0)}%)`);
  console.log(`   ${formatDiversity >= 50 ? '✅ EXCELLENT' : formatDiversity >= 30 ? '🟡 GOOD' : '🔴 POOR - Too much repetition'}`);

  // Show generator distribution
  const generatorCounts: Record<string, number> = {};
  for (const post of recentContent) {
    const gen = post.generator_name || 'unknown';
    generatorCounts[gen] = (generatorCounts[gen] || 0) + 1;
  }

  console.log(`\n📊 GENERATOR DISTRIBUTION (Last ${recentContent.length} posts):`);
  const sortedGens = Object.entries(generatorCounts).sort((a, b) => b[1] - a[1]);
  for (const [gen, count] of sortedGens) {
    const percentage = (count / recentContent.length) * 100;
    const expected = (1 / 11) * 100; // 11 generators = ~9% each
    const status = Math.abs(percentage - expected) < 5 ? '✅' : Math.abs(percentage - expected) < 10 ? '🟡' : '🔴';
    console.log(`   ${status} ${gen}: ${count} (${percentage.toFixed(0)}%) - Expected: ~${expected.toFixed(0)}%`);
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 3: Learning System - Is Performance Data Being Tracked?
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n📊 TEST 3: Learning System (Performance Tracking)');
  console.log('─────────────────────────────────────────────\n');

  // Check topic performance tracking
  const { data: topicPerformance, error: topicError } = await supabase
    .from('topic_performance')
    .select('topic, posts_count, avg_engagement_rate, total_followers_gained')
    .order('avg_engagement_rate', { ascending: false })
    .limit(10);

  if (topicError) {
    console.log(`⚠️  Topic performance table not found or error: ${topicError.message}`);
  } else if (!topicPerformance || topicPerformance.length === 0) {
    console.log('⚠️  No topic performance data yet (learning system needs more posts)');
  } else {
    console.log(`✅ Topic Performance Tracking: ${topicPerformance.length} topics tracked`);
    console.log(`\n🏆 TOP 5 PERFORMING TOPICS:`);
    for (let i = 0; i < Math.min(5, topicPerformance.length); i++) {
      const tp = topicPerformance[i];
      console.log(`   ${i + 1}. "${tp.topic}"`);
      console.log(`      Posts: ${tp.posts_count}, ER: ${((tp.avg_engagement_rate || 0) * 100).toFixed(2)}%, Followers: ${tp.total_followers_gained || 0}`);
    }
  }

  // Check generator performance tracking
  const { data: generatorPerformance, error: genError } = await supabase
    .from('generator_performance')
    .select('generator_name, attempts, successes, avg_quality_score')
    .order('avg_quality_score', { ascending: false })
    .limit(11);

  if (genError) {
    console.log(`\n⚠️  Generator performance table not found or error: ${genError.message}`);
  } else if (!generatorPerformance || generatorPerformance.length === 0) {
    console.log(`\n⚠️  No generator performance data yet (learning system needs more posts)`);
  } else {
    console.log(`\n✅ Generator Performance Tracking: ${generatorPerformance.length} generators tracked`);
    console.log(`\n🏆 GENERATOR PERFORMANCE RANKING:`);
    for (let i = 0; i < generatorPerformance.length; i++) {
      const gp = generatorPerformance[i];
      const successRate = gp.attempts > 0 ? (gp.successes / gp.attempts) * 100 : 0;
      console.log(`   ${i + 1}. ${gp.generator_name}`);
      console.log(`      Attempts: ${gp.attempts}, Success: ${successRate.toFixed(0)}%, Quality: ${((gp.avg_quality_score || 0) * 100).toFixed(0)}%`);
    }
  }

  // Check angle performance tracking
  const { data: anglePerformance, error: angleError } = await supabase
    .from('angle_performance')
    .select('angle_pattern, times_used, avg_engagement_rate')
    .order('avg_engagement_rate', { ascending: false })
    .limit(10);

  if (angleError) {
    console.log(`\n⚠️  Angle performance table not found or error: ${angleError.message}`);
  } else if (!anglePerformance || anglePerformance.length === 0) {
    console.log(`\n⚠️  No angle performance data yet (learning system needs more posts)`);
  } else {
    console.log(`\n✅ Angle Performance Tracking: ${anglePerformance.length} angle patterns tracked`);
    console.log(`\n🏆 TOP 5 PERFORMING ANGLES:`);
    for (let i = 0; i < Math.min(5, anglePerformance.length); i++) {
      const ap = anglePerformance[i];
      console.log(`   ${i + 1}. "${ap.angle_pattern}"`);
      console.log(`      Used: ${ap.times_used}x, ER: ${((ap.avg_engagement_rate || 0) * 100).toFixed(2)}%`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 4: Growth Intelligence - Is It Enabled?
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n📊 TEST 4: Growth Intelligence (Learning Feedback)');
  console.log('─────────────────────────────────────────────\n');

  // Check if growthIntelligence is enabled in planJob.ts
  const fs = await import('fs');
  const planJobContent = fs.readFileSync('./src/jobs/planJob.ts', 'utf-8');
  
  const growthIntelEnabled = !planJobContent.includes('growthIntelligence = undefined') || 
                             planJobContent.includes('buildGrowthIntelligencePackage');

  if (growthIntelEnabled && planJobContent.includes('buildGrowthIntelligencePackage')) {
    console.log('✅ Growth Intelligence: ENABLED');
    console.log('   → Generators receive performance feedback');
  } else {
    console.log('⚠️  Growth Intelligence: DISABLED (commented out)');
    console.log('   → Generators do NOT receive performance feedback yet');
    console.log('   → This is expected for early data collection phase');
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 VALIDATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallDiversity = (topicDiversity + angleDiversity + toneDiversity + generatorDiversity) / 4;
  
  console.log(`🎯 OVERALL DIVERSITY SCORE: ${overallDiversity.toFixed(0)}/100`);
  console.log(`   ${overallDiversity >= 80 ? '✅ EXCELLENT - Maximum variety' : overallDiversity >= 60 ? '🟡 GOOD - Strong variety' : '🔴 NEEDS IMPROVEMENT - Too much repetition'}`);

  console.log(`\n🎲 GENERATOR RANDOMNESS: ${uniqueGenerators >= 8 ? '✅ EXCELLENT' : uniqueGenerators >= 5 ? '🟡 GOOD' : '🔴 POOR'}`);
  console.log(`   → All 11 generators should be used roughly equally`);

  console.log(`\n🧠 LEARNING SYSTEM: ${topicPerformance && topicPerformance.length > 0 ? '✅ ACTIVE' : '⚠️  NEEDS MORE DATA'}`);
  console.log(`   → Performance tracking requires 10+ posts with outcomes`);

  console.log(`\n📊 GROWTH INTELLIGENCE: ${growthIntelEnabled ? '✅ ENABLED' : '⚠️  DISABLED (Expected for data collection)'}`);
  console.log(`   → Will be enabled after 200+ posts (Week 3)`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

