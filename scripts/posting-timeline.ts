#!/usr/bin/env tsx
/**
 * Show posting timeline for last 24 hours
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function timeline() {
  console.log('📊 POSTING TIMELINE - LAST 24 HOURS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: posts } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, posted_at, created_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', oneDayAgo.toISOString())
    .order('posted_at', { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) {
    console.log('❌ NO POSTS IN LAST 24 HOURS');
    return;
  }

  console.log(`✅ ${posts.length} posts in last 24 hours\n`);

  const now = new Date();
  let lastPostTime: Date | null = null;
  let gaps: Array<{ duration: number; between: string }> = [];

  posts.forEach((post, i) => {
    const postedAt = new Date(post.posted_at);
    const minutesAgo = Math.round((now.getTime() - postedAt.getTime()) / 1000 / 60);
    const hoursAgo = (minutesAgo / 60).toFixed(1);

    const timeDisplay = minutesAgo < 120 
      ? `${minutesAgo}m ago` 
      : `${hoursAgo}h ago`;

    console.log(`${i + 1}. ${post.decision_type.padEnd(7)} | ${timeDisplay.padEnd(10)} | tweet_id: ${post.tweet_id}`);

    if (lastPostTime) {
      const gapMinutes = Math.round((lastPostTime.getTime() - postedAt.getTime()) / 1000 / 60);
      if (gapMinutes > 120) { // Gaps > 2 hours
        gaps.push({
          duration: gapMinutes,
          between: `${post.posted_at} → ${posts[i-1].posted_at}`
        });
      }
    }
    lastPostTime = postedAt;
  });

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (gaps.length > 0) {
    console.log(`🚨 DETECTED ${gaps.length} POSTING GAP(S) > 2 HOURS:\n`);
    gaps.forEach((gap, i) => {
      const hours = (gap.duration / 60).toFixed(1);
      console.log(`   ${i + 1}. GAP: ${hours} hours (${gap.duration} minutes)`);
      console.log(`      ${gap.between}`);
      console.log('');
    });
  } else {
    console.log('✅ NO significant gaps detected (all posts within 2 hours)');
  }

  // Calculate posting rate
  if (posts.length >= 2) {
    const firstPost = new Date(posts[posts.length - 1].posted_at);
    const lastPost = new Date(posts[0].posted_at);
    const timeSpanHours = (lastPost.getTime() - firstPost.getTime()) / 1000 / 60 / 60;
    const postsPerHour = posts.length / timeSpanHours;

    console.log(`\n📈 POSTING RATE: ${postsPerHour.toFixed(1)} posts/hour (${posts.length} posts in ${timeSpanHours.toFixed(1)} hours)`);
    console.log(`   Expected: ~2 posts/hour`);
    
    if (postsPerHour < 1.5) {
      console.log(`   ⚠️  BELOW TARGET (${(postsPerHour / 2 * 100).toFixed(0)}% of expected rate)`);
    } else if (postsPerHour > 2.5) {
      console.log(`   ⚠️  ABOVE TARGET (${(postsPerHour / 2 * 100).toFixed(0)}% of expected rate)`);
    } else {
      console.log(`   ✅ WITHIN TARGET RANGE`);
    }
  }

  console.log('');
}

timeline();

