/**
 * 🧠 INTELLIGENT TWEET GENERATOR
 * 
 * Advanced AI system that generates tweets using:
 * - Learned patterns from viral tweets
 * - Dynamic prompt construction
 * - Performance-based format selection
 * - Real-time learning integration
 * 
 * This system replaces static templates with intelligent, evolving content generation.
 */

import { SecureSupabaseClient } from '../utils/secureSupabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import OpenAI from 'openai';
import * as crypto from 'crypto';

interface LearningContext {
  top_formats: Array<{
    format_type: string;
    avg_engagement: number;
    success_rate: number;
    example_content: string;
  }>;
  successful_patterns: Array<{
    pattern_name: string;
    confidence: number;
    description: string;
  }>;
  topic_performance: Array<{
    topic: string;
    avg_engagement: number;
    best_tone: string;
  }>;
  recent_winners: Array<{
    content: string;
    engagement_rate: number;
    format_type: string;
  }>;
}

interface GenerationRequest {
  topic?: string;
  target_format?: string;
  target_tone?: string;
  max_length?: number;
  include_threads?: boolean;
  urgency_level?: number;
  experimental?: boolean;
}

interface GenerationResult {
  success: boolean;
  content: string | string[];
  format_used: string;
  tone_used: string;
  confidence_score: number;
  predicted_engagement: number;
  generation_reasoning: string;
  learning_applied: string[];
  session_id: string;
  error?: string;
}

interface PromptEvolution {
  version: string;
  system_prompt: string;
  user_template: string;
  performance_score: number;
  usage_count: number;
}

export class IntelligentTweetGenerator {
  private supabase = new SecureSupabaseClient();
  private openai = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
  private currentLearningContext: LearningContext | null = null;
  private promptEvolutions: Map<string, PromptEvolution> = new Map();

  /**
   * 🎯 MAIN GENERATION FUNCTION
   */
  async generateIntelligentTweet(request: GenerationRequest = {}): Promise<GenerationResult> {
    try {
      console.log('🧠 === INTELLIGENT TWEET GENERATION ===');
      console.log(`📋 Request: ${JSON.stringify(request, null, 2)}`);

      // 1. Load current learning context
      const learningContext = await this.loadLearningContext();
      console.log(`📊 Loaded learning context with ${learningContext.top_formats.length} formats`);

      // 2. Select optimal format based on learning
      const optimalFormat = await this.selectOptimalFormat(request, learningContext);
      console.log(`🎯 Selected format: ${optimalFormat.format_type} (${optimalFormat.confidence}% confidence)`);

      // 3. Build dynamic prompt using learned patterns
      const dynamicPrompt = await this.buildDynamicPrompt(request, optimalFormat, learningContext);
      console.log('📝 Dynamic prompt constructed with learning insights');

      // 4. Generate content with evolved prompts
      const generationResult = await this.generateWithEvolvedPrompts(dynamicPrompt, request);
      
      if (!generationResult.success) {
        throw new Error(generationResult.error || 'Generation failed');
      }

      // 5. Validate and score the generated content
      const validationResult = await this.validateAndScoreContent(
        generationResult.content,
        optimalFormat,
        learningContext
      );

      // 6. Create generation session record for learning
      const sessionId = await this.recordGenerationSession({
        ...request,
        format_used: optimalFormat.format_type,
        content: generationResult.content,
        learning_context: learningContext,
        prompt_used: dynamicPrompt.prompt,
        predicted_engagement: validationResult.predicted_engagement
      });

      console.log('✅ === INTELLIGENT GENERATION COMPLETE ===');
      console.log(`📊 Predicted engagement: ${(validationResult.predicted_engagement || 0).toFixed(3)}`);
      console.log(`🎯 Confidence: ${(validationResult.confidence_score || 0).toFixed(2)}`);

      return {
        success: true,
        content: generationResult.content,
        format_used: optimalFormat.format_type,
        tone_used: optimalFormat.tone || 'professional',
        confidence_score: validationResult.confidence_score,
        predicted_engagement: validationResult.predicted_engagement,
        generation_reasoning: dynamicPrompt.reasoning,
        learning_applied: dynamicPrompt.learning_applied,
        session_id: sessionId
      };

    } catch (error: any) {
      console.error('❌ Intelligent generation failed:', error);
      return {
        success: false,
        content: '',
        format_used: 'fallback',
        tone_used: 'professional',
        confidence_score: 0,
        predicted_engagement: 0,
        generation_reasoning: 'Error occurred during generation',
        learning_applied: [],
        session_id: '',
        error: error.message
      };
    }
  }

  /**
   * 📊 LOAD LEARNING CONTEXT FROM DATABASE
   */
  private async loadLearningContext(): Promise<LearningContext> {
    try {
      // Get top-performing formats
      const { data: formatData } = await this.supabase.client
        .from('content_format_fingerprints')
        .select('*')
        .order('avg_engagement', { ascending: false })
        .limit(10);

      // Get recent viral tweets for examples
      const { data: viralTweets } = await this.supabase.client
        .from('viral_tweets_learned')
        .select('content, engagement_rate, format_type, tone, primary_topic')
        .order('viral_score', { ascending: false })
        .limit(15);

      // Get performance patterns
      const { data: patterns } = await this.supabase.client
        .from('performance_patterns_learned')
        .select('pattern_name, confidence_score, pattern_description')
        .eq('still_effective', true)
        .order('confidence_score', { ascending: false })
        .limit(10);

      // Get topic performance data
      const { data: topicData } = await this.supabase.client
        .from('topic_resonance_tracking')
        .select('topic, avg_engagement_rate')
        .order('avg_engagement_rate', { ascending: false })
        .limit(15);

      // Process format data
      const top_formats = (formatData || []).map(format => ({
        format_type: format.format_name,
        avg_engagement: format.avg_engagement || 0,
        success_rate: format.success_rate || 0,
        example_content: format.format_pattern || ''
      }));

      // Process patterns
      const successful_patterns = (patterns || []).map(pattern => ({
        pattern_name: pattern.pattern_name,
        confidence: pattern.confidence_score || 0,
        description: pattern.pattern_description || ''
      }));

      // Process topics (simplified)
      const topic_performance = (topicData || []).map(topic => ({
        topic: topic.topic,
        avg_engagement: topic.avg_engagement_rate || 0,
        best_tone: 'professional' // We'll enhance this later
      }));

      // Process recent winners
      const recent_winners = (viralTweets || []).slice(0, 8).map(tweet => ({
        content: tweet.content,
        engagement_rate: tweet.engagement_rate || 0,
        format_type: tweet.format_type || 'other'
      }));

      this.currentLearningContext = {
        top_formats,
        successful_patterns,
        topic_performance,
        recent_winners
      };

      return this.currentLearningContext;

    } catch (error: any) {
      console.error('❌ Failed to load learning context:', error);
      
      // Return minimal context as fallback
      return {
        top_formats: [],
        successful_patterns: [],
        topic_performance: [],
        recent_winners: []
      };
    }
  }

  /**
   * 🎯 SELECT OPTIMAL FORMAT BASED ON LEARNING
   */
  private async selectOptimalFormat(
    request: GenerationRequest, 
    context: LearningContext
  ): Promise<{ format_type: string; confidence: number; tone?: string }> {
    
    // If format is specified, use it
    if (request.target_format) {
      return { 
        format_type: request.target_format, 
        confidence: 70,
        tone: request.target_tone 
      };
    }

    // If we have learning data, use it
    if (context.top_formats.length > 0) {
      // Weight formats by engagement and success rate
      const scoredFormats = context.top_formats.map(format => ({
        ...format,
        score: (format.avg_engagement * 0.6) + (format.success_rate * 0.4)
      })).sort((a, b) => b.score - a.score);

      // Add some randomness to avoid repetition (but favor top performers)
      const selectedIndex = Math.floor(Math.random() * Math.min(3, scoredFormats.length));
      const selected = scoredFormats[selectedIndex];

      return {
        format_type: selected.format_type,
        confidence: Math.min(95, 70 + (selected.score * 25)),
        tone: request.target_tone || this.inferOptimalTone(selected.format_type, context)
      };
    }

    // Fallback to proven defaults
    const defaultFormats = [
      'hook_value_cta', 'research_reveal', 'personal_discovery', 
      'question_hook', 'storytelling'
    ];
    
    return {
      format_type: defaultFormats[Math.floor(Math.random() * defaultFormats.length)],
      confidence: 60,
      tone: request.target_tone || 'professional'
    };
  }

  /**
   * 📝 BUILD DYNAMIC PROMPT USING LEARNED PATTERNS
   */
  private async buildDynamicPrompt(
    request: GenerationRequest,
    format: { format_type: string; confidence: number; tone?: string },
    context: LearningContext
  ): Promise<{
    prompt: string;
    reasoning: string;
    learning_applied: string[];
  }> {
    
    const learning_applied: string[] = [];
    let reasoning = `Selected ${format.format_type} format with ${format.confidence}% confidence. `;

    // Build system prompt with learning insights
    let systemPrompt = `You are an expert health content creator who has studied thousands of viral tweets. Your specialty is creating engaging, scientifically-accurate health content that captures attention and drives engagement.

VIRAL PATTERN INSIGHTS:`;

    // Add top format insights
    if (context.top_formats.length > 0) {
      const topFormat = context.top_formats[0];
      systemPrompt += `\n- The highest-performing format is "${topFormat.format_type}" with ${topFormat.avg_engagement.toFixed(3)} average engagement`;
      learning_applied.push(`Applied top format insights from ${topFormat.format_type}`);
    }

    // Add successful patterns
    if (context.successful_patterns.length > 0) {
      systemPrompt += `\n- Key success patterns: ${context.successful_patterns.slice(0, 3).map(p => p.pattern_name).join(', ')}`;
      learning_applied.push(`Applied ${context.successful_patterns.length} successful patterns`);
    }

    // Add topic performance insights
    if (context.topic_performance.length > 0 && request.topic) {
      const relevantTopic = context.topic_performance.find(t => 
        t.topic.toLowerCase().includes(request.topic!.toLowerCase()) ||
        request.topic!.toLowerCase().includes(t.topic.toLowerCase())
      );
      if (relevantTopic) {
        systemPrompt += `\n- Topic "${relevantTopic.topic}" performs at ${relevantTopic.avg_engagement.toFixed(3)} engagement rate`;
        learning_applied.push(`Applied topic performance data for ${relevantTopic.topic}`);
      }
    }

    // Build user prompt with examples
    let userPrompt = `Create a ${format.format_type} health tweet`;
    
    if (request.topic) {
      userPrompt += ` about ${request.topic}`;
      reasoning += `Topic focused on ${request.topic}. `;
    }

    if (format.tone) {
      userPrompt += ` with a ${format.tone} tone`;
      reasoning += `Using ${format.tone} tone. `;
    }

    // Add viral examples for inspiration
    if (context.recent_winners.length > 0) {
      const relevantExamples = context.recent_winners
        .filter(w => !request.topic || w.content.toLowerCase().includes(request.topic.toLowerCase()))
        .slice(0, 3);
      
      if (relevantExamples.length > 0) {
        userPrompt += `\n\nINSPIRATION FROM HIGH-PERFORMING TWEETS:`;
        relevantExamples.forEach((example, i) => {
          userPrompt += `\n${i + 1}. "${example.content}" (${example.engagement_rate.toFixed(3)} engagement)`;
        });
        learning_applied.push(`Used ${relevantExamples.length} viral examples as inspiration`);
        reasoning += `Inspired by ${relevantExamples.length} high-performing examples. `;
      }
    }

    // Add format-specific guidance
    userPrompt += `\n\nFORMAT REQUIREMENTS:`;
    switch (format.format_type) {
      case 'hook_value_cta':
        userPrompt += `\n- Start with a surprising hook question or statement
- Provide clear value or insight in the middle
- End with a subtle call-to-action or engagement prompt`;
        break;
      case 'research_reveal':
        userPrompt += `\n- Lead with "New study reveals..." or similar
- Present the finding clearly
- Explain the mechanism or "why" behind it`;
        break;
      case 'personal_discovery':
        userPrompt += `\n- Start with personal context "I used to..." or "After researching..."
- Share the discovery or insight
- Explain the transformation or impact`;
        break;
      case 'question_hook':
        userPrompt += `\n- Open with an engaging question
- Provide the answer with supporting evidence
- Make it immediately actionable`;
        break;
      case 'storytelling':
        userPrompt += `\n- Create a mini-narrative arc
- Include relatable characters or situations
- Deliver the health insight through the story`;
        break;
      default:
        userPrompt += `\n- Follow the proven ${format.format_type} structure
- Focus on engagement and value delivery
- Make it scientifically accurate but accessible`;
    }

    // Add final requirements
    userPrompt += `\n\nFINAL REQUIREMENTS:
- Maximum ${request.max_length || 280} characters
- Scientifically accurate and evidence-based
- Engaging and shareable
- Avoid medical advice or claims
- Focus on education and inspiration
- Use natural, conversational language

Generate ONLY the tweet content, no quotes or extra formatting:`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    return {
      prompt: fullPrompt,
      reasoning,
      learning_applied
    };
  }

  /**
   * 🚀 GENERATE WITH EVOLVED PROMPTS
   */
  private async generateWithEvolvedPrompts(
    dynamicPrompt: { prompt: string },
    request: GenerationRequest
  ): Promise<{ success: boolean; content: string; error?: string }> {
    
    try {
      // Get the best performing prompt evolution for this type
      const promptEvolution = await this.getBestPromptEvolution('tweet_generation');
      
      const response = await this.openai.generateContent(
        dynamicPrompt.prompt,
        'high', // Use high priority for intelligent generation
        'intelligent_tweet_generation',
        {
          maxTokens: request.max_length ? Math.min(400, request.max_length * 2) : 400,
          temperature: request.experimental ? 0.8 : 0.7,
          topP: 0.9
        }
      );

      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      // Clean and validate the response
      const cleanedContent = this.cleanGeneratedContent(response);
      
      if (cleanedContent.length > (request.max_length || 280)) {
        // Try to trim intelligently
        const trimmed = this.intelligentTrim(cleanedContent, request.max_length || 280);
        return { success: true, content: trimmed };
      }

      return { success: true, content: cleanedContent };

    } catch (error: any) {
      console.error('❌ Generation with evolved prompts failed:', error);
      return { 
        success: false, 
        content: '', 
        error: error.message 
      };
    }
  }

  /**
   * ✅ VALIDATE AND SCORE GENERATED CONTENT
   */
  private async validateAndScoreContent(
    content: string,
    format: { format_type: string },
    context: LearningContext
  ): Promise<{ confidence_score: number; predicted_engagement: number }> {
    
    try {
      // Basic validation scores
      let confidence_score = 0.5; // Base score
      let predicted_engagement = 0.001; // Base engagement

      // Length scoring
      if (content.length >= 100 && content.length <= 280) {
        confidence_score += 0.2;
        predicted_engagement += 0.002;
      }

      // Format adherence (simplified check)
      if (this.checkFormatAdherence(content, format.format_type)) {
        confidence_score += 0.15;
        predicted_engagement += 0.003;
      }

      // Learning pattern matching
      const patternMatches = this.countPatternMatches(content, context.successful_patterns);
      confidence_score += Math.min(0.2, patternMatches * 0.05);
      predicted_engagement += Math.min(0.005, patternMatches * 0.001);

      // Topic relevance
      if (context.topic_performance.length > 0) {
        const topicRelevance = this.calculateTopicRelevance(content, context.topic_performance);
        confidence_score += topicRelevance * 0.1;
        predicted_engagement += topicRelevance * 0.002;
      }

      return {
        confidence_score: Math.min(0.95, confidence_score),
        predicted_engagement: Math.min(0.05, predicted_engagement)
      };

    } catch (error) {
      console.error('❌ Content validation failed:', error);
      return { confidence_score: 0.3, predicted_engagement: 0.001 };
    }
  }

  /**
   * 💾 RECORD GENERATION SESSION FOR LEARNING
   */
  private async recordGenerationSession(sessionData: any): Promise<string> {
    try {
      const sessionId = crypto.randomUUID();
      
      const { error } = await this.supabase.client
        .from('tweet_generation_sessions')
        .insert({
          id: sessionId,
          session_type: sessionData.experimental ? 'experimental' : 'standard',
          requested_topic: sessionData.topic,
          requested_format: sessionData.target_format,
          requested_tone: sessionData.target_tone,
          template_used: sessionData.format_used,
          prompt_version: 'v2.0_intelligent',
          model_used: 'gpt-4o-mini',
          selected_content: Array.isArray(sessionData.content) ? 
            sessionData.content.join('\n') : sessionData.content,
          predicted_engagement: sessionData.predicted_engagement,
          successful_patterns_used: sessionData.learning_context?.successful_patterns || [],
          viral_examples_referenced: sessionData.learning_context?.recent_winners || []
        });

      if (error) {
        console.error('❌ Failed to record generation session:', error);
      }

      return sessionId;

    } catch (error: any) {
      console.error('❌ Failed to record generation session:', error);
      return '';
    }
  }

  /**
   * 🛠️ UTILITY FUNCTIONS
   */
  private inferOptimalTone(format: string, context: LearningContext): string {
    // Simple tone inference based on format
    const toneMap: { [key: string]: string } = {
      'research_reveal': 'professional',
      'controversy': 'confident',
      'personal_discovery': 'inspirational',
      'question_hook': 'engaging',
      'storytelling': 'relatable',
      'hook_value_cta': 'urgent'
    };

    return toneMap[format] || 'professional';
  }

  private async getBestPromptEvolution(type: string): Promise<PromptEvolution | null> {
    try {
      const { data, error } = await this.supabase.client
        .from('intelligent_prompt_evolution')
        .select('*')
        .eq('prompt_type', type)
        .eq('is_active', true)
        .order('avg_engagement_achieved', { ascending: false })
        .limit(1);

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      return null;
    }
  }

  private cleanGeneratedContent(content: string): string {
    return content
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\.{2,}/g, '...') // Fix multiple periods
      .substring(0, 300); // Safety limit
  }

  private intelligentTrim(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // Try to trim at sentence boundaries first
    const sentences = content.split(/[.!?]+/);
    let trimmed = '';
    
    for (const sentence of sentences) {
      if ((trimmed + sentence).length <= maxLength - 3) {
        trimmed += sentence + '.';
      } else {
        break;
      }
    }

    if (trimmed.length > 0) return trimmed.trim();

    // Fallback: trim at word boundaries
    const words = content.split(' ');
    trimmed = '';
    
    for (const word of words) {
      if ((trimmed + ' ' + word).length <= maxLength - 3) {
        trimmed += (trimmed ? ' ' : '') + word;
      } else {
        break;
      }
    }

    return trimmed + '...';
  }

  private checkFormatAdherence(content: string, format: string): boolean {
    // Simplified format checking
    switch (format) {
      case 'question_hook':
        return content.includes('?');
      case 'research_reveal':
        return /study|research|reveals?|shows?|finds?/i.test(content);
      case 'personal_discovery':
        return /I |my |after |discovered|learned/i.test(content);
      case 'hook_value_cta':
        return content.split(' ').length >= 15; // Substantial content
      default:
        return true; // Default to valid
    }
  }

  private countPatternMatches(content: string, patterns: any[]): number {
    let matches = 0;
    const lowerContent = content.toLowerCase();
    
    for (const pattern of patterns) {
      // Simple keyword matching for now
      if (pattern.pattern_name && lowerContent.includes(pattern.pattern_name.toLowerCase())) {
        matches++;
      }
    }
    
    return matches;
  }

  private calculateTopicRelevance(content: string, topics: any[]): number {
    const lowerContent = content.toLowerCase();
    let relevanceScore = 0;
    
    for (const topic of topics) {
      if (lowerContent.includes(topic.topic.toLowerCase())) {
        relevanceScore = Math.max(relevanceScore, topic.avg_engagement);
      }
    }
    
    return Math.min(1, relevanceScore * 10); // Normalize to 0-1
  }
}

// Export singleton instance
export const intelligentTweetGenerator = new IntelligentTweetGenerator();