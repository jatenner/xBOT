/**
 * Growth Story Generator
 *
 * When an account crosses a follower range boundary (nano→micro, micro→small, etc.),
 * generates a human-readable "growth story" explaining HOW they grew.
 *
 * Triggered by: growth events with completed retrospective analyses that involve
 * a range boundary crossing.
 *
 * Output: brain_growth_stories — structured data + AI narrative.
 *
 * Runs every 2 hours, after the retrospective analyzer.
 */

import { getSupabaseClient } from '../../db';
import { getFollowerRange, FOLLOWER_RANGE_ORDER, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/growth-story]';
const MAX_STORIES_PER_RUN = 5;

export async function runGrowthStoryGenerator(): Promise<{
  stories_generated: number;
  insufficient_data: number;
}> {
  const supabase = getSupabaseClient();
  let generated = 0;
  let insufficient = 0;

  // Find growth events that:
  // 1. Have a completed retrospective
  // 2. Involve a range boundary crossing
  // 3. Don't already have a story
  const { data: events } = await supabase
    .from('brain_growth_events')
    .select('id, username, followers_at_detection, growth_rate_after, detected_at, follower_range_at_detection')
    .eq('retrospective_status', 'analyzed')
    .order('detected_at', { ascending: false })
    .limit(50);

  if (!events || events.length === 0) {
    return { stories_generated: 0, insufficient_data: 0 };
  }

  // Filter to events that don't have stories yet
  const eventIds = events.map(e => e.id);
  const { data: existingStories } = await supabase
    .from('brain_growth_stories')
    .select('growth_event_id')
    .in('growth_event_id', eventIds);

  const existingSet = new Set((existingStories ?? []).map(s => s.growth_event_id));
  const needsStory = events.filter(e => !existingSet.has(e.id)).slice(0, MAX_STORIES_PER_RUN);

  for (const event of needsStory) {
    try {
      const result = await generateStoryForEvent(supabase, event);
      if (result === 'success') generated++;
      else if (result === 'insufficient_data') insufficient++;
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error generating story for @${event.username}: ${err.message}`);
    }
  }

  if (generated > 0) {
    console.log(`${LOG_PREFIX} Generated ${generated} growth stories (${insufficient} skipped for insufficient data)`);
  }

  return { stories_generated: generated, insufficient_data: insufficient };
}

async function generateStoryForEvent(
  supabase: any,
  event: any,
): Promise<'success' | 'insufficient_data' | 'error'> {
  const username = event.username;

  // Get account info
  const { data: account } = await supabase
    .from('brain_accounts')
    .select('followers_count, follower_range, follower_range_at_first_snapshot, niche_cached, bio_text')
    .eq('username', username)
    .single();

  if (!account) return 'insufficient_data';

  // Determine range transition
  const currentRange = account.follower_range || getFollowerRange(account.followers_count ?? 0);
  const startRange = account.follower_range_at_first_snapshot || event.follower_range_at_detection || 'nano';

  if (currentRange === startRange) {
    // No range crossing — still interesting but not a "story"
    // Generate for any account with a growth event
  }

  // Get retrospective data
  const { data: retro } = await supabase
    .from('brain_retrospective_analyses')
    .select('before_stats, during_stats, key_changes, analysis_summary')
    .eq('username', username)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single();

  // Get snapshots for timeline
  const { data: snapshots } = await supabase
    .from('brain_account_snapshots')
    .select('followers_count, checked_at')
    .eq('username', username)
    .order('checked_at', { ascending: true })
    .limit(50);

  if (!snapshots || snapshots.length < 2) return 'insufficient_data';

  const firstSnap = snapshots[0];
  const lastSnap = snapshots[snapshots.length - 1];
  const fromFollowers = firstSnap.followers_count;
  const toFollowers = lastSnap.followers_count;
  const daysElapsed = (new Date(lastSnap.checked_at).getTime() - new Date(firstSnap.checked_at).getTime()) / (24 * 60 * 60 * 1000);

  if (daysElapsed < 1 || toFollowers <= fromFollowers) return 'insufficient_data';

  // Get their tweets
  const { data: tweets } = await supabase
    .from('brain_tweets')
    .select('tweet_type, content, likes, views, retweets, bookmarks, posted_hour_utc, media_type, reply_to_username, reply_target_followers, content_features')
    .eq('author_username', username)
    .order('likes', { ascending: false })
    .limit(50);

  if (!tweets || tweets.length < 3) return 'insufficient_data';

  // Compute content summary
  const totalTweets = tweets.length;
  const originals = tweets.filter((t: any) => t.tweet_type === 'original');
  const replies = tweets.filter((t: any) => t.tweet_type === 'reply');
  const avgLikes = tweets.reduce((s: number, t: any) => s + (t.likes ?? 0), 0) / totalTweets;
  const replyRatio = totalTweets > 0 ? Math.round((replies.length / totalTweets) * 100) / 100 : 0;
  const postsPerDay = daysElapsed > 0 ? Math.round((totalTweets / daysElapsed) * 10) / 10 : 0;

  const contentSummary = {
    total_tweets: totalTweets,
    posts_per_day: postsPerDay,
    reply_ratio: replyRatio,
    avg_likes: Math.round(avgLikes),
    avg_word_count: Math.round(tweets.reduce((s: number, t: any) => s + ((t.content ?? '').split(/\s+/).length), 0) / totalTweets),
  };

  // Reply strategy
  const replyTargets = replies.filter((t: any) => t.reply_target_followers != null);
  const replyStrategy = {
    replies_count: replies.length,
    targets: replies.map((t: any) => t.reply_to_username).filter(Boolean).slice(0, 10),
    avg_target_followers: replyTargets.length > 0
      ? Math.round(replyTargets.reduce((s: number, t: any) => s + t.reply_target_followers, 0) / replyTargets.length)
      : null,
  };

  // Key tweets (top by likes)
  const keyTweets = tweets.slice(0, 5).map((t: any) => ({
    content_preview: (t.content ?? '').substring(0, 120),
    likes: t.likes ?? 0,
    views: t.views ?? 0,
    media_type: t.media_type,
  }));

  // Bio changes
  let bioChanges: any[] = [];
  try {
    const { data } = await supabase
      .from('brain_bio_changes')
      .select('old_bio, new_bio, change_type, changed_at')
      .eq('username', username)
      .order('changed_at', { ascending: false })
      .limit(5);
    bioChanges = data ?? [];
  } catch {}

  // Content evolution
  let contentEvolution: Record<string, any> = {};
  try {
    const { data } = await supabase
      .from('brain_content_evolution')
      .select('dimension, old_primary, new_primary, growth_correlated')
      .eq('username', username);
    if (data && data.length > 0) {
      contentEvolution = {
        shifts: data.map((e: any) => `${e.dimension}: ${e.old_primary} → ${e.new_primary}`),
        growth_correlated_count: data.filter((e: any) => e.growth_correlated).length,
      };
    }
  } catch {}

  // Peer comparison
  let peerComparison: Record<string, any> = {};
  try {
    const { data: playbook } = await supabase
      .from('brain_growth_playbooks')
      .select('avg_days_to_transition, sample_size')
      .eq('from_range', startRange)
      .eq('to_range', currentRange)
      .is('niche', null)
      .single();

    if (playbook && playbook.avg_days_to_transition) {
      peerComparison = {
        avg_days_for_peers: Math.round(playbook.avg_days_to_transition),
        this_account_days: Math.round(daysElapsed),
        faster_than_avg: daysElapsed < playbook.avg_days_to_transition,
        peer_sample_size: playbook.sample_size,
      };
    }
  } catch {}

  // Generate headline and narrative
  const fromRange = startRange;
  const toRange = currentRange;
  const gained = toFollowers - fromFollowers;

  // Template-based story (always works, no AI needed)
  const headline = `@${username} went from ${fromFollowers.toLocaleString()} to ${toFollowers.toLocaleString()} followers (+${gained.toLocaleString()}) in ${Math.round(daysElapsed)} days`;

  let narrative = `**@${username}** grew from ${fromFollowers.toLocaleString()} to ${toFollowers.toLocaleString()} followers in ${Math.round(daysElapsed)} days, crossing from ${fromRange} to ${toRange} range.\n\n`;

  narrative += `**Content Strategy:** They posted ~${postsPerDay} times/day with an average of ${contentSummary.avg_word_count} words per post. `;
  if (replyRatio > 0.3) {
    narrative += `Notably, ${Math.round(replyRatio * 100)}% of their content was replies — an active engagement strategy. `;
  }
  if (replyStrategy.avg_target_followers) {
    narrative += `Their replies targeted accounts with ~${replyStrategy.avg_target_followers.toLocaleString()} followers on average. `;
  }
  narrative += `\n\n`;

  narrative += `**Engagement:** Their tweets averaged ${contentSummary.avg_likes} likes. `;
  if (keyTweets.length > 0 && keyTweets[0].likes > avgLikes * 3) {
    narrative += `Their top tweet ("${keyTweets[0].content_preview}...") got ${keyTweets[0].likes.toLocaleString()} likes — ${Math.round(keyTweets[0].likes / avgLikes)}x their average. `;
  }
  narrative += `\n\n`;

  if (bioChanges.length > 0) {
    narrative += `**Bio Evolution:** They changed their bio ${bioChanges.length} time(s) during this period`;
    if (bioChanges[0].change_type) {
      narrative += ` (${bioChanges.map((b: any) => b.change_type).join(', ')})`;
    }
    narrative += `.\n\n`;
  }

  if (retro?.key_changes && Array.isArray(retro.key_changes) && retro.key_changes.length > 0) {
    narrative += `**What Changed During Growth:** `;
    for (const change of retro.key_changes.slice(0, 3)) {
      if (change.description) narrative += change.description + '. ';
    }
    narrative += `\n\n`;
  }

  if (peerComparison.avg_days_for_peers) {
    if (peerComparison.faster_than_avg) {
      narrative += `**Pace:** This was faster than average — peers typically take ${peerComparison.avg_days_for_peers} days for the same transition (n=${peerComparison.peer_sample_size}).`;
    } else {
      narrative += `**Pace:** Peers typically take ${peerComparison.avg_days_for_peers} days for the ${fromRange}→${toRange} transition (n=${peerComparison.peer_sample_size}).`;
    }
  }

  // Try AI enhancement if budget allows
  let aiModel: string | null = null;
  try {
    const { createBudgetedChatCompletion } = await import('../../services/openaiBudgetedClient');
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You write concise, insightful growth analysis stories for Twitter accounts. Given structured data about an account\'s growth journey, write a compelling 3-paragraph story that explains HOW they grew. Focus on actionable patterns. No fluff.' },
        { role: 'user', content: `Account: @${username}\nFrom: ${fromFollowers} to ${toFollowers} followers in ${Math.round(daysElapsed)} days\nPosts/day: ${postsPerDay}\nReply ratio: ${Math.round(replyRatio * 100)}%\nAvg likes: ${contentSummary.avg_likes}\nAvg word count: ${contentSummary.avg_word_count}\nReply target size: ${replyStrategy.avg_target_followers ?? 'unknown'}\nTop tweet: "${keyTweets[0]?.content_preview ?? 'N/A'}"\nBio changes: ${bioChanges.length}\nKey changes: ${JSON.stringify(retro?.key_changes?.slice(0, 3) ?? [])}\n\nWrite the growth story.` },
      ],
      temperature: 0.3,
    }, { purpose: 'observatory_growth_story', priority: 'low' });

    if (response.choices[0]?.message?.content) {
      narrative = response.choices[0].message.content;
      aiModel = 'gpt-4o-mini';
    }
  } catch {
    // AI failed or budget exhausted — template narrative is fine
  }

  // Store the story
  const { error } = await supabase.from('brain_growth_stories').upsert({
    username,
    growth_event_id: event.id,
    from_range: fromRange,
    to_range: toRange,
    from_followers: fromFollowers,
    to_followers: toFollowers,
    days_elapsed: Math.round(daysElapsed * 10) / 10,
    content_summary: contentSummary,
    reply_strategy: replyStrategy,
    key_tweets: keyTweets,
    bio_changes: bioChanges,
    content_evolution: contentEvolution,
    peer_comparison: peerComparison,
    story_headline: headline,
    story_narrative: narrative,
    ai_model: aiModel,
  }, { onConflict: 'username,growth_event_id' });

  if (error) {
    console.error(`${LOG_PREFIX} Error storing story for @${username}: ${error.message}`);
    return 'error';
  }

  console.log(`${LOG_PREFIX} Story: ${headline}`);
  return 'success';
}
