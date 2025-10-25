/**
 * 🧠 INTELLIGENT CONTENT ENGINE
 * Multi-pass AI generation system that produces natural, helpful, complete content
 * 
 * Flow:
 * 1. Analyze topic and find best angle
 * 2. Plan thread structure
 * 3. Generate content with full context
 * 4. Humanize and polish
 * 5. Self-review and improve
 */

import { OpenAIService } from '../services/openAIService';
import { getSupabaseClient } from '../db/index';

interface TopicAnalysis {
  angle: string;
  coreInsight: string;
  whyItMatters: string;
  problemItSolves: string;
  contentType: 'single' | 'thread';
}

interface ContentStructure {
  hook: string;
  context: string;
  mechanism: string;
  problem: string;
  solution: string;
  actionSteps: string[];
  timeline: string;
  closer: string;
}

interface QualityReview {
  hookStrength: number;
  usefulness: number;
  naturalFlow: number;
  completeness: number;
  uniqueness: number;
  totalScore: number;
  needsImprovement: boolean;
  suggestion?: string;
}

interface GeneratedContent {
  content: string | string[]; // Single tweet or thread
  format: 'single' | 'thread';
  metadata: {
    angle: string;
    qualityScore: number;
    topicAnalysis: TopicAnalysis;
    iterations: number;
  };
}

export class IntelligentContentEngine {
  private static instance: IntelligentContentEngine;
  private openai = OpenAIService.getInstance();

  public static getInstance(): IntelligentContentEngine {
    if (!IntelligentContentEngine.instance) {
      IntelligentContentEngine.instance = new IntelligentContentEngine();
    }
    return IntelligentContentEngine.instance;
  }

  /**
   * Main entry point: Generate intelligent content with multi-pass system
   */
  async generateIntelligentContent(params: {
    topic: string;
    recentPosts?: string[];
    topPerformers?: any[];
    recentFlops?: any[];
    trendingTopics?: string[];
  }): Promise<GeneratedContent> {
    console.log('🧠 INTELLIGENT_ENGINE: Starting multi-pass generation...');

    try {
      // PASS 1: Analyze topic and find best angle
      console.log('📊 PASS 1: Analyzing topic and finding angle...');
      const analysis = await this.analyzeTopicAndFindAngle(params.topic);
      console.log(`   Angle: ${analysis.angle}`);
      console.log(`   Insight: ${analysis.coreInsight}`);
      console.log(`   Format: ${analysis.contentType}`);

      // PASS 2: Plan content structure
      console.log('📝 PASS 2: Planning content structure...');
      const structure = await this.planContentStructure(analysis, params.topic);
      console.log(`   Structure planned with ${Object.keys(structure).length} components`);

      // PASS 3: Generate content with full context
      console.log('✍️ PASS 3: Generating content...');
      const draft = await this.generateContentWithContext(
        params.topic,
        analysis,
        structure,
        params
      );
      console.log(`   Draft generated (${draft.length} chars)`);

      // PASS 4: Humanize and polish
      console.log('🗣️ PASS 4: Humanizing content...');
      const polished = await this.humanizeContent(draft);
      console.log(`   Content polished`);

      // PASS 5: Self-review
      console.log('⭐ PASS 5: Self-reviewing...');
      const review = await this.selfReviewContent(polished);
      console.log(`   Quality score: ${review.totalScore}/10`);

      // PASS 6: Improve if needed
      let finalContent = polished;
      let iterations = 1;

      if (review.needsImprovement && review.suggestion) {
        console.log(`🔧 PASS 6: Improving based on feedback...`);
        console.log(`   Issue: ${review.suggestion}`);
        finalContent = await this.improveContent(polished, review.suggestion);
        iterations = 2;
        console.log(`   Content improved`);
      }

      // Parse into single or thread
      const parsedContent = this.parseContent(finalContent, analysis.contentType);

      console.log('✅ INTELLIGENT_ENGINE: Generation complete');
      console.log(`   Format: ${analysis.contentType}`);
      console.log(`   Quality: ${review.totalScore}/10`);
      console.log(`   Iterations: ${iterations}`);

      return {
        content: parsedContent,
        format: analysis.contentType,
        metadata: {
          angle: analysis.angle,
          qualityScore: review.totalScore,
          topicAnalysis: analysis,
          iterations
        }
      };
    } catch (error: any) {
      console.error('❌ INTELLIGENT_ENGINE: Generation failed:', error.message);
      throw error;
    }
  }

  /**
   * PASS 1: Analyze topic and find best angle
   */
  private async analyzeTopicAndFindAngle(topic: string): Promise<TopicAnalysis> {
    const prompt = `You are analyzing a health topic to find the most engaging angle for social media content.

Topic: "${topic}"

Your job: Find the angle that will make people stop scrolling and actually care.

Consider:
1. What misconception do most people have about this?
2. What surprising fact would make someone say "wait, really?"
3. What practical problem does this solve?
4. What's a contrarian take that's actually true?
5. What's the "hidden" insight most people miss?

Also decide: Should this be a single tweet (quick insight) or thread (needs explanation + action steps)?

Rules:
- Pick ONE angle (the strongest one)
- Be specific, not vague
- Think about what would make YOU stop and read
- Consider what's shareable/quotable

Return ONLY valid JSON:
{
  "angle": "the specific angle to take",
  "coreInsight": "the main insight/takeaway",
  "whyItMatters": "why people should care",
  "problemItSolves": "what problem this solves for them",
  "contentType": "single" or "thread"
}`;

    const response = await this.openai.chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4o-mini',
        temperature: 0.8, // Higher creativity for angle discovery
        maxTokens: 500,
        requestType: 'topic_analysis'
      }
    );

    const content = response.choices[0].message.content || '{}';
    return JSON.parse(content);
  }

  /**
   * PASS 2: Plan content structure
   */
  private async planContentStructure(
    analysis: TopicAnalysis,
    topic: string
  ): Promise<ContentStructure> {
    const prompt = `You are planning the structure for social media content about a health topic.

Topic: "${topic}"
Angle: "${analysis.angle}"
Core Insight: "${analysis.coreInsight}"
Format: ${analysis.contentType}

Plan a ${analysis.contentType} structure with these components:

${analysis.contentType === 'thread' ? `
For a THREAD (needs to explain + give solutions):
- Hook: One powerful opening line that makes people stop
- Context: 2-3 sentences why this matters
- Mechanism: How it works (simple explanation)
- Problem: What people are doing wrong
- Solution: How to fix it (transition line)
- Action Steps: 3-5 specific things to do
- Timeline: When to expect results
- Closer: Thought-provoking final line
` : `
For a SINGLE TWEET (quick insight):
- Hook: Strong opening
- Core point: The main insight
- Why it matters: Brief context
- Closer: Memorable line
`}

Keep each component concise. Use conversational language.
Think: explaining to a friend over text.

Return ONLY valid JSON with these fields:
${analysis.contentType === 'thread' 
  ? '{"hook": "", "context": "", "mechanism": "", "problem": "", "solution": "", "actionSteps": ["", ""], "timeline": "", "closer": ""}'
  : '{"hook": "", "context": "", "closer": ""}'
}`;

    const response = await this.openai.chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 800,
        requestType: 'content_planning'
      }
    );

    const content = response.choices[0].message.content || '{}';
    return JSON.parse(content);
  }

  /**
   * PASS 3: Generate content with full context
   */
  private async generateContentWithContext(
    topic: string,
    analysis: TopicAnalysis,
    structure: ContentStructure,
    context: {
      recentPosts?: string[];
      topPerformers?: any[];
      recentFlops?: any[];
      trendingTopics?: string[];
    }
  ): Promise<string> {
    const recentContext = context.recentPosts?.slice(0, 5).join('\n- ') || 'None';
    const trendingContext = context.trendingTopics?.slice(0, 3).join(', ') || 'None';

    const prompt = `You are a health content creator with 500K followers known for making complex topics simple and actually helping people (not just educating).

TOPIC: "${topic}"
ANGLE: "${analysis.angle}"
INSIGHT: "${analysis.coreInsight}"
FORMAT: ${analysis.contentType}

STRUCTURE TO FOLLOW:
${JSON.stringify(structure, null, 2)}

YOUR VOICE:
- Direct and helpful
- Conversational (like texting a friend)
- Occasionally contrarian
- Always practical
- No academic BS

STYLE RULES:
✅ DO:
- Use "you" and "your" (make it personal)
- Short sentences mixed with longer ones
- Contractions (don't, isn't, won't, here's, it's)
- Metaphors that simplify complex ideas
- Specific numbers (not "many" but "60%" or "3 weeks")
- Action steps people can actually do
- Timelines for when to expect results

❌ DON'T:
- Academic citations (n=200, et al., p<0.05, Smith 2021)
- Phrases like "Studies show" or "Research indicates"
- Formal language (individuals, optimal, facilitate, utilize)
- Numbered lists like "1." "2." "3." or "Step 1"
- Labels like "Tweet 1:" or "Hook:" or "Part 1:"
- Generic advice (listen to your body, consistency is key)
- Explain without giving solutions

CONTEXT:
Recent posts to differentiate from: ${recentContext}
Trending topics: ${trendingContext}

${analysis.contentType === 'thread' ? `
THREAD FORMAT:
Write 7-10 parts that flow naturally. Each part is 1-3 sentences.
Separate parts with a blank line.
NO numbering, NO labels, just natural flow.

Example flow:
[Hook line]

[Context sentences]

[Mechanism explanation]

[Problem identification]

[Solution intro]

[Specific action]
[Specific action]
[Specific action]

[Timeline]

[Closing insight]
` : `
SINGLE TWEET FORMAT:
Write one cohesive tweet (240-280 characters).
Make it punchy and memorable.
`}

IMPORTANT:
- Make it USEFUL - people should know exactly what to do
- Sound like a real person, not a content robot
- Each part should flow naturally into the next
- If it's a thread, make sure it's COMPLETE (explains + gives solutions)

Write the content now (NO labels or structure markers, just the content):`;

    const response = await this.openai.chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: analysis.contentType === 'thread' ? 1500 : 400,
        requestType: 'content_generation'
      }
    );

    const content = response.choices[0].message.content || '';
    return content.trim();
  }

  /**
   * PASS 4: Humanize and polish
   */
  private async humanizeContent(content: string): Promise<string> {
    const prompt = `Here's a draft of social media content:

${content}

Your job: Make it sound MORE human and natural.

Changes to make:
- Remove any remaining formal/academic language
- Add more contractions where natural
- Vary sentence length (mix very short with longer)
- Make transitions smoother between parts
- Add personality (occasional "honestly", "here's the thing", "turns out")
- Remove anything that sounds "written" vs "spoken"
- Make it flow like someone passionately explaining something

The goal: Sounds like texting insights to a friend, not writing an essay.

Return ONLY the improved content (no explanations):`;

    const response = await this.openai.chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 1500,
        requestType: 'content_humanization'
      }
    );

    const humanizedContent = response.choices[0].message.content || '';
    return humanizedContent.trim();
  }

  /**
   * PASS 5: Self-review quality
   */
  private async selfReviewContent(content: string): Promise<QualityReview> {
    const prompt = `Review this social media content and score it honestly:

${content}

Rate each aspect (1-10):

1. Hook Strength: Does the opening make you want to keep reading?
2. Usefulness: Do people know exactly what to DO after reading?
3. Natural Flow: Does it sound like a real person talking?
4. Completeness: If it mentions a problem, does it give the solution?
5. Uniqueness: Is this different from typical health advice?

Scoring guide:
- 8-10: Excellent, ready to post
- 6-7: Good but could be better
- 1-5: Needs work

If any score is below 7, provide ONE specific improvement suggestion.

Return ONLY valid JSON:
{
  "hookStrength": 8,
  "usefulness": 7,
  "naturalFlow": 9,
  "completeness": 8,
  "uniqueness": 7,
  "totalScore": 7.8,
  "needsImprovement": false,
  "suggestion": "optional specific fix if needed"
}`;

    const response = await this.openai.chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4o-mini',
        temperature: 0.3, // Lower for consistent scoring
        maxTokens: 300,
        requestType: 'quality_review'
      }
    );

    const reviewContent = response.choices[0].message.content || '{}';
    return JSON.parse(reviewContent);
  }

  /**
   * PASS 6: Improve based on feedback
   */
  private async improveContent(content: string, suggestion: string): Promise<string> {
    const prompt = `Improve this content based on specific feedback:

CONTENT:
${content}

FEEDBACK:
${suggestion}

Make ONLY the change needed to address this feedback. Keep everything else the same.

Return ONLY the improved content:`;

    const response = await this.openai.chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 1500,
        requestType: 'content_improvement'
      }
    );

    const content = response.choices[0].message.content || '';
    return content.trim();
  }

  /**
   * Parse content into array for threads or string for singles
   */
  private parseContent(content: string, format: 'single' | 'thread'): string | string[] {
    if (format === 'single') {
      return content;
    }

    // Split thread by double newlines (blank lines between parts)
    const parts = content
      .split(/\n\n+/)
      .map(part => part.trim())
      .filter(part => part.length > 0);

    return parts;
  }
}

export const getIntelligentContentEngine = () => IntelligentContentEngine.getInstance();

