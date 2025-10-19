/**
 * 🗣️ HUMAN VOICE FILTER
 * 
 * Transforms robotic, academic content into engaging, human posts
 * that people actually want to read and follow.
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { parseAIJson } from '../utils/aiJsonParser';

export async function humanizeContent(content: string | string[]): Promise<string | string[]> {
  const isThread = Array.isArray(content);
  const textToHumanize = isThread ? content.join('\n\n') : content;
  
  console.log('[HUMAN_VOICE] 🗣️ Humanizing content...');
  
  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel() // Budget-optimized,
      messages: [
        {
          role: 'system',
          content: `You are a VIRAL CONTENT REWRITER. Transform academic, robotic health content into engaging posts that people actually want to read.

🚨 RULES:
1. Remove ALL academic language ("intermittent fasting boosts gut microbiome" → "fasting changes your gut in crazy ways")
2. Remove PowerPoint titles ("The Surprising Role of..." → just get to the point)
3. Remove formulas like "Myth: X. Truth: Y" (boring!)
4. Add personality, shock value, intrigue
5. Make it conversational - like you're telling a friend something wild you just learned
6. Keep it under 280 chars per tweet
7. NO numbering (1/5, 2/5, etc)
8. NO academic citations in the text (you can reference studies but make it casual)

TRANSFORM THIS:
"Intermittent fasting boosts gut microbiome diversity by 35% in 12 weeks (Harvard 2023, n=1,200)"

INTO THIS:
"Your gut bacteria multiply like crazy when you skip breakfast. Harvard tracked 1,200 people—35% more diversity in 3 months just from fasting 16 hours."

TRANSFORM THIS:
"Myth: The Impact of Intermittent Fasting on Gut Microbiome Diversity belief. Truth: evidence shows otherwise."

INTO THIS:
"Everyone's fasting for weight loss. Nobody talks about what it does to your gut bacteria. That's the real story."

TRANSFORM THIS:
"What if everything we think about The Surprising Role of Gut Microbiome Diversity in Mental Resilience is backwards?"

INTO THIS:
"Your gut bacteria control your mood way more than you think. Most people have this backwards."

TONE: Casual expert. Like you're the friend who knows way too much about health and drops knowledge bombs at parties.`
        },
        {
          role: 'user',
          content: `Rewrite this to sound human, engaging, and interesting:\n\n${textToHumanize}\n\nReturn as JSON: ${isThread ? '{"tweets": ["tweet1", "tweet2", ...]}' : '{"tweet": "rewritten_tweet"}'}`
        }
      ],
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    }, { purpose: 'human_voice_filter' });
    
    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    if (isThread) {
      const humanized = parsed.tweets || parsed.thread || content;
      console.log('[HUMAN_VOICE] ✅ Thread humanized');
      return humanized;
    } else {
      const humanized = parsed.tweet || parsed.content || content;
      console.log('[HUMAN_VOICE] ✅ Tweet humanized');
      return humanized;
    }
    
  } catch (error: any) {
    console.error('[HUMAN_VOICE] ❌ Failed to humanize:', error.message);
    return content; // Return original if humanization fails
  }
}

/**
 * Quick fixes for common robotic patterns (backup if AI fails)
 */
export function quickHumanize(text: string): string {
  let humanized = text;
  
  // Remove academic titles
  humanized = humanized.replace(/What if everything we think about (.*?) is backwards\?/gi, 
    '$1 might be backwards.');
  humanized = humanized.replace(/The Surprising Role of (.*?) in/gi, 
    '$1 affects');
  
  // Simplify formulas
  humanized = humanized.replace(/Myth: (.*?)\. Truth: (.*?)\./gi, 
    'Everyone thinks $1. Actually, $2.');
  
  // Simplify citations
  humanized = humanized.replace(/\(([A-Z][a-z]+ \d{4}), n=([0-9,]+)\)/gi, 
    '($1 study, $2 people)');
  
  // Remove excessive specificity
  humanized = humanized.replace(/boosts? (.*?) by (\d+)% in (\d+) weeks/gi, 
    'changes $1 by $2% in about $3 weeks');
  
  // Simplify mechanisms
  humanized = humanized.replace(/This occurs via (.*?) → (.*?)\./gi, 
    'Happens because $1 leads to $2.');
  
  // Remove action formulas
  humanized = humanized.replace(/Action: Adopt a (.*?) to optimize (.*?)!/gi, 
    'Try $1 for better $2.');
  
  return humanized;
}

