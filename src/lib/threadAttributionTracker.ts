/**
 * 🧵 THREAD ATTRIBUTION TRACKER
 * Comprehensive thread tracking and per-node attribution
 * 
 * Features:
 * - Individual tweet ID capture for each thread node
 * - Per-node metrics tracking (likes, retweets, replies)
 * - Thread-level aggregation and performance analysis
 * - Follower attribution split across thread nodes
 * - Thread completion verification
 */

import { getUnifiedDataManager } from './unifiedDataManager';
import { getRealMetricsScraper } from '../scrapers/realMetricsScraper';

interface ThreadNode {
  postId: string; // Individual tweet ID
  threadId: string; // Root thread ID
  postIndex: number; // Position in thread (0 = root)
  content: string;
  individualMetrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    bookmarks: number;
  };
  nodePerformance: {
    engagementRate: number;
    viralCoefficient: number;
    followersAttributed: number;
    dropoffRate: number; // How many stop reading here
  };
  postedAt: Date;
  lastUpdated: Date;
}

interface ThreadMetrics {
  threadId: string;
  rootPostId: string;
  nodes: ThreadNode[];
  threadPerformance: {
    totalLikes: number;
    totalRetweets: number;
    totalReplies: number;
    totalImpressions: number;
    avgEngagementPerNode: number;
    threadCompletionRate: number; // % who read to end
    bestPerformingNode: number; // Index of best node
    worstPerformingNode: number; // Index of worst node
    followersAttributedTotal: number;
    threadViralScore: number;
  };
  contentAnalysis: {
    threadLength: number;
    avgNodeLength: number;
    contentQuality: number;
    topicCoherence: number;
    cliffhangerEffectiveness: number[];
  };
}

export class ThreadAttributionTracker {
  private static instance: ThreadAttributionTracker;
  private dataManager = getUnifiedDataManager();
  private metricsScraper = getRealMetricsScraper();
  private activeThreads = new Map<string, ThreadMetrics>();

  private constructor() {}

  public static getInstance(): ThreadAttributionTracker {
    if (!ThreadAttributionTracker.instance) {
      ThreadAttributionTracker.instance = new ThreadAttributionTracker();
    }
    return ThreadAttributionTracker.instance;
  }

  /**
   * 🧵 START THREAD TRACKING
   * Called when a thread is posted
   */
  public async startThreadTracking(
    threadId: string,
    threadContent: string[],
    individualTweetIds: string[]
  ): Promise<void> {
    console.log(`🧵 THREAD_TRACKER: Starting tracking for thread ${threadId} with ${threadContent.length} nodes`);

    try {
      if (threadContent.length !== individualTweetIds.length) {
        console.warn(`⚠️ THREAD_TRACKER: Content/ID mismatch - ${threadContent.length} content vs ${individualTweetIds.length} IDs`);
      }

      // Create thread nodes
      const nodes: ThreadNode[] = threadContent.map((content, index) => ({
        postId: individualTweetIds[index] || `${threadId}_${index}`,
        threadId,
        postIndex: index,
        content,
        individualMetrics: {
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          bookmarks: 0
        },
        nodePerformance: {
          engagementRate: 0,
          viralCoefficient: 0,
          followersAttributed: 0,
          dropoffRate: 0
        },
        postedAt: new Date(),
        lastUpdated: new Date()
      }));

      // Create thread metrics
      const threadMetrics: ThreadMetrics = {
        threadId,
        rootPostId: individualTweetIds[0] || threadId,
        nodes,
        threadPerformance: {
          totalLikes: 0,
          totalRetweets: 0,
          totalReplies: 0,
          totalImpressions: 0,
          avgEngagementPerNode: 0,
          threadCompletionRate: 0,
          bestPerformingNode: 0,
          worstPerformingNode: 0,
          followersAttributedTotal: 0,
          threadViralScore: 0
        },
        contentAnalysis: {
          threadLength: threadContent.length,
          avgNodeLength: threadContent.reduce((sum, c) => sum + c.length, 0) / threadContent.length,
          contentQuality: 0,
          topicCoherence: 0,
          cliffhangerEffectiveness: []
        }
      };

      // Store in memory for real-time tracking
      this.activeThreads.set(threadId, threadMetrics);

      // Store each node in unified data
      for (const node of nodes) {
        await this.dataManager.storePost({
          postId: node.postId,
          threadId: node.threadId,
          postIndex: node.postIndex,
          content: node.content,
          postType: node.postIndex === 0 ? 'thread_root' : 'thread_reply',
          contentLength: node.content.length,
          postedAt: node.postedAt,
          hourPosted: node.postedAt.getHours(),
          minutePosted: node.postedAt.getMinutes(),
          dayOfWeek: node.postedAt.getDay(),
          likes: 0,
          retweets: 0,
          replies: 0,
          impressions: 0,
          profileClicks: 0,
          linkClicks: 0,
          bookmarks: 0,
          shares: 0,
          followersBefore: await this.getCurrentFollowerCount(),
          followersAttributed: 0,
          aiGenerated: true,
          aiStrategy: 'thread_posting'
        });
      }

      // Schedule metrics updates
      this.scheduleThreadUpdates(threadId);

      console.log(`✅ THREAD_TRACKER: Thread ${threadId} tracking started (${nodes.length} nodes)`);

    } catch (error: any) {
      console.error('❌ THREAD_TRACKER: Failed to start tracking:', error.message);
    }
  }

  /**
   * 🔄 UPDATE THREAD METRICS
   * Updates metrics for all nodes in a thread
   */
  public async updateThreadMetrics(threadId: string): Promise<void> {
    console.log(`🔄 THREAD_TRACKER: Updating metrics for thread ${threadId}`);

    try {
      const threadMetrics = this.activeThreads.get(threadId);
      if (!threadMetrics) {
        console.warn(`⚠️ THREAD_TRACKER: Thread ${threadId} not found in active tracking`);
        return;
      }

      // Update metrics for each node
      for (const node of threadMetrics.nodes) {
        try {
          const nodeMetrics = await this.metricsScraper.scrapePostMetrics(node.postId);
          
          // Update node metrics
          node.individualMetrics = {
            likes: nodeMetrics.likes,
            retweets: nodeMetrics.retweets,
            replies: nodeMetrics.replies,
            impressions: nodeMetrics.impressions,
            bookmarks: nodeMetrics.bookmarks
          };

          // Calculate node performance
          node.nodePerformance = this.calculateNodePerformance(node, threadMetrics);
          node.lastUpdated = new Date();

          // Update in unified data
          await this.updateNodeInDatabase(node);

          console.log(`✅ NODE_UPDATED: ${node.postId} (${nodeMetrics.likes}L, ${nodeMetrics.retweets}RT, ${nodeMetrics.replies}R)`);

        } catch (error: any) {
          console.error(`❌ Failed to update node ${node.postId}:`, error.message);
        }
      }

      // Calculate thread-level metrics
      threadMetrics.threadPerformance = this.calculateThreadPerformance(threadMetrics);
      threadMetrics.contentAnalysis = this.analyzeThreadContent(threadMetrics);

      // Update active tracking
      this.activeThreads.set(threadId, threadMetrics);

      console.log(`✅ THREAD_UPDATED: ${threadId} - Total engagement: ${threadMetrics.threadPerformance.totalLikes + threadMetrics.threadPerformance.totalRetweets + threadMetrics.threadPerformance.totalReplies}`);

    } catch (error: any) {
      console.error('❌ THREAD_TRACKER: Failed to update metrics:', error.message);
    }
  }

  /**
   * 📊 CALCULATE NODE PERFORMANCE
   */
  private calculateNodePerformance(node: ThreadNode, threadMetrics: ThreadMetrics): typeof node.nodePerformance {
    const totalEngagement = node.individualMetrics.likes + node.individualMetrics.retweets + node.individualMetrics.replies;
    const impressions = Math.max(node.individualMetrics.impressions, 1);
    
    // Engagement rate for this node
    const engagementRate = totalEngagement / impressions;
    
    // Viral coefficient (retweets per impression)
    const viralCoefficient = node.individualMetrics.retweets / impressions;
    
    // Estimate followers attributed to this specific node
    const nodeWeight = totalEngagement / Math.max(this.getTotalThreadEngagement(threadMetrics), 1);
    const followersAttributed = nodeWeight * threadMetrics.threadPerformance.followersAttributedTotal;
    
    // Calculate dropoff rate (how many stop reading here)
    const dropoffRate = this.calculateNodeDropoffRate(node, threadMetrics);

    return {
      engagementRate,
      viralCoefficient,
      followersAttributed,
      dropoffRate
    };
  }

  /**
   * 📈 CALCULATE THREAD PERFORMANCE
   */
  private calculateThreadPerformance(threadMetrics: ThreadMetrics): typeof threadMetrics.threadPerformance {
    const nodes = threadMetrics.nodes;
    
    const totalLikes = nodes.reduce((sum, n) => sum + n.individualMetrics.likes, 0);
    const totalRetweets = nodes.reduce((sum, n) => sum + n.individualMetrics.retweets, 0);
    const totalReplies = nodes.reduce((sum, n) => sum + n.individualMetrics.replies, 0);
    const totalImpressions = nodes.reduce((sum, n) => sum + n.individualMetrics.impressions, 0);
    
    const avgEngagementPerNode = (totalLikes + totalRetweets + totalReplies) / nodes.length;
    
    // Find best and worst performing nodes
    const nodeEngagements = nodes.map((n, i) => ({
      index: i,
      engagement: n.individualMetrics.likes + n.individualMetrics.retweets + n.individualMetrics.replies
    }));
    
    nodeEngagements.sort((a, b) => b.engagement - a.engagement);
    const bestPerformingNode = nodeEngagements[0]?.index || 0;
    const worstPerformingNode = nodeEngagements[nodeEngagements.length - 1]?.index || 0;
    
    // Calculate thread completion rate (impressions decay)
    const threadCompletionRate = this.calculateThreadCompletionRate(nodes);
    
    // Estimate total followers attributed to thread
    const followersAttributedTotal = this.estimateThreadFollowerAttribution(threadMetrics);
    
    // Calculate thread viral score
    const threadViralScore = (totalRetweets / Math.max(totalImpressions, 1)) * 100;

    return {
      totalLikes,
      totalRetweets,
      totalReplies,
      totalImpressions,
      avgEngagementPerNode,
      threadCompletionRate,
      bestPerformingNode,
      worstPerformingNode,
      followersAttributedTotal,
      threadViralScore
    };
  }

  /**
   * 📝 ANALYZE THREAD CONTENT
   */
  private analyzeThreadContent(threadMetrics: ThreadMetrics): typeof threadMetrics.contentAnalysis {
    const nodes = threadMetrics.nodes;
    
    // Calculate cliffhanger effectiveness for each node
    const cliffhangerEffectiveness = nodes.map((node, index) => {
      if (index === nodes.length - 1) return 0; // Last node has no cliffhanger
      
      const currentEngagement = node.individualMetrics.likes + node.individualMetrics.retweets;
      const nextNode = nodes[index + 1];
      const nextEngagement = nextNode.individualMetrics.likes + nextNode.individualMetrics.retweets;
      
      // Good cliffhanger maintains or increases engagement
      return nextEngagement >= currentEngagement * 0.8 ? 1 : 0;
    });
    
    // Estimate content quality based on engagement patterns
    const contentQuality = this.estimateContentQuality(threadMetrics);
    
    // Calculate topic coherence (simple heuristic)
    const topicCoherence = this.calculateTopicCoherence(nodes);

    return {
      threadLength: nodes.length,
      avgNodeLength: nodes.reduce((sum, n) => sum + n.content.length, 0) / nodes.length,
      contentQuality,
      topicCoherence,
      cliffhangerEffectiveness
    };
  }

  /**
   * ⏰ SCHEDULE THREAD UPDATES
   */
  private scheduleThreadUpdates(threadId: string): void {
    // Update at 1 hour
    setTimeout(() => {
      this.updateThreadMetrics(threadId);
    }, 60 * 60 * 1000);

    // Update at 24 hours
    setTimeout(() => {
      this.updateThreadMetrics(threadId);
    }, 24 * 60 * 60 * 1000);

    // Final update at 7 days
    setTimeout(() => {
      this.updateThreadMetrics(threadId);
      this.finalizeThreadTracking(threadId);
    }, 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * ✅ FINALIZE THREAD TRACKING
   */
  private async finalizeThreadTracking(threadId: string): Promise<void> {
    console.log(`✅ THREAD_TRACKER: Finalizing tracking for thread ${threadId}`);

    try {
      const threadMetrics = this.activeThreads.get(threadId);
      if (!threadMetrics) return;

      // Final metrics update
      await this.updateThreadMetrics(threadId);

      // Generate thread performance report
      const report = this.generateThreadReport(threadMetrics);
      console.log(`📊 THREAD_REPORT: ${threadId}`, report);

      // Remove from active tracking
      this.activeThreads.delete(threadId);

      console.log(`🏁 THREAD_TRACKER: Thread ${threadId} tracking completed`);

    } catch (error: any) {
      console.error('❌ THREAD_TRACKER: Failed to finalize tracking:', error.message);
    }
  }

  // Helper methods
  private getTotalThreadEngagement(threadMetrics: ThreadMetrics): number {
    return threadMetrics.nodes.reduce((sum, n) => 
      sum + n.individualMetrics.likes + n.individualMetrics.retweets + n.individualMetrics.replies, 0
    );
  }

  private calculateNodeDropoffRate(node: ThreadNode, threadMetrics: ThreadMetrics): number {
    const nodeIndex = node.postIndex;
    if (nodeIndex >= threadMetrics.nodes.length - 1) return 0;
    
    const currentImpressions = node.individualMetrics.impressions;
    const nextNode = threadMetrics.nodes[nodeIndex + 1];
    const nextImpressions = nextNode.individualMetrics.impressions;
    
    if (currentImpressions === 0) return 0;
    return Math.max(0, (currentImpressions - nextImpressions) / currentImpressions);
  }

  private calculateThreadCompletionRate(nodes: ThreadNode[]): number {
    if (nodes.length < 2) return 1;
    
    const firstImpressions = nodes[0].individualMetrics.impressions;
    const lastImpressions = nodes[nodes.length - 1].individualMetrics.impressions;
    
    if (firstImpressions === 0) return 0;
    return lastImpressions / firstImpressions;
  }

  private estimateThreadFollowerAttribution(threadMetrics: ThreadMetrics): number {
    const totalEngagement = this.getTotalThreadEngagement(threadMetrics);
    // Simple estimation: 1 follower per 50 total engagements for threads
    return Math.round(totalEngagement / 50);
  }

  private estimateContentQuality(threadMetrics: ThreadMetrics): number {
    const avgEngagement = threadMetrics.threadPerformance.avgEngagementPerNode;
    const completionRate = threadMetrics.threadPerformance.threadCompletionRate;
    const viralScore = threadMetrics.threadPerformance.threadViralScore;
    
    // Weighted quality score
    return Math.min(1, (avgEngagement / 20) * 0.4 + completionRate * 0.4 + (viralScore / 10) * 0.2);
  }

  private calculateTopicCoherence(nodes: ThreadNode[]): number {
    // Simple heuristic: threads with consistent topic have similar word patterns
    // In a real implementation, you might use NLP techniques
    return 0.8; // Placeholder
  }

  private async updateNodeInDatabase(node: ThreadNode): Promise<void> {
    try {
      await this.dataManager.storePost({
        postId: node.postId,
        threadId: node.threadId,
        postIndex: node.postIndex,
        content: node.content,
        postType: node.postIndex === 0 ? 'thread_root' : 'thread_reply',
        contentLength: node.content.length,
        postedAt: node.postedAt,
        hourPosted: node.postedAt.getHours(),
        minutePosted: node.postedAt.getMinutes(),
        dayOfWeek: node.postedAt.getDay(),
        likes: node.individualMetrics.likes,
        retweets: node.individualMetrics.retweets,
        replies: node.individualMetrics.replies,
        impressions: node.individualMetrics.impressions,
        profileClicks: 0,
        linkClicks: 0,
        bookmarks: node.individualMetrics.bookmarks,
        shares: 0,
        followersBefore: await this.getCurrentFollowerCount(),
        followersAttributed: node.nodePerformance.followersAttributed,
        aiGenerated: true,
        lastUpdated: node.lastUpdated
      });
    } catch (error: any) {
      console.error(`❌ Failed to update node ${node.postId} in database:`, error.message);
    }
  }

  private generateThreadReport(threadMetrics: ThreadMetrics): any {
    return {
      threadId: threadMetrics.threadId,
      nodeCount: threadMetrics.nodes.length,
      totalEngagement: this.getTotalThreadEngagement(threadMetrics),
      completionRate: threadMetrics.threadPerformance.threadCompletionRate,
      bestNode: threadMetrics.threadPerformance.bestPerformingNode,
      worstNode: threadMetrics.threadPerformance.worstPerformingNode,
      followersGained: threadMetrics.threadPerformance.followersAttributedTotal,
      viralScore: threadMetrics.threadPerformance.threadViralScore,
      contentQuality: threadMetrics.contentAnalysis.contentQuality
    };
  }

  private async getCurrentFollowerCount(): Promise<number> {
    try {
      const accountMetrics = await this.metricsScraper.scrapeAccountMetrics();
      return accountMetrics.followerCount;
    } catch (error) {
      return 23; // Fallback
    }
  }

  /**
   * 📊 GET THREAD ANALYTICS
   */
  public getActiveThreadsStatus(): {
    activeThreads: number;
    totalNodesTracking: number;
    avgCompletionRate: number;
    topPerformingThread: string | null;
  } {
    const threads = Array.from(this.activeThreads.values());
    const totalNodes = threads.reduce((sum, t) => sum + t.nodes.length, 0);
    const avgCompletion = threads.length > 0 
      ? threads.reduce((sum, t) => sum + t.threadPerformance.threadCompletionRate, 0) / threads.length 
      : 0;
    
    const topThread = threads.reduce((best, current) => 
      this.getTotalThreadEngagement(current) > this.getTotalThreadEngagement(best) ? current : best,
      threads[0]
    );

    return {
      activeThreads: threads.length,
      totalNodesTracking: totalNodes,
      avgCompletionRate: avgCompletion,
      topPerformingThread: topThread?.threadId || null
    };
  }
}

export const getThreadAttributionTracker = () => ThreadAttributionTracker.getInstance();
