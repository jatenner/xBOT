// Dynamic import to avoid singleton initialization before env is loaded
async function getBudgetedClient() {
  const { createBudgetedChatCompletion } = await import('../services/openaiBudgetedClient');
  return createBudgetedChatCompletion;
}

export interface TimelineCandidate {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string | null;
  like_count: number;
  reply_count: number;
  retweet_count: number;
}

export interface ActionDecision {
  action: 'reply' | 'original' | 'skip';
  target?: TimelineCandidate;
  replyContent?: string;
  originalContent?: string;
  score?: number;
  angle?: string;
  reason: string;
}

export async function scoreAndDecide(candidates: TimelineCandidate[]): Promise<ActionDecision> {
  const username = process.env.TWITTER_USERNAME || 'Neurix5';

  if (candidates.length === 0) {
    console.log('[SCORER] No candidates to score');
    return { action: 'skip', reason: 'no_candidates' };
  }

  // Filter out our own tweets and very old ones
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  const filtered = candidates.filter(c => {
    if (c.author_username.toLowerCase() === username.toLowerCase()) return false;
    if (c.posted_at && new Date(c.posted_at).getTime() < sixHoursAgo) return false;
    return true;
  });

  if (filtered.length === 0) {
    console.log('[SCORER] No candidates after filtering');
    return { action: 'skip', reason: 'all_filtered' };
  }

  // Get tick advisor guidance (non-fatal)
  let guidance = '';
  try {
    const { getTickAdvice } = await import('../intelligence/tickAdvisor');
    const advice = await getTickAdvice();
    if (advice.top_insights.length > 0) {
      guidance = '\nGuidance: ' + advice.top_insights.slice(0, 3).join('. ');
    }
  } catch { /* no guidance available */ }

  // Score via LLM — send top 15 candidates (by engagement)
  const topCandidates = filtered
    .sort((a, b) => (b.like_count + b.reply_count) - (a.like_count + a.reply_count))
    .slice(0, 15);

  const tweetList = topCandidates.map((c, i) =>
    `${i+1}. @${c.author_username}: "${c.content.substring(0, 200)}" (${c.like_count} likes, ${c.reply_count} replies)`
  ).join('\n');

  console.log(`[SCORER] Scoring ${topCandidates.length} candidates via LLM...`);

  try {
    const response = await (await getBudgetedClient())({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `You are scoring tweets for @${username} (a neuroscience/health expert) to reply to.

Health connects to EVERYTHING:
- Sports → performance science, injury prevention, recovery
- Food/cooking → nutrition, gut health, metabolism
- Travel → circadian disruption, jet lag, altitude
- Work/productivity → cortisol, burnout, focus
- Politics → public health, stress, healthcare policy
- Tech → health implications, screen time, Neuralink
- Entertainment → psychology, dopamine, addiction

Score each tweet 0-10: can @${username} add a genuinely valuable health/science angle?
10 = perfect fit (direct health topic with high engagement)
7-9 = great (clear health angle, good engagement)
4-6 = decent (requires creative angle but doable)
1-3 = weak (forced angle, low engagement)
0 = impossible (pure meme, foreign language, spam)
${guidance}

Tweets:
${tweetList}

Return JSON: {"scores": [{"index": 1, "score": 8, "angle": "brief reply angle", "reason": "why"}]}
Only include tweets scoring 5+.`
      }],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }, { purpose: 'timeline_scoring', requestId: `score_${Date.now()}` });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{"scores":[]}');
    const scores = parsed.scores || [];

    // Find best candidate
    const best = scores.sort((a: any, b: any) => b.score - a.score)[0];

    if (best && best.score >= 6 && best.index >= 1 && best.index <= topCandidates.length) {
      const target = topCandidates[best.index - 1];
      console.log(`[SCORER] Best candidate: @${target.author_username} score=${best.score} angle="${best.angle}"`);

      // Generate reply content
      try {
        const replyContent = await generateReply(target, best.angle, username);
        if (replyContent) {
          return {
            action: 'reply',
            target,
            replyContent,
            score: best.score,
            angle: best.angle,
            reason: best.reason,
          };
        }
      } catch (replyErr: any) {
        console.warn(`[SCORER] Reply generation failed: ${replyErr.message}`);
      }
    }

    console.log('[SCORER] No candidate scored high enough for reply');
  } catch (llmErr: any) {
    console.warn(`[SCORER] LLM scoring failed: ${llmErr.message}`);
  }

  // Fallback: post an original tweet
  try {
    const originalContent = await generateOriginal(username);
    if (originalContent) {
      return { action: 'original', originalContent, reason: 'no_good_reply_candidates' };
    }
  } catch (origErr: any) {
    console.warn(`[SCORER] Original generation failed: ${origErr.message}`);
  }

  return { action: 'skip', reason: 'generation_failed' };
}

async function generateReply(target: TimelineCandidate, angle: string, username: string): Promise<string | null> {
  const response = await (await getBudgetedClient())({
    model: process.env.REPLY_GENERATION_MODEL || 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are @${username}. Reply like a smart friend texting. Short, punchy, specific. Never sound like AI.

VOICE:
- Casual. Conversational. Like a text message.
- Have opinions: "this is underrated", "most people get this wrong"
- Be specific: "200mg magnesium glycinate" not "magnesium supplementation"
- One insight per reply. Under 100 chars ideal.

NEVER: "Great point", "Interesting", "Studies show", "crucial", "indeed"

Health angle to use: ${angle}`
    }, {
      role: 'user',
      content: `Reply to @${target.author_username}: "${target.content.substring(0, 300)}"

JSON only: {"content": "your reply"}`
    }],
    temperature: 0.7,
    max_tokens: 100,
    response_format: { type: 'json_object' },
  }, { purpose: 'reply_generation', requestId: `reply_${Date.now()}` });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
  const content = parsed.content?.trim();
  if (content && content.length > 10 && content.length < 280) {
    console.log(`[SCORER] Reply generated (${content.length} chars): "${content.substring(0, 80)}..."`);
    return content;
  }
  return null;
}

async function generateOriginal(username: string): Promise<string | null> {
  const response = await (await getBudgetedClient())({
    model: process.env.CONTENT_GENERATION_MODEL || 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are @${username} — a real person obsessed with neuroscience and health. Tweet like you're texting a smart friend.

NEVER start with "Surprising fact:", "Did you know", "Fun fact:", "Studies show"
Write like: "your body literally eats its own damaged cells while you sleep. autophagy peaks around hour 16 of fasting"
Be casual, have opinions, use lowercase sometimes. Sound HUMAN not like a brand.`
    }, {
      role: 'user',
      content: 'Write one tweet. JSON only: {"content": "your tweet"}'
    }],
    temperature: 0.8,
    max_tokens: 150,
    response_format: { type: 'json_object' },
  }, { purpose: 'original_generation', requestId: `original_${Date.now()}` });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
  const content = parsed.content?.trim();
  if (content && content.length > 10 && content.length < 280) {
    console.log(`[SCORER] Original generated (${content.length} chars): "${content.substring(0, 80)}..."`);
    return content;
  }
  return null;
}
