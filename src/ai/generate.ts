/**
 * Advanced Content Generation System for @SignalAndSynapse
 * Produces contrarian, data-backed health content that drives engagement
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

interface GenerationRequest {
  format: 'short' | 'medium' | 'thread';
  topic?: string;
  hook_type?: string;
  avoid_patterns?: string[];
  amplify_patterns?: string[];
}

interface ContentCandidate {
  text: string;
  format: 'short' | 'medium' | 'thread';
  topic: string;
  hook_type: string;
  generation_params: any;
  estimated_engagement_score: number;
}

export class AdvancedContentGenerator {
  private openai: OpenAI;
  private supabase: any;
  private redis: Redis;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Generate 3-5 content candidates for a given format/topic
   */
  async generateCandidates(request: GenerationRequest): Promise<ContentCandidate[]> {
    const systemPrompt = await this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);
    
    const candidates: ContentCandidate[] = [];
    
    // Generate 5 candidates for diversity
    for (let i = 0; i < 5; i++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8 + (i * 0.1), // Increase temperature for diversity
          max_tokens: request.format === 'thread' ? 2000 : 300,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const candidate = await this.parseAndEnrichCandidate(content, request, {
            temperature: 0.8 + (i * 0.1),
            attempt: i + 1
          });
          candidates.push(candidate);
        }
      } catch (error) {
        console.error(`Failed to generate candidate ${i + 1}:`, error);
      }
    }

    return candidates;
  }

  /**
   * Build dynamic system prompt based on learned patterns
   */
  private async buildSystemPrompt(request: GenerationRequest): Promise<string> {
    // Get successful patterns from database
    const { data: patterns } = await this.supabase
      .from('patterns')
      .select('*')
      .eq('status', 'active')
      .gte('confidence_score', 0.6)
      .order('confidence_score', { ascending: false });

    // Get recent recommendations
    const { data: recommendations } = await this.supabase
      .from('recommendations')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1);

    const latestRec = recommendations?.[0];
    const amplifyPatterns = request.amplify_patterns || latestRec?.amplify_patterns || [];
    const avoidPatterns = request.avoid_patterns || latestRec?.avoid_patterns || [];

    return `You are the AI content creator for @SignalAndSynapse, a top health Twitter account that has grown to thousands of followers by posting contrarian, evidence-based health content.

## Your Voice & Style
- **Contrarian**: Challenge common health wisdom with data
- **Curiosity-driven**: Make people question what they think they know
- **Evidence-based**: Reference studies, data, surprising statistics
- **Twitter-native**: Write for social media, not academic journals
- **No BS**: Skip generic tips, obvious advice, and feel-good platitudes

## Content Rules
- NEVER use hashtags
- NEVER use emojis
- NEVER sound like a corporate wellness blog
- NEVER give obvious advice like "drink water" or "exercise more"
- ALWAYS lead with something surprising or counterintuitive
- ALWAYS be specific with numbers, studies, or examples

## Successful Patterns to Amplify
${amplifyPatterns.map((p: any) => `- ${p.pattern_name}: ${p.description || p.pattern_name}`).join('\n')}

## Patterns to Avoid
${avoidPatterns.map((p: any) => `- ${p.pattern_name}: ${p.reason || 'Low engagement'}`).join('\n')}

## High-Performing Hooks
${patterns?.filter((p: any) => p.pattern_type === 'hook').slice(0, 5).map((p: any) => 
  `- ${p.pattern_name}: ${p.pattern_description}`
).join('\n')}

## Format Guidelines
${request.format === 'short' ? `
**Short Tweet (1 tweet)**: Single powerful statement. 150-200 characters.
Examples:
- "Most 'superfoods' are marketing scams. Blueberries aren't magic. A study of 50,000 people found regular berries work just as well for brain health."
- "Your grandmother was right about one thing: going to bed angry is terrible for your health. Sleep quality drops 67% after unresolved conflict."
` : request.format === 'medium' ? `
**Medium Tweet (1 tweet)**: Expanded thought with context. 200-280 characters.
Examples:
- "The 8 glasses of water rule has zero scientific backing. Your kidneys are smarter than wellness influencers. A 2019 study found that forcing water intake can actually harm performance and increase injury risk in athletes."
` : `
**Thread (3-8 tweets)**: Deep dive into a counterintuitive topic.
Structure:
1. Hook: Surprising claim or statistic
2-6. Evidence, examples, mechanisms
7-8. Practical takeaway or reframe

NO numbered lists like "1/8". Natural flow between tweets.
Each tweet should be valuable standalone.
`}

Generate content that sounds like it could go viral among health-conscious, intelligent Twitter users who appreciate nuance and evidence.`;
  }

  /**
   * Build user prompt with specific requirements
   */
  private buildUserPrompt(request: GenerationRequest): string {
    const topicPrompt = request.topic 
      ? `Focus on: ${request.topic}` 
      : 'Choose any health topic that would surprise or educate people';
      
    const hookPrompt = request.hook_type 
      ? `Use a ${request.hook_type} style hook`
      : 'Use your best judgment for the hook style';

    return `${topicPrompt}

${hookPrompt}

Format: ${request.format}

Create content that challenges conventional wisdom and makes people think differently about health. Be specific, be surprising, be memorable.

${request.format === 'thread' ? 'Write as individual tweets separated by line breaks. No thread numbering.' : 'Write as a single tweet.'}`;
  }

  /**
   * Parse AI response and enrich with metadata
   */
  private async parseAndEnrichCandidate(
    content: string, 
    request: GenerationRequest, 
    generationParams: any
  ): Promise<ContentCandidate> {
    // Clean and parse content
    const text = content.trim();
    
    // Extract topic using AI
    const topic = await this.extractTopic(text);
    
    // Identify hook type
    const hook_type = await this.identifyHookType(text);
    
    // Estimate engagement potential
    const estimated_engagement_score = await this.estimateEngagement(text, request.format);

      return { 
      text,
      format: request.format,
      topic,
      hook_type,
      generation_params: {
        ...generationParams,
        topic_requested: request.topic,
        hook_requested: request.hook_type
      },
      estimated_engagement_score
    };
  }

  /**
   * Extract main topic from content using AI
   */
  private async extractTopic(text: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Extract the main health topic from this content in 1-2 words: "${text}"`
        }],
        temperature: 0.1,
        max_tokens: 10
      });

      return response.choices[0]?.message?.content?.trim() || 'general_health';
    } catch (error) {
      console.error('Topic extraction failed:', error);
      return 'general_health';
    }
  }

  /**
   * Identify the hook type used
   */
  private async identifyHookType(text: string): Promise<string> {
    const hookPatterns = {
      'contrarian_stat': /\d+%|\d+ study|\d+ people|research shows/i,
      'myth_busting': /myth|wrong|actually|truth is|contrary to/i,
      'question_provocative': /^\w+.*\?/,
      'surprising_fact': /surprising|shocking|most people don't know/i,
      'personal_story': /I used to|when I|my experience/i
    };

    for (const [hookType, pattern] of Object.entries(hookPatterns)) {
      if (pattern.test(text)) {
        return hookType;
      }
    }

    return 'general';
  }

  /**
   * Estimate engagement potential based on learned patterns
   */
  private async estimateEngagement(text: string, format: string): Promise<number> {
    try {
      // Get embeddings for similarity comparison
      const embedding = await this.getEmbedding(text);
      
      // Compare against high-performing posts
      const { data: topPosts } = await this.supabase
        .from('posts')
        .select('embeddings, engagement_rate')
        .eq('performance_tier', 'top')
        .eq('format', format)
        .limit(50);

      if (!topPosts?.length) {
        return 0.5; // Default score
      }

      // Calculate similarity scores and weight by engagement
      let weightedScore = 0;
      let totalWeight = 0;

      for (const post of topPosts) {
        if (post.embeddings) {
          const similarity = this.cosineSimilarity(embedding, post.embeddings);
          const weight = post.engagement_rate || 0.01;
          weightedScore += similarity * weight;
          totalWeight += weight;
        }
      }

      return totalWeight > 0 ? Math.min(weightedScore / totalWeight, 1) : 0.5;
    } catch (error) {
      console.error('Engagement estimation failed:', error);
      return 0.5;
    }
  }

  /**
   * Get OpenAI embeddings for text
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Save candidates to database for vetting
   */
  async saveCandidates(candidates: ContentCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      try {
        const embeddings = await this.getEmbedding(candidate.text);
        
        await this.supabase
          .from('content_candidates')
          .insert({
            text: candidate.text,
            format: candidate.format,
            topic: candidate.topic,
            hook_type: candidate.hook_type,
            generation_params: candidate.generation_params,
            embeddings,
            overall_score: candidate.estimated_engagement_score
          });
    } catch (error) {
        console.error('Failed to save candidate:', error);
      }
    }
  }
}

export default AdvancedContentGenerator;