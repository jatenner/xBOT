/**
 * 🧬 PROMPT EVOLUTION ENGINE
 * Automatically improves prompts based on performance data
 */

import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface PromptVersion {
  id: string;
  version: string;
  persona: string;
  emotion: string;
  framework: string;
  temperature: number;
  promptText: string;
  createdAt: Date;
}

export interface PerformanceMetrics {
  postId: string;
  promptVersion: string;
  persona: string;
  emotion: string;
  framework: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  follows: number;
  engagementRate: number;
  viralScore: number;
  hoursAfterPost: number;
}

export interface BanditArm {
  name: string;
  type: 'persona' | 'emotion' | 'framework' | 'temperature';
  value: string | number;
  pullCount: number;
  totalReward: number;
  avgReward: number;
  confidence: number;
  lastUsed: Date;
}

export class PromptEvolutionEngine {
  private static instance: PromptEvolutionEngine;
  private db: AdvancedDatabaseManager;
  private banditArms: Map<string, BanditArm[]> = new Map();
  private learningRate = 0.1;
  private explorationRate = 0.2;

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
    this.initializeBanditArms();
  }

  public static getInstance(): PromptEvolutionEngine {
    if (!PromptEvolutionEngine.instance) {
      PromptEvolutionEngine.instance = new PromptEvolutionEngine();
    }
    return PromptEvolutionEngine.instance;
  }

  /**
   * 🎰 INITIALIZE BANDIT ARMS
   */
  private initializeBanditArms(): void {
    // Persona arms
    this.banditArms.set('persona', [
      { name: 'Dr. Elena Vasquez', type: 'persona', value: 'harvard_researcher', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Marcus Chen', type: 'persona', value: 'navy_seal_biohacker', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Dr. Sarah Kim', type: 'persona', value: 'stanford_neuroscientist', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Dr. James Mitchell', type: 'persona', value: 'mayo_investigator', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Dr. Lisa Patel', type: 'persona', value: 'functional_medicine', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() }
    ]);

    // Emotion arms
    this.banditArms.set('emotion', [
      { name: 'Curiosity', type: 'emotion', value: 'curiosity', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Surprise', type: 'emotion', value: 'surprise', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Fear/Urgency', type: 'emotion', value: 'fear_urgency', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Validation/Pride', type: 'emotion', value: 'validation', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Hope/Optimism', type: 'emotion', value: 'hope', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() }
    ]);

    // Framework arms
    this.banditArms.set('framework', [
      { name: 'Contrarian Revelation', type: 'framework', value: 'contrarian', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Insider Secret', type: 'framework', value: 'insider_secret', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Mechanism Master', type: 'framework', value: 'mechanism', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Precision Protocol', type: 'framework', value: 'protocol', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Data Bomb', type: 'framework', value: 'data_bomb', pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() }
    ]);

    // Temperature arms
    this.banditArms.set('temperature', [
      { name: 'Conservative', type: 'temperature', value: 0.6, pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Balanced', type: 'temperature', value: 0.8, pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() },
      { name: 'Creative', type: 'temperature', value: 0.95, pullCount: 0, totalReward: 0, avgReward: 0, confidence: 0, lastUsed: new Date() }
    ]);
  }

  /**
   * 🎯 SELECT OPTIMAL PROMPT CONFIGURATION using Thompson Sampling
   */
  async selectOptimalConfig(intent: 'single' | 'thread' | 'reply'): Promise<{
    persona: string;
    emotion: string;
    framework: string;
    temperature: number;
    confidence: number;
  }> {
    console.log(`🎰 BANDIT_SELECTION: Choosing optimal config for ${intent}...`);

    try {
      // Load recent performance data to update bandits
      await this.updateBanditArms();

      // Select using Thompson Sampling (exploration vs exploitation)
      const selectedPersona = this.thompsonSampling('persona');
      const selectedEmotion = this.thompsonSampling('emotion');
      const selectedFramework = this.thompsonSampling('framework');
      const selectedTemperature = this.thompsonSampling('temperature');

      const config = {
        persona: selectedPersona.name,
        emotion: selectedEmotion.name,
        framework: selectedFramework.name,
        temperature: selectedTemperature.value as number,
        confidence: (selectedPersona.confidence + selectedEmotion.confidence + selectedFramework.confidence) / 3
      };

      console.log(`🎯 BANDIT_SELECTED: ${config.persona} + ${config.emotion} + ${config.framework} (temp: ${config.temperature})`);
      console.log(`📊 CONFIDENCE: ${config.confidence.toFixed(1)}%`);

      return config;
    } catch (error) {
      console.error('❌ BANDIT_SELECTION_FAILED:', error);
      
      // Fallback to defaults
      return {
        persona: 'Dr. Elena Vasquez',
        emotion: 'Curiosity',
        framework: 'Mechanism Master',
        temperature: 0.8,
        confidence: 50
      };
    }
  }

  /**
   * 🎰 THOMPSON SAMPLING for bandit arm selection
   */
  private thompsonSampling(armType: string): BanditArm {
    const arms = this.banditArms.get(armType) || [];
    
    if (arms.length === 0) {
      throw new Error(`No bandit arms found for type: ${armType}`);
    }

    // Exploration: randomly pick if we don't have enough data
    const totalPulls = arms.reduce((sum, arm) => sum + arm.pullCount, 0);
    if (totalPulls < 50 || Math.random() < this.explorationRate) {
      console.log(`🔍 EXPLORATION: Random selection for ${armType}`);
      return arms[Math.floor(Math.random() * arms.length)];
    }

    // Exploitation: use Thompson Sampling with Beta distribution approximation
    let bestArm = arms[0];
    let bestSample = -1;

    for (const arm of arms) {
      // Simple Thompson Sampling: sample from Beta(successes + 1, failures + 1)
      const alpha = (arm.avgReward * arm.pullCount) + 1;
      const beta = ((1 - arm.avgReward) * arm.pullCount) + 1;
      
      // Simplified beta sampling using uniform random approximation
      const sample = this.sampleBeta(alpha, beta);
      
      if (sample > bestSample) {
        bestSample = sample;
        bestArm = arm;
      }
    }

    console.log(`🎯 EXPLOITATION: Selected ${bestArm.name} (avg reward: ${bestArm.avgReward.toFixed(3)})`);
    return bestArm;
  }

  /**
   * 📊 UPDATE BANDIT ARMS with recent performance data
   */
  private async updateBanditArms(): Promise<void> {
    try {
      // Get recent performance data (last 100 posts)
      const recentPosts = await this.getRecentPerformanceData(100);
      
      for (const post of recentPosts) {
        // Update persona arm
        this.updateArmReward('persona', post.persona, post.engagementRate);
        
        // Update emotion arm
        this.updateArmReward('emotion', post.emotion, post.engagementRate);
        
        // Update framework arm
        this.updateArmReward('framework', post.framework, post.engagementRate);
      }

      // Update confidence scores
      this.updateConfidenceScores();
      
      console.log(`📊 BANDIT_UPDATE: Updated with ${recentPosts.length} recent posts`);
    } catch (error) {
      console.warn('⚠️ Failed to update bandit arms:', error);
    }
  }

  /**
   * 🔄 UPDATE ARM REWARD
   */
  private updateArmReward(armType: string, armName: string, reward: number): void {
    const arms = this.banditArms.get(armType);
    if (!arms) return;

    const arm = arms.find(a => a.name === armName || a.value === armName);
    if (!arm) return;

    // Update using exponential moving average
    arm.pullCount += 1;
    arm.totalReward += reward;
    arm.avgReward = arm.avgReward * (1 - this.learningRate) + reward * this.learningRate;
    arm.lastUsed = new Date();
  }

  /**
   * 📈 UPDATE CONFIDENCE SCORES
   */
  private updateConfidenceScores(): void {
    for (const [armType, arms] of this.banditArms.entries()) {
      for (const arm of arms) {
        // Confidence based on sample size and performance consistency
        const sampleSizeConfidence = Math.min(100, (arm.pullCount / 10) * 20);
        const performanceConfidence = arm.avgReward * 100;
        
        arm.confidence = (sampleSizeConfidence + performanceConfidence) / 2;
      }
    }
  }

  /**
   * 📝 RECORD PROMPT PERFORMANCE
   */
  async recordPromptPerformance(metrics: PerformanceMetrics): Promise<void> {
    console.log(`📝 RECORDING_PERFORMANCE: ${metrics.postId} with ${metrics.engagementRate.toFixed(3)} engagement`);

    try {
      // NO FALLBACKS - post_id is required for analytics
      if (!metrics.postId) {
        console.error(`❌ POST_ID_MISSING: Cannot record performance without valid post ID`);
        throw new Error('Cannot record prompt performance without valid post ID');
      }
      
      const postId = metrics.postId;

      // Store in database with validated post_id
      await this.db.executeQuery(
        'record_prompt_performance',
        async (client) => {
          const { data, error } = await client.from('prompt_performance').insert({
            post_id: postId,
            prompt_version: metrics.promptVersion || 'unknown',
            persona: metrics.persona || 'unknown',
            emotion: metrics.emotion || 'unknown', 
            framework: metrics.framework || 'unknown',
            likes: metrics.likes || 0,
            retweets: metrics.retweets || 0,
            replies: metrics.replies || 0,
            impressions: metrics.impressions || 0,
            follows: metrics.follows || 0,
            engagement_rate: metrics.engagementRate || 0,
            viral_score: metrics.viralScore || 0,
            hours_after_post: metrics.hoursAfterPost || 0
          });
          
          if (error) throw error;
          return data;
        }
      );

      // Update bandit arms immediately
      this.updateArmReward('persona', metrics.persona, metrics.engagementRate);
      this.updateArmReward('emotion', metrics.emotion, metrics.engagementRate);
      this.updateArmReward('framework', metrics.framework, metrics.engagementRate);

      console.log(`✅ PERFORMANCE_RECORDED: Updated bandits for ${metrics.persona}/${metrics.emotion}/${metrics.framework}`);
    } catch (error: any) {
      // Check if it's a circuit breaker error
      if (error.message && error.message.includes('Circuit breaker is OPEN')) {
        console.warn('⚠️ CIRCUIT_BREAKER_OPEN: Analytics temporarily unavailable, continuing operation');
        console.log(`📊 TRACKED_PERFORMANCE: ${metrics.postId || 'unknown'} - ${(metrics.engagementRate * 100).toFixed(2)}% engagement`);
        
        // Still update bandit arms in memory even if DB fails
        this.updateArmReward('persona', metrics.persona, metrics.engagementRate);
        this.updateArmReward('emotion', metrics.emotion, metrics.engagementRate);
        this.updateArmReward('framework', metrics.framework, metrics.engagementRate);
        
      } else {
        console.error('❌ RECORD_PERFORMANCE_FAILED:', error);
        console.log(`📊 TRACKED_PERFORMANCE: ${metrics.postId || 'unknown'} - ${(metrics.engagementRate * 100).toFixed(2)}% engagement`);
      }
    }
  }

  /**
   * 📊 GET RECENT PERFORMANCE DATA
   */
  private async getRecentPerformanceData(limit: number): Promise<PerformanceMetrics[]> {
    try {
      const result = await this.db.executeQuery(
        'get_recent_performance_data',
        async (client) => {
          const { data, error } = await client
            .from('prompt_performance')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(limit);
          
          if (error) throw error;
          return data || [];
        }
      );

      return result.map((row: any) => ({
        postId: row.post_id,
        promptVersion: row.prompt_version,
        persona: row.persona,
        emotion: row.emotion,
        framework: row.framework,
        likes: row.likes,
        retweets: row.retweets,
        replies: row.replies,
        impressions: row.impressions,
        follows: row.follows,
        engagementRate: parseFloat(row.engagement_rate),
        viralScore: row.viral_score,
        hoursAfterPost: row.hours_after_post
      }));
    } catch (error) {
      console.warn('⚠️ Failed to get recent performance data:', error);
      return [];
    }
  }

  /**
   * 🎲 SIMPLE BETA DISTRIBUTION SAMPLING
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Simplified beta sampling for Thompson Sampling
    // Using method of moments approximation
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    
    // Add some randomness based on variance
    const noise = (Math.random() - 0.5) * Math.sqrt(variance) * 2;
    return Math.max(0, Math.min(1, mean + noise));
  }

  /**
   * 📈 GET BANDIT ARM PERFORMANCE REPORT
   */
  getBanditReport(): any {
    const report: any = {};

    for (const [armType, arms] of this.banditArms.entries()) {
      report[armType] = arms.map(arm => ({
        name: arm.name,
        pulls: arm.pullCount,
        avgReward: arm.avgReward.toFixed(3),
        confidence: arm.confidence.toFixed(1) + '%',
        lastUsed: arm.lastUsed.toISOString().split('T')[0]
      }));
    }

    return report;
  }

  /**
   * 🔄 RESET BANDIT ARMS (for experimentation)
   */
  resetBandits(): void {
    console.log('🔄 RESETTING_BANDITS: Clearing all learning data...');
    this.initializeBanditArms();
  }
}
