/**
 * 🚀 ENHANCED OPENAI CLIENT WITH CLAUDE COMPATIBILITY
 * 
 * Centralized AI client with:
 * - Multi-model support (OpenAI + Claude)
 * - Comprehensive error handling
 * - Exponential backoff retry logic
 * - Performance monitoring
 * - Budget enforcement
 * - Fallback mechanisms
 */

import { OpenAI } from 'openai';
import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { trendingTopicsEngine } from './trendingTopicsEngine';

// Claude integration placeholder (would need actual Anthropic SDK)
interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIResponse {
  success: boolean;
  content: string;
  model: string;
  tokens_used: number;
  cost: number;
  error?: string;
  retry_count: number;
  response_time_ms: number;
}

interface AIRequestOptions {
  model?: 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-sonnet' | 'claude-3-haiku';
  max_tokens?: number;
  temperature?: number;
  retry_attempts?: number;
  priority?: 'high' | 'medium' | 'low';
  operation_type?: string;
  include_trending?: boolean;
  fallback_to_cache?: boolean;
}

interface CachedContent {
  key: string;
  content: string;
  created_at: string;
  use_count: number;
  quality_score: number;
}

export class EnhancedOpenAIClient {
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private static readonly DEFAULT_RETRY_ATTEMPTS = 3;
  private static readonly BASE_DELAY = 1000; // 1 second
  private static readonly MAX_DELAY = 30000; // 30 seconds
  private static contentCache: Map<string, CachedContent> = new Map();

  /**
   * 🎯 MAIN CONTENT GENERATION METHOD
   */
  static async generateContent(
    prompt: string,
    options: AIRequestOptions = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const {
      model = 'gpt-4o-mini',
      max_tokens = 150,
      temperature = 0.8,
      retry_attempts = this.DEFAULT_RETRY_ATTEMPTS,
      priority = 'medium',
      operation_type = 'content_generation',
      include_trending = true,
      fallback_to_cache = true
    } = options;

    console.log(`🤖 Generating content with ${model} (${operation_type})`);

    // Check cache first (but not for content generation to avoid duplicates)
    const cacheKey = this.generateCacheKey(prompt, model, temperature);
    if (fallback_to_cache && operation_type !== 'content_generation' && operation_type !== 'supreme_content_generation') {
      const cachedContent = await this.getCachedContent(cacheKey);
      if (cachedContent) {
        console.log('📋 Using cached content for non-content operation');
        return {
          success: true,
          content: cachedContent.content,
          model: `${model}-cached`,
          tokens_used: 0,
          cost: 0,
          retry_count: 0,
          response_time_ms: Date.now() - startTime
        };
      }
    } else if (operation_type === 'content_generation' || operation_type === 'supreme_content_generation') {
      console.log('🚫 Skipping cache for content generation to ensure uniqueness');
    }

    // Enhance prompt with trending topics if requested
    let enhancedPrompt = prompt;
    if (include_trending) {
      try {
        const trendContext = await trendingTopicsEngine.getTrendingContext();
        enhancedPrompt = `${trendContext.contextualPrompt}\n\n${prompt}`;
        console.log(`🔥 Enhanced with trending: ${trendContext.primaryTrend.keyword}`);
      } catch (error) {
        console.warn('⚠️ Failed to add trending context, continuing with original prompt');
      }
    }

    // Attempt generation with retries
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retry_attempts; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${retry_attempts}`);

        // Budget check
        await emergencyBudgetLockdown.enforceBeforeAICall(operation_type);

        const response = await this.makeAICall(enhancedPrompt, {
          model,
          max_tokens,
          temperature
        });

        if (response.success) {
          // Cache successful response
          if (fallback_to_cache && response.content) {
            await this.cacheContent(cacheKey, response.content, 8); // Quality score 8/10
          }

          // Log success
          await this.logAICall({
            operation_type,
            model,
            success: true,
            tokens_used: response.tokens_used,
            cost: response.cost,
            retry_count: attempt - 1,
            response_time_ms: Date.now() - startTime
          });

          return {
            ...response,
            retry_count: attempt - 1,
            response_time_ms: Date.now() - startTime
          };
        }

        lastError = new Error(response.error || 'Unknown error');

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`⚠️ Attempt ${attempt} failed:`, lastError.message);

        // Wait before retry (exponential backoff)
        if (attempt < retry_attempts) {
          const delay = Math.min(this.BASE_DELAY * Math.pow(2, attempt - 1), this.MAX_DELAY);
          console.log(`⏱️ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed - try fallback
    console.error(`❌ All ${retry_attempts} attempts failed, trying fallback`);
    const fallbackResponse = await this.handleFailureFallback(prompt, model, operation_type);

    // Log failure
    await this.logAICall({
      operation_type,
      model,
      success: false,
      error: lastError?.message || 'Unknown error',
      tokens_used: 0,
      cost: 0,
      retry_count: retry_attempts,
      response_time_ms: Date.now() - startTime
    });

    return {
      ...fallbackResponse,
      retry_count: retry_attempts,
      response_time_ms: Date.now() - startTime
    };
  }

  /**
   * 🤖 MAKE AI CALL (Model Router)
   */
  private static async makeAICall(
    prompt: string,
    options: {
      model: string;
      max_tokens: number;
      temperature: number;
    }
  ): Promise<AIResponse> {
    const { model, max_tokens, temperature } = options;

    if (model.startsWith('claude')) {
      return await this.callClaude(prompt, model, max_tokens, temperature);
    } else {
      return await this.callOpenAI(prompt, model, max_tokens, temperature);
    }
  }

  /**
   * 🔵 OPENAI API CALL
   */
  private static async callOpenAI(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<AIResponse> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokensUsed, model);

      return {
        success: true,
        content,
        model,
        tokens_used: tokensUsed,
        cost,
        error: undefined,
        retry_count: 0,
        response_time_ms: 0
      };

    } catch (error) {
      console.error('❌ OpenAI API call failed:', error);
      return {
        success: false,
        content: '',
        model,
        tokens_used: 0,
        cost: 0,
        error: error instanceof Error ? error.message : 'Unknown OpenAI error',
        retry_count: 0,
        response_time_ms: 0
      };
    }
  }

  /**
   * 🟣 CLAUDE API CALL (Future Implementation)
   */
  private static async callClaude(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<AIResponse> {
    // Placeholder for Claude integration
    console.log('🟣 Claude integration not yet implemented, falling back to OpenAI');
    
    // For now, fallback to OpenAI with gpt-4o-mini
    return await this.callOpenAI(prompt, 'gpt-4o-mini', maxTokens, temperature);
    
    // Future Claude implementation would go here:
    /*
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      
      const response = await anthropic.messages.create({
        model: model.replace('claude-3-', 'claude-3-'),
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }]
      });

      return {
        success: true,
        content: response.content[0]?.text || '',
        model,
        tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
        cost: this.calculateClaudeCost(response.usage?.input_tokens || 0, response.usage?.output_tokens || 0, model),
        error: undefined,
        retry_count: 0,
        response_time_ms: 0
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        model,
        tokens_used: 0,
        cost: 0,
        error: error instanceof Error ? error.message : 'Unknown Claude error',
        retry_count: 0,
        response_time_ms: 0
      };
    }
    */
  }

  /**
   * 🆘 FAILURE FALLBACK HANDLER
   */
  private static async handleFailureFallback(
    originalPrompt: string,
    failedModel: string,
    operationType: string
  ): Promise<AIResponse> {
    console.log('🆘 Attempting failure fallback...');

    // Try cached high-quality content first
    const fallbackCache = await this.getHighQualityCachedContent(operationType);
    if (fallbackCache) {
      console.log('📋 Using high-quality cached fallback');
      return {
        success: true,
        content: fallbackCache.content,
        model: `${failedModel}-cached-fallback`,
        tokens_used: 0,
        cost: 0,
        error: undefined,
        retry_count: 0,
        response_time_ms: 0
      };
    }

    // Try different model
    const fallbackModel = failedModel === 'gpt-4o-mini' ? 'gpt-4o' : 'gpt-4o-mini';
    try {
      console.log(`🔄 Trying fallback model: ${fallbackModel}`);
      return await this.callOpenAI(originalPrompt, fallbackModel, 100, 0.7);
    } catch (error) {
      console.error('❌ Fallback model also failed');
    }

    // Last resort: pre-written content
    const emergencyContent = this.getEmergencyContent(operationType);
    return {
      success: true,
      content: emergencyContent,
      model: `${failedModel}-emergency`,
      tokens_used: 0,
      cost: 0,
      error: 'Used emergency content due to AI failure',
      retry_count: 0,
      response_time_ms: 0
    };
  }

  /**
   * 📋 CONTENT CACHING
   */
  private static generateCacheKey(prompt: string, model: string, temperature: number): string {
    const hash = this.simpleHash(prompt + model + temperature);
    return `content_${hash}`;
  }

  private static async getCachedContent(key: string): Promise<CachedContent | null> {
    try {
      // Check memory cache first
      if (this.contentCache.has(key)) {
        const cached = this.contentCache.get(key)!;
        // Check if cache is still valid (24 hours)
        const age = Date.now() - new Date(cached.created_at).getTime();
        if (age < 24 * 60 * 60 * 1000) {
          cached.use_count++;
          return cached;
        } else {
          this.contentCache.delete(key);
        }
      }

      // Check database cache
      const { data, error } = await supabaseClient.supabase
        .from('content_cache')
        .select('*')
        .eq('key', key)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (error || !data) return null;

      const cached: CachedContent = {
        key: data.key,
        content: data.content,
        created_at: data.created_at,
        use_count: data.use_count + 1,
        quality_score: data.quality_score
      };

      this.contentCache.set(key, cached);
      return cached;

    } catch (error) {
      console.error('❌ Cache retrieval failed:', error);
      return null;
    }
  }

  private static async cacheContent(
    key: string,
    content: string,
    qualityScore: number
  ): Promise<void> {
    try {
      const cached: CachedContent = {
        key,
        content,
        created_at: new Date().toISOString(),
        use_count: 1,
        quality_score: qualityScore
      };

      // Store in memory
      this.contentCache.set(key, cached);

      // Store in database
      await supabaseClient.supabase
        .from('content_cache')
        .upsert({
          key,
          content,
          quality_score: qualityScore,
          use_count: 1,
          created_at: cached.created_at
        }, {
          onConflict: 'key'
        });

    } catch (error) {
      console.error('❌ Cache storage failed:', error);
    }
  }

  private static async getHighQualityCachedContent(operationType: string): Promise<CachedContent | null> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('content_cache')
        .select('*')
        .gte('quality_score', 8)
        .order('quality_score', { ascending: false })
        .limit(1)
        .single();

      return error ? null : data;
    } catch (error) {
      return null;
    }
  }

  /**
   * 🆘 EMERGENCY CONTENT
   */
  private static getEmergencyContent(operationType: string): string {
    const emergencyContent = {
      content_generation: "Did you know that just 10 minutes of daily movement can boost your energy levels by 20%? Small habits create big changes. What's one healthy habit you want to build this week?",
      reply_generation: "Thanks for sharing! That's a great point about health optimization.",
      quote_generation: "This is exactly why evidence-based health information matters 🧠",
      trend_analysis: "Health trends come and go, but evidence-based practices remain constant."
    };

    return emergencyContent[operationType as keyof typeof emergencyContent] || 
           "Health is wealth! Focus on evidence-based practices for long-term wellness. 🌱";
  }

  /**
   * 💰 COST CALCULATION
   */
  private static calculateCost(tokens: number, model: string): number {
    const rates = {
      'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
      'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
      'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
      'claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 }
    };

    const rate = rates[model as keyof typeof rates] || rates['gpt-4o-mini'];
    // Estimate 70% input, 30% output
    return (tokens * 0.7 * rate.input) + (tokens * 0.3 * rate.output);
  }

  /**
   * 📊 LOGGING
   */
  private static async logAICall(log: {
    operation_type: string;
    model: string;
    success: boolean;
    tokens_used?: number;
    cost?: number;
    error?: string;
    retry_count: number;
    response_time_ms: number;
  }): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('ai_call_logs')
        .insert({
          ...log,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('❌ Failed to log AI call:', error);
    }
  }

  /**
   * 🔧 UTILITY METHODS
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 📊 PERFORMANCE ANALYTICS
   */
  static async getPerformanceMetrics(): Promise<{
    total_calls: number;
    success_rate: number;
    average_response_time: number;
    total_cost: number;
    top_models: { model: string; usage_count: number }[];
    error_rate_by_model: { model: string; error_rate: number }[];
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_ai_performance_metrics');

      if (error) throw error;

      return data || {
        total_calls: 0,
        success_rate: 0,
        average_response_time: 0,
        total_cost: 0,
        top_models: [],
        error_rate_by_model: []
      };
    } catch (error) {
      console.error('❌ Failed to get performance metrics:', error);
      return {
        total_calls: 0,
        success_rate: 0,
        average_response_time: 0,
        total_cost: 0,
        top_models: [],
        error_rate_by_model: []
      };
    }
  }
}

export const enhancedOpenAIClient = EnhancedOpenAIClient; 