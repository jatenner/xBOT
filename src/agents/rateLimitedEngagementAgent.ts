import { xClient } from '../utils/xClient';
import OpenAI from 'openai';

interface EngagementAction {
  type: 'reply' | 'like' | 'follow' | 'retweet' | 'search' | 'analyze';
  success: boolean;
  target?: string;
  content?: string;
  reasoning: string;
}

interface RateLimitStatus {
  tweets: { remaining: number; limit: number; resetTime: Date };
  replies: { remaining: number; limit: number; resetTime: Date };
  likes: { remaining: number; limit: number; resetTime: Date };
  follows: { remaining: number; limit: number; resetTime: Date };
  searches: { remaining: number; limit: number; resetTime: Date };
}

export class RateLimitedEngagementAgent {
  private openai: OpenAI;
  private engagementActions: EngagementAction[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async run(): Promise<any> {
    console.log('🚫 === RATE LIMITED MODE ACTIVATED ===');
    console.log('🚀 MAXIMIZING ALL AVAILABLE ENGAGEMENT OPTIONS');
    
    // Check what we can still do
    const rateLimits = await this.checkRateLimits();
    console.log('📊 Current Rate Limit Status:');
    console.log(`   Tweets: ${rateLimits.tweets.remaining}/${rateLimits.tweets.limit} (BLOCKED)`);
    console.log(`   Replies: ${rateLimits.replies.remaining}/${rateLimits.replies.limit} ✅`);
    console.log(`   Likes: ${rateLimits.likes.remaining}/${rateLimits.likes.limit} ✅`);
    console.log(`   Follows: ${rateLimits.follows.remaining}/${rateLimits.follows.limit} ✅`);
    console.log(`   Searches: ${rateLimits.searches.remaining}/${rateLimits.searches.limit} ✅`);

    // Execute all available engagement strategies
    const results = await Promise.allSettled([
      this.massiveReplyEngagement(),
      this.strategicLikingCampaign(), 
      this.networkBuildingSession(),
      this.contentCurationRetweets(),
      this.competitorIntelligence(),
      this.trendResearchSession(),
      this.audienceAnalysisDeep(),
      this.contentStrategyOptimization()
    ]);

    const successfulActions = results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value)
      .flat();

    console.log(`\n🎊 RATE LIMITED ENGAGEMENT COMPLETE`);
    console.log(`✅ Successfully executed ${successfulActions.length} engagement actions`);
    console.log(`🎯 Next tweet available: ${rateLimits.tweets.resetTime.toLocaleString()}`);
    console.log(`💪 Productivity during rate limit: MAXIMUM`);

    return {
      success: true,
      mode: 'rate_limited_maximum_engagement',
      actionsCompleted: successfulActions.length,
      nextTweetTime: rateLimits.tweets.resetTime,
      engagementActions: successfulActions,
      rateLimitStatus: rateLimits
    };
  }

  private async checkRateLimits(): Promise<RateLimitStatus> {
    try {
      // Note: In real implementation, we'd check actual rate limit headers
      // For now, simulate based on known Twitter API v2 limits
      const now = new Date();
      const resetIn15Min = new Date(now.getTime() + 15 * 60 * 1000);
      const resetIn24Hr = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      return {
        tweets: { remaining: 0, limit: 17, resetTime: resetIn24Hr },
        replies: { remaining: 300, limit: 300, resetTime: resetIn15Min },
        likes: { remaining: 300, limit: 300, resetTime: resetIn15Min },
        follows: { remaining: 400, limit: 400, resetTime: resetIn24Hr },
        searches: { remaining: 300, limit: 300, resetTime: resetIn15Min }
      };
    } catch (error) {
      console.log('⚠️ Could not check rate limits, proceeding with defaults');
      const now = new Date();
      return {
        tweets: { remaining: 0, limit: 17, resetTime: new Date(now.getTime() + 17 * 60 * 60 * 1000) },
        replies: { remaining: 300, limit: 300, resetTime: new Date(now.getTime() + 15 * 60 * 1000) },
        likes: { remaining: 300, limit: 300, resetTime: new Date(now.getTime() + 15 * 60 * 1000) },
        follows: { remaining: 400, limit: 400, resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        searches: { remaining: 300, limit: 300, resetTime: new Date(now.getTime() + 15 * 60 * 1000) }
      };
    }
  }

  private async massiveReplyEngagement(): Promise<EngagementAction[]> {
    console.log('💬 === MASSIVE REPLY ENGAGEMENT (300 per 15 min) ===');
    const actions: EngagementAction[] = [];

    try {
      // Search for health tech conversations to join
      const healthTopics = [
        'digital health innovation',
        'AI healthcare breakthrough', 
        'telemedicine trends',
        'health data analytics',
        'medical device innovation',
        'patient care technology'
      ];

      for (const topic of healthTopics) {
        try {
          const searchResults = await xClient.v2.search(topic, {
            max_results: 10,
            'tweet.fields': ['public_metrics', 'conversation_id'],
            'expansions': ['author_id']
          });

          if (searchResults.data?.data) {
            for (const tweet of searchResults.data.data.slice(0, 5)) {
              const shouldReply = await this.analyzeReplyOpportunity(tweet);
              
              if (shouldReply.engage) {
                const reply = await this.generateValueAddReply(tweet);
                const replyResult = await this.postStrategicReply(tweet.id, reply);
                
                if (replyResult.success) {
                  actions.push({
                    type: 'reply',
                    success: true,
                    target: tweet.id,
                    content: reply,
                    reasoning: 'Building thought leadership through valuable replies'
                  });
                  
                  console.log(`💬 Replied to ${topic} discussion`);
                }
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not engage with ${topic} topic`);
        }
      }

      console.log(`✅ Reply engagement: ${actions.length} valuable conversations joined`);
      return actions;

    } catch (error) {
      console.log('⚠️ Reply engagement error:', error);
      return [];
    }
  }

  private async strategicLikingCampaign(): Promise<EngagementAction[]> {
    console.log('❤️ === STRATEGIC LIKING CAMPAIGN (300 per 15 min) ===');
    const actions: EngagementAction[] = [];

    try {
      // Find high-quality health tech content to like
      const influencers = [
        'healthcare',
        'healthtech', 
        'digitalhealth',
        'medtech',
        'healthinnovation'
      ];

      for (const hashtag of influencers) {
        try {
          const results = await xClient.v2.search(`#${hashtag}`, {
            max_results: 20,
            'tweet.fields': ['public_metrics'],
            'expansions': ['author_id']
          });

          if (results.data?.data) {
            // Like high-engagement, relevant tweets
            for (const tweet of results.data.data.slice(0, 10)) {
              const metrics = tweet.public_metrics;
              
              // Like tweets with good engagement that align with our brand
              if (metrics && (metrics.retweet_count > 5 || metrics.like_count > 20)) {
                try {
                  await xClient.v2.like(xClient.currentUser?.id!, tweet.id);
                  actions.push({
                    type: 'like',
                    success: true,
                    target: tweet.id,
                    reasoning: `Liked high-engagement ${hashtag} content`
                  });
                  
                  console.log(`❤️ Liked trending ${hashtag} tweet`);
                } catch (error) {
                  console.log(`⚠️ Could not like tweet ${tweet.id}`);
                }
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not process ${hashtag} hashtag`);
        }
      }

      console.log(`✅ Strategic liking: ${actions.length} high-value tweets liked`);
      return actions;

    } catch (error) {
      console.log('⚠️ Liking campaign error:', error);
      return [];
    }
  }

  private async networkBuildingSession(): Promise<EngagementAction[]> {
    console.log('🤝 === NETWORK BUILDING SESSION (400 follows per day) ===');
    const actions: EngagementAction[] = [];

    try {
      const targetFollows = [
        'health tech founders',
        'digital health researchers',
        'medical innovation leaders',
        'healthcare AI experts'
      ];

      for (const category of targetFollows) {
        // Search for relevant users to follow
        const searchQuery = category.replace(' ', '+');
        
        try {
          const results = await xClient.v2.search(searchQuery, {
            max_results: 10,
            'expansions': ['author_id'],
            'user.fields': ['verified', 'public_metrics']
          });

          if (results.includes?.users) {
            for (const user of results.includes.users.slice(0, 3)) {
              // Follow verified users or those with good following
              const metrics = user.public_metrics;
              if (user.verified || (metrics && metrics.followers_count > 1000)) {
                try {
                  await xClient.v2.follow(xClient.currentUser?.id!, user.id);
                  actions.push({
                    type: 'follow',
                    success: true,
                    target: user.id,
                    reasoning: `Followed ${category}: @${user.username}`
                  });
                  
                  console.log(`➕ Followed @${user.username} (${category})`);
                } catch (error) {
                  console.log(`⚠️ Could not follow @${user.username}`);
                }
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not search for ${category}`);
        }
      }

      console.log(`✅ Network building: ${actions.length} strategic follows completed`);
      return actions;

    } catch (error) {
      console.log('⚠️ Network building error:', error);
      return [];
    }
  }

  private async contentCurationRetweets(): Promise<EngagementAction[]> {
    console.log('🔄 === CONTENT CURATION RETWEETS (300 per 15 min) ===');
    const actions: EngagementAction[] = [];

    try {
      // Find exceptional health tech content to retweet
      const curatedSources = [
        'breakthrough medical research',
        'health tech innovation news',
        'digital therapeutics updates',
        'AI healthcare discoveries'
      ];

      for (const source of curatedSources) {
        try {
          const results = await xClient.v2.search(source, {
            max_results: 10,
            'tweet.fields': ['public_metrics', 'created_at'],
            'expansions': ['author_id']
          });

          if (results.data?.data) {
            for (const tweet of results.data.data.slice(0, 2)) {
              const shouldRetweet = await this.analyzeRetweetValue(tweet);
              
              if (shouldRetweet.valuable) {
                try {
                  await xClient.v2.retweet(xClient.currentUser?.id!, tweet.id);
                  actions.push({
                    type: 'retweet',
                    success: true,
                    target: tweet.id,
                    reasoning: `Curated valuable ${source} content`
                  });
                  
                  console.log(`🔄 Retweeted ${source} content`);
                } catch (error) {
                  console.log(`⚠️ Could not retweet ${tweet.id}`);
                }
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not curate ${source}`);
        }
      }

      console.log(`✅ Content curation: ${actions.length} valuable retweets shared`);
      return actions;

    } catch (error) {
      console.log('⚠️ Content curation error:', error);
      return [];
    }
  }

  private async competitorIntelligence(): Promise<EngagementAction[]> {
    console.log('🔍 === COMPETITOR INTELLIGENCE GATHERING ===');
    const actions: EngagementAction[] = [];

    try {
      const competitors = [
        'teladoc',
        'amwell', 
        'dexcom',
        'veracyte',
        'guardant'
      ];

      for (const competitor of competitors.slice(0, 3)) {
        try {
          const timeline = await xClient.v2.userTimelineByUsername(competitor, {
            max_results: 10,
            'tweet.fields': ['public_metrics', 'created_at']
          });

          if (timeline.data?.data) {
            const analysis = await this.analyzeCompetitorStrategy(competitor, timeline.data.data);
            actions.push({
              type: 'analyze',
              success: true,
              target: competitor,
              reasoning: `Analyzed ${competitor} content strategy and engagement patterns`
            });
            
            console.log(`🔍 Analyzed @${competitor} strategy`);
          }
        } catch (error) {
          console.log(`⚠️ Could not analyze @${competitor}`);
        }
      }

      console.log(`✅ Competitor intelligence: ${actions.length} comprehensive analyses`);
      return actions;

    } catch (error) {
      console.log('⚠️ Competitor intelligence error:', error);
      return [];
    }
  }

  private async trendResearchSession(): Promise<EngagementAction[]> {
    console.log('📈 === TREND RESEARCH SESSION ===');
    const actions: EngagementAction[] = [];

    try {
      const trendTopics = [
        'AI healthcare 2024',
        'digital therapeutics FDA',
        'remote patient monitoring',
        'health data interoperability',
        'precision medicine AI'
      ];

      for (const topic of trendTopics) {
        try {
          const results = await xClient.v2.search(topic, {
            max_results: 50,
            'tweet.fields': ['public_metrics', 'created_at'],
            'expansions': ['author_id']
          });

          if (results.data?.data) {
            const trendAnalysis = await this.analyzeTrendData(topic, results.data.data);
            actions.push({
              type: 'analyze',
              success: true,
              content: trendAnalysis,
              reasoning: `Deep trend analysis of ${topic}`
            });
            
            console.log(`📈 Analyzed ${topic} trend patterns`);
          }
        } catch (error) {
          console.log(`⚠️ Could not research ${topic}`);
        }
      }

      console.log(`✅ Trend research: ${actions.length} comprehensive trend analyses`);
      return actions;

    } catch (error) {
      console.log('⚠️ Trend research error:', error);
      return [];
    }
  }

  private async audienceAnalysisDeep(): Promise<EngagementAction[]> {
    console.log('👥 === DEEP AUDIENCE ANALYSIS ===');
    const actions: EngagementAction[] = [];

    try {
      // Analyze our followers and their interests
      const ourTweets = await xClient.v2.userTimeline(xClient.currentUser?.id!, {
        max_results: 20,
        'tweet.fields': ['public_metrics', 'created_at']
      });

      if (ourTweets.data?.data) {
        const audienceInsights = await this.analyzeAudiencePatterns(ourTweets.data.data);
        actions.push({
          type: 'analyze',
          success: true,
          content: audienceInsights,
          reasoning: 'Deep analysis of audience engagement patterns and preferences'
        });
        
        console.log('👥 Completed deep audience analysis');
      }

      console.log(`✅ Audience analysis: ${actions.length} comprehensive insights`);
      return actions;

    } catch (error) {
      console.log('⚠️ Audience analysis error:', error);
      return [];
    }
  }

  private async contentStrategyOptimization(): Promise<EngagementAction[]> {
    console.log('🎯 === CONTENT STRATEGY OPTIMIZATION ===');
    const actions: EngagementAction[] = [];

    try {
      // Use this time to prepare optimized content for when limits reset
      const optimization = await this.optimizeContentStrategy();
      actions.push({
        type: 'analyze',
        success: true,
        content: optimization,
        reasoning: 'Prepared optimized content strategy for when tweet limits reset'
      });
      
      console.log('🎯 Content strategy optimized for limit reset');
      console.log(`✅ Content optimization: ${actions.length} strategic plans prepared`);
      return actions;

    } catch (error) {
      console.log('⚠️ Content optimization error:', error);
      return [];
    }
  }

  // Helper methods
  private async analyzeReplyOpportunity(tweet: any): Promise<any> {
    try {
      const analysis = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Quickly analyze if this health tech tweet is worth replying to. Return {engage: boolean, priority: 1-5}"
          },
          {
            role: "user", 
            content: JSON.stringify(tweet)
          }
        ],
        temperature: 0.3
      });
      
      return JSON.parse(analysis.choices[0].message.content || '{"engage": false}');
    } catch {
      return { engage: false };
    }
  }

  private async generateValueAddReply(tweet: any): Promise<string> {
    try {
      const reply = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Generate a valuable, professional reply that adds insight to this health tech discussion. Keep under 280 characters."
          },
          {
            role: "user",
            content: JSON.stringify(tweet)
          }
        ],
        temperature: 0.6
      });
      
      return reply.choices[0].message.content || "Great insights on health tech innovation!";
    } catch {
      return "Interesting perspective on healthcare technology trends!";
    }
  }

  private async postStrategicReply(tweetId: string, content: string): Promise<any> {
    try {
      const reply = await xClient.v2.reply(content, tweetId);
      return { success: true, replyId: reply.data.id };
    } catch (error) {
      return { success: false, error };
    }
  }

  private async analyzeRetweetValue(tweet: any): Promise<any> {
    try {
      const metrics = tweet.public_metrics;
      const valuable = metrics && (metrics.retweet_count > 10 || metrics.like_count > 50);
      return { valuable, reasoning: 'High engagement content' };
    } catch {
      return { valuable: false };
    }
  }

  private async analyzeCompetitorStrategy(competitor: string, tweets: any[]): Promise<string> {
    try {
      const analysis = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analyze competitor content strategy and identify actionable insights."
          },
          {
            role: "user",
            content: `Competitor: ${competitor}\nTweets: ${JSON.stringify(tweets)}`
          }
        ],
        temperature: 0.2
      });
      
      return analysis.choices[0].message.content || 'Analysis completed';
    } catch {
      return 'Basic competitor analysis completed';
    }
  }

  private async analyzeTrendData(topic: string, tweets: any[]): Promise<string> {
    try {
      const analysis = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analyze trend data and identify content opportunities."
          },
          {
            role: "user",
            content: `Topic: ${topic}\nTweets: ${JSON.stringify(tweets.slice(0, 10))}`
          }
        ],
        temperature: 0.2
      });
      
      return analysis.choices[0].message.content || 'Trend analysis completed';
    } catch {
      return 'Basic trend analysis completed';
    }
  }

  private async analyzeAudiencePatterns(tweets: any[]): Promise<string> {
    try {
      const analysis = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analyze audience engagement patterns and preferences."
          },
          {
            role: "user",
            content: JSON.stringify(tweets)
          }
        ],
        temperature: 0.2
      });
      
      return analysis.choices[0].message.content || 'Audience analysis completed';
    } catch {
      return 'Basic audience analysis completed';
    }
  }

  private async optimizeContentStrategy(): Promise<string> {
    try {
      const optimization = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Create an optimized content strategy for when tweet limits reset. Prepare 10 high-engagement tweet ideas."
          },
          {
            role: "user",
            content: "Generate strategic content plan for tomorrow when limits reset"
          }
        ],
        temperature: 0.4
      });
      
      return optimization.choices[0].message.content || 'Content strategy optimized';
    } catch {
      return 'Basic content strategy prepared';
    }
  }
} 