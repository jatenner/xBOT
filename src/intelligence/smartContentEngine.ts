/**
 * 🧠 SMART CONTENT ENGINE
 * 
 * Not just "interesting" - SMART
 * - Makes connections between ideas
 * - Builds on previous content
 * - Has unique insights and viewpoints
 * - Remembers what's been said
 * - Gets smarter over time
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';

export interface SmartContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  metadata: {
    insight_level: number; // 1-10
    connection_made: string; // What connection/insight this reveals
    builds_on: string[]; // Previous topics this builds on
    novel_angle: string; // What makes this unique
  };
}

export class SmartContentEngine {
  private static instance: SmartContentEngine;
  
  private constructor() {}
  
  static getInstance(): SmartContentEngine {
    if (!SmartContentEngine.instance) {
      SmartContentEngine.instance = new SmartContentEngine();
    }
    return SmartContentEngine.instance;
  }

  /**
   * Get recent topics and angles to avoid repetition and build context
   */
  async getRecentContext(): Promise<{
    recentTopics: string[];
    recentAngles: string[];
    connections: string[];
  }> {
    const supabase = getSupabaseClient();
    
    // Get last 30 posts
    const { data: recentPosts } = await supabase
      .from('outcomes')
      .select('topic_cluster, content, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (!recentPosts || recentPosts.length === 0) {
      return { recentTopics: [], recentAngles: [], connections: [] };
    }
    
    // Extract topics
    const recentTopics = [...new Set(recentPosts.map(p => String(p.topic_cluster || '')).filter(Boolean))];
    
    // Extract key angles from content
    const recentAngles = recentPosts
      .map(p => {
        const content = String(p.content || '');
        // Extract first sentence as the "angle"
        const firstSentence = content.split(/[.!?]/)[0];
        return firstSentence ? firstSentence.substring(0, 100) : '';
      })
      .filter(Boolean) as string[];
    
    return {
      recentTopics,
      recentAngles: recentAngles.slice(0, 10),
      connections: [] // Will be populated by AI
    };
  }

  /**
   * Generate SMART content - makes connections, has insights, unique viewpoints
   */
  async generateSmartContent(params: {
    topic?: string;
    format: 'single' | 'thread';
    research?: any;
  }): Promise<SmartContent> {
    
    const { topic, format, research } = params;
    
    // Get context of what we've already said
    const context = await this.getRecentContext();
    
    console.log('[SMART_ENGINE] 🧠 Generating SMART content...');
    console.log(`[SMART_ENGINE] Context: ${context.recentTopics.length} recent topics`);
    
    const systemPrompt = `You make people stop scrolling with GENUINELY INTERESTING INSIGHTS.

🎯 YOUR JOB: Say something that makes people go "shit, I never thought about it that way"

✅ WHAT MAKES IT GOOD:

"Your gut bacteria outvote your brain. 100 trillion vs 86 billion neurons. When you crave 
sugar, it's them voting, not you. Democracy at the cellular level."
→ Unexpected connection + specific numbers + reframes cravings

"Zone 2 cardio = barely hold a conversation. Too easy? Go harder. Can't talk? Slow down. 
That's the mitochondrial adaptation zone most people miss."
→ Practical test + explains why + corrects common mistake

"Sleep isn't about hours. It's about cycles. 6 hours (4 complete cycles) beats 7 hours 
(interrupted mid-cycle). That's why you feel worse after 'more' sleep."
→ Challenges assumption + explains mechanism + paradox

"Fasting works at 16+ hours when you switch from glucose to ketones. Eat every 3 hours? 
You never switch. Spend entire life in one fuel mode."
→ Reveals mechanism + shows what people miss

🚨 REQUIREMENTS:
- Specific numbers ("30%", "16 hours", "100 trillion vs 86 billion")
- Real examples or research when possible
- Explains WHY it works (mechanism)
- 180-280 chars max
- NO vague claims, NO templates, NO "What if..."

${context.recentTopics.length > 0 ? `
📚 WHAT WE'VE ALREADY COVERED:
Recent topics: ${context.recentTopics.slice(0, 5).join(', ')}

Recent angles:
${context.recentAngles.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join('\n')}

🚨 DO NOT REPEAT these angles. Build on them or find completely new angles.
If covering same topic, find a DIFFERENT connection or mechanism.
` : ''}

${research ? `
📊 RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Don't just report this. Find the SMART angle:
- What connection does this reveal?
- What framework does this challenge?
- How does this explain something unexpected?
- What does this mean for how we think about health?
` : ''}

${topic ? `
🎯 TOPIC: ${topic}

Don't give generic facts about this. Ask:
- What's the non-obvious connection here?
- What mechanism explains this?
- How does this relate to something else we know?
- What's the insight that makes people think differently?
` : `
🎯 OPEN TOPIC

Pick something that lets you make a SMART connection:
- Connect biology to behavior
- Explain a mechanism that reveals why something works
- Challenge a framework that's wrong
- Make people see something familiar in a new way
`}

${format === 'thread' ? `
📱 FORMAT: Thread (3-5 tweets)

Structure:
1. Make the connection/reveal the insight (hook)
2. Explain the mechanism (why this matters)
3. Show the implications (what this changes)
4. Give the reframe/action (how to think/act differently)

Each tweet: 150-250 chars
Natural flow, no numbering

Return JSON: {
  "tweets": ["tweet1", "tweet2", ...],
  "connection_made": "what insight this reveals",
  "builds_on": ["topic1", "topic2"],
  "novel_angle": "what makes this unique"
}
` : `
📱 FORMAT: Single tweet

One tweet that makes a SMART connection:
- Reveals a mechanism
- Challenges a framework
- Connects unexpected things
- Reframes a problem

180-280 characters

Return JSON: {
  "tweet": "your tweet",
  "connection_made": "what insight this reveals",
  "builds_on": ["topic"],
  "novel_angle": "what makes this unique"
}
`}

🧠 BE SMART. Make connections. Reveal mechanisms. Challenge frameworks.
Not just interesting facts - INSIGHTS that change how people think.`;

    const userPrompt = topic 
      ? `What's the most interesting insight about: ${topic}\n\nWhat connection or mechanism makes people think "wait, REALLY?" Be specific.`
      : `Share something genuinely interesting.\n\nMake a connection or reveal a mechanism that changes how people think. Be specific with numbers.`;

    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o', // Use best model for smart content
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: format === 'thread' ? 900 : 350,
        response_format: { type: 'json_object' }
      }, { purpose: 'smart_content_generation' });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      
      const content = format === 'thread' 
        ? (parsed.tweets || parsed.thread || [])
        : (parsed.tweet || parsed.content || '');

      const smartContent: SmartContent = {
        content,
        format,
        confidence: 0.95,
        metadata: {
          insight_level: parsed.insight_level || 8,
          connection_made: parsed.connection_made || 'insight revealed',
          builds_on: Array.isArray(parsed.builds_on) ? parsed.builds_on : [],
          novel_angle: parsed.novel_angle || 'unique perspective'
        }
      };
      
      console.log(`[SMART_ENGINE] ✅ Generated (insight level: ${smartContent.metadata.insight_level}/10)`);
      console.log(`[SMART_ENGINE] 💡 Connection: ${smartContent.metadata.connection_made}`);
      console.log(`[SMART_ENGINE] 🎯 Novel angle: ${smartContent.metadata.novel_angle}`);
      
      return smartContent;
      
    } catch (error: any) {
      console.error('[SMART_ENGINE] ❌ Error:', error.message);
      throw new Error(`Smart content generation failed: ${error.message}`);
    }
  }

  /**
   * Check if content is too similar to recent posts (anti-duplication)
   */
  async isDuplicate(content: string | string[]): Promise<{
    isDuplicate: boolean;
    similarity: number;
    similarTo?: string;
  }> {
    const supabase = getSupabaseClient();
    
    const textToCheck = Array.isArray(content) ? content[0] : content;
    const words = textToCheck.toLowerCase().split(/\s+/).slice(0, 15); // First 15 words
    
    // Get recent posts
    const { data: recentPosts } = await supabase
      .from('outcomes')
      .select('content, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!recentPosts || recentPosts.length === 0) {
      return { isDuplicate: false, similarity: 0 };
    }
    
    // Check for high similarity
    for (const post of recentPosts) {
      const postText = String(post.content || '').toLowerCase();
      const postWords = postText.split(/\s+/).slice(0, 15);
      
      // Calculate word overlap
      const overlap = words.filter(w => postWords.includes(w)).length;
      const similarity = overlap / Math.max(words.length, postWords.length);
      
      if (similarity > 0.6) { // 60% similar = duplicate
        console.warn(`[SMART_ENGINE] ⚠️ Duplicate detected (${(similarity * 100).toFixed(0)}% similar)`);
        return {
          isDuplicate: true,
          similarity,
          similarTo: postText.substring(0, 100)
        };
      }
    }
    
    return { isDuplicate: false, similarity: 0 };
  }

  /**
   * Generate smart content with duplication check
   */
  async generateUniqueSmartContent(params: {
    topic?: string;
    format: 'single' | 'thread';
    research?: any;
    maxRetries?: number;
  }): Promise<SmartContent> {
    
    const maxRetries = params.maxRetries || 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[SMART_ENGINE] 🎯 Generation attempt ${attempt}/${maxRetries}`);
      
      const content = await this.generateSmartContent(params);
      
      // Check for duplicates
      const dupCheck = await this.isDuplicate(content.content);
      
      if (!dupCheck.isDuplicate) {
        console.log('[SMART_ENGINE] ✅ Content is unique');
        return content;
      }
      
      console.warn(`[SMART_ENGINE] ⚠️ Content too similar to recent post, retrying...`);
      
      if (attempt === maxRetries) {
        throw new Error('Could not generate unique content after max retries');
      }
    }
    
    throw new Error('Duplication check failed');
  }
}

export const smartContentEngine = SmartContentEngine.getInstance();

