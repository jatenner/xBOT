/**
 * 🛡️ BULLETPROOF PROMPT SYSTEM
 * Perfect OpenAI prompts with validation, anti-repetition, and strict schemas
 */

import OpenAI from 'openai';

export interface PromptContext {
  intent: 'single' | 'thread' | 'reply';
  topic?: string;
  audience?: string;
  recentOpenings?: string[];
  recentTopics?: string[];
  recentBrands?: string[];
  personaLine?: string;
  emotionLine?: string;
  trends?: string;
  viralPatterns?: string;
  parentSummary?: string; // for replies
  stance?: string; // for replies
  strategy?: string; // for replies
  repair?: string; // for regeneration
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * 🎯 GOLDEN PROMPT ENVELOPE SYSTEM
 */
export class BulletproofPrompts {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * 🧠 SYSTEM PROMPT - Authority + Constraints (Universal)
   */
  private getSystemPrompt(): string {
    return `You are an elite health industry analyst producing factual, professional content with zero fluff.
Follow all constraints precisely. Never output markdown. Never use hashtags or quotation marks.
Use specific research, mechanisms, companies, costs, protocols, and concrete numbers.
Write with the authority of someone who understands health at a deeper level than most experts.`;
  }

  /**
   * 🔧 DEVELOPER PROMPT - Schema + Guardrails (Intent-Specific)
   */
  private getDeveloperPrompt(intent: 'single' | 'thread' | 'reply'): string {
    const baseRules = `
OUTPUT: Strict JSON. No markdown, no commentary, no code fences.

BANNED_PATTERNS (instant rejection):
- generic hooks, AI tells, "Let's dive in", "...", personal anecdotes
- "crazy, right?", "think again", "here's the kicker", "plot thickens"
- repetitive openers from recent_content.openings
- topics/brands already used in recent_content.topics/brands
- hashtags (#anything), quotation marks, emojis, ellipses (...)
- incomplete sentences, cut-off words, "each nigh" instead of "each night"

REQUIRED ELEMENTS:
- mechanism-level WHY explanations
- specific numbers/brands/costs where relevant
- each content unit stands alone (no teasers or cliffhangers)
- complete sentences ending with proper punctuation
- factual, professional tone with insider knowledge`;

    if (intent === 'thread') {
      return `${baseRules}

THREAD RULES (STRICT VALIDATION - FAILURE = REJECTION):
- FLEXIBLE length: 3-7 tweets (can be short or long based on topic)
- Each tweet PRECISELY 150-270 characters (count spaces!)
- ZERO hashtags (#), ZERO quotes (" or '), ZERO apostrophes in contractions
- Write "do not" instead of "don't", "cannot" instead of "can't"
- Every tweet ends with punctuation (. ! ?) - NO ellipses (...)
- NO numbering (1/8, 2/8), NO emojis, NO markdown
- Full coherence: ALL tweets about the SAME specific topic
- Each tweet complete and valuable if seen in isolation
- Build toward complete framework or system
- First tweet must hook, subsequent tweets deliver value
- CRITICAL: If posting a thread, ALWAYS post the full thread - never mention threads without posting them

CHARACTER COUNT EXAMPLES:
✅ VALID (190 chars): "Elite athletes avoid heavy cardio during peak training phases. Stanford research shows excessive cardio elevates cortisol by 300% and reduces testosterone for 48 hours after each session."
❌ INVALID (170 chars): "Athletes avoid cardio. Bad for performance." (TOO SHORT)
❌ INVALID (250 chars): "Elite professional athletes completely avoid heavy cardiovascular training during their peak performance training phases because extensive research shows it significantly impacts recovery." (TOO LONG)

SCHEMA (return ONLY this JSON):
{
  "topic": "string",
  "tweets": [{"text": "string (150-270 chars each)"}],
  "metadata": {
    "persona": "string",
    "emotion": "string", 
    "framework": "string",
    "scores": {
      "completeness": 0,
      "value": 0,
      "clarity": 0,
      "actionability": 0,
      "evidence": 0
    }
  }
}`;
    } else if (intent === 'reply') {
      return `${baseRules}

REPLY RULES (CRITICAL):
- Start with 1-line synthesis of parent point (no quotes)
- Add mechanism or data point that advances conversation
- Optional protocol enhancement with numbers/dosages/timing
- 150-270 characters total
- No moralizing, quotes, hashtags, emojis

REPLY STRATEGIES:
- mechanism_expert: explain biological WHY
- study_data: cite specific research/numbers
- protocol_enhancement: improve with precise steps
- unexpected_connection: reveal surprising link
- actionable_insight: immediate applicable advice
- brand_specific: mention specific products/costs

SCHEMA (return ONLY this JSON):
{
  "reply": "string (150-270 chars)",
  "metadata": {
    "strategy": "string",
    "evidence": "string", 
    "confidence": 0
  }
}`;
    } else {
      return `${baseRules}

SINGLE TWEET RULES:
- 200-280 characters
- Complete thought with hook, value, and intrigue
- Include specific details (brands, costs, timeframes)
- Create desire to learn more or take action

SCHEMA (return ONLY this JSON):
{
  "content": "string (200-280 chars)",
  "metadata": {
    "persona": "string",
    "emotion": "string",
    "uniqueness": 0
  }
}`;
    }
  }

  /**
   * 👤 USER PROMPT - Dynamic Context Pack
   */
  private getUserPrompt(ctx: PromptContext): string {
    let userPrompt = `
INTENT: ${ctx.intent}
TOPIC: ${ctx.topic || 'timely health insight'}
TARGET_AUDIENCE: ${ctx.audience || 'health-curious professionals'}

ANTI-REPETITION CONSTRAINTS:
${ctx.recentOpenings?.length ? `BANNED_OPENINGS: ${JSON.stringify(ctx.recentOpenings.slice(-10))}` : ''}
${ctx.recentTopics?.length ? `BANNED_TOPICS: ${JSON.stringify(ctx.recentTopics.slice(-20))}` : ''}
${ctx.recentBrands?.length ? `RECENT_BRANDS: ${JSON.stringify(ctx.recentBrands.slice(-15))} (vary these)` : ''}

PERSONA: ${ctx.personaLine || 'Dr. Elena Vasquez (Harvard; Fortune 500 advisor; Olympic protocols; WHO consultant)'}

EMOTION: ${ctx.emotionLine || 'Primary=Curiosity; Triggers=information gaps; Principles=Zeigarnik Effect; Tactics=exclusive hint'}

CURRENT TRENDS:
${ctx.trends || 'GLP-1 medications (95% momentum), Longevity protocols, Microbiome optimization, Sleep tech'}

VIRAL PATTERNS TO LEVERAGE:
${ctx.viralPatterns || '- specific numbers get 3x engagement - contrarian + data = viral - insider protocols boost authority - cost/time comparisons drive interest'}

GOALS: maximize follows, screenshot-worthiness, saves, and engagement`;

    // Add reply-specific context
    if (ctx.intent === 'reply' && ctx.parentSummary) {
      userPrompt += `

REPLY CONTEXT:
PARENT_TWEET_SUMMARY: ${ctx.parentSummary}
STANCE: ${ctx.stance || 'supportive with additional insight'}
STRATEGY: ${ctx.strategy || 'mechanism_expert'}`;
    }

    // Add repair instructions if regenerating
    if (ctx.repair) {
      userPrompt += `

REPAIR_VIOLATIONS: ${ctx.repair}
Fix these issues and return valid JSON only.`;
    }

    return userPrompt;
  }

  /**
   * 🎯 PARAMETER PRESETS (Optimized per intent)
   */
  private getModelParams(intent: 'single' | 'thread' | 'reply'): any {
    const presets = {
      single: {
        model: 'gpt-4o',
        temperature: 0.8,
        top_p: 0.9,
        presence_penalty: 0.2,
        max_tokens: 400
      },
      thread: {
        model: 'gpt-4o',
        temperature: 0.7,
        top_p: 0.9,
        presence_penalty: 0.3,
        max_tokens: 900
      },
      reply: {
        model: 'gpt-4o-mini',
        temperature: 0.6,
        top_p: 0.9,
        presence_penalty: 0.1,
        max_tokens: 250
      }
    };

    return presets[intent];
  }

  /**
   * ✅ VALIDATION & SCHEMA CHECKER
   */
  private validateResponse(intent: 'single' | 'thread' | 'reply', parsed: any): ValidationResult {
    const issues: string[] = [];

    if (!parsed || typeof parsed !== 'object') {
      issues.push('Invalid JSON structure');
      return { valid: false, issues };
    }

    // Schema validation by intent
    if (intent === 'thread') {
      if (!parsed.topic || !parsed.tweets || !Array.isArray(parsed.tweets)) {
        issues.push('Missing topic or tweets array');
      }
      
      if (parsed.tweets?.length < 3 || parsed.tweets?.length > 7) {
        issues.push(`Thread length ${parsed.tweets?.length || 0} not in range 3-7`);
      }

      parsed.tweets?.forEach((tweet: any, idx: number) => {
        if (!tweet.text || typeof tweet.text !== 'string') {
          issues.push(`Tweet ${idx + 1} missing text`);
          return;
        }
        
        const len = tweet.text.length;
        if (len < 150 || len > 270) {
          issues.push(`Tweet ${idx + 1} length ${len} not in range 150-270`);
        }
        
        if (tweet.text.includes('#') || tweet.text.includes('"') || tweet.text.includes("'")) {
          issues.push(`Tweet ${idx + 1} contains banned chars (hashtags/quotes)`);
        }
        
        if (tweet.text.includes('...')) {
          issues.push(`Tweet ${idx + 1} contains ellipses`);
        }
        
        if (!tweet.text.match(/[.!?]$/)) {
          issues.push(`Tweet ${idx + 1} doesn't end with punctuation`);
        }
      });
    } else if (intent === 'reply') {
      if (!parsed.reply || typeof parsed.reply !== 'string') {
        issues.push('Missing reply string');
      } else {
        const len = parsed.reply.length;
        if (len < 150 || len > 270) {
          issues.push(`Reply length ${len} not in range 150-270`);
        }
        
        if (parsed.reply.includes('#') || parsed.reply.includes('"') || parsed.reply.includes("'")) {
          issues.push('Reply contains banned chars (hashtags/quotes)');
        }
      }
    } else { // single
      if (!parsed.content || typeof parsed.content !== 'string') {
        issues.push('Missing content string');
      } else {
        const len = parsed.content.length;
        if (len < 200 || len > 280) {
          issues.push(`Content length ${len} not in range 200-280`);
        }
        
        if (parsed.content.includes('#') || parsed.content.includes('"') || parsed.content.includes("'")) {
          issues.push('Content contains banned chars (hashtags/quotes)');
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * 🔄 SAFE JSON PARSER
   */
  private safeParseJson(text: string): any {
    try {
      // Remove any markdown code fences if present
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.warn('JSON parse failed:', error);
      return null;
    }
  }

  /**
   * 🚀 MAIN GENERATION METHOD with Validation Loop
   */
  async generateStrict(ctx: PromptContext): Promise<any> {
    console.log(`🛡️ BULLETPROOF_GENERATION: ${ctx.intent} with strict validation`);

    const params = this.getModelParams(ctx.intent);
    const systemPrompt = this.getSystemPrompt();
    const developerPrompt = this.getDeveloperPrompt(ctx.intent);
    const userPrompt = this.getUserPrompt(ctx);

    try {
      // First attempt
      console.log('🎯 Generating with bulletproof prompts...');
      const response = await this.openai.chat.completions.create({
        ...params,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'developer', content: developerPrompt },
          { role: 'user', content: userPrompt }
        ]
      });

      const text = response.choices[0]?.message?.content?.trim() || '';
      const parsed = this.safeParseJson(text);
      const validation = this.validateResponse(ctx.intent, parsed);

      if (validation.valid) {
        console.log('✅ BULLETPROOF_SUCCESS: Valid response on first attempt');
        return parsed;
      }

      // Regeneration attempt with specific repair instructions
      console.warn(`⚠️ VALIDATION_FAILED: ${validation.issues.join(' | ')}`);
      console.log('🔄 Attempting repair generation...');

      const repairContext = {
        ...ctx,
        repair: validation.issues.join(' | ') + '. Fix these violations and return valid JSON only.'
      };

      const repairResponse = await this.openai.chat.completions.create({
        ...params,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'developer', content: developerPrompt },
          { role: 'user', content: this.getUserPrompt(repairContext) }
        ]
      });

      const repairText = repairResponse.choices[0]?.message?.content?.trim() || '';
      const repairParsed = this.safeParseJson(repairText);
      const repairValidation = this.validateResponse(ctx.intent, repairParsed);

      if (repairValidation.valid) {
        console.log('✅ BULLETPROOF_REPAIR: Valid response after repair');
        return repairParsed;
      }

      // If repair failed, return best attempt with warning
      console.error(`❌ BULLETPROOF_FAILED: ${repairValidation.issues.join(' | ')}`);
      return repairParsed || parsed || { error: 'Generation failed validation' };

    } catch (error: any) {
      console.error('💥 BULLETPROOF_CRASHED:', error.message);
      return { error: `Generation crashed: ${error.message}` };
    }
  }

  /**
   * 🎭 HELPER: Build persona line from expert system
   */
  buildPersonaLine(persona: any): string {
    return `${persona.name} (${persona.background.split(',').slice(0, 3).join('; ')})`;
  }

  /**
   * 🧠 HELPER: Build emotion line from emotional intelligence
   */
  buildEmotionLine(emotion: any): string {
    return `Primary=${emotion.primaryEmotion}; Triggers=${emotion.triggers.slice(0, 2).join(', ')}; Principles=${emotion.psychologyPrinciples.slice(0, 2).join(', ')}; Tactics=${emotion.persuasionTactics[0]}`;
  }
}
