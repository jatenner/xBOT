// src/examples/contentBrainUsage.ts - Complete Content Brain Integration Example
import { HealthContentTemplates, generatePromptContext } from '../prompts/healthContentTemplates';
import { contentLearning } from '../analytics/contentLearning';
import { getContentBrainConfig, getCurrentTimeSlot, generateBanditArmKey } from '../config/contentBrain';
import { safeLog } from '../utils/redact';

/**
 * Complete example of how to use the Content Brain system
 * This demonstrates the full cycle: generation → posting → learning → optimization
 */
export class ContentBrainExample {
  
  /**
   * Generate health-focused content using Thompson Sampling
   */
  static async generateOptimizedContent(): Promise<any> {
    const config = getContentBrainConfig();
    const currentTimeSlot = getCurrentTimeSlot();
    
    // Check budget remaining
    const budgetRemaining = await contentLearning.getDailyBudgetRemaining();
    if (budgetRemaining <= 0) {
      safeLog.warn('💰 BUDGET_EXHAUSTED: No budget remaining for content generation');
      return null;
    }
    
    // Define available content strategies (bandit arms)
    const topics = config.topics.health_core.slice(0, 5); // Top 5 health topics
    const formats = ['single', 'thread']; // Available formats
    
    const availableArms = [];
    for (const topic of topics) {
      for (const format of formats) {
        const armKey = generateBanditArmKey(topic, format, currentTimeSlot);
        availableArms.push(armKey);
      }
    }
    
    // Use Thompson Sampling to select the best arm
    const selectedArm = await contentLearning.selectBanditArm(availableArms);
    const [topic, format, timeSlot] = selectedArm.split(':');
    
    safeLog.info(`🎯 SELECTED_ARM: ${selectedArm} (${availableArms.length} options)`);
    
    // Generate appropriate prompt
    let prompt: string;
    const context = generatePromptContext(topic, format as any, {
      context: `Health-focused content for ${timeSlot} posting`,
      target_audience: 'Health-conscious individuals seeking evidence-based insights'
    });
    
    if (format === 'single') {
      prompt = HealthContentTemplates.generateSinglePostPrompt(context);
    } else if (format === 'thread') {
      context.length = 6; // 6-tweet thread
      prompt = HealthContentTemplates.generateThreadPrompt(context);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
    
    // Simulate OpenAI call (replace with actual OpenAI integration)
    const mockContent = await this.simulateOpenAICall(prompt, topic, format);
    
    // Generate unique post ID
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Quality check using Regret Checker
    const qualityCheck = await this.runQualityCheck(mockContent.content);
    
    if (!qualityCheck.pass) {
      safeLog.warn(`❌ QUALITY_CHECK_FAILED: ${postId} - ${qualityCheck.suggested_edits?.join(', ')}`);
      
      // Log the failed generation event
      await contentLearning.logContentEvent({
        event: 'skipped',
        post_id: postId,
        kind: format as any,
        meta: {
          topic,
          format,
          model_used: mockContent.model,
          cost_usd: mockContent.cost,
          confidence: qualityCheck.confidence,
          time_slot: currentTimeSlot,
          bandit_arm: selectedArm,
          exploration: false,
          quality_gates: {
            regret_check_passed: false,
            fact_check_score: qualityCheck.factual_accuracy_confidence,
            helpfulness_score: qualityCheck.helpful_tone ? 0.9 : 0.3
          }
        }
      });
      
      return null;
    }
    
    // Log successful generation
    await contentLearning.logContentEvent({
      event: 'generated',
      post_id: postId,
      kind: format as any,
      meta: {
        topic,
        format,
        model_used: mockContent.model,
        cost_usd: mockContent.cost,
        confidence: qualityCheck.confidence,
        time_slot: currentTimeSlot,
        bandit_arm: selectedArm,
        exploration: false, // Could be determined by exploration ratio
        quality_gates: {
          regret_check_passed: true,
          fact_check_score: qualityCheck.factual_accuracy_confidence,
          helpfulness_score: qualityCheck.helpful_tone ? 0.9 : 0.7
        }
      }
    });
    
    safeLog.info(`✅ CONTENT_GENERATED: ${postId} (${topic}/${format})`);
    
    return {
      post_id: postId,
      content: mockContent.content,
      topic,
      format,
      bandit_arm: selectedArm,
      quality_score: qualityCheck.confidence,
      cost_usd: mockContent.cost
    };
  }
  
  /**
   * Simulate OpenAI API call with cost tracking
   */
  private static async simulateOpenAICall(prompt: string, topic: string, format: string): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock responses based on topic and format
    const mockResponses = {
      'nutrition:single': 'Protein timing matters less than total intake. Your body can absorb 25-30g per meal efficiently, but eating 50g won\'t waste half. Focus on consistent daily totals over perfect timing. Research shows 0.8-1.2g per kg body weight daily optimizes muscle maintenance.',
      'nutrition:thread': '1/6 Why most people misunderstand protein absorption\n\n2/6 Common myth: "You can only absorb 30g of protein per meal"\n\n3/6 Reality: Your body adapts absorption based on intake. Larger meals = slower digestion = more complete absorption\n\n4/6 What matters: Total daily protein (0.8-1.2g/kg), not per-meal amounts\n\n5/6 Practical tip: Spread protein across meals for steady muscle protein synthesis, but don\'t stress about exact timing\n\n6/6 Focus on consistency over perfection. Your body is smarter than rigid meal timing rules.',
      'sleep:single': 'Room temperature affects sleep quality more than most realize. 65-68°F (18-20°C) supports natural core body temperature drop needed for deep sleep. Hot rooms disrupt REM cycles. Cool rooms enhance recovery and growth hormone release.',
      'exercise:thread': '1/5 Why "no pain, no gain" can sabotage your fitness goals\n\n2/5 Muscle soreness (DOMS) isn\'t a reliable indicator of workout effectiveness. You can build strength without extreme soreness\n\n3/5 Progressive overload works through: increased weight, reps, sets, or improved form - not just muscle damage\n\n4/5 Smart approach: Challenge yourself while maintaining good form. Listen to fatigue, not just pain\n\n5/5 Sustainable fitness comes from consistency, not intensity that leaves you unable to train for days'
    };
    
    const key = `${topic}:${format}`;
    const content = mockResponses[key] || `Mock ${format} content about ${topic} with health insights and evidence-based recommendations.`;
    
    // Simulate different model costs
    const modelCosts = {
      'single': { model: 'gpt-4o-mini', cost: 0.003 },
      'thread': { model: 'gpt-4o', cost: 0.015 },
      'reply': { model: 'gpt-4o-mini', cost: 0.002 }
    };
    
    const cost = modelCosts[format] || modelCosts['single'];
    
    return {
      content,
      model: cost.model,
      cost: cost.cost
    };
  }
  
  /**
   * Run quality check using Regret Checker
   */
  private static async runQualityCheck(content: string): Promise<any> {
    const prompt = HealthContentTemplates.generateRegretCheckPrompt(content);
    
    // Simulate quality analysis
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock quality scores based on content characteristics
    const hasNumbers = /\d/.test(content);
    const hasEvidence = /(research|study|shows|according)/i.test(content);
    const hasAction = /(tip|try|focus|avoid|start)/i.test(content);
    const hasSpecifics = /(minutes|grams|degrees|percent)/i.test(content);
    
    const factCheckScore = (hasNumbers ? 0.3 : 0) + (hasEvidence ? 0.4 : 0) + (hasSpecifics ? 0.3 : 0);
    const helpfulnessScore = (hasAction ? 0.5 : 0) + (hasSpecifics ? 0.3 : 0) + 0.2;
    
    const pass = factCheckScore >= 0.7 && helpfulnessScore >= 0.6;
    
    return {
      pass,
      confidence: Math.min(0.95, (factCheckScore + helpfulnessScore) / 2),
      non_trivial_insight: hasSpecifics,
      mechanism_or_consensus: hasEvidence,
      no_hallucinated_facts: factCheckScore >= 0.7,
      helpful_tone: helpfulnessScore >= 0.6,
      factual_accuracy_confidence: factCheckScore,
      regret_risk: pass ? 'low' : 'medium',
      suggested_edits: pass ? [] : ['Add more specific evidence', 'Include actionable steps']
    };
  }
  
  /**
   * Simulate posting and learning cycle
   */
  static async simulatePostingCycle(): Promise<void> {
    safeLog.info('🚀 SIMULATION: Starting content brain posting cycle');
    
    // Generate content
    const generatedContent = await this.generateOptimizedContent();
    
    if (!generatedContent) {
      safeLog.info('⏭️ SIMULATION: No content generated (budget or quality constraints)');
      return;
    }
    
    // Simulate posting
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate posting delay
    
    // Log posting event
    await contentLearning.logContentEvent({
      event: 'posted',
      post_id: generatedContent.post_id,
      kind: generatedContent.format,
      meta: {
        topic: generatedContent.topic,
        format: generatedContent.format,
        model_used: 'gpt-4o-mini',
        cost_usd: generatedContent.cost_usd,
        confidence: generatedContent.quality_score,
        time_slot: getCurrentTimeSlot(),
        bandit_arm: generatedContent.bandit_arm,
        exploration: false,
        quality_gates: {
          regret_check_passed: true,
          fact_check_score: 0.85,
          helpfulness_score: 0.8
        }
      }
    });
    
    safeLog.info(`📤 SIMULATION: Posted content ${generatedContent.post_id}`);
    
    // Simulate engagement metrics (would come from real Twitter API)
    const mockMetrics = this.generateMockEngagementMetrics(generatedContent.topic, generatedContent.format);
    
    // Log performance metrics
    await contentLearning.logLearningMetrics({
      post_id: generatedContent.post_id,
      likes: mockMetrics.likes,
      reposts: mockMetrics.reposts,
      comments: mockMetrics.comments,
      bookmarks: mockMetrics.bookmarks,
      impressions: mockMetrics.impressions,
      engagement_rate: mockMetrics.engagement_rate,
      reach_efficiency: mockMetrics.reach_efficiency
    });
    
    safeLog.info(`📊 SIMULATION: Logged metrics for ${generatedContent.post_id} (${mockMetrics.engagement_rate}% engagement)`);
    
    // Generate content strategy recommendations
    const strategy = await contentLearning.generateContentStrategy();
    if (strategy) {
      safeLog.info('📈 STRATEGY_RECOMMENDATIONS:');
      safeLog.info(`   Top topics: ${strategy.top_topics.map(([topic, score]) => `${topic}(${score.toFixed(3)})`).join(', ')}`);
      safeLog.info(`   Top formats: ${strategy.top_formats.map(([format, score]) => `${format}(${score.toFixed(3)})`).join(', ')}`);
    }
  }
  
  /**
   * Generate realistic mock engagement metrics
   */
  private static generateMockEngagementMetrics(topic: string, format: string): any {
    // Base performance varies by topic and format
    const topicMultipliers = {
      'nutrition': 1.2,
      'exercise': 1.1,
      'sleep': 1.3,
      'stress_management': 0.9,
      'recovery': 0.8
    };
    
    const formatMultipliers = {
      'single': 1.0,
      'thread': 1.4,
      'reply': 0.7
    };
    
    const baseImpressions = Math.floor(Math.random() * 2000) + 500; // 500-2500
    const topicBoost = topicMultipliers[topic] || 1.0;
    const formatBoost = formatMultipliers[format] || 1.0;
    
    const impressions = Math.floor(baseImpressions * topicBoost * formatBoost);
    const engagementRate = (Math.random() * 0.04 + 0.01) * topicBoost; // 1-5%
    
    const totalEngagement = Math.floor(impressions * engagementRate);
    const likes = Math.floor(totalEngagement * 0.7);
    const reposts = Math.floor(totalEngagement * 0.15);
    const comments = Math.floor(totalEngagement * 0.1);
    const bookmarks = Math.floor(totalEngagement * 0.05);
    
    return {
      impressions,
      likes,
      reposts,
      comments,
      bookmarks,
      engagement_rate: parseFloat((engagementRate * 100).toFixed(2)),
      reach_efficiency: parseFloat(((likes + reposts * 2 + comments * 1.5) / impressions).toFixed(4))
    };
  }
}

// Export the example for use in other parts of the system
export default ContentBrainExample;
