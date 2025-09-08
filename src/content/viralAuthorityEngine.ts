/**
 * 🔥 VIRAL AUTHORITY ENGINE
 * 
 * Combines expert credibility with viral psychology for maximum follower growth.
 * Creates content that's both authoritative AND irresistibly engaging.
 */

import { OpenAI } from 'openai';

export interface ViralAuthorityContent {
  success: boolean;
  content: string[];
  format: 'single' | 'thread';
  viralScore: number;
  authorityScore: number;
  expectedFollowers: number;
  metadata: {
    hook_type: string;
    viral_elements: string[];
    authority_markers: string[];
    engagement_drivers: string[];
  };
}

export class ViralAuthorityEngine {
  private static instance: ViralAuthorityEngine;
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public static getInstance(): ViralAuthorityEngine {
    if (!ViralAuthorityEngine.instance) {
      ViralAuthorityEngine.instance = new ViralAuthorityEngine();
    }
    return ViralAuthorityEngine.instance;
  }

  /**
   * 🎯 Generate viral authority content optimized for follower growth
   */
  async generateViralAuthorityContent(topic?: string): Promise<ViralAuthorityContent> {
    console.log('🔥 VIRAL_AUTHORITY: Generating follower-magnet content...');

    try {
      const prompt = this.buildViralAuthorityPrompt(topic || 'health optimization');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8, // Higher creativity for viral content
        max_tokens: 600
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Parse and structure the content
      const structured = this.structureViralContent(content);
      
      // Score for viral potential and authority
      const scores = this.scoreContent(structured.content);
      
      return {
        success: true,
        content: structured.content,
        format: structured.format,
        viralScore: scores.viralScore,
        authorityScore: scores.authorityScore,
        expectedFollowers: this.calculateExpectedFollowers(scores.viralScore, scores.authorityScore),
        metadata: {
          hook_type: this.identifyHookType(structured.content[0]),
          viral_elements: this.extractViralElements(structured.content.join(' ')),
          authority_markers: this.extractAuthorityMarkers(structured.content.join(' ')),
          engagement_drivers: this.extractEngagementDrivers(structured.content.join(' '))
        }
      };

    } catch (error) {
      console.error('❌ VIRAL_AUTHORITY_ERROR:', error);
      return this.getFallbackContent();
    }
  }

  /**
   * 🏗️ Build viral authority prompt that combines credibility with engagement
   */
  private buildViralAuthorityPrompt(topic: string): string {
    return `You are Dr. Alex Rivera, a Harvard-trained health researcher who went viral on social media by making complex health science accessible and controversial. You have 500K+ followers because you:

1. 🔥 Challenge popular health myths with SHOCKING research
2. 📊 Back everything with prestigious studies BUT make it personal 
3. 🎯 Use hooks that make people STOP scrolling
4. 💣 Drop controversial but defensible health takes
5. 🧠 Sound like a brilliant friend, not a boring professor

TOPIC: ${topic}

VIRAL AUTHORITY FORMULA:
Hook (controversial/surprising) + Institutional credibility + Research backing + Actionable insight

WINNING HOOK PATTERNS (use these - NO PERSONAL LANGUAGE):
- "Unpopular opinion from Harvard researchers:"
- "Scientists studied this for 10 years. Everyone's wrong about:"
- "Doctors won't tell you this, but the research shows:"
- "Controversial health take backed by science:"
- "New analysis of 47 studies reveals shocking results about [topic]:"
- "Latest clinical trials confirm what researchers suspected:"
- "Medical establishment hates this, but the data doesn't lie:"

AUTHORITY ELEMENTS TO INCLUDE:
✅ Specific study references: "23 clinical trials", "Harvard Sleep Lab data", "Mayo Clinic research"
✅ Precise statistics: "47% improvement", "2.3x higher risk", "reduces by 31%"
✅ Institution names: Harvard, Stanford, Mayo Clinic, Johns Hopkins
✅ Research terminology: "systematic review", "meta-analysis", "longitudinal study"

VIRAL PSYCHOLOGY TRIGGERS:
✅ Controversy: Challenge conventional wisdom
✅ Specificity: Exact numbers, timeframes, amounts
✅ Social proof: "Most people don't know this"
✅ Curiosity gaps: "The real reason why..."
✅ Pattern interrupts: "Everything you know about X is wrong"
✅ Shocking reveals: "Scientists were shocked when they discovered"

CONTENT STRUCTURE:
If simple insight → Single tweet (220-250 chars)
If complex topic → Thread (3-4 tweets, each <270 chars)

EXAMPLES OF PERFECT VIRAL AUTHORITY CONTENT:

SINGLE TWEET:
"Unpopular opinion from Harvard researchers: Drinking 8 glasses of water daily is marketing BS. New analysis of 23 hydration studies shows kidneys can only process 0.8-1L per hour. Most people are just making expensive urine. Drink when thirsty. Science > marketing."

THREAD:
"1/3 🧵 Medical establishment won't tell you: Cold showers are overhyped. Latest review of 15 studies on cold therapy reveals the truth.

2/3 📊 Reality: 2-3 minutes of cold water triggers norepinephrine (study: 530% increase). But hot saunas show superior cardiovascular benefits [Finnish research, 20-year study].

3/3 💡 Optimal protocol: Hot sauna 3x/week beats daily cold showers. Research suggests this approach optimizes cardiovascular health more effectively."

CRITICAL REQUIREMENTS:
❌ NO medical advice language ("take", "should", "must")
❌ NO personal language ("I", "me", "my", "we", "us", "our")
❌ NO boring academic tone
❌ NO generic health tips
✅ ALWAYS controversial but defensible
✅ ALWAYS include specific research
✅ ALWAYS hook with pattern interrupt
✅ ALWAYS end with engagement driver
✅ Use third-person: "researchers found", "studies show", "data reveals"

Generate viral authority content about "${topic}" that will stop scrolling, build trust, and drive massive follower growth.`;
  }

  /**
   * 🏗️ Structure and format the viral content
   */
  private structureViralContent(content: string): { content: string[]; format: 'single' | 'thread' } {
    // Check if it's a thread (contains numbered structure or is very long)
    const isThread = content.includes('1/') || content.includes('1.') || content.length > 250;
    
    if (isThread) {
      // Split by thread markers or sentences
      const threadParts = content.split(/\d+\/\d+|\d+\./).filter(part => part.trim().length > 0);
      return {
        content: threadParts.map(part => part.trim().substring(0, 270)),
        format: 'thread'
      };
    } else {
      return {
        content: [content.trim().substring(0, 250)],
        format: 'single'
      };
    }
  }

  /**
   * 📊 Score content for viral potential and authority
   */
  private scoreContent(content: string[]): { viralScore: number; authorityScore: number } {
    const fullText = content.join(' ');
    
    // Viral scoring
    let viralScore = 0;
    const viralIndicators = [
      { pattern: /(unpopular opinion|controversial|shocking|won't tell you)/i, points: 25 },
      { pattern: /(everyone's wrong|myth|bs|scam|lie)/i, points: 20 },
      { pattern: /(\d+% |x higher|analyzed \d+)/i, points: 15 },
      { pattern: /(harvard|stanford|mayo|johns hopkins)/i, points: 10 },
      { pattern: /^.{0,250}$/, points: 10 } // Optimal length
    ];

    viralIndicators.forEach(({ pattern, points }) => {
      if (pattern.test(fullText)) viralScore += points;
    });

    // Authority scoring  
    let authorityScore = 0;
    const authorityIndicators = [
      { pattern: /\b(research|study|studies|clinical|meta-analysis)\b/gi, points: 5 },
      { pattern: /\[(harvard|mayo|stanford|cochrane)[^\]]*\]/gi, points: 10 },
      { pattern: /\d+% (improvement|reduction|increase)/gi, points: 8 },
      { pattern: /\b(systematic review|longitudinal|peer-reviewed)\b/gi, points: 12 }
    ];

    authorityIndicators.forEach(({ pattern, points }) => {
      const matches = fullText.match(pattern) || [];
      authorityScore += matches.length * points;
    });

    return {
      viralScore: Math.min(viralScore, 100),
      authorityScore: Math.min(authorityScore, 100)
    };
  }

  /**
   * 📈 Calculate expected followers based on scores
   */
  private calculateExpectedFollowers(viralScore: number, authorityScore: number): number {
    const baseFollowers = 5;
    const viralMultiplier = viralScore / 20;
    const authorityMultiplier = authorityScore / 25;
    
    return Math.round(baseFollowers + viralMultiplier + authorityMultiplier);
  }

  /**
   * 🎯 Identify hook type
   */
  private identifyHookType(firstTweet: string): string {
    if (/unpopular opinion/i.test(firstTweet)) return 'unpopular_opinion';
    if (/won't tell you/i.test(firstTweet)) return 'authority_reveal';
    if (/controversial/i.test(firstTweet)) return 'controversial_take';
    if (/everyone's wrong/i.test(firstTweet)) return 'myth_buster';
    if (/studied.*years/i.test(firstTweet)) return 'expertise_flex';
    return 'research_insight';
  }

  /**
   * 🔥 Extract viral elements
   */
  private extractViralElements(content: string): string[] {
    const elements = [];
    if (/unpopular|controversial/i.test(content)) elements.push('controversy');
    if (/won't tell you|secret|hidden/i.test(content)) elements.push('insider_knowledge');
    if (/everyone's wrong|myth|bs/i.test(content)) elements.push('myth_busting');
    if (/\d+%|\d+ studies/i.test(content)) elements.push('specific_data');
    if (/harvard|stanford|mayo/i.test(content)) elements.push('prestigious_source');
    return elements;
  }

  /**
   * 🎓 Extract authority markers
   */
  private extractAuthorityMarkers(content: string): string[] {
    const markers = [];
    const institutions = content.match(/(harvard|stanford|mayo|johns hopkins|cochrane)/gi) || [];
    const studies = content.match(/\d+ (studies|trials|research)/gi) || [];
    const percentages = content.match(/\d+%/g) || [];
    
    return [...institutions, ...studies, ...percentages];
  }

  /**
   * 💬 Extract engagement drivers
   */
  private extractEngagementDrivers(content: string): string[] {
    const drivers = [];
    if (/\?/.test(content)) drivers.push('question');
    if (/controversial|unpopular/i.test(content)) drivers.push('debate_starter');
    if (/(agree|disagree|thoughts)/i.test(content)) drivers.push('opinion_request');
    if (/(try|test|experiment)/i.test(content)) drivers.push('actionable');
    return drivers;
  }

  /**
   * 🔄 Fallback content for errors
   */
  private getFallbackContent(): ViralAuthorityContent {
    return {
      success: false,
      content: ["Unpopular opinion from health researchers: Most wellness advice online is recycled nonsense. Real health optimization requires understanding individual biomarkers, not following generic protocols promoted by influencers."],
      format: 'single',
      viralScore: 75,
      authorityScore: 60,
      expectedFollowers: 8,
      metadata: {
        hook_type: 'unpopular_opinion',
        viral_elements: ['controversy', 'myth_busting'],
        authority_markers: ['health researchers', 'biomarkers'],
        engagement_drivers: ['debate_starter']
      }
    };
  }
}

export default ViralAuthorityEngine;
