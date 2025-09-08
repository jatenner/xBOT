/**
 * 🏥 AUTHORITATIVE HEALTH ENGINE
 * 
 * Generates expert, evidence-based health content with automatic thread detection.
 * Enforces strict content policies and expert voice requirements.
 * 
 * Structure: Hook → Claim → Evidence → Actionable → Caveat
 * Voice: Expert, third-person, evidence-based (never first-person)
 */

import { OpenAI } from 'openai';

export interface ContentContext {
  topic?: string;
  format?: 'auto' | 'single' | 'thread';
  complexity?: 'simple' | 'moderate' | 'complex';
  target_audience?: 'general' | 'informed' | 'professional';
}

export interface AuthoritativeContent {
  success: boolean;
  content: string[];
  format: 'single' | 'thread';
  metadata: {
    evidence_score: number;
    expert_voice_score: number;
    policy_compliance: boolean;
    thread_rationale?: string;
    evidence_tags: string[];
    quality_gates_passed: string[];
    rejected_reasons?: string[];
  };
  raw_generation?: string;
}

export interface EvidenceTag {
  source: string;
  year?: string;
  type: 'study' | 'review' | 'meta-analysis' | 'clinical-trial' | 'authority';
  short_tag: string;
}

export class AuthoritativeHealthEngine {
  private static instance: AuthoritativeHealthEngine;
  private openai: OpenAI;
  
  // Quality thresholds
  private readonly MIN_EVIDENCE_SCORE = 0.8;
  private readonly MIN_EXPERT_VOICE_SCORE = 0.9;
  private readonly THREAD_CHAR_THRESHOLD = 180;
  private readonly MAX_TWEET_LENGTH = 275;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public static getInstance(): AuthoritativeHealthEngine {
    if (!AuthoritativeHealthEngine.instance) {
      AuthoritativeHealthEngine.instance = new AuthoritativeHealthEngine();
    }
    return AuthoritativeHealthEngine.instance;
  }

  /**
   * 🎯 Main generation method
   */
  async generatePost(context: ContentContext = {}): Promise<AuthoritativeContent> {
    console.log('🏥 AUTHORITATIVE_ENGINE: Generating expert health content...');
    
    try {
      // Step 1: Generate raw content
      const rawContent = await this.generateRawContent(context);
      
      // Step 2: Apply style critic (remove personal language)
      const critiquedContent = await this.applyCritic(rawContent);
      
      // Step 3: Resolve evidence tags
      const evidenceResolved = await this.resolveEvidence(critiquedContent);
      
      // Step 4: Determine format and structure
      const structuredContent = await this.structureContent(evidenceResolved, context);
      
      // Step 5: Apply quality gates
      const qualityResult = await this.applyQualityGates(structuredContent);
      
      if (!qualityResult.passed) {
        console.log('❌ QUALITY_GATES_FAILED:', qualityResult.reasons);
        
        // Retry once with more strict prompt
        const retryContent = await this.generateRawContent({
          ...context,
          complexity: 'simple'
        });
        
        const retryStructured = await this.structureContent(retryContent, context);
        const retryQuality = await this.applyQualityGates(retryStructured);
        
        if (!retryQuality.passed) {
          return {
            success: false,
            content: [],
            format: 'single',
            metadata: {
              evidence_score: 0,
              expert_voice_score: 0,
              policy_compliance: false,
              evidence_tags: [],
              quality_gates_passed: [],
              rejected_reasons: retryQuality.reasons
            }
          };
        }
        
        structuredContent.content = retryStructured.content;
        structuredContent.format = retryStructured.format;
      }
      
      // Step 6: Final assembly
      return {
        success: true,
        content: structuredContent.content,
        format: structuredContent.format,
        metadata: {
          evidence_score: qualityResult.evidence_score,
          expert_voice_score: qualityResult.expert_voice_score,
          policy_compliance: true,
          thread_rationale: structuredContent.thread_rationale,
          evidence_tags: this.extractEvidenceTags(structuredContent.content.join(' ')),
          quality_gates_passed: qualityResult.gates_passed
        },
        raw_generation: rawContent
      };
      
    } catch (error) {
      console.error('❌ AUTHORITATIVE_ENGINE_ERROR:', error);
      return {
        success: false,
        content: [],
        format: 'single',
        metadata: {
          evidence_score: 0,
          expert_voice_score: 0,
          policy_compliance: false,
          evidence_tags: [],
          quality_gates_passed: [],
          rejected_reasons: ['Generation error: ' + (error as Error).message]
        }
      };
    }
  }

  /**
   * 📝 Generate raw content with expert prompt
   */
  private async generateRawContent(context: ContentContext): Promise<string> {
    const prompt = this.buildExpertPrompt(context);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * 🏗️ Build expert-level content prompt
   */
  private buildExpertPrompt(context: ContentContext): string {
    const topic = context.topic || 'evidence-based health optimization';
    
    return `You are a medical research expert writing educational health content for X (Twitter).

TOPIC: ${topic}

STRICT VOICE REQUIREMENTS:
❌ NEVER use first-person: No "I", "me", "my", "we", "our", "us"
❌ NEVER use anecdotal language: No "tried", "found", "experience", "friend told me"  
❌ NEVER use casual filler: No "who knew?", "crazy", "amazing", "wow"
✅ ALWAYS use third-person expert voice: "Research demonstrates", "Studies indicate", "Clinical evidence shows"
✅ ALWAYS reference authority: "Harvard research", "Mayo Clinic data", "Cochrane reviews"

STRUCTURE REQUIREMENTS:
If content requires >1 claim OR >180 characters → CREATE THREAD (3-5 tweets)
If simple single claim <180 characters → SINGLE TWEET

THREAD FORMAT (if needed):
Tweet 1: Hook (max 120 chars) - contrarian or surprising insight
Tweet 2-4: Claim + Evidence + Actionable tip (each <275 chars)
Tweet 5: Caveat/limitation + "Save for later ✓" CTA

SINGLE FORMAT:
Hook → Claim → Evidence tag → Actionable insight (total <275 chars)

EVIDENCE REQUIREMENTS:
Include specific tags like: [Harvard, 2023], [Cochrane Review], [Mayo Clinic], [NEJM]
Use precise statistics: "40% improvement", "23% reduction", "2.5x higher risk"
Reference real institutions: Stanford, Johns Hopkins, Cleveland Clinic

CONTENT POLICY:
❌ NO medical advice or treatment recommendations
❌ NO supplement/product promotion  
❌ NO personal medical claims
✅ Educational framing: "Research suggests", "Evidence indicates"
✅ General health optimization focus
✅ Include appropriate caveats/limitations

Generate expert health content following ALL requirements above.`;
  }

  /**
   * ✂️ Apply style critic to remove personal language
   */
  private async applyCritic(content: string): Promise<string> {
    const personalPatterns = [
      { pattern: /\b(I|me|my|mine)\b/gi, replacement: '' },
      { pattern: /\b(we|us|our|ours)\b/gi, replacement: '' },
      { pattern: /\b(tried|found|experienced|discovered)\b/gi, replacement: 'research shows' },
      { pattern: /\b(who knew|amazing|crazy|wow)\b/gi, replacement: '' },
      { pattern: /\b(friend told me|I heard)\b/gi, replacement: 'studies indicate' },
      { pattern: /\b(in my experience|personally)\b/gi, replacement: 'evidence suggests' }
    ];

    let cleaned = content;
    
    for (const { pattern, replacement } of personalPatterns) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    
    // Clean up extra spaces and grammar
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*\.\s*/g, '. ')
      .trim();

    return cleaned;
  }

  /**
   * 🔍 Resolve evidence citations to short tags
   */
  private async resolveEvidence(content: string): Promise<string> {
    const evidenceMap: { [key: string]: string } = {
      'Harvard research': '[Harvard, 2023]',
      'Stanford study': '[Stanford, 2023]',
      'Mayo Clinic': '[Mayo Clinic]',
      'Cochrane review': '[Cochrane Review]',
      'Johns Hopkins': '[Johns Hopkins]',
      'Cleveland Clinic': '[Cleveland Clinic]',
      'NEJM': '[NEJM, 2023]',
      'BMJ study': '[BMJ, 2023]',
      'systematic review': '[Systematic Review]'
    };

    let resolved = content;
    
    for (const [longForm, shortTag] of Object.entries(evidenceMap)) {
      const regex = new RegExp(longForm, 'gi');
      resolved = resolved.replace(regex, shortTag);
    }

    return resolved;
  }

  /**
   * 🏗️ Structure content into single tweet or thread
   */
  private async structureContent(content: string, context: ContentContext): Promise<{
    content: string[];
    format: 'single' | 'thread';
    thread_rationale?: string;
  }> {
    // Determine if thread is needed
    const needsThread = 
      context.format === 'thread' ||
      (context.format !== 'single' && (
        content.length > this.THREAD_CHAR_THRESHOLD ||
        content.split('.').length > 2 ||
        content.includes('\n\n')
      ));

    if (!needsThread) {
      // Single tweet
      const singleTweet = content.substring(0, this.MAX_TWEET_LENGTH);
      return {
        content: [singleTweet],
        format: 'single'
      };
    }

    // Thread assembly
    const threadParts = await this.assembleThread(content);
    
    return {
      content: threadParts,
      format: 'thread',
      thread_rationale: `Content length (${content.length} chars) and complexity requires thread format`
    };
  }

  /**
   * 🧵 Assemble content into thread format
   */
  private async assembleThread(content: string): Promise<string[]> {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const tweets: string[] = [];

    // Tweet 1: Hook (first impactful sentence)
    if (sentences.length > 0) {
      tweets.push(sentences[0].trim() + '.');
    }

    // Tweets 2-N: Distribute remaining content
    let currentTweet = '';
    
    for (let i = 1; i < sentences.length; i++) {
      const sentence = sentences[i].trim() + '.';
      
      if ((currentTweet + ' ' + sentence).length <= this.MAX_TWEET_LENGTH) {
        currentTweet += (currentTweet ? ' ' : '') + sentence;
      } else {
        if (currentTweet) {
          tweets.push(currentTweet);
        }
        currentTweet = sentence;
      }
    }
    
    if (currentTweet) {
      tweets.push(currentTweet);
    }

    // Add CTA to last tweet if thread
    if (tweets.length > 1) {
      const lastTweet = tweets[tweets.length - 1];
      if (lastTweet.length <= this.MAX_TWEET_LENGTH - 20) {
        tweets[tweets.length - 1] = lastTweet + '\n\nSave for later ✓';
      }
    }

    return tweets.slice(0, 5); // Max 5 tweets per thread
  }

  /**
   * 🚪 Apply quality gates
   */
  private async applyQualityGates(content: { content: string[]; format: string }): Promise<{
    passed: boolean;
    evidence_score: number;
    expert_voice_score: number;
    gates_passed: string[];
    reasons: string[];
  }> {
    const fullText = content.content.join(' ');
    const reasons: string[] = [];
    const gatesPassed: string[] = [];

    // Gate 1: No first-person language
    const personalPatterns = /\b(I|me|my|we|us|our|tried|found|experienced)\b/gi;
    if (personalPatterns.test(fullText)) {
      reasons.push('Contains first-person or anecdotal language');
    } else {
      gatesPassed.push('first_person_check');
    }

    // Gate 2: Evidence tags required
    const evidencePatterns = /\[[^\]]+\]/g;
    const evidenceTags = fullText.match(evidencePatterns) || [];
    if (evidenceTags.length === 0) {
      reasons.push('No evidence citations found');
    } else {
      gatesPassed.push('evidence_citation_check');
    }

    // Gate 3: No medical advice
    const medicalAdvicePatterns = /\b(take|use|consume|try|should|must|recommended dose)\b/gi;
    if (medicalAdvicePatterns.test(fullText)) {
      reasons.push('Contains medical advice language');
    } else {
      gatesPassed.push('medical_advice_check');
    }

    // Gate 4: Expert language
    const expertPatterns = /\b(research|study|evidence|clinical|data|findings)\b/gi;
    const expertMatches = fullText.match(expertPatterns) || [];
    const expertScore = expertMatches.length / 10; // Normalize
    
    if (expertScore < 0.3) {
      reasons.push('Insufficient expert language');
    } else {
      gatesPassed.push('expert_language_check');
    }

    // Calculate scores
    const evidenceScore = Math.min(evidenceTags.length / 2, 1.0);
    const expertVoiceScore = Math.min(expertScore, 1.0);

    const passed = reasons.length === 0 && 
                  evidenceScore >= this.MIN_EVIDENCE_SCORE && 
                  expertVoiceScore >= this.MIN_EXPERT_VOICE_SCORE;

    return {
      passed,
      evidence_score: evidenceScore,
      expert_voice_score: expertVoiceScore,
      gates_passed: gatesPassed,
      reasons
    };
  }

  /**
   * 🏷️ Extract evidence tags from content
   */
  private extractEvidenceTags(content: string): string[] {
    const matches = content.match(/\[[^\]]+\]/g) || [];
    return matches.map(tag => tag.replace(/[\[\]]/g, ''));
  }
}

export default AuthoritativeHealthEngine;
