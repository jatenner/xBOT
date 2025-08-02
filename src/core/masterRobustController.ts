/**
 * 🎯 MASTER ROBUST CONTROLLER
 * Orchestrates bulletproof learning and posting with zero errors
 */

import { RobustLearningPipeline } from '../utils/robustLearningPipeline';
import { BulletproofPostingPipeline } from '../utils/bulletproofPostingPipeline';
import { IntelligentErrorPrevention } from '../utils/intelligentErrorPrevention';

interface RobustOperationResult {
  success: boolean;
  operation: string;
  details: any;
  errors: string[];
  recoveryActions: string[];
  systemHealth: number;
}

export class MasterRobustController {
  private static instance: MasterRobustController;
  private isRunning = false;
  private operationCount = 0;
  private successCount = 0;
  private errorPrevention: IntelligentErrorPrevention;
  private learningPipeline: RobustLearningPipeline;
  private postingPipeline: BulletproofPostingPipeline;

  private constructor() {
    this.errorPrevention = IntelligentErrorPrevention.getInstance();
    this.learningPipeline = RobustLearningPipeline.getInstance();
    this.postingPipeline = BulletproofPostingPipeline.getInstance();
  }

  static getInstance(): MasterRobustController {
    if (!MasterRobustController.instance) {
      MasterRobustController.instance = new MasterRobustController();
    }
    return MasterRobustController.instance;
  }

  /**
   * 🚀 START BULLETPROOF OPERATION
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Master controller already running');
      return;
    }

    console.log('🎯 === MASTER ROBUST CONTROLLER STARTING ===');
    this.isRunning = true;

    try {
      // Start error prevention monitoring
      this.errorPrevention.startProactiveMonitoring();

      // Run initial system health check
      await this.performSystemHealthCheck();

      // Start main operation cycle
      await this.startOperationCycle();

    } catch (error) {
      console.error('❌ Master controller startup failed:', error);
      this.errorPrevention.recordError(error as Error);
      await this.handleCriticalError(error as Error);
    }
  }

  /**
   * 🔄 MAIN OPERATION CYCLE
   */
  private async startOperationCycle(): Promise<void> {
    console.log('🔄 Starting bulletproof operation cycle...');

    while (this.isRunning) {
      try {
        this.operationCount++;
        console.log(`\n🎯 === CYCLE ${this.operationCount} STARTING ===`);

        // Step 1: Predictive error prevention
        const preventionResult = await this.errorPrevention.predictAndPrevent();
        console.log(`🔮 Prevention: ${preventionResult.risksFound} risks found, ${preventionResult.actionsExecuted} actions executed`);

        // Step 2: Learning cycle (every 3rd cycle or when needed)
        if (this.operationCount % 3 === 0) {
          await this.executeLearningCycle();
        }

        // Step 3: Posting decision and execution
        await this.executePostingCycle();

        // Step 4: System health assessment
        const healthScore = preventionResult.systemHealth.overallScore;
        console.log(`📊 System health: ${healthScore}%`);

        // Step 5: Adaptive wait based on system health
        const waitTime = this.calculateWaitTime(healthScore);
        console.log(`⏰ Waiting ${waitTime}ms before next cycle...`);
        await this.sleep(waitTime);

      } catch (error) {
        console.error('❌ Operation cycle error:', error);
        this.errorPrevention.recordError(error as Error);
        
        // Don't stop the entire system for single cycle errors
        const recoveryWait = Math.min(30000 * Math.pow(2, this.operationCount % 5), 300000); // Max 5 minutes
        console.log(`🔄 Recovering... waiting ${recoveryWait}ms`);
        await this.sleep(recoveryWait);
      }
    }
  }

  /**
   * 🧠 EXECUTE LEARNING CYCLE
   */
  private async executeLearningCycle(): Promise<RobustOperationResult> {
    console.log('🧠 === ROBUST LEARNING CYCLE ===');
    
    try {
      const learningResult = await this.learningPipeline.executeLearningCycle();
      
      if (learningResult.success) {
        console.log('✅ Learning cycle completed successfully');
        if (learningResult.fallbackUsed) {
          console.log('⚠️ Learning used fallback strategies');
        }
        
        return {
          success: true,
          operation: 'learning_cycle',
          details: learningResult.insights,
          errors: learningResult.errorDetails || [],
          recoveryActions: [],
          systemHealth: 95
        };
      } else {
        console.error('❌ Learning cycle failed:', learningResult.errorDetails);
        
        return {
          success: false,
          operation: 'learning_cycle',
          details: null,
          errors: learningResult.errorDetails || ['Unknown learning error'],
          recoveryActions: ['fallback_learning_strategy'],
          systemHealth: 60
        };
      }
      
    } catch (error) {
      console.error('❌ Learning cycle critical error:', error);
      this.errorPrevention.recordError(error as Error);
      
      return {
        success: false,
        operation: 'learning_cycle',
        details: null,
        errors: [error.message],
        recoveryActions: ['emergency_learning_fallback'],
        systemHealth: 40
      };
    }
  }

  /**
   * 📝 EXECUTE POSTING CYCLE
   */
  private async executePostingCycle(): Promise<RobustOperationResult> {
    console.log('📝 === BULLETPROOF POSTING CYCLE ===');
    
    try {
      // First, check if we should post
      const { AutonomousPostingEngine } = await import('./autonomousPostingEngine');
      const engine = AutonomousPostingEngine.getInstance();
      
      const decision = await engine.makePostingDecision();
      console.log(`📋 Posting decision: ${decision.should_post ? 'POST' : 'WAIT'}`);
      console.log(`📝 Reason: ${decision.reason}`);
      
      if (!decision.should_post) {
        return {
          success: true,
          operation: 'posting_decision',
          details: decision,
          errors: [],
          recoveryActions: [],
          systemHealth: 90
        };
      }

      // Generate content for posting
      const content = await this.generateRobustContent();
      
      // Execute bulletproof posting
      const postingResult = await this.postingPipeline.guaranteedPost(content);
      
      if (postingResult.success) {
        console.log(`✅ Tweet posted successfully via ${postingResult.finalMethod}`);
        this.successCount++;
        
        return {
          success: true,
          operation: 'posting_execution',
          details: {
            tweetId: postingResult.tweetId,
            method: postingResult.finalMethod,
            attempts: postingResult.totalAttempts
          },
          errors: [],
          recoveryActions: postingResult.recoveryActions,
          systemHealth: 95
        };
      } else {
        console.error('❌ All posting methods failed');
        
        return {
          success: false,
          operation: 'posting_execution',
          details: postingResult.attemptsLog,
          errors: ['All posting methods exhausted'],
          recoveryActions: postingResult.recoveryActions,
          systemHealth: 30
        };
      }
      
    } catch (error) {
      console.error('❌ Posting cycle critical error:', error);
      this.errorPrevention.recordError(error as Error);
      
      return {
        success: false,
        operation: 'posting_cycle',
        details: null,
        errors: [error.message],
        recoveryActions: ['emergency_posting_fallback'],
        systemHealth: 25
      };
    }
  }

  /**
   * 📝 GENERATE ROBUST CONTENT
   */
  private async generateRobustContent(): Promise<string> {
    const fallbackContent = [
      "💡 Small daily health improvements compound into major transformations over time.",
      "🧠 Your brain adapts and optimizes based on the patterns you feed it daily.",
      "⚡ Energy management is more important than time management for peak performance.",
      "🌱 Consistency in small actions creates sustainable long-term health benefits.",
      "💪 Your body has incredible self-healing capabilities when given proper support."
    ];

    try {
      // Try to generate content using the main system
      const { EliteTwitterContentStrategist } = await import('../agents/eliteTwitterContentStrategist');
      const strategist = EliteTwitterContentStrategist.getInstance();
      
      const contentResult = await strategist.generateEliteContent({
        topic: 'general_health',
        style: 'engaging',
        length: 'medium'
      });

      if (contentResult?.content && typeof contentResult.content === 'string') {
        return contentResult.content;
      }

      throw new Error('Content generation returned invalid result');
      
    } catch (error) {
      console.warn('⚠️ Main content generation failed, using fallback:', error.message);
      
      // Return random fallback content
      const randomIndex = Math.floor(Math.random() * fallbackContent.length);
      return fallbackContent[randomIndex];
    }
  }

  /**
   * 🏥 PERFORM SYSTEM HEALTH CHECK
   */
  private async performSystemHealthCheck(): Promise<void> {
    console.log('🏥 Performing comprehensive system health check...');
    
    try {
      const preventionResult = await this.errorPrevention.predictAndPrevent();
      const healthScore = preventionResult.systemHealth.overallScore;
      
      console.log(`📊 Overall system health: ${healthScore}%`);
      console.log(`🔧 Component health:`, preventionResult.systemHealth.components);
      
      if (healthScore < 50) {
        console.warn('⚠️ System health critical - executing emergency recovery');
        await this.executeEmergencyRecovery();
      } else if (healthScore < 70) {
        console.warn('⚠️ System health low - executing preventive maintenance');
        await this.executePreventiveMaintenance();
      } else {
        console.log('✅ System health good');
      }
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.errorPrevention.recordError(error as Error);
    }
  }

  /**
   * 🚨 EXECUTE EMERGENCY RECOVERY
   */
  private async executeEmergencyRecovery(): Promise<void> {
    console.log('🚨 Executing emergency recovery procedures...');
    
    try {
      // Clear browser processes
      const { execSync } = await import('child_process');
      execSync('pkill -f chromium 2>/dev/null || true');
      
      // Clear cache
      const fs = await import('fs');
      const path = await import('path');
      const cacheDir = path.join(process.cwd(), '.cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
      
      // Wait for recovery
      await this.sleep(5000);
      
      console.log('✅ Emergency recovery completed');
      
    } catch (error) {
      console.error('❌ Emergency recovery failed:', error);
    }
  }

  /**
   * 🔧 EXECUTE PREVENTIVE MAINTENANCE
   */
  private async executePreventiveMaintenance(): Promise<void> {
    console.log('🔧 Executing preventive maintenance...');
    
    try {
      // Clean up old logs
      const { supabaseClient } = await import('../utils/supabaseClient');
      await supabaseClient.supabase
        .from('system_logs')
        .delete()
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      console.log('✅ Preventive maintenance completed');
      
    } catch (error) {
      console.error('❌ Preventive maintenance failed:', error);
    }
  }

  /**
   * ⏰ CALCULATE WAIT TIME
   */
  private calculateWaitTime(healthScore: number): number {
    // Base wait time: 15 minutes
    let baseWait = 15 * 60 * 1000;
    
    // Adjust based on health score
    if (healthScore >= 90) {
      baseWait *= 0.8; // Faster cycle for healthy system
    } else if (healthScore >= 70) {
      baseWait *= 1.0; // Normal cycle
    } else if (healthScore >= 50) {
      baseWait *= 1.5; // Slower cycle for unhealthy system
    } else {
      baseWait *= 2.0; // Much slower cycle for critical system
    }
    
    // Add some randomness to avoid predictable patterns
    const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
    baseWait *= randomFactor;
    
    return Math.round(baseWait);
  }

  /**
   * 🚨 HANDLE CRITICAL ERROR
   */
  private async handleCriticalError(error: Error): Promise<void> {
    console.error('🚨 CRITICAL ERROR - Implementing emergency procedures:', error);
    
    try {
      // Execute emergency recovery
      await this.executeEmergencyRecovery();
      
      // Stop operation cycle temporarily
      this.isRunning = false;
      
      // Wait before attempting restart
      await this.sleep(60000); // 1 minute
      
      // Attempt restart
      console.log('🔄 Attempting system restart after critical error...');
      this.isRunning = true;
      await this.startOperationCycle();
      
    } catch (recoveryError) {
      console.error('❌ Critical error recovery failed:', recoveryError);
      this.isRunning = false;
    }
  }

  /**
   * 📊 GET OPERATION STATS
   */
  getOperationStats(): {
    isRunning: boolean;
    operationCount: number;
    successCount: number;
    successRate: number;
  } {
    return {
      isRunning: this.isRunning,
      operationCount: this.operationCount,
      successCount: this.successCount,
      successRate: this.operationCount > 0 ? (this.successCount / this.operationCount) * 100 : 0
    };
  }

  /**
   * 🛑 STOP OPERATION
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping master robust controller...');
    this.isRunning = false;
    this.errorPrevention.stopMonitoring();
    console.log('✅ Master robust controller stopped');
  }

  /**
   * 💤 SLEEP UTILITY
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}