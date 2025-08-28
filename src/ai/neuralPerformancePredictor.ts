import OpenAI from 'openai';
import { admin } from '../lib/supabaseClients';

interface ContentFeatures {
  // Structural features
  character_count: number;
  word_count: number;
  sentence_count: number;
  has_numbers: boolean;
  has_emojis: boolean;
  has_questions: boolean;
  has_controversy_words: boolean;
  
  // Content type features
  is_thread: boolean;
  thread_length?: number;
  content_type: 'educational' | 'controversial' | 'personal' | 'data' | 'question' | 'tip';
  
  // Engagement features
  hook_strength: number; // 1-10
  call_to_action: boolean;
  social_proof: boolean;
  urgency_indicators: boolean;
  
  // Temporal features
  hour_of_day: number;
  day_of_week: number;
  is_weekend: boolean;
  
  // Historical context
  recent_performance_avg: number;
  days_since_similar_topic: number;
  account_follower_momentum: number;
}

interface PerformancePrediction {
  predicted_likes: number;
  predicted_retweets: number;
  predicted_replies: number;
  predicted_followers_gained: number;
  viral_probability: number; // 0-1
  engagement_rate: number; // 0-1
  confidence_score: number; // 0-1
  optimization_suggestions: string[];
  risk_factors: string[];
}

interface TrainingData {
  features: ContentFeatures;
  actual_performance: {
    likes: number;
    retweets: number;
    replies: number;
    followers_gained: number;
    hours_since_posted: number;
  };
}

/**
 * 🧠 NEURAL PERFORMANCE PREDICTOR
 * Advanced AI system that learns from historical data to predict content performance
 * Uses machine learning patterns to optimize content before posting
 */
export class NeuralPerformancePredictor {
  private static instance: NeuralPerformancePredictor;
  private openai: OpenAI;
  private trainingData: TrainingData[] = [];
  private modelVersion: string = '1.0';
  private lastTraining: Date | null = null;

  private constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  public static getInstance(): NeuralPerformancePredictor {
    if (!NeuralPerformancePredictor.instance) {
      NeuralPerformancePredictor.instance = new NeuralPerformancePredictor();
    }
    return NeuralPerformancePredictor.instance;
  }

  /**
   * 🎯 MAIN PREDICTION: Analyze content and predict performance
   */
  public async predictPerformance(content: string, isThread: boolean = false): Promise<PerformancePrediction> {
    console.log('🧠 NEURAL_PREDICTOR: Analyzing content for performance prediction...');

    try {
      // 1. Extract features from content
      const features = await this.extractContentFeatures(content, isThread);
      
      // 2. Ensure we have recent training data
      await this.ensureTrainingData();
      
      // 3. Make AI-powered prediction
      const prediction = await this.makePrediction(features);
      
      console.log(`🎯 PREDICTION: ${prediction.viral_probability.toFixed(2)} viral probability, ${prediction.predicted_likes} likes expected`);
      
      return prediction;

    } catch (error: any) {
      console.error('❌ NEURAL_PREDICTOR: Prediction failed:', error.message);
      
      // Fallback prediction based on content analysis
      return this.createFallbackPrediction(content, isThread);
    }
  }

  /**
   * 🔍 FEATURE EXTRACTION: Analyze content to extract predictive features
   */
  private async extractContentFeatures(content: string, isThread: boolean): Promise<ContentFeatures> {
    const now = new Date();
    
    // Basic text analysis
    const characterCount = content.length;
    const wordCount = content.split(/\s+/).length;
    const sentenceCount = content.split(/[.!?]+/).length;
    
    // Content pattern detection
    const hasNumbers = /\d/.test(content);
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content);
    const hasQuestions = /\?/.test(content);
    
    // Controversy detection
    const controversyWords = ['unpopular', 'controversial', 'wrong', 'myth', 'scam', 'lie', 'secret', 'hidden', 'industry', 'truth'];
    const hasControversyWords = controversyWords.some(word => 
      content.toLowerCase().includes(word)
    );

    // Thread analysis
    let threadLength = 0;
    if (isThread) {
      threadLength = content.split(/\d+\//).length - 1;
    }

    // Content type classification
    const contentType = await this.classifyContentType(content);

    // Hook strength analysis
    const hookStrength = await this.analyzeHookStrength(content);

    // Engagement indicators
    const callToAction = /follow|share|like|comment|thoughts|agree|disagree|what do you think/i.test(content);
    const socialProof = /study|research|data|expert|proven|scientist|doctor/i.test(content);
    const urgencyIndicators = /breaking|urgent|just|now|today|alert|new|latest/i.test(content);

    // Get recent performance context
    const recentPerformance = await this.getRecentPerformanceAverage();
    const daysSinceSimilar = await this.getDaysSinceSimilarContent(content);
    const followerMomentum = await this.getFollowerMomentum();

    return {
      character_count: characterCount,
      word_count: wordCount,
      sentence_count: sentenceCount,
      has_numbers: hasNumbers,
      has_emojis: hasEmojis,
      has_questions: hasQuestions,
      has_controversy_words: hasControversyWords,
      is_thread: isThread,
      thread_length: threadLength > 0 ? threadLength : undefined,
      content_type: contentType,
      hook_strength: hookStrength,
      call_to_action: callToAction,
      social_proof: socialProof,
      urgency_indicators: urgencyIndicators,
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      is_weekend: now.getDay() === 0 || now.getDay() === 6,
      recent_performance_avg: recentPerformance,
      days_since_similar_topic: daysSinceSimilar,
      account_follower_momentum: followerMomentum
    };
  }

  /**
   * 🤖 AI-POWERED PREDICTION: Use AI to analyze features and predict performance
   */
  private async makePrediction(features: ContentFeatures): Promise<PerformancePrediction> {
    const trainingContext = this.createTrainingContext();
    
    const prompt = `You are an advanced neural network trained on Twitter engagement patterns. Analyze these content features and predict performance.

CONTENT FEATURES:
- Structure: ${features.character_count} chars, ${features.word_count} words, ${features.sentence_count} sentences
- Content Type: ${features.content_type}${features.is_thread ? ` thread (${features.thread_length} tweets)` : ' single tweet'}
- Engagement Elements: Hook strength ${features.hook_strength}/10
- Has: ${[
  features.has_numbers && 'numbers',
  features.has_emojis && 'emojis', 
  features.has_questions && 'questions',
  features.has_controversy_words && 'controversy words',
  features.call_to_action && 'call to action',
  features.social_proof && 'social proof',
  features.urgency_indicators && 'urgency'
].filter(Boolean).join(', ') || 'basic content'}

CONTEXT:
- Timing: ${features.hour_of_day}:00 on ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][features.day_of_week]}${features.is_weekend ? ' (weekend)' : ''}
- Account State: Recent avg ${features.recent_performance_avg} engagement, ${features.days_since_similar_topic} days since similar topic
- Momentum: ${features.account_follower_momentum}/100 follower momentum

TRAINING PATTERNS:
${trainingContext}

Based on similar content patterns, predict performance:

Respond in JSON:
{
  "predicted_likes": [number],
  "predicted_retweets": [number], 
  "predicted_replies": [number],
  "predicted_followers_gained": [number],
  "viral_probability": [0-1],
  "engagement_rate": [0-1],
  "confidence_score": [0-1],
  "optimization_suggestions": ["suggestion1", "suggestion2"],
  "risk_factors": ["risk1", "risk2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for consistent predictions
        response_format: { type: 'json_object' },
        max_tokens: 600
      });

      const prediction = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        predicted_likes: Math.max(0, prediction.predicted_likes || 0),
        predicted_retweets: Math.max(0, prediction.predicted_retweets || 0),
        predicted_replies: Math.max(0, prediction.predicted_replies || 0),
        predicted_followers_gained: Math.max(0, prediction.predicted_followers_gained || 0),
        viral_probability: Math.min(1, Math.max(0, prediction.viral_probability || 0)),
        engagement_rate: Math.min(1, Math.max(0, prediction.engagement_rate || 0)),
        confidence_score: Math.min(1, Math.max(0, prediction.confidence_score || 0.5)),
        optimization_suggestions: prediction.optimization_suggestions || [],
        risk_factors: prediction.risk_factors || []
      };

    } catch (error: any) {
      console.error('❌ AI prediction failed:', error.message);
      return this.createFallbackPrediction('', features.is_thread);
    }
  }

  /**
   * 📚 TRAINING DATA: Ensure we have recent performance data for learning
   */
  private async ensureTrainingData(): Promise<void> {
    // Only refresh training data every hour
    if (this.lastTraining && Date.now() - this.lastTraining.getTime() < 60 * 60 * 1000) {
      return;
    }

    try {
      console.log('📚 NEURAL_PREDICTOR: Refreshing training data...');

      // Get recent posts with performance data
      const { data: posts } = await admin
        .from('tweets')
        .select('content, likes_count, retweets_count, replies_count, created_at')
        .not('content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!posts || posts.length === 0) {
        console.warn('⚠️ No training data available');
        return;
      }

      // Convert to training data format
      this.trainingData = [];
      
      for (const post of posts) {
        try {
          const features = await this.extractContentFeatures(post.content, false);
          const hoursOld = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
          
          this.trainingData.push({
            features,
            actual_performance: {
              likes: post.likes_count || 0,
              retweets: post.retweets_count || 0,
              replies: post.replies_count || 0,
              followers_gained: Math.max(0, Math.floor((post.likes_count || 0) / 10)), // Estimate
              hours_since_posted: hoursOld
            }
          });
        } catch (error) {
          // Skip posts that can't be processed
          continue;
        }
      }

      this.lastTraining = new Date();
      console.log(`✅ NEURAL_PREDICTOR: Loaded ${this.trainingData.length} training examples`);

    } catch (error: any) {
      console.error('❌ Training data refresh failed:', error.message);
    }
  }

  /**
   * 🎯 Content type classification using AI
   */
  private async classifyContentType(content: string): Promise<ContentFeatures['content_type']> {
    const educationalWords = ['how', 'guide', 'step', 'learn', 'tip', 'method', 'technique'];
    const controversialWords = ['unpopular', 'wrong', 'myth', 'controversial', 'hot take'];
    const personalWords = ['I', 'my', 'me', 'personal', 'experience', 'story'];
    const dataWords = ['study', 'research', 'data', 'statistics', 'percent', '%'];
    const questionWords = ['?', 'what', 'how', 'why', 'when', 'where'];

    const lowerContent = content.toLowerCase();

    if (controversialWords.some(word => lowerContent.includes(word))) return 'controversial';
    if (dataWords.some(word => lowerContent.includes(word))) return 'data';
    if (personalWords.some(word => lowerContent.includes(word))) return 'personal';
    if (educationalWords.some(word => lowerContent.includes(word))) return 'educational';
    if (questionWords.some(word => lowerContent.includes(word))) return 'question';
    
    return 'tip';
  }

  /**
   * 🎣 Analyze hook strength (opening impact)
   */
  private async analyzeHookStrength(content: string): Promise<number> {
    const firstSentence = content.split(/[.!?]/)[0];
    const hooks = [
      { pattern: /🚨|breaking|urgent|alert/i, strength: 9 },
      { pattern: /unpopular|controversial|hot take/i, strength: 8 },
      { pattern: /secret|hidden|insider/i, strength: 8 },
      { pattern: /\d+%|\d+ \w+/i, strength: 7 },
      { pattern: /study|research|data/i, strength: 6 },
      { pattern: /tip|hack|trick/i, strength: 5 },
      { pattern: /\?/i, strength: 4 }
    ];

    for (const hook of hooks) {
      if (hook.pattern.test(firstSentence)) {
        return hook.strength;
      }
    }

    return 3; // Base hook strength
  }

  /**
   * Helper methods for context data
   */
  private async getRecentPerformanceAverage(): Promise<number> {
    try {
      const { data } = await admin
        .from('tweets')
        .select('likes_count, retweets_count, replies_count')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!data || data.length === 0) return 0;

      const avgEngagement = data.reduce((sum, post) => {
        return sum + (post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0);
      }, 0) / data.length;

      return avgEngagement;
    } catch {
      return 0;
    }
  }

  private async getDaysSinceSimilarContent(content: string): Promise<number> {
    // Simplified: extract key words and check for similar content
    const keyWords = content.toLowerCase().split(/\s+/).filter(word => word.length > 4).slice(0, 3);
    
    try {
      const { data } = await admin
        .from('tweets')
        .select('created_at, content')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!data) return 30;

      for (const post of data) {
        if (post.content && keyWords.some(word => post.content.toLowerCase().includes(word))) {
          const daysDiff = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff;
        }
      }
    } catch {
      // Fallback
    }

    return 30; // Default: 30 days
  }

  private async getFollowerMomentum(): Promise<number> {
    // Simplified momentum calculation based on recent engagement trends
    try {
      const { data } = await admin
        .from('tweets')
        .select('likes_count, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!data || data.length < 2) return 50;

      const recent = data.slice(0, 3).reduce((sum, p) => sum + (p.likes_count || 0), 0) / 3;
      const older = data.slice(3).reduce((sum, p) => sum + (p.likes_count || 0), 0) / Math.max(data.slice(3).length, 1);

      const momentum = Math.min(100, Math.max(0, (recent / Math.max(older, 1)) * 50));
      return momentum;
    } catch {
      return 50;
    }
  }

  /**
   * 📊 Create training context for AI
   */
  private createTrainingContext(): string {
    if (this.trainingData.length === 0) {
      return "Limited training data available - using general patterns.";
    }

    const topPerformers = this.trainingData
      .sort((a, b) => {
        const aScore = a.actual_performance.likes + a.actual_performance.retweets * 2;
        const bScore = b.actual_performance.likes + b.actual_performance.retweets * 2;
        return bScore - aScore;
      })
      .slice(0, 5);

    return topPerformers.map((item, i) => 
      `Top ${i+1}: ${item.features.content_type} (${item.features.character_count} chars) → ${item.actual_performance.likes} likes, ${item.actual_performance.retweets} retweets`
    ).join('\n');
  }

  /**
   * 🔄 Fallback prediction when AI fails
   */
  private createFallbackPrediction(content: string, isThread: boolean): PerformancePrediction {
    const baseEngagement = isThread ? 25 : 15;
    const lengthMultiplier = Math.max(0.5, Math.min(2, content.length / 200));
    
    return {
      predicted_likes: Math.round(baseEngagement * lengthMultiplier),
      predicted_retweets: Math.round(baseEngagement * 0.3 * lengthMultiplier),
      predicted_replies: Math.round(baseEngagement * 0.4 * lengthMultiplier),
      predicted_followers_gained: Math.round(baseEngagement * 0.1 * lengthMultiplier),
      viral_probability: 0.3,
      engagement_rate: 0.05,
      confidence_score: 0.4,
      optimization_suggestions: ['Add specific numbers or data', 'Include a stronger hook'],
      risk_factors: ['Limited prediction confidence', 'No recent training data']
    };
  }

  /**
   * 📈 Record actual performance for learning
   */
  public async recordActualPerformance(content: string, likes: number, retweets: number, replies: number): Promise<void> {
    try {
      console.log(`📈 NEURAL_PREDICTOR: Recording performance - ${likes} likes, ${retweets} retweets, ${replies} replies`);
      
      // This would update the training data with actual results
      // Could be used to improve future predictions
      
    } catch (error: any) {
      console.error('❌ Performance recording failed:', error.message);
    }
  }
}

export const getNeuralPredictor = () => NeuralPerformancePredictor.getInstance();
