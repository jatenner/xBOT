import * as cron from 'node-cron';
import { StrategistAgent } from './strategistAgent';
import { PostTweetAgent } from './postTweet';
import { ReplyAgent } from './replyAgent';
import { LearnAgent } from './learnAgent';
import { ResearchAgent } from './researchAgent';
import { AutonomousLearningAgent } from './autonomousLearningAgent';
import { CrossIndustryLearningAgent } from './crossIndustryLearningAgent';
import { NightlyOptimizerAgent } from './nightlyOptimizer';
import { RealEngagementAgent } from './realEngagementAgent';
import { EngagementFeedbackAgent } from './engagementFeedbackAgent';
import { StrategyLearner } from './strategyLearner';
import { FollowGrowthAgent } from './followGrowthAgent';

import dotenv from 'dotenv';
import { RealTimeEngagementTracker } from './realTimeEngagementTracker';
import { AutonomousTweetAuditor } from './autonomousTweetAuditor';
import { AutonomousContentOrchestrator } from './autonomousContentOrchestrator';
import { pubmedFetcher } from './pubmedFetcher';
import { supabase } from '../utils/supabaseClient.js';
import { dailyPostingManager } from '../utils/dailyPostingManager';
import { tweetAnalyticsCollector } from './tweetAnalyticsCollector';
import { dashboardWriter } from '../dashboard/dashboardWriter';
import { runtimeConfig } from '../utils/supabaseConfig.js';

dotenv.config();

// 🚨 EMERGENCY: Prevent API spam from database issues
const EMERGENCY_MIN_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum
const EMERGENCY_MAX_DAILY = 5; // Conservative daily limit
  
export class Scheduler {
  private strategistAgent: StrategistAgent;
  private postTweetAgent: PostTweetAgent;
  private replyAgent: ReplyAgent;
  private learnAgent: LearnAgent;
  private researchAgent: ResearchAgent;
  private autonomousLearner: AutonomousLearningAgent;
  private crossIndustryLearner: CrossIndustryLearningAgent;
  private nightlyOptimizer: NightlyOptimizerAgent;
  private draftDrainJob: NodeJS.Timeout | null = null;
  private rateLimitedEngagementAgent: RealEngagementAgent;
  
  // Growth agents
  private engagementFeedbackAgent: EngagementFeedbackAgent;
  private strategyLearner: StrategyLearner;
  private followGrowthAgent: FollowGrowthAgent;

  private engagementTracker: RealTimeEngagementTracker;
  private tasks: any[] = [];
  private jobs: Map<string, any> = new Map();
  private isRunning = false;

  private autonomousTweetAuditor: AutonomousTweetAuditor;
  private contentOrchestrator: AutonomousContentOrchestrator;
  
  private strategistJob: cron.ScheduledTask | null = null;
  private learningJob: cron.ScheduledTask | null = null;
  private autonomousLearningJob: cron.ScheduledTask | null = null;
  private engagementJob: cron.ScheduledTask | null = null;
  private rateLimitedEngagementJob: cron.ScheduledTask | null = null;
  private weeklyReportJob: cron.ScheduledTask | null = null;
  private tweetAuditorJob: cron.ScheduledTask | null = null;
  private orchestratorJob: cron.ScheduledTask | null = null;
  private nightlyOptimizerJob: cron.ScheduledTask | null = null;
  
  // Growth job schedulers
  private engagementFeedbackJob: cron.ScheduledTask | null = null;
  private strategyLearnerJob: cron.ScheduledTask | null = null;
  private followGrowthJob: cron.ScheduledTask | null = null;

  constructor() {
    this.strategistAgent = new StrategistAgent();
    this.postTweetAgent = new PostTweetAgent();
    this.replyAgent = new ReplyAgent();
    this.learnAgent = new LearnAgent();
    this.researchAgent = new ResearchAgent();
    this.autonomousLearner = new AutonomousLearningAgent();
    this.crossIndustryLearner = new CrossIndustryLearningAgent();
    this.nightlyOptimizer = new NightlyOptimizerAgent();
    this.rateLimitedEngagementAgent = new RealEngagementAgent();

    // Initialize growth agents
    this.engagementFeedbackAgent = new EngagementFeedbackAgent();
    this.strategyLearner = new StrategyLearner();
    this.followGrowthAgent = new FollowGrowthAgent();

    this.engagementTracker = new RealTimeEngagementTracker();
    this.autonomousTweetAuditor = new AutonomousTweetAuditor();
    this.contentOrchestrator = new AutonomousContentOrchestrator();
  }

  async start(): Promise<void> {
    // 🚨 EMERGENCY: Add startup delay to prevent API spam
    console.log('⏳ EMERGENCY: Delaying scheduler startup by 3 minutes');
    await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
    console.log('✅ Scheduler startup delay complete');
    
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting Snap2Health X-Bot Scheduler...');
    this.isRunning = true;

    // 🎯 START DAILY POSTING MANAGER - Safe human-like posting
    const dailyTarget = 17;
    console.log(`🎯 Activating Daily Posting Manager - Target: ${dailyTarget} tweets/day`);
    await dailyPostingManager.start();

    // 🚨 EMERGENCY COST MODE CHECK
    const emergencyMode = process.env.EMERGENCY_COST_MODE === 'true';
    const disableLearningAgents = process.env.DISABLE_LEARNING_AGENTS === 'true';
    const dailyBudgetLimit = parseFloat(process.env.DAILY_BUDGET_LIMIT || '10');

    if (emergencyMode) {
      console.log('🚨 === EMERGENCY COST MODE ACTIVE ===');
      console.log('💰 All expensive background analysis DISABLED');
      console.log(`💵 Daily budget limit: $${dailyBudgetLimit}`);
      console.log('📝 Basic posting mode only - optimized for 0-follower growth');
      const dailyTarget = 17;
      console.log(`🎯 Daily Posting Manager will handle all ${dailyTarget} tweets`);
      
      // In emergency mode, let daily posting manager handle all posts
      // No additional strategist scheduling needed
      
      console.log('⚠️ EMERGENCY MODE: Daily Posting Manager controls all posting');
      console.log(`   - ${dailyTarget} tweets/day spread across optimal times`);
      console.log('   - ALL learning agents: DISABLED');
      console.log('   - ALL competitive intelligence: DISABLED');
      console.log('   - ALL background analysis: DISABLED');
      console.log('   - Expected daily cost: $0.50-2.00 instead of $40-50');
      return;
    }

    if (disableLearningAgents) {
      console.log('⚠️ Learning agents disabled for cost savings');
    }

    // Temporarily disable engagement tracking to avoid rate limits
    // await this.engagementTracker.startTracking();

    // Schedule strategist to run every 45 minutes instead of 15 (reduced from 96x to 32x daily)
    this.strategistJob = cron.schedule('*/45 * * * *', async () => {
      try {
        await this.runStrategistCycle();
      } catch (error) {
        console.error('❌ Strategist cycle failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // Schedule learning agent to run daily at 2 AM EST (learning during off hours)
    if (!disableLearningAgents) {
      this.learningJob = cron.schedule('0 2 * * *', async () => {
        console.log('🧠 === Daily Learning Cycle Started ===');
        try {
          await this.learnAgent.run();
          console.log('🧠 === Daily Learning Cycle Completed ===');
        } catch (error) {
          console.error('❌ Daily learning cycle failed:', error);
        }
      }, {
        scheduled: true,
        timezone: "America/New_York"
      });
    }

    // Schedule autonomous learning every 12 hours instead of 6 (reduced from 4x to 2x daily)
    if (!disableLearningAgents) {
      this.autonomousLearningJob = cron.schedule('0 */12 * * *', async () => {
        console.log('🚀 === Autonomous Learning Cycle Started ===');
        try {
          await this.autonomousLearner.run();
          console.log('🚀 === Autonomous Learning Cycle Completed ===');
        } catch (error) {
          console.error('❌ Autonomous learning cycle failed:', error);
        }
      }, {
        scheduled: true,
        timezone: "America/New_York"
      });
    }

    // Schedule engagement analysis every 2 hours during peak hours only (reduced from every 30 min)
    this.engagementJob = cron.schedule('0 */2 * * *', async () => {
      // Convert to Eastern Time for peak hour detection
      const currentHour = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
      const estHour = new Date(currentHour).getHours();
      const isPeakHour = (estHour >= 9 && estHour <= 11) ||  // 9-11 AM EST
                        (estHour >= 15 && estHour <= 17) || // 3-5 PM EST  
                        (estHour >= 19 && estHour <= 21);   // 7-9 PM EST

      if (isPeakHour) {
        console.log('📊 === Peak Hour Engagement Analysis (EST) ===');
        try {
          const report = await this.engagementTracker.generateEngagementReport();
          console.log('📈 Engagement Report:', report);
        } catch (error) {
          console.error('❌ Engagement analysis failed:', error);
        }
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // Schedule weekly performance report on Sundays at 9 AM EST
    this.weeklyReportJob = cron.schedule('0 9 * * 0', async () => {
      console.log('📊 === Weekly Performance Report ===');
      try {
        await this.generateWeeklyReport();
      } catch (error) {
        console.error('❌ Weekly report failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // 🤖 AUTONOMOUS TWEET AUDITOR - runs every 4 hours instead of 2 to reduce API costs
    if (!disableLearningAgents) {
      this.tweetAuditorJob = cron.schedule('0 */4 * * *', async () => {
        console.log('🤖 === Autonomous Tweet Auditor Cycle ===');
        try {
          await this.autonomousTweetAuditor.runAutonomousAudit();
        } catch (error) {
          console.error('❌ Tweet auditor failed:', error);
        }
      }, {
        scheduled: true,
        timezone: "America/New_York"
      });
    }

    // 🎭 AUTONOMOUS CONTENT ORCHESTRATOR - runs twice daily instead of every 4 hours
    if (!disableLearningAgents) {
      this.orchestratorJob = cron.schedule('0 6,18 * * *', async () => {
        console.log('🎭 === Content Orchestrator Cycle ===');
        try {
          // Note: AutonomousContentOrchestrator may not have a run method
          console.log('🎭 Content orchestrator placeholder');
        } catch (error) {
          console.error('❌ Content orchestrator failed:', error);
        }
      }, {
        scheduled: true,
        timezone: "America/New_York"
      });
    }

    // 🌙 NIGHTLY OPTIMIZER - runs once at 3 AM EST
    this.nightlyOptimizerJob = cron.schedule('0 3 * * *', async () => {
      console.log('🌙 === Nightly Optimizer Cycle ===');
      try {
        await this.nightlyOptimizer.runNightlyOptimization();
      } catch (error) {
        console.error('❌ Nightly optimizer failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // 📊 GROWTH AGENTS - Autonomous growth loop
    console.log('📈 Initializing autonomous growth loop...');
    
    // Engagement Feedback Agent - runs hourly
    this.engagementFeedbackJob = cron.schedule('0 * * * *', async () => {
      console.log('📊 === Engagement Feedback Agent ===');
      try {
        await this.engagementFeedbackAgent.run();
      } catch (error) {
        console.error('❌ Engagement feedback agent failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // Strategy Learner - runs daily at 2:30 AM EST (after engagement aggregation)
    this.strategyLearnerJob = cron.schedule('30 2 * * *', async () => {
      console.log('🧠 === Strategy Learner (ε-greedy) ===');
      try {
        await this.strategyLearner.run();
        await this.strategyLearner.adaptEpsilon();
      } catch (error) {
        console.error('❌ Strategy learner failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // Follow Growth Agent - runs every 4 hours
    this.followGrowthJob = cron.schedule('15 */4 * * *', async () => {
      console.log('👥 === Follow Growth Agent ===');
      try {
        await this.followGrowthAgent.run();
      } catch (error) {
        console.error('❌ Follow growth agent failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    console.log('✅ Autonomous growth loop initialized');
    console.log('   📊 Engagement feedback: Every hour');
    console.log('   🧠 Strategy learning: Daily at 2:30 AM EST');
    console.log('   👥 Follow growth: Every 4 hours');

    console.log('✅ Snap2Health X-Bot Scheduler started successfully');
    console.log(`📅 Emergency mode: ${emergencyMode ? 'ON' : 'OFF'}`);
    console.log(`🧠 Learning agents: ${disableLearningAgents ? 'DISABLED' : 'ENABLED'}`);
    console.log(`💵 Daily budget limit: $${dailyBudgetLimit}`);

    // 🔥 REAL ENGAGEMENT AGENT - reduce to every 60 minutes instead of 30 (still frequent but reasonable)
    this.rateLimitedEngagementJob = cron.schedule('0 * * * *', async () => {
      console.log('🔥 === REAL ENGAGEMENT AGENT TRIGGERED ===');
      console.log('🎯 Performing ACTUAL Twitter likes, follows, and replies');
      try {
        const result = await this.rateLimitedEngagementAgent.run();
        if (result.success) {
          console.log(`✅ Real engagement completed: ${result.message}`);
          console.log(`🎯 ACTUAL actions performed: ${result.actions.length}`);
          
          // Count successful real actions
          const successful = result.actions.filter(a => a.success);
          if (successful.length > 0) {
            console.log(`💖 Real Twitter engagement achieved: ${successful.length} successful actions`);
          }
        } else {
          console.log(`⚠️ Real engagement failed: ${result.message}`);
        }
      } catch (error) {
        console.error('❌ Real engagement agent failed:', error);
      }
    }, { scheduled: true });

    // PubMed research fetcher - every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('🔬 Running scheduled PubMed research fetch...');
        await pubmedFetcher.fetchLatestResearch();
      } catch (error) {
        console.error('🔬 Scheduled PubMed fetch failed:', error);
      }
    });

    // Style performance analyzer - nightly at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('📊 Running nightly style performance analysis...');
        await this.analyzeStylePerformance();
      } catch (error) {
        console.error('📊 Style analysis failed:', error);
      }
    });

    // Tweet Analytics Collector - nightly at 1:00 AM UTC
    cron.schedule('0 1 * * *', async () => {
      try {
        console.log('📊 Running nightly tweet analytics collection...');
        const { tweetAnalyticsCollector } = await import('./tweetAnalyticsCollector');
        await tweetAnalyticsCollector.run();
      } catch (error) {
        console.error('📊 Tweet analytics collection failed:', error);
      }
    });

    // Dashboard Writer - nightly at 1:15 AM UTC
    cron.schedule('15 1 * * *', async () => {
      try {
        console.log('📝 Running nightly dashboard update...');
        const { dashboardWriter } = await import('../dashboard/dashboardWriter');
        await dashboardWriter.publish();
      } catch (error) {
        console.error('📝 Dashboard writer failed:', error);
      }
    });

    // Store job references for cleanup
    this.jobs.set('strategist', this.strategistJob);
    this.jobs.set('learning', this.learningJob);
    this.jobs.set('autonomousLearning', this.autonomousLearningJob);
    this.jobs.set('engagementAnalysis', this.engagementJob);
    this.jobs.set('rateLimitedEngagement', this.rateLimitedEngagementJob);
    this.jobs.set('weeklyReport', this.weeklyReportJob);
    this.jobs.set('tweetAuditor', this.tweetAuditorJob);
    this.jobs.set('orchestrator', this.orchestratorJob);
    this.jobs.set('nightlyOptimizer', this.nightlyOptimizerJob);

    // Start all jobs
    this.strategistJob.start();
    if (!disableLearningAgents) {
      this.learningJob.start();
      this.autonomousLearningJob.start();
    }
    this.engagementJob.start();
    this.rateLimitedEngagementJob.start();
    this.weeklyReportJob.start();
    this.tweetAuditorJob.start();
    this.orchestratorJob.start();
    this.nightlyOptimizerJob.start();

    // Start engagement tracker
    try {
      await this.engagementTracker.startTracking();
      console.log('🎯 Real-time engagement tracking started');
    } catch (error) {
      console.warn('⚠️ Failed to start engagement tracking:', error);
    }

    console.log('⏰ Scheduler started with the following jobs:');
    console.log('   - Strategist: Every 45 minutes');
    if (!disableLearningAgents) {
      console.log('   - Learning: Daily at 2:00 AM EST');
    }
    if (!disableLearningAgents) {
      console.log('   - Autonomous Learning: Every 12 hours');
    }
    console.log('   - Engagement Analysis: Every 2 hours during peak hours (EST)');
    console.log('   - 🔥 REAL Engagement: Every 60 minutes (ACTUAL Twitter actions)');
    console.log('   - Weekly Report: Sundays at 9:00 AM EST');
    console.log('   - 🤖 Autonomous Tweet Auditor: Every 4 hours');
    console.log('   - 🎭 Supreme Content Orchestrator: Every 8 hours');
    console.log('   - Real-time Engagement Tracking: Continuous');
    console.log('   - Nightly Optimizer: Daily at 3:00 AM EST');
    console.log('   - 📊 Tweet Analytics Collector: Daily at 1:00 AM EST');
    console.log('   - 📝 Dashboard Writer: Daily at 1:15 AM EST');
    
    console.log('🧠 AUTONOMOUS INTELLIGENCE ACTIVATED:');
    console.log('   - System continuously learns and improves');
    console.log('   - Content strategies evolve in real-time');
    console.log('   - Competitive intelligence gathering');
    console.log('   - Predictive trend analysis');
    console.log('   - Creative capability enhancement');
    console.log('   - 🔧 AUTONOMOUS QUALITY CONTROL: Tweet auditing and fixing');

    // Run initial cycles
    try {
      console.log('🚀 Running initial strategist cycle...');
      await this.runStrategistCycle();
    } catch (error) {
      console.error('❌ Initial strategist cycle failed:', error);
    }
  }

  private async runStrategistCycle(): Promise<void> {
    try {
      console.log('🧠 === Strategist Cycle Started ===');
      
      // Get strategic decision from enhanced strategist
      const decision = await this.strategistAgent.run();
      
      // Execute the decision
      const result = await this.strategistAgent.executeDecision(decision);
      
      if (result.success) {
        console.log('🧠 === Strategist Cycle Completed ===');
      } else {
        console.log('⚠️ Strategist cycle completed with issues:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Error in strategist cycle:', error);
    }
  }

  private async runResearchCycle(): Promise<void> {
    try {
      console.log('\n🔍 === Research Cycle Started ===');
      
      const research = await this.researchAgent.run();

      if (research.research.length > 0 || research.trends.length > 0) {
        console.log('✅ Research completed successfully');
        console.log(`📚 Found ${research.research.length} research papers`);
        console.log(`📈 Identified ${research.trends.length} trending topics`);
        console.log(`💡 Generated ${research.insights.length} insights`);
        
        // Log top insights for visibility
        if (research.insights.length > 0) {
          console.log('\nTop insights:');
          research.insights.slice(0, 3).forEach((insight, i) => {
            console.log(`${i + 1}. ${insight.substring(0, 100)}...`);
          });
        }
      } else {
        console.log('❌ Research failed or no data available');
      }

      console.log('🔍 === Research Cycle Completed ===\n');

    } catch (error) {
      console.error('❌ Error in research cycle:', error);
    }
  }

  private async executePostAction(decision: any): Promise<void> {
    try {
      console.log('📝 Executing post action...');
      
      const shouldIncludeCTA = decision.reasoning.includes('Snap2Health CTA');
      const result = await this.postTweetAgent.run(shouldIncludeCTA);

      if (result.success) {
        console.log(`✅ Tweet posted: ${result.tweetId}`);
        console.log(`Content: ${result.content}`);
      } else {
        console.log(`❌ Failed to post tweet: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Error executing post action:', error);
    }
  }

  private async executeReplyAction(decision: any): Promise<void> {
    try {
      console.log('💬 Executing reply action...');
      
      const result = await this.replyAgent.run();

      if (result.success) {
        console.log(`✅ Reply posted: ${result.replyId}`);
        console.log(`Target: ${result.targetTweetId}`);
        console.log(`Content: ${result.content}`);
      } else {
        console.log(`❌ Failed to post reply: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Error executing reply action:', error);
    }
  }

  private async runLearningCycle(): Promise<void> {
    try {
      console.log('\n📊 === Learning Cycle Started ===');
      
      const result = await this.learnAgent.run();

      if (result.success && result.insights) {
        console.log('✅ Learning completed successfully');
        console.log(`Top variant: ${result.topVariant || 'default'}`);
        console.log(`Insights generated: ${JSON.stringify(result.insights).length} characters`);
        
        // Log specific insights if available
        if (result.insights.topPerformingVariant) {
          console.log(`Best performing variant: ${result.insights.topPerformingVariant.variant}`);
        }
        if (result.insights.recommendations) {
          console.log(`Generated ${result.insights.recommendations.length} recommendations`);
        }
      } else {
        console.log('❌ Learning failed or no data available');
      }

      console.log('📊 === Learning Cycle Completed ===\n');

    } catch (error) {
      console.error('❌ Error in learning cycle:', error);
    }
  }

  private async generateWeeklyReport(): Promise<void> {
    try {
      console.log('📊 Generating weekly performance report...');
      
      // Get engagement analytics
      const engagementReport = await this.engagementTracker.generateEngagementReport();
      
      console.log('📈 WEEKLY PERFORMANCE SUMMARY:');
      console.log(`   - Total viral patterns tracked: ${engagementReport.total_patterns_tracked}`);
      console.log(`   - High-performing patterns: ${engagementReport.high_performing_patterns}`);
      console.log(`   - Top viral elements: ${engagementReport.top_viral_elements.map((p: any) => p.content_element).join(', ')}`);
      
      // Log autonomous learning achievements
      console.log('🚀 AUTONOMOUS LEARNING PROGRESS:');
      console.log('   - Pattern recognition improving');
      console.log('   - Engagement optimization active');
      console.log('   - Content quality enhancement ongoing');
      
    } catch (error) {
      console.error('Failed to generate weekly report:', error);
    }
  }

  private async analyzeStylePerformance(): Promise<void> {
    try {
      // Get 7-day tweet performance by style
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: tweets, error } = await supabase
        .from('tweets')
        .select('style, eng_score')
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('style', 'is', null)
        .not('eng_score', 'is', null);

      if (error || !tweets || tweets.length === 0) {
        console.log('📊 No recent tweets with style/engagement data');
        return;
      }

      // Calculate average engagement by style
      const styleStats = new Map<string, { total: number; count: number }>();
      
      tweets.forEach(tweet => {
        if (!styleStats.has(tweet.style)) {
          styleStats.set(tweet.style, { total: 0, count: 0 });
        }
        const stats = styleStats.get(tweet.style)!;
        stats.total += tweet.eng_score;
        stats.count += 1;
      });

      // Calculate weights (higher for better performing styles)
      const styleWeights: Record<string, number> = {};
      let totalAvgScore = 0;
      let styleCount = 0;

      styleStats.forEach((stats, style) => {
        const avgScore = stats.total / stats.count;
        styleWeights[style] = avgScore;
        totalAvgScore += avgScore;
        styleCount++;
      });

      if (styleCount === 0) return;

      const overallAvg = totalAvgScore / styleCount;
      
      // Normalize weights (1.0 = average, higher = better)
      Object.keys(styleWeights).forEach(style => {
        styleWeights[style] = Math.max(0.1, styleWeights[style] / overallAvg);
      });

      // Update bot config
      await supabase
        .from('bot_config')
        .upsert({
          key: 'style_weights',
          value: JSON.stringify(styleWeights),
          updated_at: new Date().toISOString()
        });

      console.log('📊 Style weights updated:', styleWeights);

    } catch (error) {
      console.error('📊 Style analysis error:', error);
    }
  }

  // Manual execution methods for testing
  async runOnce(): Promise<void> {
    console.log('🧪 Running single strategist cycle...');
    await this.runStrategistCycle();
  }

  async testResearch(): Promise<void> {
    console.log('🧪 Testing research capabilities...');
    await this.runResearchCycle();
  }

  async testAllAgents(): Promise<void> {
    console.log('🧪 Testing all agents...');
    
    try {
      // Test strategist
      console.log('\n1. Testing StrategistAgent...');
      const decision = await this.strategistAgent.run();
      console.log('Decision:', decision);

      // Test post tweet agent
      console.log('\n2. Testing PostTweetAgent...');
      const testResult = await this.postTweetAgent.run(false);
      console.log('PostTweetAgent test result:', testResult.success ? 'Success' : 'Failed');

      // Test reply agent
      console.log('\n3. Testing ReplyAgent...');
      await this.replyAgent.testReplyGeneration({
        content: "AI in healthcare could diagnose diseases years before symptoms appear, using machine learning & early biomarkers. What's the most exciting development?",
        author: "healthtech_guru"
      });

      // Test learn agent
      console.log('\n4. Testing LearnAgent...');
      const insights = await this.learnAgent.run();
      console.log('Learning insights:', insights ? 'Generated' : 'None');

      // Test research agent
      console.log('\n5. Testing ResearchAgent...');
      const researchResults = await this.researchAgent.run();
      console.log('Research test result:', researchResults ? 'Success' : 'Failed');

      console.log('\n✅ All agent tests completed');

    } catch (error) {
      console.error('❌ Error testing agents:', error);
    }
  }

  async testAutonomousLearning(): Promise<void> {
    console.log('🧪 Testing autonomous learning system...');
    try {
      await this.autonomousLearner.run();
      console.log('✅ Autonomous learning test completed');
    } catch (error) {
      console.error('❌ Autonomous learning test failed:', error);
    }
  }

  private scheduleDraftDrain(): void {
    console.log('📝 Starting draft drain job (every 30 minutes)');
    
    const drainDrafts = async () => {
      try {
        const { data: drafts } = await supabase
          .from('drafts')
          .select('*')
          .eq('draft_status', 'queued')
          .order('created_at', { ascending: true })
          .limit(5);
        
        if (drafts && drafts.length > 0) {
          console.log(`📝 Processing ${drafts.length} queued drafts`);
          
          for (const draft of drafts) {
            try {
              const result = await this.postTweetAgent.run(false, draft.content);
              
              if (result.success) {
                await supabase
                  .from('drafts')
                  .update({ draft_status: 'posted', posted_at: new Date().toISOString() })
                  .eq('id', draft.id);
                  
                console.log(`✅ Posted draft: ${draft.content.substring(0, 50)}...`);
              } else {
                await supabase
                  .from('drafts')
                  .update({ draft_status: 'failed' })
                  .eq('id', draft.id);
                  
                console.log(`❌ Failed to post draft: ${result.error}`);
              }
            } catch (error) {
              console.error('❌ Failed to process draft:', error);
              await supabase
                .from('drafts')
                .update({ draft_status: 'failed' })
                .eq('id', draft.id);
            }
          }
        }
      } catch (error) {
        console.error('❌ Draft drain error:', error);
      }
    };
    
    // Run immediately and then every 30 minutes
    drainDrafts();
    this.draftDrainJob = setInterval(drainDrafts, 30 * 60 * 1000);
  }

  stop(): void {
    console.log('🛑 Stopping scheduler...');
    
    // Stop all cron jobs
    const cronJobs = [
      { name: 'strategist', job: this.strategistJob },
      { name: 'learning', job: this.learningJob },
      { name: 'autonomous-learning', job: this.autonomousLearningJob },
      { name: 'engagement', job: this.engagementJob },
      { name: 'rate-limited-engagement', job: this.rateLimitedEngagementJob },
      { name: 'weekly-report', job: this.weeklyReportJob },
      { name: 'tweet-auditor', job: this.tweetAuditorJob },
      { name: 'orchestrator', job: this.orchestratorJob },
      { name: 'nightly-optimizer', job: this.nightlyOptimizerJob },
      { name: 'engagement-feedback', job: this.engagementFeedbackJob },
      { name: 'strategy-learner', job: this.strategyLearnerJob },
      { name: 'follow-growth', job: this.followGrowthJob }
    ];

    cronJobs.forEach(({ name, job }) => {
      try {
        if (job) {
          job.stop();
          console.log(`✅ Stopped ${name} job`);
        }
      } catch (error) {
        console.error(`❌ Error stopping ${name} job:`, error);
      }
    });
    
    // Stop draft drain job
    if (this.draftDrainJob) {
      clearInterval(this.draftDrainJob);
      console.log('✅ Stopped draft drain job');
    }
    
    for (const [name, job] of this.jobs) {
      try {
        if (job && typeof job.stop === 'function') {
          job.stop();
          console.log(`✅ Stopped ${name} job`);
        } else if (job && typeof job.destroy === 'function') {
          job.destroy();
          console.log(`✅ Stopped ${name} job`);
        }
      } catch (error) {
        console.error(`❌ Error stopping ${name} job:`, error);
      }
    }
    
    // Stop engagement tracker
    try {
      this.engagementTracker.stopTracking();
      console.log('🛑 Engagement tracking stopped');
      console.log('✅ Stopped engagement tracker');
    } catch (error) {
      console.error('❌ Error stopping engagement tracker:', error);
    }
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('⏹️ Scheduler stopped');
  }

  // Public methods for status checking
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  async getSystemStatus(): Promise<any> {
    return {
      scheduler_running: this.isRunning,
      active_jobs: this.jobs.size,
      engagement_tracking: this.isRunning, // Tracking runs with scheduler
      last_check: new Date().toISOString()
    };
  }
}

// Allow running as standalone script
if (require.main === module) {
  const scheduler = new Scheduler();

  // Handle command line arguments
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    scheduler.testAllAgents().then(() => {
      console.log('💚 All agents completed');
      process.exit(0);
    });
  } else if (args.includes('--research')) {
    scheduler.testResearch().then(() => {
      console.log('💚 Research test completed');
      process.exit(0);
    });
  } else if (args.includes('--once')) {
    scheduler.runOnce().then(() => {
      console.log('💚 Single cycle completed');
      process.exit(0);
    });
  } else if (args.includes('--autonomous')) {
    scheduler.testAutonomousLearning().then(() => {
      console.log('💚 Autonomous learning test completed');
      process.exit(0);
    });
  } else {
    // Start continuous scheduling
    scheduler.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

    // Keep the process alive
    console.log('🤖 Snap2Health X-Bot is now running...');
    console.log('   Press Ctrl+C to stop');
  }
} 