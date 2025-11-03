#!/usr/bin/env tsx
/**
 * 📊 VIRAL LEARNING SYSTEM MONITOR
 * 
 * Run this in 5-8 hours to verify the scraping system is working
 * 
 * Usage: pnpm tsx scripts/monitor-viral-learning.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function monitor() {
  console.log('📊 VIRAL LEARNING SYSTEM MONITOR');
  console.log('━'.repeat(80));
  console.log('');
  
  const supabase = getSupabaseClient();
  
  // ============================================================================
  // 1. VIRAL TWEET LIBRARY STATUS
  // ============================================================================
  
  console.log('🔥 VIRAL TWEET LIBRARY STATUS:\n');
  
  const { count: totalTweets } = await supabase
    .from('viral_tweet_library')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  
  const { count: todayTweets } = await supabase
    .from('viral_tweet_library')
    .select('*', { count: 'exact', head: true })
    .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const { count: last8Hours } = await supabase
    .from('viral_tweet_library')
    .select('*', { count: 'exact', head: true })
    .gte('scraped_at', new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString());
  
  console.log(`  Total viral tweets: ${totalTweets || 0}`);
  console.log(`  Added today: ${todayTweets || 0}`);
  console.log(`  Added last 8 hours: ${last8Hours || 0}`);
  
  if (totalTweets === 0) {
    console.log('\n  ⚠️  WARNING: No viral tweets scraped yet!');
    console.log('  Possible reasons:');
    console.log('    1. Scraper hasn\'t run yet (needs 3-4 hours after deploy)');
    console.log('    2. Browser session may need refresh on Railway');
    console.log('    3. Check Railway logs for scraper errors\n');
  } else if (totalTweets < 50) {
    console.log(`\n  ⏳ Learning in progress... (${totalTweets}/500 target)\n`);
  } else {
    console.log(`\n  ✅ System is learning! (${totalTweets} patterns collected)\n`);
  }
  
  // ============================================================================
  // 2. PATTERN ANALYSIS
  // ============================================================================
  
  if (totalTweets && totalTweets > 0) {
    console.log('━'.repeat(80));
    console.log('🧠 LEARNED PATTERNS:\n');
    
    // Hook types distribution
    const { data: hookTypes } = await supabase
      .from('viral_tweet_library')
      .select('hook_type')
      .eq('is_active', true);
    
    const hookCount: Record<string, number> = {};
    hookTypes?.forEach((row: any) => {
      const hook = row.hook_type || 'unknown';
      hookCount[hook] = (hookCount[hook] || 0) + 1;
    });
    
    console.log('  Hook Types:');
    Object.entries(hookCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([hook, count]) => {
        console.log(`    • ${hook}: ${count} examples`);
      });
    
    // Average performance
    const { data: avgStats } = await supabase
      .from('viral_tweet_library')
      .select('views, engagement_rate, pattern_strength')
      .eq('is_active', true);
    
    if (avgStats && avgStats.length > 0) {
      const avgViews = avgStats.reduce((sum: number, t: any) => sum + (Number(t.views) || 0), 0) / avgStats.length;
      const avgEngagement = avgStats.reduce((sum: number, t: any) => sum + (Number(t.engagement_rate) || 0), 0) / avgStats.length;
      const avgStrength = avgStats.reduce((sum: number, t: any) => sum + (Number(t.pattern_strength) || 0), 0) / avgStats.length;
      
      console.log('\n  Performance Metrics:');
      console.log(`    • Avg views: ${Math.round(avgViews).toLocaleString()}`);
      console.log(`    • Avg engagement: ${(avgEngagement * 100).toFixed(2)}%`);
      console.log(`    • Avg pattern strength: ${avgStrength.toFixed(1)}/10`);
    }
    
    // Top performing examples
    const { data: topExamples } = await supabase
      .from('viral_tweet_library')
      .select('text, author_handle, views, likes, hook_type, why_it_works')
      .eq('is_active', true)
      .order('engagement_rate', { ascending: false })
      .limit(3);
    
    if (topExamples && topExamples.length > 0) {
      console.log('\n  Top 3 Viral Examples:\n');
      topExamples.forEach((ex: any, i: number) => {
        console.log(`  ${i + 1}. @${ex.author_handle} (${Number(ex.views || 0).toLocaleString()} views)`);
        console.log(`     Hook: ${ex.hook_type}`);
        console.log(`     Text: "${String(ex.text || '').substring(0, 80)}..."`);
        if (ex.why_it_works) {
          console.log(`     Why: "${String(ex.why_it_works).substring(0, 120)}..."`);
        }
        console.log('');
      });
    }
  }
  
  // ============================================================================
  // 3. RECENT POSTS USING NEW FORMATTER
  // ============================================================================
  
  console.log('━'.repeat(80));
  console.log('📝 RECENT POSTS (Checking format quality):\n');
  
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('content, created_at, status')
    .in('status', ['posted', 'queued'])
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentPosts && recentPosts.length > 0) {
    recentPosts.forEach((post: any, i: number) => {
      const content = String(post.content || '');
      
      // Quality checks
      const hasMarkdown = /\*\*|\*(?!\d)|__/.test(content);
      const hasHashtag = /#\w/.test(content);
      const charCount = content.length;
      const overLimit = charCount > 280;
      
      const quality = !hasMarkdown && !hasHashtag && !overLimit ? '✅' : '⚠️';
      
      console.log(`  ${i + 1}. ${quality} ${post.status.toUpperCase()} (${new Date(post.created_at).toLocaleTimeString()})`);
      console.log(`     "${content.substring(0, 100)}..."`);
      
      if (hasMarkdown) console.log(`     ❌ Contains markdown`);
      if (hasHashtag) console.log(`     ❌ Contains hashtags`);
      if (overLimit) console.log(`     ❌ Over 280 chars (${charCount})`);
      
      console.log('');
    });
  } else {
    console.log('  No recent posts found\n');
  }
  
  // ============================================================================
  // 4. SYSTEM HEALTH SUMMARY
  // ============================================================================
  
  console.log('━'.repeat(80));
  console.log('🏥 SYSTEM HEALTH:\n');
  
  const health = {
    viralLearning: totalTweets && totalTweets > 0 ? '✅' : '⏳',
    recentActivity: last8Hours && last8Hours > 0 ? '✅' : '⏳',
    contentQuality: recentPosts?.some((p: any) => {
      const c = String(p.content || '');
      return /\*\*/.test(c) || /#\w/.test(c);
    }) ? '⚠️' : '✅'
  };
  
  console.log(`  Viral Learning: ${health.viralLearning} ${totalTweets || 0} patterns collected`);
  console.log(`  Recent Activity: ${health.recentActivity} ${last8Hours || 0} tweets scraped in last 8h`);
  console.log(`  Content Quality: ${health.contentQuality} Recent posts are clean`);
  
  console.log('\n━'.repeat(80));
  
  // Overall status
  if (totalTweets === 0) {
    console.log('\n⏳ STATUS: Waiting for first scraper run (check back in 1-2 hours)\n');
  } else if (totalTweets < 100) {
    console.log(`\n📈 STATUS: Early learning phase (${totalTweets}/500 tweets collected)\n`);
  } else if (totalTweets < 500) {
    console.log(`\n🚀 STATUS: Active learning (${totalTweets}/500 tweets collected)\n`);
  } else {
    console.log(`\n✅ STATUS: Fully operational (${totalTweets} patterns, continuous learning)\n`);
  }
  
  // Next steps
  console.log('📋 NEXT STEPS:\n');
  if (totalTweets === 0) {
    console.log('  1. Wait 2-3 hours for first scraper cycle');
    console.log('  2. Check Railway logs: railway logs | grep VIRAL_SCRAPER');
    console.log('  3. Run this script again\n');
  } else if (totalTweets < 100) {
    console.log('  1. System is working! Keep monitoring');
    console.log('  2. Run this script every 4-6 hours to track progress');
    console.log('  3. Watch your tweet engagement improve\n');
  } else {
    console.log('  1. ✅ System is fully operational');
    console.log('  2. Monitor your tweet performance');
    console.log('  3. Check this dashboard weekly\n');
  }
}

monitor()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Monitor failed:', error.message);
    process.exit(1);
  });

