/**
 * 💬 CONVERSATION MONITOR
 * 
 * Detects when targets reply to our replies, creating conversation opportunities.
 * Enables multi-turn engagement for deeper relationships.
 */

import { getSupabaseClient } from '../db';
import { getBrowser, createContext } from '../browser/browserFactory';

export interface ConversationOpportunity {
  our_reply_id: string;
  their_reply_id: string;
  our_reply_content: string;
  their_reply_content: string;
  target_username: string;
  target_followers: number;
  conversation_depth: number; // How many turns so far
  discovered_at: string;
  expires_at: string; // Reply within 2 hours for best visibility
}

export class ConversationMonitor {
  private static instance: ConversationMonitor;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): ConversationMonitor {
    if (!ConversationMonitor.instance) {
      ConversationMonitor.instance = new ConversationMonitor();
    }
    return ConversationMonitor.instance;
  }

  /**
   * Monitor our recent replies for responses from targets
   * Should run every 15-30 minutes
   */
  public async monitorConversations(): Promise<ConversationOpportunity[]> {
    console.log('[CONVERSATION] 💬 Monitoring for conversation opportunities...');

    try {
      // Get our posted replies from last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const { data: ourReplies } = await this.supabase
        .from('content_metadata')
        .select('decision_id, tweet_id, target_username, target_tweet_id, content, posted_at')
        .eq('decision_type', 'reply')
        .eq('status', 'posted')
        .gte('posted_at', twentyFourHoursAgo.toISOString())
        .not('tweet_id', 'like', 'reply_posted_%') // Exclude placeholders
        .order('posted_at', { ascending: false })
        .limit(50); // Check last 50 replies

      if (!ourReplies || ourReplies.length === 0) {
        console.log('[CONVERSATION] No recent replies to monitor');
        return [];
      }

      console.log(`[CONVERSATION] Checking ${ourReplies.length} recent replies for responses...`);

      // Check each reply for responses
      const opportunities: ConversationOpportunity[] = [];
      
      for (const reply of ourReplies) {
        try {
          // Check if target has replied to our reply
          const conversation = await this.checkForResponse(reply);
          
          if (conversation) {
            opportunities.push(conversation);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error: any) {
          console.error(`[CONVERSATION] Error checking ${reply.decision_id}:`, error.message);
        }
      }

      console.log(`[CONVERSATION] ✅ Found ${opportunities.length} conversation opportunities`);

      // Store opportunities in database
      if (opportunities.length > 0) {
        await this.storeOpportunities(opportunities);
      }

      return opportunities;

    } catch (error: any) {
      console.error('[CONVERSATION] ❌ Monitoring failed:', error.message);
      return [];
    }
  }

  /**
   * Check if a specific reply has received a response
   */
  private async checkForResponse(ourReply: any): Promise<ConversationOpportunity | null> {
    try {
      // Use browser to check if there are replies to our tweet
      const browser = await getBrowser();
      const context = await createContext(browser);
      const page = await context.newPage();

      try {
        // Navigate to our reply
        await page.goto(`https://x.com/i/status/${ourReply.tweet_id}`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });

        await page.waitForTimeout(3000);

        // Find replies to our tweet
        const replyArticles = await page.$$('article[data-testid="tweet"]');
        
        // Skip first article (that's our tweet)
        const replies = replyArticles.slice(1);

        if (replies.length === 0) {
          console.log(`[CONVERSATION] No responses to ${ourReply.tweet_id}`);
          return null;
        }

        // Check if any reply is from the original target
        for (const replyEl of replies) {
          try {
            // Get username from reply
            const usernameEl = await replyEl.$('[data-testid="User-Name"] a[role="link"]');
            if (!usernameEl) continue;

            const href = await usernameEl.getAttribute('href');
            if (!href) continue;

            const username = href.replace('/', '');

            // Check if this is from our target
            if (username.toLowerCase() === ourReply.target_username.toLowerCase()) {
              console.log(`[CONVERSATION] 🎯 Found response from @${username}!`);

              // Get their reply content
              const contentEl = await replyEl.$('[data-testid="tweetText"]');
              const theirContent = contentEl ? await contentEl.textContent() : '';

              // Get their reply ID
              const linkEl = await replyEl.$('a[href*="/status/"]');
              const linkHref = await linkEl?.getAttribute('href');
              const match = linkHref?.match(/\/status\/(\d+)/);
              const theirReplyId = match ? match[1] : null;

              if (!theirReplyId) {
                console.warn('[CONVERSATION] Could not extract reply ID');
                continue;
              }

              // Get target follower count (from discovered_accounts)
              const { data: account } = await this.supabase
                .from('discovered_accounts')
                .select('follower_count')
                .eq('username', ourReply.target_username)
                .single();

              // Calculate conversation depth
              const depth = await this.getConversationDepth(ourReply.target_username);

              // Create opportunity
              const opportunity: ConversationOpportunity = {
                our_reply_id: ourReply.tweet_id,
                their_reply_id: theirReplyId,
                our_reply_content: ourReply.content,
                their_reply_content: theirContent || '',
                target_username: ourReply.target_username,
                target_followers: account?.follower_count || 0,
                conversation_depth: depth + 1,
                discovered_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
              };

              await page.close();
              await context.close();
              
              return opportunity;
            }

          } catch (error) {
            continue;
          }
        }

        await page.close();
        await context.close();
        
        return null;

      } catch (error: any) {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        throw error;
      }

    } catch (error: any) {
      console.error(`[CONVERSATION] Error checking response:`, error.message);
      return null;
    }
  }

  /**
   * Get current conversation depth with a target
   */
  private async getConversationDepth(username: string): Promise<number> {
    const { data: conversations } = await this.supabase
      .from('conversation_opportunities')
      .select('conversation_depth')
      .eq('target_username', username)
      .order('conversation_depth', { ascending: false })
      .limit(1)
      .single();

    return conversations?.conversation_depth || 0;
  }

  /**
   * Store conversation opportunities in database
   */
  private async storeOpportunities(opportunities: ConversationOpportunity[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('conversation_opportunities')
        .upsert(
          opportunities.map(o => ({
            our_reply_id: o.our_reply_id,
            their_reply_id: o.their_reply_id,
            our_reply_content: o.our_reply_content,
            their_reply_content: o.their_reply_content,
            target_username: o.target_username,
            target_followers: o.target_followers,
            conversation_depth: o.conversation_depth,
            status: 'pending',
            discovered_at: o.discovered_at,
            expires_at: o.expires_at,
            created_at: new Date().toISOString()
          })),
          { onConflict: 'their_reply_id', ignoreDuplicates: false }
        );

      if (error) {
        console.error('[CONVERSATION] Failed to store opportunities:', error);
      } else {
        console.log(`[CONVERSATION] ✅ Stored ${opportunities.length} opportunities`);
      }

    } catch (error: any) {
      console.error('[CONVERSATION] Storage error:', error.message);
    }
  }

  /**
   * Get pending conversation opportunities
   */
  public async getPendingConversations(): Promise<ConversationOpportunity[]> {
    const { data } = await this.supabase
      .from('conversation_opportunities')
      .select('*')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('target_followers', { ascending: false }) // Prioritize high-follower accounts
      .limit(10);

    return (data || []).map(d => ({
      our_reply_id: d.our_reply_id,
      their_reply_id: d.their_reply_id,
      our_reply_content: d.our_reply_content,
      their_reply_content: d.their_reply_content,
      target_username: d.target_username,
      target_followers: d.target_followers,
      conversation_depth: d.conversation_depth,
      discovered_at: d.discovered_at,
      expires_at: d.expires_at
    }));
  }

  /**
   * Mark conversation as replied
   */
  public async markReplied(theirReplyId: string, ourFollowUpId: string): Promise<void> {
    await this.supabase
      .from('conversation_opportunities')
      .update({
        status: 'replied',
        our_followup_id: ourFollowUpId,
        replied_at: new Date().toISOString()
      })
      .eq('their_reply_id', theirReplyId);
  }
}

// Export singleton
export const conversationMonitor = ConversationMonitor.getInstance();

