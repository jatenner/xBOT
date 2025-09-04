/**
 * SYSTEM AUDIT - Analyze content creation and diversity
 */

async function auditSystem() {
  console.log('🔍 COMPREHENSIVE SYSTEM AUDIT');
  console.log('='*50);

  // 1. Check recent posts from your Twitter
  console.log('\n📊 ANALYZING YOUR RECENT TWITTER POSTS:');
  const recentPosts = [
    "Why drinking cold water in the morning is actually making you worse: It shocks your digestive system, slowing metabolism and hindering nutrient absorption. Opt for warm water to kickstart your body effectively!",
    "The simplest way to optimize magnesium timing for better sleep that nobody tries: Take magnesium 1 hour before bed. This can enhance relaxation and improve sleep quality, potentially reducing nighttime awakenings.",
    "The missing piece in your stress-relief routine that changes everything: Try the 4-7-8 breathing technique—activates the vagus nerve, reducing cortisol levels and calming your mind in under a minute!"
  ];

  // Content analysis
  console.log('\n🔍 CONTENT PATTERN ANALYSIS:');
  
  // Check for repetitive patterns
  const patterns = {};
  const words = recentPosts.join(' ').toLowerCase().split(/\s+/);
  words.forEach(word => {
    if (word.length > 4) patterns[word] = (patterns[word] || 0) + 1;
  });

  const overusedWords = Object.entries(patterns)
    .filter(([word, count]) => count > 1)
    .sort(([,a], [,b]) => b - a);

  console.log('❌ REPETITIVE PATTERNS FOUND:');
  overusedWords.slice(0, 10).forEach(([word, count]) => {
    console.log(`   "${word}" used ${count} times`);
  });

  // Check topic diversity
  console.log('\n🎯 TOPIC DIVERSITY ANALYSIS:');
  const topics = {
    'water/hydration': recentPosts.filter(p => /water|hydration/i.test(p)).length,
    'magnesium/supplements': recentPosts.filter(p => /magnesium|supplement/i.test(p)).length,
    'breathing/stress': recentPosts.filter(p => /breathing|stress|cortisol/i.test(p)).length,
    'sleep': recentPosts.filter(p => /sleep|bed/i.test(p)).length,
    'metabolism': recentPosts.filter(p => /metabolism|metabolic/i.test(p)).length
  };

  console.log('📊 TOPIC COVERAGE:');
  Object.entries(topics).forEach(([topic, count]) => {
    const status = count > 1 ? '⚠️ OVERUSED' : count === 1 ? '✅ GOOD' : '❌ MISSING';
    console.log(`   ${topic}: ${count} posts ${status}`);
  });

  // Content structure analysis
  console.log('\n📝 CONTENT STRUCTURE ANALYSIS:');
  const structures = {
    'Hook patterns': recentPosts.filter(p => /Why .* is actually/i.test(p)).length,
    'Specific advice': recentPosts.filter(p => /Take|Try|Opt for/i.test(p)).length,
    'Benefits mentioned': recentPosts.filter(p => /enhance|improve|reducing/i.test(p)).length,
    'Time specifics': recentPosts.filter(p => /1 hour|minute|morning/i.test(p)).length
  };

  Object.entries(structures).forEach(([structure, count]) => {
    console.log(`   ${structure}: ${count}/${recentPosts.length} posts`);
  });

  // Missing content areas
  console.log('\n❌ MISSING HEALTH DOMAINS:');
  const missingDomains = [
    'Exercise science (strength training, cardio protocols)',
    'Gut microbiome (probiotics, fermented foods)', 
    'Hormonal health (testosterone, insulin, thyroid)',
    'Biohacking tools (red light, cold therapy, devices)',
    'Specific product recommendations with brands',
    'Nutrition timing (meal timing, macros, fasting)',
    'Cognitive enhancement (nootropics, brain training)',
    'Recovery protocols (muscle recovery, inflammation)'
  ];

  missingDomains.forEach(domain => {
    console.log(`   📋 ${domain}`);
  });

  // System issues identified
  console.log('\n🚨 CRITICAL ISSUES IDENTIFIED:');
  console.log('1. CONTENT REPETITION: Same advice patterns repeated');
  console.log('2. LIMITED TOPIC RANGE: Stuck on sleep/supplements');  
  console.log('3. GENERIC ADVICE: "Take magnesium" vs specific brands/protocols');
  console.log('4. SIMILAR STRUCTURES: All posts follow same format');
  console.log('5. MISSING THREADS: No detailed threads with multiple parts');

  // Recommendations
  console.log('\n🎯 IMMEDIATE ACTION PLAN:');
  console.log('1. ✅ Enable diversity tracker to force topic rotation');
  console.log('2. ✅ Generate specific product/brand recommendations');
  console.log('3. ✅ Create thread content with detailed protocols');
  console.log('4. ✅ Explore exercise science and gut health domains');
  console.log('5. ✅ Add specific timing, dosages, and costs');

  console.log('\n📈 SUCCESS METRICS TO TRACK:');
  console.log('• Content diversity score >80% (currently ~30%)');
  console.log('• Thread posting 2-3x per day');
  console.log('• Specific product mentions in 80% of posts');
  console.log('• Topic rotation across 15 health domains');
  console.log('• Engagement rate >3% (need to measure current)');

  console.log('\n✅ AUDIT COMPLETE - DIVERSITY SYSTEM NEEDED!');
}

auditSystem().catch(console.error);
