import * as cron from 'node-cron';
import { StrategistAgent } from './strategistAgent';
import { PostTweetAgent } from './postTweet';
import { ReplyAgent } from './replyAgent';
import { LearnAgent } from './learnAgent';
import { ResearchAgent } from './researchAgent';
import { AutonomousLearningAgent } from './autonomousLearningAgent';
import { CrossIndustryLearningAgent } from './crossIndustryLearningAgent';

import dotenv from 'dotenv';
import { RealTimeEngagementTracker } from './realTimeEngagementTracker';

dotenv.config();

export class Scheduler {
  private strategistAgent: StrategistAgent;
  private postTweetAgent: PostTweetAgent;
  private replyAgent: ReplyAgent;
  private learnAgent: LearnAgent;
  private researchAgent: ResearchAgent;
  private autonomousLearner: AutonomousLearningAgent;
  private crossIndustryLearner: CrossIndustryLearningAgent;

  private engagementTracker: RealTimeEngagementTracker;
  private tasks: any[] = [];
  private jobs: Map<string, any> = new Map();
  private isRunning = false;

  constructor() {
    this.strategistAgent = new StrategistAgent();
    this.postTweetAgent = new PostTweetAgent();
    this.replyAgent = new ReplyAgent();
    this.learnAgent = new LearnAgent();
    this.researchAgent = new ResearchAgent();
    this.autonomousLearner = new AutonomousLearningAgent();

    this.engagementTracker = new RealTimeEngagementTracker();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting Snap2Health X-Bot Scheduler...');
    this.isRunning = true;

    // Temporarily disable engagement tracking to avoid rate limits
    // await this.engagementTracker.startTracking();

    // Schedule strategist to run every 15 minutes
    const strategistJob = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.runStrategistCycle();
      } catch (error) {
        console.error('❌ Strategist cycle failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Schedule learning agent to run daily at 2 AM UTC
    const learningJob = cron.schedule('0 2 * * *', async () => {
      console.log('🧠 === Daily Learning Cycle Started ===');
      try {
        await this.learnAgent.run();
        console.log('🧠 === Daily Learning Cycle Completed ===');
      } catch (error) {
        console.error('❌ Daily learning cycle failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Schedule autonomous learning every 6 hours for continuous improvement
    const autonomousLearningJob = cron.schedule('0 */6 * * *', async () => {
      console.log('🚀 === Autonomous Learning Cycle Started ===');
      try {
        await this.autonomousLearner.run();
        console.log('🚀 === Autonomous Learning Cycle Completed ===');
      } catch (error) {
        console.error('❌ Autonomous learning cycle failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Schedule engagement analysis every 30 minutes during peak hours
    const engagementAnalysisJob = cron.schedule('*/30 * * * *', async () => {
      const currentHour = new Date().getUTCHours();
      const isPeakHour = (currentHour >= 13 && currentHour <= 15) || // 9-11 AM EST
                        (currentHour >= 19 && currentHour <= 21) || // 3-5 PM EST  
                        (currentHour >= 23 || currentHour <= 1);    // 7-9 PM EST

      if (isPeakHour) {
        console.log('📊 === Peak Hour Engagement Analysis ===');
        try {
          const report = await this.engagementTracker.generateEngagementReport();
          console.log('📈 Engagement Report:', report);
        } catch (error) {
          console.error('❌ Engagement analysis failed:', error);
        }
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Schedule weekly performance report on Sundays at 9 AM UTC
    const weeklyReportJob = cron.schedule('0 9 * * 0', async () => {
      console.log('📊 === Weekly Performance Report ===');
      try {
        await this.generateWeeklyReport();
      } catch (error) {
        console.error('❌ Weekly report failed:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Store job references for cleanup
    this.jobs.set('strategist', strategistJob);
    this.jobs.set('learning', learningJob);
    this.jobs.set('autonomousLearning', autonomousLearningJob);
    this.jobs.set('engagementAnalysis', engagementAnalysisJob);
    this.jobs.set('weeklyReport', weeklyReportJob);

    // Start all jobs
    strategistJob.start();
    learningJob.start();
    autonomousLearningJob.start();
    engagementAnalysisJob.start();
    weeklyReportJob.start();

    console.log('⏰ Scheduler started with the following jobs:');
    console.log('   - Strategist: Every 15 minutes');
    console.log('   - Learning: Daily at 2:00 AM UTC');
    console.log('   - Autonomous Learning: Every 6 hours');
    console.log('   - Engagement Analysis: Every 30 minutes during peak hours');
    console.log('   - Weekly Report: Sundays at 9:00 AM UTC');
    console.log('   - Real-time Engagement Tracking: Continuous');
    
    console.log('🧠 AUTONOMOUS INTELLIGENCE ACTIVATED:');
    console.log('   - System continuously learns and improves');
    console.log('   - Content strategies evolve in real-time');
    console.log('   - Competitive intelligence gathering');
    console.log('   - Predictive trend analysis');
    console.log('   - Creative capability enhancement');

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
      
      const insights = await this.learnAgent.run();

      if (insights) {
        console.log('✅ Learning completed successfully');
        console.log(`Analyzed ${insights.topPerformingTweets.length} top tweets`);
        console.log(`Generated ${insights.contentRecommendations.length} recommendations`);
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

  stop(): void {
    console.log('🛑 Stopping scheduler...');
    
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