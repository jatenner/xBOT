/**
 * 🔥 VIRAL THREAD GENERATOR
 * 
 * Specifically designed to create threads that have viral potential
 * Based on proven patterns from successful health/science accounts
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';

interface ViralThreadRequest {
  topic?: string;
  hook_style?: 'controversial' | 'shocking_stat' | 'myth_buster' | 'contrarian';
  target_emotion?: 'curiosity' | 'anger' | 'hope' | 'fear';
}

interface ViralThreadResult {
  content: string[];
  format: 'thread';
  viral_score: number;
  hook_type: string;
  metadata: {
    generator: 'viral';
    has_controversy: boolean;
    has_specific_numbers: boolean;
    has_call_to_action: boolean;
    estimated_share_potential: number;
  };
}

/**
 * Generate a viral-optimized thread
 */
export async function generateViralThread(request: ViralThreadRequest = {}): Promise<ViralThreadResult> {
  console.log('[VIRAL_GENERATOR] 🔥 Generating viral thread...');

  const hookStyle = request.hook_style || selectRandomHook();
  const emotion = request.target_emotion || selectRandomEmotion();
  const topic = request.topic || selectViralTopic();

  try {
    const prompt = buildViralPrompt(topic, hookStyle, emotion);
    
    const completion = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.9, // Higher temp for more creative/provocative content
      max_tokens: 800,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'viral_thread_generation'
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    const parsed = JSON.parse(content);
    const threadTweets = validateAndExtractContent(parsed, 'thread', 'ViralGenerator');

    if (!Array.isArray(threadTweets) || threadTweets.length < 3) {
      throw new Error('Viral thread must have at least 3 tweets');
    }

    // Calculate viral score
    const viralScore = calculateViralScore(threadTweets, hookStyle);

    console.log(`[VIRAL_GENERATOR] ✅ Generated viral thread: ${threadTweets.length} tweets, score=${viralScore}`);

    return {
      content: threadTweets,
      format: 'thread',
      viral_score: viralScore,
      hook_type: hookStyle,
      metadata: {
        generator: 'viral',
        has_controversy: hookStyle === 'controversial' || hookStyle === 'contrarian',
        has_specific_numbers: threadTweets.some(t => /\d+%|\$\d+|x\s+\w+/.test(t)),
        has_call_to_action: threadTweets[threadTweets.length - 1].toLowerCase().includes('follow') || 
                              threadTweets[threadTweets.length - 1].toLowerCase().includes('retweet'),
        estimated_share_potential: viralScore
      }
    };

  } catch (error: any) {
    console.error('[VIRAL_GENERATOR] ❌ Error:', error.message);
    
    // Fallback: Create basic viral thread
    return {
      content: [
        "Most health advice is backwards.",
        "Here's what actually works (backed by 1000+ studies):",
        "The problem: Everyone focuses on what to eat. The real game-changer: when you eat.",
        "Fasting for 16 hours daily can increase fat burning by 23% and improve insulin sensitivity by 31%.",
        "Try this: Skip breakfast. Eat between 12-8 PM. Watch your energy skyrocket.",
        "Follow for weekly evidence-based health threads that challenge conventional wisdom."
      ],
      format: 'thread',
      viral_score: 65,
      hook_type: 'contrarian',
      metadata: {
        generator: 'viral',
        has_controversy: true,
        has_specific_numbers: true,
        has_call_to_action: true,
        estimated_share_potential: 65
      }
    };
  }
}

function buildViralPrompt(topic: string, hookStyle: string, emotion: string): { system: string; user: string } {
  const system = `You are a viral content creator specializing in health/science threads.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 STRICT VOICE REQUIREMENTS - MANDATORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ REQUIRED ELEMENTS:
▸ Third-person perspective ONLY - no first-person ever
▸ Specific numbers, measurements, or studies
▸ Mechanism explanation (how/why it works)
▸ Evidence-based claims with sources
▸ Actionable, concrete advice
▸ Complete sentences - no trailing "..."

❌ STRICTLY FORBIDDEN:
▸ First-person language: "I", "me", "my", "mine"
▸ Collective pronouns: "we", "us", "our", "ours"
▸ Vague claims without data
▸ Template phrases: "Let's dive in", "Thread below"
▸ Hashtags (never use #hashtags)
▸ Emojis: Maximum 2 emojis per tweet

🚨 NON-NEGOTIABLES:
1. ZERO first-person: NO "I/me/my/we/us/our"
2. Max 2 emojis per tweet
3. Each tweet <230 chars
4. 5-7 tweets total

🎨 DIVERSITY MANDATE - NEVER USE SAME FORMULA TWICE:

🎨 CREATE SOMETHING NEW: Invent fresh approaches every time. Surprise people. Experiment wildly.

💡 WHAT MAKES THREADS VIRAL:
• Surprise factor (challenges assumptions)
• Concrete examples (Okinawa foods, not "plant-based")
• Specific numbers (43% lower, 11°C for 11min)
• Hidden mechanisms (WHY it works)
• Actionable takeaways (what to DO)
• Shareability ("My friends need this!")

⚠️ AVOID FORMULAIC THREADS:
❌ Don't always structure: Hook → Setup → Turn → Depth → Action → CTA
❌ Don't always use "But here's what the data shows..."
❌ Don't always end with "Follow for more" CTA
❌ Don't waste space on sample sizes "n=288"
❌ Don't use jargon (IL-6) when simple words work (inflammation)

🎯 PRINCIPLES (not formulas):
• Challenge conventional wisdom
• Use concrete examples over abstractions
• Show mechanisms, not just outcomes
• Make it actionable and shareable
• Vary your structure and style

Return as JSON:
{
  "content": ["tweet1", "tweet2", "tweet3", "tweet4", "tweet5"]
}`;

  const user = `Create a viral thread about: "${topic}"

Hook style: ${hookStyle}
Target emotion: ${emotion}

Make it so good people HAVE to share it.`;

  return { system, user };
}

function getHookGuidance(hookStyle: string): string {
  const hooks = {
    controversial: 'Start with a claim that contradicts popular belief:\n"Your doctor is wrong about X"\n"The health industry is lying about Y"',
    shocking_stat: 'Lead with a number that stops the scroll:\n"73% of people are doing X wrong"\n"$15 billion industry built on a lie"',
    myth_buster: 'Call out a widespread myth:\n"Everything you know about X is backwards"\n"The X myth is killing your progress"',
    contrarian: 'Take the opposite view of common wisdom:\n"X doesn\'t cause Y. Z does."\n"Stop doing X. Start doing Y instead."'
  };

  return hooks[hookStyle as keyof typeof hooks] || hooks.contrarian;
}

function getEmotionalGuidance(emotion: string): string {
  const emotions = {
    curiosity: '✅ "Wait until you see #3" "The real secret is..." "What they don\'t tell you"\n❌ Flat statements with no mystery',
    anger: '✅ "This industry is scamming you" "You\'ve been lied to" "They profit from your ignorance"\n❌ Neutral, academic tone',
    hope: '✅ "This reversed my condition" "You can fix this in 30 days" "There\'s a better way"\n❌ No solution or outcome',
    fear: '✅ "This could be shortening your life" "The hidden danger of X" "Why this matters NOW"\n❌ No urgency or consequences'
  };

  return emotions[emotion as keyof typeof emotions] || emotions.curiosity;
}

function selectRandomHook(): 'controversial' | 'shocking_stat' | 'myth_buster' | 'contrarian' {
  const hooks: Array<'controversial' | 'shocking_stat' | 'myth_buster' | 'contrarian'> = ['controversial', 'shocking_stat', 'myth_buster', 'contrarian'];
  return hooks[Math.floor(Math.random() * hooks.length)];
}

function selectRandomEmotion(): 'curiosity' | 'anger' | 'hope' | 'fear' {
  const emotions: Array<'curiosity' | 'anger' | 'hope' | 'fear'> = ['curiosity', 'anger', 'hope', 'fear'];
  return emotions[Math.floor(Math.random() * emotions.length)];
}

function selectViralTopic(): string {
  const viralTopics = [
    // Myth-busting topics
    'breakfast myths and intermittent fasting',
    'cholesterol misconceptions',
    'vitamin D supplementation truth',
    'sleep debt and recovery myths',
    
    // Controversial topics
    'why your doctor is wrong about statins',
    'the cardio myth for fat loss',
    'why eating small meals doesn\'t boost metabolism',
    'the truth about dietary cholesterol',
    
    // Counterintuitive topics
    'cold showers and immune system (the opposite of what you think)',
    'fasting and muscle loss (what actually happens)',
    'carbs and insulin (beyond the hype)',
    'sitting vs standing desks (surprising research)'
  ];

  return viralTopics[Math.floor(Math.random() * viralTopics.length)];
}

function calculateViralScore(tweets: string[], hookStyle: string): number {
  let score = 50; // Base score

  // Check for specific numbers (+20)
  const hasNumbers = tweets.some(t => /\d+%|\$\d+|\d+x|\d+\/\d+/.test(t));
  if (hasNumbers) score += 20;

  // Check for credibility signals (+15)
  const credibilityWords = ['study', 'research', 'dr.', 'stanford', 'harvard', 'mit', 'meta-analysis'];
  const hasCredibility = tweets.some(t => credibilityWords.some(word => t.toLowerCase().includes(word)));
  if (hasCredibility) score += 15;

  // Check for controversy (+20)
  const controversyWords = ['wrong', 'lie', 'myth', 'backwards', 'scam', 'hiding'];
  const hasControversy = tweets.some(t => controversyWords.some(word => t.toLowerCase().includes(word)));
  if (hasControversy) score += 20;

  // Check for CTA (+10)
  const hasCTA = tweets[tweets.length - 1].toLowerCase().includes('follow') || 
                 tweets[tweets.length - 1].toLowerCase().includes('rt');
  if (hasCTA) score += 10;

  // Check thread length (5-7 tweets is optimal) (+/- 10)
  if (tweets.length >= 5 && tweets.length <= 7) {
    score += 10;
  } else if (tweets.length < 4 || tweets.length > 8) {
    score -= 10;
  }

  // Hook style bonus
  if (hookStyle === 'controversial' || hookStyle === 'myth_buster') {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

export default generateViralThread;

