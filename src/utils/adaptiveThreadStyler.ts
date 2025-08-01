/**
 * 🧪 ADAPTIVE THREAD STYLER - A/B Test Different Threading Styles
 * Learns which thread styles get more followers and engagement
 */

export interface ThreadStyle {
  id: string;
  name: string;
  description: string;
  numberingFormat: (index: number) => string;
  hookStyle: (content: string) => string;
  engagement_score?: number;
  follower_growth_rate?: number;
  times_used?: number;
}

export interface StylePerformance {
  style_id: string;
  posts_count: number;
  avg_likes: number;
  avg_retweets: number;
  avg_replies: number;
  follower_growth: number;
  last_updated: Date;
}

export class AdaptiveThreadStyler {
  private static instance: AdaptiveThreadStyler;
  
  private threadStyles: ThreadStyle[] = [
    {
      id: 'emoji_numbers',
      name: 'Emoji Numbers',
      description: 'Use emoji numbers (1️⃣, 2️⃣, 3️⃣) for visual appeal',
      numberingFormat: (index: number) => this.getEmojiNumber(index),
      hookStyle: (content: string) => this.addSubtleHook(content)
    },
    {
      id: 'slash_numbers', 
      name: 'Slash Numbers',
      description: 'Traditional Twitter threading (1/, 2/, 3/)',
      numberingFormat: (index: number) => `${index}/`,
      hookStyle: (content: string) => this.addSubtleHook(content)
    },
    {
      id: 'dot_numbers',
      name: 'Dot Numbers', 
      description: 'Clean numbered list style (1., 2., 3.)',
      numberingFormat: (index: number) => `${index}.`,
      hookStyle: (content: string) => this.addSubtleHook(content)
    },
    {
      id: 'arrow_style',
      name: 'Arrow Style',
      description: 'Modern arrow threading (→ Point 1, → Point 2)',
      numberingFormat: (index: number) => `→`,
      hookStyle: (content: string) => this.addModernHook(content)
    },
    {
      id: 'minimal_clean',
      name: 'Minimal Clean',
      description: 'No numbering, just clean content flow',
      numberingFormat: (index: number) => '',
      hookStyle: (content: string) => this.addMinimalHook(content)
    }
  ];

  public static getInstance(): AdaptiveThreadStyler {
    if (!AdaptiveThreadStyler.instance) {
      AdaptiveThreadStyler.instance = new AdaptiveThreadStyler();
    }
    return AdaptiveThreadStyler.instance;
  }

  /**
   * 🎯 SELECT OPTIMAL STYLE USING LINUCB CONTEXTUAL BANDIT
   */
  async selectOptimalStyle(context?: any): Promise<ThreadStyle> {
    try {
      // Try LinUCB bandit first for intelligent selection
      const selectedStyle = await this.selectWithLinUCB(context);
      if (selectedStyle) {
        return selectedStyle;
      }
      
      // Fallback to 80/20 exploit/explore
      return this.fallbackSelection();
      
    } catch (error) {
      console.error('❌ Error selecting thread style:', error);
      return this.threadStyles[0]; // Default to emoji numbers
    }
  }

  /**
   * 🧠 Use LinUCB contextual bandit for intelligent style selection
   */
  private async selectWithLinUCB(inputContext?: any): Promise<ThreadStyle | null> {
    try {
      const { ContextualBandit } = await import('../intelligence/contextualBandit');
      const bandit = ContextualBandit.getInstance();
      
      // Build context for bandit decision
      const banditContext = await this.buildBanditContext(inputContext);
      
      // Convert thread styles to bandit actions
      const actions = this.threadStyles.map(style => ({
        id: style.id,
        name: style.name,
        type: 'thread_style' as const,
        parameters: { style: style.id }
      }));
      
      // Let bandit select optimal action
      const selectedAction = await bandit.selectAction(banditContext, actions);
      
      // Find corresponding thread style
      const selectedStyle = this.threadStyles.find(s => s.id === selectedAction.id);
      
      if (selectedStyle) {
        console.log(`🎯 LinUCB selected style: ${selectedStyle.name}`);
        return selectedStyle;
      }
      
      return null;
      
    } catch (error) {
      console.warn('⚠️ LinUCB selection failed, using fallback:', error);
      return null;
    }
  }

  /**
   * 🔄 Fallback to original 80/20 exploit/explore
   */
  private async fallbackSelection(): Promise<ThreadStyle> {
    try {
      const shouldExperiment = Math.random() < 0.2;
      
      if (shouldExperiment) {
        console.log('🧪 Experimenting with new thread style...');
        return this.getRandomStyle();
      } else {
        console.log('🎯 Using best performing thread style...');
        return await this.getBestPerformingStyle();
      }
    } catch (error) {
      console.error('❌ Error in fallback selection:', error);
      return this.threadStyles[0];
    }
  }

  /**
   * 🧠 Build context for bandit decision
   */
  private async buildBanditContext(inputContext?: any): Promise<any> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Get recent engagement rate
    let recentEngagementRate = 0.0;
    try {
      const { supabaseClient } = await import('../utils/supabaseClient');
      const { data } = await supabaseClient.supabase
        .from('tweets')
        .select('engagement_score, impressions')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data && data.length > 0) {
        const avgEngagement = data.reduce((sum, tweet) => sum + tweet.engagement_score, 0) / data.length;
        const avgImpressions = data.reduce((sum, tweet) => sum + (tweet.impressions || 1), 0) / data.length;
        recentEngagementRate = avgEngagement / Math.max(avgImpressions, 1);
      }
    } catch (error) {
      console.warn('Could not get recent engagement rate:', error);
    }
    
    return {
      hour,
      dayOfWeek,
      contentLength: inputContext?.contentLength || 150,
      emojiCount: inputContext?.emojiCount || 1,
      hasHook: inputContext?.hasHook || true,
      topicCluster: inputContext?.topicCluster || 'general_health',
      recentEngagementRate,
      followerCount: inputContext?.followerCount || 1000
    };
  }

  /**
   * 🏆 Get the best performing style based on follower growth
   */
  private async getBestPerformingStyle(): Promise<ThreadStyle> {
    try {
      // In a real implementation, this would query the database for performance metrics
      // For now, we'll simulate with some logic
      
      // Check if we have performance data
      const performanceData = await this.getStylePerformance();
      
      if (performanceData.length > 0) {
        // Sort by follower growth rate
        const bestStyle = performanceData.sort((a, b) => 
          (b.follower_growth / b.posts_count) - (a.follower_growth / a.posts_count)
        )[0];
        
        const style = this.threadStyles.find(s => s.id === bestStyle.style_id);
        if (style) {
          console.log(`🏆 Best style: ${style.name} (${bestStyle.follower_growth} followers from ${bestStyle.posts_count} posts)`);
          return style;
        }
      }
      
      // Default to emoji numbers if no data
      console.log('📊 No performance data yet, using emoji numbers as default');
      return this.threadStyles[0];
      
    } catch (error) {
      console.error('❌ Error getting best performing style:', error);
      return this.threadStyles[0];
    }
  }

  /**
   * 🎲 Get random style for experimentation
   */
  private getRandomStyle(): ThreadStyle {
    const randomIndex = Math.floor(Math.random() * this.threadStyles.length);
    const style = this.threadStyles[randomIndex];
    console.log(`🎲 Experimenting with: ${style.name}`);
    return style;
  }

  /**
   * 📊 Log performance of a style after posting
   */
  async logStylePerformance(styleId: string, postData: {
    postType: 'single' | 'thread';
    tweetId: string;
    likes: number;
    retweets: number; 
    replies: number;
    impressions?: number;
    follower_change: number;
    content?: string;
  }): Promise<void> {
    try {
      console.log(`📊 Logging performance for style: ${styleId}`);
      console.log(`📈 Engagement: ${postData.likes} likes, ${postData.retweets} retweets, ${postData.replies} replies`);
      console.log(`👥 Follower change: ${postData.follower_change}`);
      
      // Store to database using the SQL function
      const { supabaseClient } = await import('../utils/supabaseClient');
      
      await supabaseClient.rpc('log_style_performance', {
        p_style_id: styleId,
        p_post_type: postData.postType,
        p_tweet_id: postData.tweetId,
        p_likes: postData.likes,
        p_retweets: postData.retweets,
        p_replies: postData.replies,
        p_impressions: postData.impressions || 0,
        p_follower_change: postData.follower_change,
        p_post_content: postData.content || null
      });
      
      console.log(`✅ Style performance logged to database`);
      
    } catch (error) {
      console.error('❌ Error logging style performance:', error);
    }
  }

  /**
   * 🔢 Convert number to emoji format
   */
  private getEmojiNumber(num: number): string {
    const emojiMap: { [key: number]: string } = {
      1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣',
      6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 10: '🔟'
    };
    return emojiMap[num] || `${num}.`;
  }

  /**
   * 🎨 Add subtle hook to content
   */
  private addSubtleHook(content: string): string {
    if (content.includes('?') || content.includes('👇') || content.includes('🧵')) {
      return content; // Already has engagement elements
    }
    
    // Add subtle thread indicator
    return content + ' 👇';
  }

  /**
   * 🚀 Add modern hook style
   */
  private addModernHook(content: string): string {
    if (content.includes('?') || content.includes('👇')) {
      return content;
    }
    
    // More modern, question-based hooks
    if (/\d+\s+(ways|tips|secrets|hacks)/i.test(content)) {
      return content + '\n\nWhich one will you try first? 🤔';
    }
    
    return content + ' ↓';
  }

  /**
   * ✨ Add minimal hook style
   */
  private addMinimalHook(content: string): string {
    // Very clean, no extra elements
    return content;
  }

  /**
   * 📊 Get style performance data from database
   */
  private async getStylePerformance(): Promise<StylePerformance[]> {
    try {
      const { supabaseClient } = await import('../utils/supabaseClient');
      
      const { data, error } = await supabaseClient.rpc('get_best_performing_style', {
        post_type_filter: null // Get all post types
      });
      
      if (error) {
        console.error('❌ Error fetching style performance:', error);
        return [];
      }
      
      return data.map((row: any) => ({
        style_id: row.style_id,
        posts_count: row.total_posts,
        avg_likes: 0, // We use aggregated success_score instead
        avg_retweets: 0,
        avg_replies: 0,
        follower_growth: row.avg_follower_growth,
        last_updated: new Date()
      }));
      
    } catch (error) {
      console.error('❌ Error querying style performance:', error);
      return [];
    }
  }

  /**
   * 🎨 Apply selected style to thread content
   */
  applyStyleToThread(tweets: string[], style: ThreadStyle): string[] {
    return tweets.map((tweet, index) => {
      if (index === 0) {
        // Apply hook style to first tweet
        return style.hookStyle(tweet);
      } else {
        // Apply numbering to subsequent tweets
        const numbering = style.numberingFormat(index);
        
        // Clean existing numbering first
        const cleanTweet = tweet.replace(/^(\d+[\.\/]|\d+\)|[\u0030-\u0039]\uFE0F?\u20E3|→)\s*/, '');
        
        return numbering ? `${numbering} ${cleanTweet}` : cleanTweet;
      }
    });
  }
}