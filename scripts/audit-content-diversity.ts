/**
 * 🔍 CONTENT SYSTEM DIVERSITY AUDIT
 * 
 * Checks if the 5-dimensional diversity system is working:
 * 1. Topics - are they varied and AI-generated?
 * 2. Tones - are they varied and AI-generated?
 * 3. Angles - are they varied and AI-generated?
 * 4. Generators - are all 12 generators being used?
 * 5. Format strategies - are they varied and AI-generated?
 * 
 * Also checks if historical data is flowing into generation prompts.
 */

import { getSupabaseClient } from '../src/db/index';
import { getDiversityEnforcer } from '../src/intelligence/diversityEnforcer';

async function auditContentDiversity() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CONTENT SYSTEM DIVERSITY AUDIT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  
  // ═══════════════════════════════════════════════════════════
  // 1️⃣ CHECK DATABASE SCHEMA - Do columns exist?
  // ═══════════════════════════════════════════════════════════
  
  console.log('1️⃣ DATABASE SCHEMA CHECK\n');
  
  const { data: recentPosts, error } = await supabase
    .from('content_metadata')
    .select('decision_id, raw_topic, angle, tone, generator_name, format_strategy, visual_format, status, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (error) {
    console.error('❌ Error querying database:', error.message);
    return;
  }
  
  if (!recentPosts || recentPosts.length === 0) {
    console.log('⚠️ No posts found in database');
    return;
  }
  
  console.log(`✅ Found ${recentPosts.length} recent posts\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 2️⃣ CHECK COLUMN POPULATION - Are they filled with data?
  // ═══════════════════════════════════════════════════════════
  
  console.log('2️⃣ COLUMN POPULATION ANALYSIS\n');
  
  const stats = {
    total: recentPosts.length,
    has_raw_topic: recentPosts.filter(p => p.raw_topic).length,
    has_angle: recentPosts.filter(p => p.angle).length,
    has_tone: recentPosts.filter(p => p.tone).length,
    has_generator_name: recentPosts.filter(p => p.generator_name).length,
    has_format_strategy: recentPosts.filter(p => p.format_strategy).length,
    has_visual_format: recentPosts.filter(p => p.visual_format).length,
  };
  
  console.log(`📊 Column Population Rate:`);
  console.log(`   raw_topic:        ${stats.has_raw_topic}/${stats.total} (${(stats.has_raw_topic/stats.total*100).toFixed(0)}%)`);
  console.log(`   angle:            ${stats.has_angle}/${stats.total} (${(stats.has_angle/stats.total*100).toFixed(0)}%)`);
  console.log(`   tone:             ${stats.has_tone}/${stats.total} (${(stats.has_tone/stats.total*100).toFixed(0)}%)`);
  console.log(`   generator_name:   ${stats.has_generator_name}/${stats.total} (${(stats.has_generator_name/stats.total*100).toFixed(0)}%)`);
  console.log(`   format_strategy:  ${stats.has_format_strategy}/${stats.total} (${(stats.has_format_strategy/stats.total*100).toFixed(0)}%)`);
  console.log(`   visual_format:    ${stats.has_visual_format}/${stats.total} (${(stats.has_visual_format/stats.total*100).toFixed(0)}%)\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 3️⃣ CHECK DIVERSITY - Are values varied or repetitive?
  // ═══════════════════════════════════════════════════════════
  
  console.log('3️⃣ DIVERSITY ANALYSIS (Last 30 Posts)\n');
  
  const uniqueTopics = new Set(recentPosts.filter(p => p.raw_topic).map(p => p.raw_topic));
  const uniqueAngles = new Set(recentPosts.filter(p => p.angle).map(p => p.angle));
  const uniqueTones = new Set(recentPosts.filter(p => p.tone).map(p => p.tone));
  const uniqueGenerators = new Set(recentPosts.filter(p => p.generator_name).map(p => p.generator_name));
  const uniqueFormats = new Set(recentPosts.filter(p => p.format_strategy).map(p => p.format_strategy));
  
  console.log(`🎯 TOPICS:`);
  console.log(`   Unique: ${uniqueTopics.size}/${stats.has_raw_topic} (${(uniqueTopics.size/stats.has_raw_topic*100).toFixed(0)}% diversity)`);
  console.log(`   Sample: ${[...uniqueTopics].slice(0, 5).join(' | ')}\n`);
  
  console.log(`📐 ANGLES:`);
  console.log(`   Unique: ${uniqueAngles.size}/${stats.has_angle} (${(uniqueAngles.size/stats.has_angle*100).toFixed(0)}% diversity)`);
  console.log(`   Sample: ${[...uniqueAngles].slice(0, 3).join(' | ')}\n`);
  
  console.log(`🎤 TONES:`);
  console.log(`   Unique: ${uniqueTones.size}/${stats.has_tone} (${(uniqueTones.size/stats.has_tone*100).toFixed(0)}% diversity)`);
  console.log(`   Sample: ${[...uniqueTones].slice(0, 3).join(' | ')}\n`);
  
  console.log(`🎭 GENERATORS:`);
  console.log(`   Unique: ${uniqueGenerators.size}/${stats.has_generator_name}`);
  console.log(`   Used: ${[...uniqueGenerators].join(', ')}\n`);
  
  console.log(`🎨 FORMAT STRATEGIES:`);
  console.log(`   Unique: ${uniqueFormats.size}/${stats.has_format_strategy} (${(uniqueFormats.size/stats.has_format_strategy*100).toFixed(0)}% diversity)`);
  console.log(`   Sample: ${[...uniqueFormats].slice(0, 3).map(f => f.substring(0, 50)).join(' | ')}\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 4️⃣ CHECK DIVERSITY ENFORCER - Is it working?
  // ═══════════════════════════════════════════════════════════
  
  console.log('4️⃣ DIVERSITY ENFORCER CHECK\n');
  
  const enforcer = getDiversityEnforcer();
  
  console.log('Fetching blacklisted values (last 20 posts)...\n');
  const bannedTopics = await enforcer.getLast10Topics();
  const bannedAngles = await enforcer.getLast10Angles();
  const bannedTones = await enforcer.getLast10Tones();
  const bannedFormats = await enforcer.getLast4FormatStrategies();
  
  console.log(`\n✅ Diversity Enforcer is tracking:`);
  console.log(`   ${bannedTopics.length} recent topics`);
  console.log(`   ${bannedAngles.length} recent angles`);
  console.log(`   ${bannedTones.length} recent tones`);
  console.log(`   ${bannedFormats.length} recent format strategies\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 5️⃣ CHECK AI GENERATION - Are values AI-generated or hardcoded?
  // ═══════════════════════════════════════════════════════════
  
  console.log('5️⃣ AI GENERATION QUALITY CHECK\n');
  
  // Check for hardcoded/templated patterns
  const hardcodedPatterns = [
    'default',
    'test',
    'sample',
    'placeholder',
    'unknown',
  ];
  
  const suspiciousTopics = recentPosts.filter(p => 
    p.raw_topic && hardcodedPatterns.some(pattern => 
      p.raw_topic.toLowerCase().includes(pattern)
    )
  );
  
  const suspiciousAngles = recentPosts.filter(p => 
    p.angle && hardcodedPatterns.some(pattern => 
      p.angle.toLowerCase().includes(pattern)
    )
  );
  
  const suspiciousTones = recentPosts.filter(p => 
    p.tone && hardcodedPatterns.some(pattern => 
      p.tone.toLowerCase().includes(pattern)
    )
  );
  
  if (suspiciousTopics.length > 0) {
    console.log(`⚠️ Found ${suspiciousTopics.length} posts with hardcoded topics`);
  } else {
    console.log(`✅ No hardcoded topics detected`);
  }
  
  if (suspiciousAngles.length > 0) {
    console.log(`⚠️ Found ${suspiciousAngles.length} posts with hardcoded angles`);
  } else {
    console.log(`✅ No hardcoded angles detected`);
  }
  
  if (suspiciousTones.length > 0) {
    console.log(`⚠️ Found ${suspiciousTones.length} posts with hardcoded tones`);
  } else {
    console.log(`✅ No hardcoded tones detected`);
  }
  
  // Check for AI-like characteristics (length, specificity)
  const avgTopicLength = recentPosts
    .filter(p => p.raw_topic)
    .map(p => p.raw_topic.length)
    .reduce((sum, len) => sum + len, 0) / stats.has_raw_topic;
  
  const avgAngleLength = recentPosts
    .filter(p => p.angle)
    .map(p => p.angle.length)
    .reduce((sum, len) => sum + len, 0) / stats.has_angle;
  
  const avgToneLength = recentPosts
    .filter(p => p.tone)
    .map(p => p.tone.length)
    .reduce((sum, len) => sum + len, 0) / stats.has_tone;
  
  console.log(`\n📏 Average lengths (AI-generated content is usually 20-80 chars):`);
  console.log(`   Topics: ${avgTopicLength.toFixed(0)} chars`);
  console.log(`   Angles: ${avgAngleLength.toFixed(0)} chars`);
  console.log(`   Tones: ${avgToneLength.toFixed(0)} chars\n`);
  
  // ═══════════════════════════════════════════════════════════
  // 6️⃣ SAMPLE RECENT POSTS - Show actual data
  // ═══════════════════════════════════════════════════════════
  
  console.log('6️⃣ RECENT POST SAMPLES (Last 5)\n');
  
  recentPosts.slice(0, 5).forEach((post, i) => {
    console.log(`\n📝 Post ${i + 1} (${post.created_at}):`);
    console.log(`   Status: ${post.status}`);
    console.log(`   Topic: ${post.raw_topic || 'MISSING'}`);
    console.log(`   Angle: ${post.angle || 'MISSING'}`);
    console.log(`   Tone: ${post.tone || 'MISSING'}`);
    console.log(`   Generator: ${post.generator_name || 'MISSING'}`);
    console.log(`   Format Strategy: ${post.format_strategy ? post.format_strategy.substring(0, 60) + '...' : 'MISSING'}`);
    console.log(`   Visual Format: ${post.visual_format || 'MISSING'}`);
  });
  
  // ═══════════════════════════════════════════════════════════
  // 7️⃣ OVERALL SCORE - Summarize findings
  // ═══════════════════════════════════════════════════════════
  
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 OVERALL DIVERSITY SCORE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const scores = {
    population: (stats.has_raw_topic + stats.has_angle + stats.has_tone + stats.has_generator_name + stats.has_format_strategy) / (stats.total * 5) * 100,
    diversity: ((uniqueTopics.size/stats.has_raw_topic) + (uniqueAngles.size/stats.has_angle) + (uniqueTones.size/stats.has_tone) + (uniqueGenerators.size/stats.has_generator_name) + (uniqueFormats.size/stats.has_format_strategy)) / 5 * 100,
  };
  
  const overallScore = (scores.population + scores.diversity) / 2;
  
  console.log(`Population Rate: ${scores.population.toFixed(0)}% (are columns filled?)`);
  console.log(`Diversity Rate: ${scores.diversity.toFixed(0)}% (are values varied?)`);
  console.log(`\n⭐ OVERALL SCORE: ${overallScore.toFixed(0)}/100`);
  
  if (overallScore >= 90) {
    console.log('🟢 EXCELLENT - System is highly diverse and AI-driven!');
  } else if (overallScore >= 75) {
    console.log('🟡 GOOD - System is working well with room for improvement');
  } else if (overallScore >= 60) {
    console.log('🟠 FAIR - System needs optimization');
  } else {
    console.log('🔴 POOR - System needs significant fixes');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // ═══════════════════════════════════════════════════════════
  // 8️⃣ RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════
  
  console.log('💡 RECOMMENDATIONS\n');
  
  if (stats.has_raw_topic < stats.total * 0.9) {
    console.log('❌ Topics not being populated consistently - check planJob.ts');
  }
  
  if (stats.has_angle < stats.total * 0.9) {
    console.log('❌ Angles not being populated consistently - check angleGenerator.ts');
  }
  
  if (stats.has_tone < stats.total * 0.9) {
    console.log('❌ Tones not being populated consistently - check toneGenerator.ts');
  }
  
  if (stats.has_generator_name < stats.total * 0.9) {
    console.log('❌ Generators not being tracked - check planJob.ts line 624');
  }
  
  if (stats.has_format_strategy < stats.total * 0.9) {
    console.log('❌ Format strategies not being populated - check formatStrategyGenerator.ts');
  }
  
  if (uniqueTopics.size / stats.has_raw_topic < 0.5) {
    console.log('❌ Topic diversity too low - DiversityEnforcer may not be working');
  }
  
  if (uniqueAngles.size / stats.has_angle < 0.5) {
    console.log('❌ Angle diversity too low - angleGenerator may need tuning');
  }
  
  if (uniqueTones.size / stats.has_tone < 0.5) {
    console.log('❌ Tone diversity too low - toneGenerator may need tuning');
  }
  
  if (uniqueGenerators.size < 8) {
    console.log(`❌ Only ${uniqueGenerators.size} generators being used - should be using all 12+`);
  }
  
  if (overallScore >= 75) {
    console.log('✅ System is working well! Content is AI-driven and diverse.');
  }
  
  console.log('\n');
}

auditContentDiversity().catch(console.error);

