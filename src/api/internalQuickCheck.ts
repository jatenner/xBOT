/**
 * 🔍 INTERNAL QUICK CHECK ENDPOINT
 * Fast diagnostics endpoint that runs inside Railway container
 * No need for slow `railway run` command
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../db';

export async function getInternalQuickCheck(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const results: any = {
      timestamp: new Date().toISOString(),
      issues: []
    };

    // ISSUE 1: Check posts in last hour (rate limit violation)
    const { data: recentPosts, error: postsError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, decision_type, status, posted_at, tweet_id, content, generator_name, thread_parts')
      .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false });

    if (postsError) {
      results.issues.push({ type: 'database_error', message: postsError.message });
    } else {
      const postsOnly = recentPosts?.filter(p => p.decision_type === 'post') || [];
      const repliesOnly = recentPosts?.filter(p => p.decision_type === 'reply') || [];
      
      results.posting_rate = {
        total: recentPosts?.length || 0,
        posts: postsOnly.length,
        replies: repliesOnly.length,
        limit_posts: 2,
        limit_replies: 4,
        violation: postsOnly.length > 2 || repliesOnly.length > 4,
        posts_list: postsOnly.map(p => ({
          tweet_id: p.tweet_id,
          posted_at: p.posted_at,
          minutes_ago: Math.floor((Date.now() - new Date(p.posted_at).getTime()) / 60000),
          content_preview: p.content?.substring(0, 80)
        }))
      };

      if (postsOnly.length > 2) {
        results.issues.push({
          type: 'RATE_LIMIT_VIOLATION',
          severity: 'HIGH',
          message: `Posted ${postsOnly.length} times in last hour (limit: 2)`,
          posts: postsOnly.map(p => ({ tweet_id: p.tweet_id, time: p.posted_at }))
        });
      }
    }

    // ISSUE 2: Check specific tweet with thread emoji
    const { data: threadEmojiPost } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('tweet_id', '2005828901415551455')
      .maybeSingle();

    if (threadEmojiPost) {
      const hasThreadEmoji = threadEmojiPost.content?.includes('🧵');
      const isThread = threadEmojiPost.decision_type === 'thread' || !!threadEmojiPost.thread_parts;
      
      results.thread_emoji_check = {
        tweet_id: '2005828901415551455',
        decision_type: threadEmojiPost.decision_type,
        has_thread_emoji: hasThreadEmoji,
        is_thread: isThread,
        generator: threadEmojiPost.generator_name,
        content_preview: threadEmojiPost.content?.substring(0, 150),
        thread_parts: threadEmojiPost.thread_parts
      };

      if (hasThreadEmoji && !isThread) {
        results.issues.push({
          type: 'THREAD_EMOJI_ON_SINGLE',
          severity: 'MEDIUM',
          message: 'Tweet has thread emoji 🧵 but is marked as single post',
          tweet_id: '2005828901415551455',
          generator: threadEmojiPost.generator_name
        });
      }
    }

    // ISSUE 3: Check recent replies for targeting issues
    const { data: recentReplies } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, content, tweet_id, reply_opportunity_id, posted_at, decision_type, thread_parts')
      .eq('decision_type', 'reply')
      .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false });

    const replyIssues: any[] = [];
    
    if (recentReplies && recentReplies.length > 0) {
      for (const reply of recentReplies) {
        const replyData: any = {
          tweet_id: reply.tweet_id,
          content_preview: reply.content?.substring(0, 100),
          issues: []
        };

        // Check if reply is structured as thread
        const hasThreadMarker = reply.content?.match(/^\d+\/\d+/);
        const isThread = reply.decision_type === 'thread' || !!reply.thread_parts;
        
        if (hasThreadMarker || isThread) {
          replyData.issues.push('Reply structured as thread (should be single)');
        }

        // Check what it's replying to
        if (reply.reply_opportunity_id) {
          const { data: opp } = await supabase
            .from('reply_opportunities')
            .select('target_tweet_id, target_author_handle, target_tweet_content')
            .eq('opportunity_id', reply.reply_opportunity_id)
            .maybeSingle();

          if (opp) {
            replyData.target = {
              tweet_id: opp.target_tweet_id,
              author: opp.target_author_handle,
              content_preview: opp.target_tweet_content?.substring(0, 80)
            };

            // Check if target is itself a reply
            if (opp.target_tweet_content?.startsWith('@')) {
              replyData.issues.push('Target tweet is a reply (starts with @) - replying to a reply instead of original post');
            }
          }
        }

        if (replyData.issues.length > 0) {
          replyIssues.push(replyData);
          results.issues.push({
            type: 'REPLY_TARGETING_OR_STRUCTURE',
            severity: 'HIGH',
            tweet_id: reply.tweet_id,
            problems: replyData.issues,
            target: replyData.target
          });
        }
      }

      results.reply_check = {
        total_replies: recentReplies.length,
        problematic_replies: replyIssues.length,
        details: replyIssues
      };
    } else {
      results.reply_check = {
        total_replies: 0,
        message: 'No replies posted in last hour'
      };
    }

    // ISSUE 4: Check rate limit config
    results.rate_limit_config = {
      MAX_POSTS_PER_HOUR: process.env.MAX_POSTS_PER_HOUR || 'NOT SET (default: 2)',
      MAX_REPLIES_PER_HOUR: process.env.MAX_REPLIES_PER_HOUR || 'NOT SET (default: 4)',
      actual_config_value: process.env.MAX_POSTS_PER_HOUR
    };

    // Summary
    results.summary = {
      total_issues: results.issues.length,
      critical: results.issues.filter((i: any) => i.severity === 'HIGH').length,
      needs_attention: results.issues.length > 0,
      rate_violation: results.posting_rate?.violation || false
    };

    res.json(results);
  } catch (error: any) {
    console.error('[INTERNAL_QUICK_CHECK] Error:', error);
    res.status(500).json({ 
      error: error.message, 
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

