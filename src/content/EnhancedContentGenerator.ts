/**
 * Enhanced Content Generator for xBOT
 * Generates 5+ candidates per cycle, with self-critique and scoring
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

export interface ContentCandidate {
  id: string;
  text: string;
  format: 'single' | 'thread';
  hook_type: 'curiosity_gap' | 'contrarian' | 'practical_list' | 'story' | 'bold_statement';
  thread_parts?: string[];
  scores: {
    hook_strength: number;    // 0-100
    novelty: number;         // 0-100  
    clarity: number;         // 0-100
    shareability: number;    // 0-100
    overall: number;         // 0-100
  };
  critique: string;
  created_at: Date;
}

export interface GenerationRequest {
  topic?: string;
  format_distribution?: {
    single: number;
    thread: number;
  };
  candidate_count?: number;
  voice_style?: 'conversational' | 'contrarian' | 'practical' | 'storytelling';
}

export interface GenerationResult {
  candidates: ContentCandidate[];
  top_candidate: ContentCandidate;
  generation_metadata: {
    total_generated: number;
    avg_score: number;
    processing_time_ms: number;
    topic_used: string;
  };
}

export class EnhancedContentGenerator {
  private openai: OpenAI;
  private supabase: any;
  private redis: Redis;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Generate multiple content candidates with scoring
   */
  async generateCandidates(request: GenerationRequest = {}): Promise<GenerationResult> {
    const startTime = Date.now();
    console.log('🎯 ENHANCED_GENERATION: Starting multi-candidate generation...');

    const {
      topic = await this.selectOptimalTopic(),
      candidate_count = 6,
      format_distribution = { single: 0.7, thread: 0.3 },
      voice_style = 'conversational'
    } = request;

    console.log(`📋 GENERATING: ${candidate_count} candidates for "${topic}" (${voice_style} voice)`);

    // Generate candidates in parallel
    const candidatePromises: Promise<ContentCandidate>[] = [];
    
    for (let i = 0; i < candidate_count; i++) {
      const format = Math.random() < format_distribution.single ? 'single' : 'thread';
      const hook_type = this.selectHookType(i);
      
      candidatePromises.push(
        this.generateSingleCandidate(topic, format, hook_type, voice_style, i)
      );
    }

    const candidates = await Promise.all(candidatePromises);
    
    // Score all candidates
    const scoredCandidates = await Promise.all(
      candidates.map(candidate => this.scoreCandidate(candidate))
    );

    // Select top candidate
    const topCandidate = scoredCandidates.reduce((best, current) => 
      current.scores.overall > best.scores.overall ? current : best
    );

    const processingTime = Date.now() - startTime;
    const avgScore = scoredCandidates.reduce((sum, c) => sum + c.scores.overall, 0) / scoredCandidates.length;

    console.log(`✅ GENERATION_COMPLETE: ${candidate_count} candidates, top score: ${topCandidate.scores.overall}/100 (${processingTime}ms)`);

    return {
      candidates: scoredCandidates,
      top_candidate: topCandidate,
      generation_metadata: {
        total_generated: scoredCandidates.length,
        avg_score: Math.round(avgScore),
        processing_time_ms: processingTime,
        topic_used: topic
      }
    };
  }

  /**
   * Generate a single content candidate
   */
  private async generateSingleCandidate(
    topic: string,
    format: 'single' | 'thread',
    hook_type: ContentCandidate['hook_type'],
    voice_style: string,
    index: number
  ): Promise<ContentCandidate> {
    
    const prompt = this.buildGenerationPrompt(topic, format, hook_type, voice_style);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(voice_style)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: format === 'thread' ? 800 : 400
      });

      const content = response.choices[0]?.message?.content || '';
      const { text, thread_parts } = this.parseContent(content, format);

      return {
        id: `candidate_${Date.now()}_${index}`,
        text,
        format,
        hook_type,
        thread_parts,
        scores: { hook_strength: 0, novelty: 0, clarity: 0, shareability: 0, overall: 0 },
        critique: '',
        created_at: new Date()
      };

    } catch (error) {
      console.error(`❌ GENERATION_ERROR (candidate ${index}):`, error);
      
      // Fallback candidate
      return {
        id: `fallback_${Date.now()}_${index}`,
        text: this.getFallbackContent(topic, hook_type),
        format,
        hook_type,
        scores: { hook_strength: 60, novelty: 40, clarity: 80, shareability: 50, overall: 58 },
        critique: 'Fallback content due to generation error',
        created_at: new Date()
      };
    }
  }

  /**
   * Score a candidate using AI critique
   */
  private async scoreCandidate(candidate: ContentCandidate): Promise<ContentCandidate> {
    try {
      const critiquePrompt = `
You are an expert social media content critic. Analyze this ${candidate.format} content and provide scores:

CONTENT:
${candidate.text}

Score each aspect 0-100:
1. HOOK STRENGTH: How compelling is the opening? Does it create curiosity/controversy?
2. NOVELTY: How unique/surprising is the insight? Avoid obvious or generic advice.
3. CLARITY: How clear and readable is the content? Easy to understand?
4. SHAREABILITY: How likely would someone share this? Viral potential?

Provide your response in this exact format:
HOOK_STRENGTH: [score]
NOVELTY: [score] 
CLARITY: [score]
SHAREABILITY: [score]
OVERALL: [average score]
CRITIQUE: [2-3 sentences explaining strengths/weaknesses]

Ban these filler phrases: "Who knew?", "Turns out", "Did you know?", "Here's the thing", "The truth is"
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: critiquePrompt }],
        temperature: 0.3,
        max_tokens: 300
      });

      const critique = response.choices[0]?.message?.content || '';
      const scores = this.parseCritiqueScores(critique);

      return {
        ...candidate,
        scores,
        critique: this.extractCritique(critique)
      };

    } catch (error) {
      console.error(`❌ SCORING_ERROR for ${candidate.id}:`, error);
      
      // Fallback scoring
      return {
        ...candidate,
        scores: {
          hook_strength: 65,
          novelty: 60,
          clarity: 75,
          shareability: 55,
          overall: 64
        },
        critique: 'Scoring failed, using fallback scores'
      };
    }
  }

  /**
   * Build generation prompt for specific content type
   */
  private buildGenerationPrompt(
    topic: string, 
    format: 'single' | 'thread',
    hook_type: ContentCandidate['hook_type'],
    voice_style: string
  ): string {
    
    const hookInstructions = {
      curiosity_gap: "Start with a curiosity gap that makes people need to know more",
      contrarian: "Challenge conventional wisdom about this topic", 
      practical_list: "Create a numbered list of practical actions",
      story: "Tell a compelling story or example that illustrates the point",
      bold_statement: "Make a bold, attention-grabbing statement"
    };

    const formatInstructions = format === 'thread' 
      ? `Create a Twitter thread (3-5 tweets). Start each tweet with a number (1/5, 2/5, etc.). 
         Tweet 1: Strong hook with curiosity gap
         Tweets 2-4: Evidence, examples, or practical details  
         Final tweet: Practical takeaway or call to action`
      : `Create a single tweet (under 280 characters) that is complete and engaging on its own.`;

    return `
Topic: ${topic}
Hook Type: ${hookInstructions[hook_type]}
Format: ${formatInstructions}
Voice: ${voice_style}, slightly contrarian, conversational, shareable

REQUIREMENTS:
- NO filler phrases: "Who knew?", "Turns out", "Did you know?", "Here's the thing"
- NO generic health advice everyone knows
- Include specific details, numbers, or examples when possible
- Make it engaging enough that someone would want to share it
- Keep it conversational but authoritative

Generate the content now:
`;
  }

  /**
   * Get system prompt for voice style
   */
  private getSystemPrompt(voice_style: string): string {
    return `You are an expert health content creator for Twitter. Your writing style is:

- ${voice_style} and engaging
- Slightly contrarian and thought-provoking  
- Backed by evidence when possible
- Avoids obvious advice everyone already knows
- Uses specific examples and numbers
- Creates curiosity and shareability
- Bans these filler phrases: "Who knew?", "Turns out", "Did you know?", "Here's the thing", "The truth is"

You create content that makes people think differently about health topics.`;
  }

  /**
   * Select hook type for variation
   */
  private selectHookType(index: number): ContentCandidate['hook_type'] {
    const types: ContentCandidate['hook_type'][] = [
      'curiosity_gap', 'contrarian', 'practical_list', 'story', 'bold_statement'
    ];
    return types[index % types.length];
  }

  /**
   * Parse content response based on format
   */
  private parseContent(content: string, format: 'single' | 'thread'): { text: string; thread_parts?: string[] } {
    if (format === 'thread') {
      // Split thread by numbered parts (1/5, 2/5, etc.) or double newlines
      const parts = content
        .split(/\n\n+/)
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .map(part => part.replace(/^\d+\/\d+\s*/, '').trim());

      return {
        text: parts.join('\n\n'),
        thread_parts: parts
      };
    }

    return { text: content.trim() };
  }

  /**
   * Parse scores from critique response
   */
  private parseCritiqueScores(critique: string): ContentCandidate['scores'] {
    const extractScore = (pattern: RegExp): number => {
      const match = critique.match(pattern);
      return match ? Math.min(100, Math.max(0, parseInt(match[1]) || 0)) : 60;
    };

    const hook_strength = extractScore(/HOOK_STRENGTH:\s*(\d+)/i);
    const novelty = extractScore(/NOVELTY:\s*(\d+)/i);
    const clarity = extractScore(/CLARITY:\s*(\d+)/i);
    const shareability = extractScore(/SHAREABILITY:\s*(\d+)/i);
    
    // Calculate overall as weighted average
    const overall = Math.round(
      hook_strength * 0.3 + 
      novelty * 0.25 + 
      clarity * 0.2 + 
      shareability * 0.25
    );

    return { hook_strength, novelty, clarity, shareability, overall };
  }

  /**
   * Extract critique text from response
   */
  private extractCritique(response: string): string {
    const match = response.match(/CRITIQUE:\s*(.+?)$/s);
    return match ? match[1].trim() : 'No critique provided';
  }

  /**
   * Select optimal topic based on recent performance
   */
  private async selectOptimalTopic(): Promise<string> {
    try {
      // Get recent high-performing topics from Supabase
      const { data: recentPosts } = await this.supabase
        .from('posts')
        .select('topic, likes, replies, reposts')
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentPosts && recentPosts.length > 0) {
        // Find best performing topic
        const topicPerformance = recentPosts.reduce((acc: any, post: any) => {
          const engagement = (post.likes || 0) + (post.replies || 0) + (post.reposts || 0);
          if (!acc[post.topic]) acc[post.topic] = [];
          acc[post.topic].push(engagement);
          return acc;
        }, {});

        const bestTopic = Object.entries(topicPerformance)
          .map(([topic, engagements]: [string, any]) => ({
            topic,
            avgEngagement: engagements.reduce((a: number, b: number) => a + b, 0) / engagements.length
          }))
          .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

        if (bestTopic) {
          console.log(`📊 TOPIC_SELECTION: Using high-performing topic "${bestTopic.topic}" (${bestTopic.avgEngagement.toFixed(1)} avg engagement)`);
          return bestTopic.topic;
        }
      }
    } catch (error) {
      console.warn('⚠️ TOPIC_SELECTION: Could not access recent performance data, using fallback');
    }

    // Fallback topics
    const fallbackTopics = [
      'sleep optimization', 'metabolic health', 'stress management', 
      'nutrition myths', 'exercise science', 'mental performance',
      'biohacking basics', 'hormone optimization', 'gut health'
    ];
    
    const selectedTopic = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
    console.log(`🎯 TOPIC_SELECTION: Using fallback topic "${selectedTopic}"`);
    return selectedTopic;
  }

  /**
   * Get fallback content when generation fails
   */
  private getFallbackContent(topic: string, hook_type: ContentCandidate['hook_type']): string {
    const fallbacks = {
      curiosity_gap: `The real reason ${topic} advice fails 90% of the time isn't what you think...`,
      contrarian: `Everything you've been told about ${topic} is backwards. Here's what actually works:`,
      practical_list: `3 ${topic} changes that work in 7 days:\n1. [Evidence-based tip]\n2. [Practical action]\n3. [Surprising insight]`,
      story: `I tried the "expert" advice on ${topic} for 30 days. The results surprised everyone...`,
      bold_statement: `${topic} is broken. Here's how to fix it in 2 weeks:`
    };

    return fallbacks[hook_type] || `The truth about ${topic} that experts don't want you to know.`;
  }

  /**
   * Check for duplicate content using Redis
   */
  async checkDuplicate(text: string): Promise<boolean> {
    try {
      const hash = this.createContentHash(text);
      const exists = await this.redis.exists(`content:${hash}`);
      
      if (exists) {
        console.log('🚫 DUPLICATE_DETECTED: Content already exists');
        return true;
      }

      // Store hash for 30 days
      await this.redis.setex(`content:${hash}`, 30 * 24 * 60 * 60, text.substring(0, 100));
      return false;
    } catch (error) {
      console.warn('⚠️ DUPLICATE_CHECK: Redis check failed, allowing content');
      return false;
    }
  }

  /**
   * Create content hash for deduplication
   */
  private createContentHash(text: string): string {
    // Simple hash based on first 50 chars (normalized)
    const normalized = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
    
    return Buffer.from(normalized).toString('base64').substring(0, 16);
  }
}

export default EnhancedContentGenerator;
