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
You are an expert health content auditor evaluating content for a professional health authority account. Analyze this ${candidate.format} content:

CONTENT:
${candidate.text}

STRICT SCORING CRITERIA (0-100 each):

1. AUTHORITY SCORE (0-100):
   - 90-100: Research citations, specific statistics, expert-level insights
   - 70-89: Evidence-backed claims with general research references
   - 50-69: Some credible information but lacks research backing
   - 30-49: Vague claims without evidence
   - 0-29: Personal anecdotes, "I tried" language, diary-style content

2. HOOK STRENGTH (0-100):
   - 90-100: Challenges conventional wisdom with surprising contrarian claim
   - 70-89: Strong curiosity gap or myth-busting angle
   - 50-69: Moderately engaging but predictable
   - 30-49: Weak hook, obvious information
   - 0-29: No hook, generic opening

3. EVIDENCE QUALITY (0-100):
   - 90-100: Specific numbers, percentages, study references, measurable outcomes
   - 70-89: General research backing with some specifics
   - 50-69: Plausible claims but limited evidence
   - 30-49: Vague or unsubstantiated claims
   - 0-29: No evidence, personal experience only

4. ACTIONABILITY (0-100):
   - 90-100: Clear, specific, immediately implementable advice
   - 70-89: Good practical guidance with some specifics
   - 50-69: General advice that's somewhat actionable
   - 30-49: Vague recommendations
   - 0-29: No clear takeaway or action

AUTOMATIC PENALTIES:
- DEDUCT 50 points from ALL scores for ANY first-person language: "I", "my", "worked for me"
- DEDUCT 30 points for vague phrases: "amazing results", "crazy difference", "who knew"
- DEDUCT 20 points for obvious/generic advice everyone knows

BONUSES:
- ADD 10 points for specific statistics or percentages
- ADD 15 points for research citations ("Studies show", "Research reveals")
- ADD 10 points for contrarian angle that challenges mainstream beliefs

Provide your response in this exact format:
AUTHORITY: [score]
HOOK_STRENGTH: [score]
EVIDENCE_QUALITY: [score] 
ACTIONABILITY: [score]
OVERALL: [weighted average: Authority 35% + Hook 25% + Evidence 25% + Action 15%]
CRITIQUE: [2-3 sentences explaining why this does/doesn't meet professional health content standards]
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
      curiosity_gap: "Challenge a widely-held belief or reveal a counterintuitive truth that makes people question what they know",
      contrarian: "Directly contradict conventional health wisdom with evidence-backed alternative approach", 
      practical_list: "Present a numbered list of specific, actionable strategies with measurable outcomes",
      story: "Reference a study, research finding, or documented case that illustrates a surprising health principle",
      bold_statement: "Make a provocative, research-backed claim that challenges mainstream health advice"
    };

    const formatInstructions = format === 'thread' 
      ? `Create a Twitter thread (3-5 tweets). Structure:
         Tweet 1: HOOK - Contrarian statement or curiosity gap that challenges conventional wisdom
         Tweet 2-3: EVIDENCE - Research findings, statistics, or mechanism explanation (cite studies generically: "Research shows...", "Studies find...", "Data reveals...")
         Tweet 4: TAKEAWAY - Specific, actionable advice people can implement immediately
         Final tweet: Clear benefit or expected outcome`
      : `Create a single tweet (under 280 characters) with this structure:
         HOOK: Challenge conventional wisdom
         EVIDENCE: Brief research-backed explanation  
         TAKEAWAY: One clear action or insight`;

    return `
Topic: ${topic}
Hook Type: ${hookInstructions[hook_type]}
Format: ${formatInstructions}

MANDATORY STRUCTURE - ALL CONTENT MUST FOLLOW:
🎯 HOOK: Contrarian statement or curiosity gap that challenges what people believe
📊 EVIDENCE: Research-backed explanation with numbers, percentages, or study references
✅ TAKEAWAY: Clear, practical action or insight people can use immediately

STRICT CONTENT RULES:
❌ ABSOLUTELY FORBIDDEN:
- First-person language: "I tried", "my experience", "I found", "my results", "I discovered"
- Anecdotal phrasing: "worked for me", "my journey", "personal experience"
- Vague claims: "crazy difference", "amazing results", "who knew?", "turns out"
- Generic advice: obvious tips everyone already knows

✅ REQUIRED ELEMENTS:
- Research references: "Studies show", "Research reveals", "Data indicates"
- Specific numbers: percentages, timeframes, quantities
- Contrarian angle: challenge mainstream health beliefs
- Authoritative tone: expert-level knowledge presentation
- Practical utility: actionable advice people can implement

VOICE GUIDELINES:
- Authoritative but accessible
- Evidence-based and credible  
- Slightly contrarian but professional
- No personal anecdotes or diary-style content
- Third-person perspective only

Generate the content now following this exact structure:
`;
  }

  /**
   * Get system prompt for voice style
   */
  private getSystemPrompt(voice_style: string): string {
    return `You are a leading health research expert creating authoritative Twitter content. Your expertise includes:

AUTHORITY MARKERS:
- Reference research studies and clinical data (use generic citations: "Research shows", "Studies find", "Data reveals")
- Include specific statistics, percentages, and measurable outcomes
- Challenge conventional health wisdom with evidence-based alternatives
- Present information from an expert third-person perspective

CONTENT STANDARDS:
- NEVER use first-person language ("I", "my", personal experiences)
- NEVER include anecdotal or diary-style content  
- ALWAYS include research-backed explanations
- ALWAYS provide specific, actionable takeaways
- Challenge mainstream beliefs with contrarian but credible information

FORBIDDEN PHRASES:
- "I tried", "my experience", "worked for me", "my journey"
- "Who knew?", "Turns out", "Did you know?", "Here's the thing", "The truth is"
- "Amazing results", "crazy difference", "game-changer"

REQUIRED ELEMENTS:
- Hook that challenges conventional wisdom
- Evidence with numbers or research references
- Clear, practical takeaway
- Professional, authoritative tone

You create content that positions the account as a trusted health authority, not a personal blogger.`;
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

    const authority = extractScore(/AUTHORITY:\s*(\d+)/i);
    const hook_strength = extractScore(/HOOK_STRENGTH:\s*(\d+)/i);
    const evidence_quality = extractScore(/EVIDENCE_QUALITY:\s*(\d+)/i);
    const actionability = extractScore(/ACTIONABILITY:\s*(\d+)/i);
    
    // Calculate overall as weighted average (Authority 35% + Hook 25% + Evidence 25% + Action 15%)
    const overall = Math.round(
      authority * 0.35 + 
      hook_strength * 0.25 + 
      evidence_quality * 0.25 + 
      actionability * 0.15
    );

    // Map new scoring to existing interface (backwards compatibility)
    return { 
      hook_strength, 
      novelty: evidence_quality,  // Evidence quality maps to novelty
      clarity: actionability,     // Actionability maps to clarity  
      shareability: authority,    // Authority maps to shareability
      overall 
    };
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
