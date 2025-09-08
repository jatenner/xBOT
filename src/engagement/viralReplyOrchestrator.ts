/**
 * 🎭 VIRAL REPLY ORCHESTRATOR
 * 
 * Orchestrates the complete viral reply system:
 * 1. Finds high-value targets using StrategicTargeting
 * 2. Generates viral replies using ViralReplyEngine  
 * 3. Posts REAL comments (not fake @username tweets)
 * 4. Tracks performance and optimizes strategy
 * 5. Drives massive follower growth through strategic engagement
 */

import ViralReplyEngine, { ViralReplyTarget } from './viralReplyEngine';
import StrategicTargeting, { TargetTweet } from './strategicTargeting';

export interface ReplySession {
  session_id: string;
  targets_found: number;
  replies_posted: number;
  success_rate: number;
  expected_total_clicks: number;
  strategies_used: string[];
  top_performing_strategy: string;
  session_started: Date;
  session_completed?: Date;
}

export class ViralReplyOrchestrator {
  private static instance: ViralReplyOrchestrator;
  private viralReplyEngine: ViralReplyEngine;
  private strategicTargeting: StrategicTargeting;

  private constructor() {
    this.viralReplyEngine = ViralReplyEngine.getInstance();
    this.strategicTargeting = StrategicTargeting.getInstance();
  }

  public static getInstance(): ViralReplyOrchestrator {
    if (!ViralReplyOrchestrator.instance) {
      ViralReplyOrchestrator.instance = new ViralReplyOrchestrator();
    }
    return ViralReplyOrchestrator.instance;
  }

  /**
   * 🚀 Execute complete viral reply session
   */
  async executeViralReplySession(maxReplies: number = 3): Promise<ReplySession> {
    const sessionId = `viral_session_${Date.now()}`;
    console.log(`🎭 VIRAL_REPLY_SESSION: Starting session ${sessionId} (max ${maxReplies} replies)`);

    const session: ReplySession = {
      session_id: sessionId,
      targets_found: 0,
      replies_posted: 0,
      success_rate: 0,
      expected_total_clicks: 0,
      strategies_used: [],
      top_performing_strategy: '',
      session_started: new Date()
    };

    try {
      // Step 1: Find high-value targets
      console.log('🎯 STEP_1: Finding high-value reply targets...');
      const targets = await this.strategicTargeting.getTopReplyTargets(maxReplies * 2); // Get extra targets
      session.targets_found = targets.length;

      if (targets.length === 0) {
        console.warn('⚠️ No suitable targets found for viral replies');
        session.session_completed = new Date();
        return session;
      }

      console.log(`✅ Found ${targets.length} high-value targets:`);
      targets.forEach(target => {
        console.log(`  📍 @${target.username}: ${target.reply_opportunity_score}/100 score (${target.suggested_strategy})`);
      });

      // Step 2: Generate and post viral replies
      console.log('🔥 STEP_2: Generating and posting viral replies...');
      const replyResults = [];
      let successCount = 0;
      let totalExpectedClicks = 0;

      for (let i = 0; i < Math.min(targets.length, maxReplies); i++) {
        const target = targets[i];
        
        try {
          // Convert target to viral reply target format
          const viralTarget: ViralReplyTarget = {
            tweet_id: target.tweet_id,
            username: target.username,
            content: target.content,
            follower_count: this.getFollowerCount(target.username),
            topic: this.extractMainTopic(target.content)
          };

          // Generate viral reply
          console.log(`📝 Generating viral reply ${i + 1}/${maxReplies} for @${target.username}...`);
          const reply = await this.viralReplyEngine.generateViralReply(viralTarget);

          if (!reply.success) {
            console.warn(`⚠️ Failed to generate reply for @${target.username}`);
            continue;
          }

          console.log(`✅ Generated ${reply.strategy} reply (${reply.expected_clicks} expected clicks)`);
          console.log(`💬 Content: "${reply.content}"`);

          // Post the viral reply as REAL comment
          const postResult = await this.viralReplyEngine.postViralReply(viralTarget, reply);

          if (postResult.success) {
            successCount++;
            totalExpectedClicks += reply.expected_clicks;
            session.strategies_used.push(reply.strategy);
            
            console.log(`🎉 VIRAL_REPLY_SUCCESS: Posted to @${target.username} (${reply.expected_clicks} expected clicks)`);
            
            replyResults.push({
              target: viralTarget,
              reply,
              postResult,
              expected_clicks: reply.expected_clicks
            });
          } else {
            console.error(`❌ Failed to post reply to @${target.username}: ${postResult.error}`);
          }

          // Rate limiting delay
          await this.delay(2000 + Math.random() * 3000); // 2-5 second delay

        } catch (error) {
          console.error(`❌ Error processing target @${target.username}:`, error);
        }
      }

      // Step 3: Calculate session metrics
      session.replies_posted = successCount;
      session.success_rate = targets.length > 0 ? (successCount / Math.min(targets.length, maxReplies)) * 100 : 0;
      session.expected_total_clicks = totalExpectedClicks;
      session.top_performing_strategy = this.getTopPerformingStrategy(replyResults);
      session.session_completed = new Date();

      // Step 4: Log session summary
      console.log('\n' + '='.repeat(60));
      console.log('🎭 VIRAL_REPLY_SESSION_COMPLETE:');
      console.log(`📊 Targets Found: ${session.targets_found}`);
      console.log(`✅ Replies Posted: ${session.replies_posted}/${maxReplies}`);
      console.log(`📈 Success Rate: ${session.success_rate.toFixed(1)}%`);
      console.log(`🔥 Expected Total Clicks: ${session.expected_total_clicks}`);
      console.log(`🏆 Top Strategy: ${session.top_performing_strategy}`);
      console.log(`⏱️ Duration: ${this.getSessionDuration(session)} minutes`);
      console.log('='.repeat(60));

      // Step 5: Store session analytics
      await this.storeSessionAnalytics(session);

      return session;

    } catch (error) {
      console.error('❌ VIRAL_REPLY_SESSION_ERROR:', error);
      session.session_completed = new Date();
      return session;
    }
  }

  /**
   * 🎯 Execute quick viral reply burst (for immediate engagement)
   */
  async executeQuickViralBurst(): Promise<void> {
    console.log('⚡ QUICK_VIRAL_BURST: Executing rapid engagement burst...');
    
    try {
      const targets = await this.strategicTargeting.getTopReplyTargets(2);
      
      if (targets.length === 0) {
        console.warn('⚠️ No targets available for quick burst');
        return;
      }

      for (const target of targets) {
        const viralTarget: ViralReplyTarget = {
          tweet_id: target.tweet_id,
          username: target.username,
          content: target.content,
          follower_count: this.getFollowerCount(target.username)
        };

        const reply = await this.viralReplyEngine.generateViralReply(viralTarget);
        
        if (reply.success) {
          const postResult = await this.viralReplyEngine.postViralReply(viralTarget, reply);
          
          if (postResult.success) {
            console.log(`⚡ QUICK_BURST_SUCCESS: Engaged with @${target.username}`);
          }
        }

        await this.delay(1000); // Quick delay
      }

    } catch (error) {
      console.error('❌ QUICK_BURST_ERROR:', error);
    }
  }

  /**
   * 📊 Get follower count for username (from strategic targeting data)
   */
  private getFollowerCount(username: string): number {
    const accounts = this.strategicTargeting.getHighValueHealthAccounts();
    const account = accounts.find(acc => acc.username === username);
    return account ? account.follower_count : 50000; // Default estimate
  }

  /**
   * 🏷️ Extract main topic from tweet content
   */
  private extractMainTopic(content: string): string {
    const healthKeywords = this.strategicTargeting.getHealthKeywords();
    const lowerContent = content.toLowerCase();
    
    for (const keyword of healthKeywords) {
      if (lowerContent.includes(keyword)) {
        return keyword;
      }
    }
    
    return 'health optimization';
  }

  /**
   * 🏆 Get top performing strategy from results
   */
  private getTopPerformingStrategy(results: any[]): string {
    if (results.length === 0) return 'none';

    const strategyScores: { [key: string]: number[] } = {};
    
    results.forEach(result => {
      const strategy = result.reply.strategy;
      const clicks = result.expected_clicks;
      
      if (!strategyScores[strategy]) {
        strategyScores[strategy] = [];
      }
      strategyScores[strategy].push(clicks);
    });

    let topStrategy = 'none';
    let topScore = 0;

    Object.entries(strategyScores).forEach(([strategy, scores]) => {
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      if (avgScore > topScore) {
        topScore = avgScore;
        topStrategy = strategy;
      }
    });

    return topStrategy;
  }

  /**
   * ⏱️ Get session duration in minutes
   */
  private getSessionDuration(session: ReplySession): string {
    if (!session.session_completed) return 'ongoing';
    
    const durationMs = session.session_completed.getTime() - session.session_started.getTime();
    const minutes = Math.round(durationMs / 60000 * 10) / 10;
    return minutes.toString();
  }

  /**
   * ⏳ Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 📊 Store session analytics
   */
  private async storeSessionAnalytics(session: ReplySession): Promise<void> {
    try {
      const { supabaseClient } = await import('../db/supabaseClient');
      
      const analyticsData = {
        session_id: session.session_id,
        targets_found: session.targets_found,
        replies_posted: session.replies_posted,
        success_rate: session.success_rate,
        expected_total_clicks: session.expected_total_clicks,
        strategies_used: session.strategies_used,
        top_performing_strategy: session.top_performing_strategy,
        session_started: session.session_started.toISOString(),
        session_completed: session.session_completed?.toISOString(),
        duration_minutes: parseFloat(this.getSessionDuration(session))
      };

      const result = await supabaseClient.safeInsert('viral_reply_sessions', analyticsData);
      
      if (result.success) {
        console.log('📊 SESSION_ANALYTICS_STORED: Session data saved for analysis');
      } else {
        console.warn('⚠️ SESSION_ANALYTICS_WARNING:', result.error?.message);
      }

    } catch (error) {
      console.error('❌ SESSION_ANALYTICS_ERROR:', error);
    }
  }

  /**
   * 📈 Get viral reply performance analytics
   */
  async getPerformanceAnalytics(): Promise<{
    total_sessions: number;
    total_replies_posted: number;
    avg_success_rate: number;
    total_expected_clicks: number;
    top_strategies: string[];
  }> {
    try {
      const { supabaseClient } = await import('../db/supabaseClient');
      
      const result = await supabaseClient.safeSelect('viral_reply_sessions');
      
      if (!result.success || !result.data || result.data.length === 0) {
        return {
          total_sessions: 0,
          total_replies_posted: 0,
          avg_success_rate: 0,
          total_expected_clicks: 0,
          top_strategies: []
        };
      }

      const sessions = result.data;
      
      const totalReplies = sessions.reduce((sum: number, s: any) => sum + (Number(s.replies_posted) || 0), 0) as number;
      const totalSuccessRate = sessions.reduce((sum: number, s: any) => sum + (Number(s.success_rate) || 0), 0) as number;
      const totalClicks = sessions.reduce((sum: number, s: any) => sum + (Number(s.expected_total_clicks) || 0), 0) as number;
      
      const analytics = {
        total_sessions: sessions.length,
        total_replies_posted: totalReplies,
        avg_success_rate: sessions.length > 0 ? (totalSuccessRate / sessions.length) : 0,
        total_expected_clicks: totalClicks,
        top_strategies: this.getTopStrategiesFromSessions(sessions)
      };

      return analytics;

    } catch (error) {
      console.error('❌ PERFORMANCE_ANALYTICS_ERROR:', error);
      return {
        total_sessions: 0,
        total_replies_posted: 0,
        avg_success_rate: 0,
        total_expected_clicks: 0,
        top_strategies: []
      };
    }
  }

  /**
   * 🏆 Extract top strategies from session data
   */
  private getTopStrategiesFromSessions(sessions: any[]): string[] {
    const strategyFrequency: { [key: string]: number } = {};
    
    sessions.forEach(session => {
      if (session.top_performing_strategy) {
        strategyFrequency[session.top_performing_strategy] = 
          (strategyFrequency[session.top_performing_strategy] || 0) + 1;
      }
    });

    return Object.entries(strategyFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([strategy]) => strategy);
  }
}

export default ViralReplyOrchestrator;
