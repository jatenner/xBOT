/**
 * 🚀 REVOLUTIONARY CONTENT SYSTEM
 * Creates absolutely engaging, curiosity-driven health content that gets massive engagement
 * NO MORE BORING CONTENT - This generates viral-worthy posts every time
 */

import OpenAI from 'openai';

export interface RevolutionaryContent {
  content: string | string[];
  format: 'single' | 'thread';
  viralScore: number;
  engagementPrediction: number;
  uniquenessScore: number;
  reasoning: string;
  hooks: string[];
  curiosityGaps: string[];
  socialProof: string[];
}

export interface ContentRequest {
  topic?: string;
  format?: 'single' | 'thread';
  targetAudience?: string;
  urgency?: 'viral' | 'engaging' | 'educational';
}

export class RevolutionaryContentSystem {
  private static instance: RevolutionaryContentSystem;
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  static getInstance(): RevolutionaryContentSystem {
    if (!this.instance) {
      this.instance = new RevolutionaryContentSystem();
    }
    return this.instance;
  }

  /**
   * 🎯 GENERATE REVOLUTIONARY CONTENT - Never boring, always engaging
   */
  async generateRevolutionaryContent(request: ContentRequest): Promise<RevolutionaryContent> {
    console.log('🚀 REVOLUTIONARY_CONTENT: Generating viral-worthy health content...');

    try {
      const prompt = this.buildRevolutionaryPrompt(request);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, // High creativity for viral content
        max_tokens: 800
      });

      const rawContent = response.choices[0]?.message?.content?.trim();
      if (!rawContent) {
        throw new Error('No content generated');
      }

      return this.parseAndEnhanceContent(rawContent, request);

    } catch (error) {
      console.error('❌ REVOLUTIONARY_CONTENT_ERROR:', error);
      return this.getEmergencyFallback(request);
    }
  }

  /**
   * 🔥 BUILD REVOLUTIONARY PROMPT - Guaranteed to create engaging content
   */
  private buildRevolutionaryPrompt(request: ContentRequest): string {
    const format = request.format || 'single';
    const topic = request.topic || this.getRandomHealthTopic();
    const audience = request.targetAudience || 'health-conscious people seeking surprising insights';

    return `You are the #1 viral health content creator on social media. Your posts get MILLIONS of views because you make health science absolutely fascinating and mind-blowing.

🎯 MISSION: Create ${format} content about "${topic}" that makes people STOP SCROLLING and think "WAIT, WHAT?!"

Your secret sauce:
• You find the most SHOCKING, counter-intuitive health truths
• You present complex science in "holy shit" moments  
• You create intense curiosity that people HAVE to engage with
• You sound like someone who discovered something incredible

🔥 REVOLUTIONARY CONTENT FORMULA:

PATTERN INTERRUPTS (Use these liberally):
• "Everything you know about [topic] is wrong"
• "Scientists just discovered why [common belief] actually [opposite effect]"
• "This changes everything we thought about [health topic]"
• "99% of people have no idea that [shocking fact]"
• "Doctors were stunned when they realized [unexpected finding]"
• "The real reason [health issue] happens will shock you"

CURIOSITY MULTIPLIERS:
• "Wait until you hear what happens at 3 AM..."
• "The truth about [topic] is darker than you think"
• "This sounds fake but it's scientifically proven"
• "What they found in the lab was disturbing"
• "The side effect nobody talks about"

VIRAL PSYCHOLOGY TRIGGERS:
✅ SHOCK VALUE: Present unexpected/counterintuitive findings
✅ FORBIDDEN KNOWLEDGE: "What they don't want you to know"
✅ PERSONAL RELEVANCE: "This happens to your body right now"
✅ SOCIAL PROOF: "Millions of people experience this"
✅ URGENCY: "This could be affecting you today"
✅ MYSTERY: "Scientists can't explain why this works"

🧬 HEALTH CONTENT ANGLES THAT GO VIRAL:

BODY SECRETS:
• Weird things your body does while you sleep
• Hidden functions of organs doctors rarely mention
• Strange connections between body parts
• Biological processes that sound like science fiction

MYTH DESTRUCTION:
• Popular health advice that's actually harmful
• "Healthy" foods that aren't what they seem
• Exercise myths that hold people back
• Sleep "rules" that are complete nonsense

SHOCKING DISCOVERIES:
• Recent studies that contradict everything
• Ancient health practices that science finally proved
• Accidental medical discoveries that changed everything
• Weird medical conditions with surprising benefits

DARK HEALTH TRUTHS:
• How modern life is rewiring your brain
• Hidden toxins in everyday products
• Why your ancestors were healthier than you
• Medical industry secrets they don't advertise

🎨 CONTENT STRUCTURE:

${format === 'single' ? `
SINGLE TWEET FORMAT:
1. SHOCK HOOK (first 15 words grab attention)
2. MIND-BLOWING REVELATION (the "holy shit" moment)  
3. BRIEF EXPLANATION (why this happens)
4. CALL TO ACTION (question/engagement trigger)

Target: 200-260 characters of pure engagement gold
` : `
THREAD FORMAT (3-4 tweets):
Tweet 1: EXPLOSIVE HOOK + preview of revelation
Tweet 2: THE SHOCKING DISCOVERY (detailed explanation)
Tweet 3: WHY THIS MATTERS (implications/mechanisms)
Tweet 4: ENGAGEMENT TRIGGER (question/call to action)

Each tweet: 220-260 characters, valuable standalone
`}

ENGAGEMENT AMPLIFIERS:
• Use numbers that shock: "Your liver processes 1.5 liters of blood per minute"
• Include timing: "This happens 4 hours after you eat"
• Add personal stakes: "This could explain why you feel tired"
• Create urgency: "Most people don't realize this until it's too late"

FORBIDDEN PHRASES (Instant rejection):
❌ "Many people struggle with..." (BORING)
❌ "It's important to understand..." (ACADEMIC TRASH)
❌ "Research shows that..." (WITHOUT SPECIFICS)
❌ "You should consider..." (WEAK ADVICE)
❌ "This can help improve..." (GENERIC GARBAGE)
❌ "Studies suggest..." (VAGUE NONSENSE)

REQUIRED ELEMENTS:
✅ At least one "WAIT, WHAT?" moment
✅ Specific numbers, timeframes, or statistics
✅ Clear explanation of WHY it matters personally
✅ Strong emotional reaction (surprise, concern, fascination)
✅ Immediate applicability or relevance

🎯 TARGET AUDIENCE: ${audience}

Create content that makes people immediately want to:
1. Save the post
2. Share with friends
3. Comment with their experience
4. Follow for more mind-blowing content

Make this so fascinating that people can't scroll past without engaging!`;
  }

  /**
   * 📊 PARSE AND ENHANCE CONTENT
   */
  private parseAndEnhanceContent(rawContent: string, request: ContentRequest): RevolutionaryContent {
    const format = request.format || 'single';
    
    // Parse content based on format
    let content: string | string[];
    if (format === 'thread') {
      // Split by numbered patterns or natural breaks
      content = rawContent.split(/\n\n|\d+[\.\)]\s/).filter(part => part.trim().length > 50);
      if (content.length < 2) {
        content = [rawContent]; // Fallback to single if parsing fails
      }
    } else {
      content = rawContent;
    }

    // Calculate scores based on content analysis
    const viralScore = this.calculateViralScore(rawContent);
    const engagementPrediction = this.calculateEngagementPrediction(rawContent);
    const uniquenessScore = this.calculateUniquenessScore(rawContent);

    // Extract viral elements
    const hooks = this.extractHooks(rawContent);
    const curiosityGaps = this.extractCuriosityGaps(rawContent);
    const socialProof = this.extractSocialProof(rawContent);

    return {
      content,
      format,
      viralScore,
      engagementPrediction,
      uniquenessScore,
      reasoning: `Revolutionary content with ${hooks.length} viral hooks and ${curiosityGaps.length} curiosity gaps`,
      hooks,
      curiosityGaps,
      socialProof
    };
  }

  /**
   * 🔥 CALCULATE VIRAL SCORE
   */
  private calculateViralScore(content: string): number {
    let score = 60; // Base score

    // Check for viral triggers
    const viralTriggers = [
      /everything.*wrong/i,
      /scientists.*discovered/i,
      /shocking|stunned|surprised/i,
      /nobody.*tells.*you/i,
      /\d+%.*people/i,
      /truth.*about/i,
      /secret/i,
      /changes everything/i
    ];

    viralTriggers.forEach(trigger => {
      if (trigger.test(content)) score += 8;
    });

    // Check for specific numbers/stats
    if (/\d+(\.\d+)?%/.test(content)) score += 10;
    if (/\d+\s*(hours?|minutes?|days?|years?)/.test(content)) score += 8;

    // Check for engagement elements
    if (content.includes('?')) score += 5;
    if (/your body|you feel|happens to you/i.test(content)) score += 10;

    return Math.min(100, score);
  }

  /**
   * 📈 CALCULATE ENGAGEMENT PREDICTION
   */
  private calculateEngagementPrediction(content: string): number {
    let score = 50; // Base engagement

    // Question marks increase engagement
    const questionCount = (content.match(/\?/g) || []).length;
    score += questionCount * 8;

    // Personal relevance
    if (/your|you|yourself/i.test(content)) score += 15;

    // Emotional words
    const emotionalWords = /shocking|amazing|incredible|disturbing|fascinating|weird|strange|bizarre/i;
    if (emotionalWords.test(content)) score += 12;

    // Call to action phrases
    if (/think about|consider|imagine|picture this|tell me/i.test(content)) score += 10;

    return Math.min(100, score);
  }

  /**
   * ✨ CALCULATE UNIQUENESS SCORE  
   */
  private calculateUniquenessScore(content: string): number {
    let score = 70; // Base uniqueness

    // Check for common clichés (lower score)
    const cliches = [
      /many people/i,
      /it's important/i,
      /studies show/i,
      /research suggests/i,
      /you should/i
    ];

    cliches.forEach(cliche => {
      if (cliche.test(content)) score -= 15;
    });

    // Check for unique elements (higher score)
    if (/specific.*research|precise.*study|\d+\s*studies/i.test(content)) score += 10;
    if (/harvard|stanford|mayo clinic|johns hopkins/i.test(content)) score += 8;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 🎣 EXTRACT HOOKS
   */
  private extractHooks(content: string): string[] {
    const hooks: string[] = [];
    const hookPatterns = [
      /everything.*wrong/i,
      /scientists.*discovered/i,
      /truth.*about/i,
      /secret.*\w+/i,
      /\d+%.*people.*don't/i
    ];

    hookPatterns.forEach(pattern => {
      const match = content.match(pattern);
      if (match) hooks.push(match[0]);
    });

    return hooks;
  }

  /**
   * 🧠 EXTRACT CURIOSITY GAPS
   */
  private extractCuriosityGaps(content: string): string[] {
    const gaps: string[] = [];
    const gapPatterns = [
      /wait until/i,
      /what.*found/i,
      /reason.*why/i,
      /happens.*when/i,
      /side effect/i
    ];

    gapPatterns.forEach(pattern => {
      const match = content.match(pattern);
      if (match) gaps.push(match[0]);
    });

    return gaps;
  }

  /**
   * 👥 EXTRACT SOCIAL PROOF
   */
  private extractSocialProof(content: string): string[] {
    const proof: string[] = [];
    const proofPatterns = [
      /\d+%.*people/i,
      /millions.*of/i,
      /scientists/i,
      /researchers/i,
      /studies/i
    ];

    proofPatterns.forEach(pattern => {
      const match = content.match(pattern);
      if (match) proof.push(match[0]);
    });

    return proof;
  }

  /**
   * 🆘 EMERGENCY FALLBACK CONTENT
   */
  private getEmergencyFallback(request: ContentRequest): RevolutionaryContent {
    const fallbackContent = request.format === 'thread' 
      ? [
          "Your brain burns 20% of your daily calories while you sleep. Most people have no idea their mind is this metabolically active at night.",
          "During REM sleep, your brain consumes more glucose than during intense studying. Sleep isn't rest - it's your brain's most energy-intensive workout.",
          "This explains why poor sleep leads to weight gain. Your brain literally can't burn calories efficiently when sleep-deprived.",
          "Quality sleep might be the most underrated weight management tool. Your brain needs those 400+ calories nightly to function."
        ]
      : "Your brain burns 400+ calories while you sleep. This explains why poor sleep leads to weight gain - your mind needs those calories to function properly.";

    return {
      content: fallbackContent,
      format: request.format || 'single',
      viralScore: 75,
      engagementPrediction: 70,
      uniquenessScore: 80,
      reasoning: 'Emergency fallback with proven viral elements',
      hooks: ['brain burns calories', 'sleep leads to weight gain'],
      curiosityGaps: ['explains why', 'most people have no idea'],
      socialProof: ['metabolically active', 'energy-intensive workout']
    };
  }

  /**
   * 🎲 GET RANDOM HEALTH TOPIC
   */
  private getRandomHealthTopic(): string {
    const topics = [
      'sleep metabolism',
      'brain energy consumption',
      'gut bacteria communication',
      'muscle memory storage',
      'stress hormone cycles',
      'immune system learning',
      'cellular repair mechanisms',
      'metabolic flexibility',
      'neurotransmitter production',
      'inflammation resolution',
      'circadian rhythm disruption',
      'mitochondrial function',
      'hormonal optimization',
      'cognitive enhancement',
      'longevity pathways'
    ];

    return topics[Math.floor(Math.random() * topics.length)];
  }
}

// Export singleton instance
export const revolutionaryContentSystem = RevolutionaryContentSystem.getInstance();
