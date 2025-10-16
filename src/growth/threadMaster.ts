/**
 * Thread Master
 * 
 * Generates PROPER Twitter threads (reply chains, not numbered lists)
 * Optimized for follower growth through engagement and dwell time
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { followerGrowthEngine } from './followerGrowthEngine';

export interface ThreadStructure {
  hook: string; // Tweet 1 - The parent tweet
  body: string[]; // Tweets 2-6 - The thread body
  closer: string; // Final tweet - CTA or insight
  total_length: number;
  estimated_dwell_time: number; // seconds
}

export class ThreadMaster {
  private static instance: ThreadMaster;
  
  private constructor() {}
  
  public static getInstance(): ThreadMaster {
    if (!ThreadMaster.instance) {
      ThreadMaster.instance = new ThreadMaster();
    }
    return ThreadMaster.instance;
  }
  
  /**
   * Generate a FOLLOWER-OPTIMIZED thread
   */
  public async generateFollowerThread(request: {
    topic: string;
    category: string;
    hook_strategy: string;
    context: any;
    psychology: any;
  }): Promise<ThreadStructure> {
    
    console.log('[THREAD_MASTER] 🧵 Generating follower-optimized thread...');
    
    // Get viral hook
    const viralHook = followerGrowthEngine.getViralHook(request.hook_strategy, request.topic);
    
    console.log(`[THREAD_MASTER] 🎣 Hook: "${viralHook}"`);
    
    // Generate thread with AI
    const thread = await this.generateThreadContent(request, viralHook);
    
    console.log(`[THREAD_MASTER] ✅ Generated ${thread.total_length}-tweet thread`);
    
    return thread;
  }
  
  /**
   * Generate thread content with AI
   */
  private async generateThreadContent(
    request: any,
    viralHook: string
  ): Promise<ThreadStructure> {
    
    const systemPrompt = `You are a master Twitter thread writer optimized for FOLLOWER GROWTH.

=== THREAD PSYCHOLOGY ===
Threads grow followers because they:
1. Show expertise across multiple tweets (prove you're worth following)
2. Create dwell time (algorithm boost)
3. End with soft CTA (natural follow prompt)
4. Make people check your profile (where they see more good content)

=== TWITTER THREAD FORMAT (CRITICAL) ===
Twitter threads are REPLY CHAINS, not numbered lists!

WRONG:
"1. First point
2. Second point  
3. Third point"

RIGHT:
Tweet 1 (parent): Hook that makes them want more
Tweet 2 (reply to 1): First insight with depth
Tweet 3 (reply to 2): Second insight building on previous
Tweet 4 (reply to 3): Third insight or mechanism
Tweet 5 (reply to 4): Actionable protocol
Tweet 6 (reply to 5): Key insight + soft CTA

Each tweet is SEPARATE, flows naturally, NO NUMBERS, NO FORMATTING.

=== CONTENT REQUIREMENTS ===
- NO numbered lists (1., 2., 3.)
- NO bold formatting (**text**)
- NO "🧵" or "thread below"
- Each tweet: 150-230 characters
- Each tweet stands alone BUT flows to next
- DEPTH: Explain HOW and WHY, not just WHAT
- SPECIFIC: Real numbers, studies, mechanisms
- CONVERSATIONAL: Like explaining to smart friend

=== HOOK REQUIREMENTS ===
Use this specific hook (it's optimized for growth):
"${viralHook}"

This hook should:
- Create curiosity gap (make them NEED to read more)
- Challenge beliefs (pattern interrupt)
- Promise value (you'll learn something)

=== BODY REQUIREMENTS (Tweets 2-5) ===
Tweet 2: The surprising mechanism (WHY this matters)
Tweet 3: The specific data (WHAT the research shows)
Tweet 4: The protocol (HOW to actually do it)
Tweet 5: The key insight (non-obvious detail that changes everything)

Each adds NEW information. No repetition. No filler.

=== CLOSER REQUIREMENTS (Tweet 6) ===
End with:
- Final insight or summary
- Soft CTA: "Found this useful? I share threads like this weekly."
- NO hard sell, NO desperate "please follow"

=== EXAMPLE THREAD (CORRECT FORMAT) ===

Tweet 1 (hook):
"Everyone's sleep advice is backwards. New research tracked 5,000 people for 10 years. The results changed everything we know."

Tweet 2 (mechanism):
"The issue: we optimize for total hours. But sleep architecture matters more. REM in last 2 hours consolidates memories. Cut those, you're done."

Tweet 3 (data):
"UC Berkeley study: people who slept 6 hours but protected REM outperformed 8-hour sleepers on memory tests. It's not duration, it's structure."

Tweet 4 (protocol):
"The fix: track your natural wake time. Count back 7.5 hours (5 complete cycles). That's your bedtime. Protect those last 2 hours like your career depends on it."

Tweet 5 (key insight):
"Key: most people sacrifice morning hours, keep late nights. But REM front-loads in morning sleep. You're literally deleting memories to scroll Twitter."

Tweet 6 (closer):
"Your brain doesn't care about 8-hour rules. It cares about completing cycles and protecting REM. Follow for more research breakdowns like this."

=== WHAT THIS ACHIEVES ===
- Curiosity gap in tweet 1 (they HAVE to read more)
- Mechanism in tweet 2 (explains WHY, shows expertise)
- Data in tweet 3 (credibility, specific numbers)
- Protocol in tweet 4 (actionable, they can use it)
- Insight in tweet 5 (non-obvious key that impresses)
- Closer in tweet 6 (natural follow prompt)

Result: Reader thinks "This person knows their stuff" → checks profile → sees more threads → follows`;

    const userPrompt = `Create a follower-optimized thread about: "${request.topic}"

CONTEXT: ${request.context.timeOfDay} on ${request.context.dayOfWeek}
CATEGORY: ${request.category}
PSYCHOLOGY: ${request.psychology.primary_motive.name}

HOOK (use this):
"${viralHook}"

DEPTH REQUIREMENTS:
- Include real research (specific studies, researchers, data)
- Explain mechanisms (HOW it works biologically/psychologically)
- Provide exact protocols (specific numbers, timing, methods)
- Add non-obvious key insights (what experts know that most don't)

FORBIDDEN:
❌ Numbered lists
❌ Bold formatting
❌ Generic advice without depth
❌ "Here's everything for free" phrases
❌ Thread indicators (🧵, "thread below", "1/")

OUTPUT AS JSON:
{
  "hook": "Tweet 1 text here",
  "body": [
    "Tweet 2 text here",
    "Tweet 3 text here",
    "Tweet 4 text here",
    "Tweet 5 text here"
  ],
  "closer": "Tweet 6 text here"
}

Each tweet: 150-230 characters. Natural flow. Deep insights. Conversational tone.`;

    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      top_p: 0.9,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'follower_thread_generation',
      requestId: `thread_${Date.now()}`
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(rawContent);
    
    // Calculate dwell time (avg reading speed: 200 words/min = 3.3 words/sec)
    const totalChars = parsed.hook.length + 
                      parsed.body.reduce((sum: number, t: string) => sum + t.length, 0) + 
                      parsed.closer.length;
    const estimatedWords = totalChars / 5; // avg 5 chars per word
    const estimatedDwellTime = Math.ceil(estimatedWords / 3.3); // seconds
    
    return {
      hook: parsed.hook,
      body: parsed.body || [],
      closer: parsed.closer,
      total_length: 1 + parsed.body.length + 1,
      estimated_dwell_time: estimatedDwellTime,
    };
  }
  
  /**
   * Validate thread quality for follower growth
   */
  public validateThreadQuality(thread: ThreadStructure): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check lengths
    const allTweets = [thread.hook, ...thread.body, thread.closer];
    allTweets.forEach((tweet, i) => {
      if (tweet.length < 100) {
        issues.push(`Tweet ${i + 1} too short (${tweet.length} chars)`);
      }
      if (tweet.length > 280) {
        issues.push(`Tweet ${i + 1} too long (${tweet.length} chars)`);
      }
    });
    
    // Check for forbidden patterns
    allTweets.forEach((tweet, i) => {
      if (/^\d+\./.test(tweet)) {
        issues.push(`Tweet ${i + 1} has numbered list format`);
      }
      if (/\*\*/.test(tweet)) {
        issues.push(`Tweet ${i + 1} has bold formatting`);
      }
      if (/🧵|thread below|\/\d+/.test(tweet.toLowerCase())) {
        issues.push(`Tweet ${i + 1} has thread indicators`);
      }
    });
    
    // Check for depth (should have numbers/research)
    const hasNumbers = allTweets.some(t => /\d+%|\d+ (people|studies|hours|years)/.test(t));
    if (!hasNumbers) {
      issues.push('Thread lacks specific numbers/data');
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export const threadMaster = ThreadMaster.getInstance();

