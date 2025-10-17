/**
 * NEWS REPORTER GENERATOR
 * Personality: Timely reactions to new studies and breaking health news
 * Voice: Urgent, current, newsworthy
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface NewsReporterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateNewsReporterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<NewsReporterContent> {
  
  const { topic, format, research } = params;
  
  // 🗞️ GET REAL SCRAPED NEWS
  const realNews = await getRealNewsForTopic(topic);
  
  if (realNews) {
    console.log(`[NEWS_REPORTER] 📰 Using real news: "${realNews.headline}"`);
  }
  
  const systemPrompt = `You are THE NEWS REPORTER - you break timely HEADLINES and ANNOUNCEMENTS.

${realNews ? `
🗞️ REAL NEWS BREAKING RIGHT NOW (USE THIS):
Headline: ${realNews.headline}
Key Claim: ${realNews.key_claim}
Source: @${realNews.author_username}
Engagement: ${realNews.viral_score.toLocaleString()} interactions
Posted: ${realNews.posted_at} (${realNews.freshness_score}/100 fresh)
${realNews.study_url ? `Link: ${realNews.study_url}` : ''}

YOU MUST USE THIS REAL NEWS. This is a HEADLINE/ANNOUNCEMENT, not a research study.
Frame it as breaking news, reports, announcements - NOT as "study shows" or "research finds".
` : ''}

🗞️ NEWS REPORTER STYLE (Not research reporter!):

GOOD NEWS HOOKS:
- "Breaking: FDA announces new approval for..."
- "Health officials just reported..."
- "Major announcement: WHO confirms..."
- "Just in: CDC releases new guidelines on..."
- "Developing story: Health agencies warn..."

BAD HOOKS (Too research-focused):
- "New study shows..." ← This is for Data Nerd, not News Reporter
- "Researchers found..." ← This is research, not news
- "MIT 2024 published..." ← This is academic, not headlines

🚨 MANDATORY REQUIREMENTS:

1. MUST START with news language: "Breaking", "Just in", "Reports", "Announces", "Officials confirm"
2. MUST reference the SOURCE: "according to [source]", "says [official]", "per [organization]"
3. MUST include timing: "today", "this morning", "just released", "announced yesterday"
4. MUST include impact/implications: "This means...", "Experts warn...", "Could affect..."
5. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

FOCUS: Headlines, announcements, reports, official statements
NOT: Research studies, clinical trials, academic papers (those are for other generators)

GOOD NEWS EXAMPLES:
- "Breaking: FDA approves first blood test for early Alzheimer's detection"
- "Health officials warn: New variant spreading faster than expected"
- "Just announced: CDC updates vaccination guidelines for adults over 65"
- "Reports confirm: Major recall on popular supplement brand"
- "Developing: WHO declares health emergency in three countries"

GOOD SOURCE ATTRIBUTION:
- "according to FDA officials"
- "per CDC announcement"
- "says WHO spokesperson"
- "health authorities confirm"
- "sources close to the investigation"

GOOD TIMING LANGUAGE:
- "announced this morning"
- "released today"
- "just confirmed"
- "breaking overnight"
- "developing story"

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT FORMAT: Return JSON object with array of 3-5 tweets (150-230 chars each):
Tweet 1: Breaking hook + headline stat
Tweet 2: Full study citation + key finding
Tweet 3: Mechanism (why it works)
Tweet 4: Actionable implication (what to do)
Format your response as JSON.
` : `
OUTPUT FORMAT: Return single tweet as JSON object (180-260 chars):
Breaking hook + citation + stat + implication
Format your response as JSON.
`}`;

  const userPrompt = `${realNews 
    ? `Create content about this REAL breaking news: "${realNews.headline}"

Key finding: ${realNews.key_claim}
${realNews.study_url ? `Study: ${realNews.study_url}` : ''}

${format === 'thread' ? 'Break down this real finding and why it matters right now.' : 'Share this urgent real finding.'}

IMPORTANT: Reference the actual timing (hours/days ago). Use phrases like:
- "Just published" (if < 24 hours old)
- "New study shows" (if < 48 hours old)
- "Recent research" (if < 72 hours old)`
    : `Report breaking research about: ${topic}

${format === 'thread' ? 'Break down new findings and why they matter right now.' : 'Share urgent new finding.'}`
  }`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'news_reporter_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    // Mark news as used if we used real news
    if (realNews) {
      await markNewsAsUsed(realNews.id);
    }
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: realNews ? 0.95 : 0.8 // Higher confidence with real news
    };
    
  } catch (error: any) {
    console.error('[NEWS_REPORTER_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `New research on ${topic} just dropped.`,
            `Study shows surprising finding.`,
            `Why this matters right now.`,
            `What you should know today.`
          ]
        : `New research shows ${topic} works differently than we thought.`,
      format,
      confidence: 0.5
    };
  }
}

/**
 * Get real scraped news for topic
 */
async function getRealNewsForTopic(topic: string): Promise<any | null> {
  try {
    const { NewsCuratorService } = await import('../news/newsCuratorService');
    const curator = NewsCuratorService.getInstance();
    
    // Get fresh, high-credibility, unused news
    const news = await curator.getCuratedNews({
      topic,
      minCredibility: 'medium',
      minFreshnessScore: 60,
      unused: true,
      limit: 1
    });
    
    if (news.length > 0) {
      // Get the full scraped tweet data
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      const { data: scrapedTweet } = await supabase
        .from('health_news_scraped')
        .select('*')
        .eq('tweet_id', news[0].original_tweet_id)
        .single();
      
      return {
        ...news[0],
        author_username: scrapedTweet?.author_username,
        posted_at: scrapedTweet?.posted_at,
        study_url: news[0].study_url
      };
    }
    
    return null;
  } catch (error) {
    console.warn('[NEWS_REPORTER] ⚠️ Could not fetch real news:', error);
    return null;
  }
}

/**
 * Mark news as used
 */
async function markNewsAsUsed(newsId: string): Promise<void> {
  try {
    const { NewsCuratorService } = await import('../news/newsCuratorService');
    const curator = NewsCuratorService.getInstance();
    await curator.markNewsAsUsed(newsId, `post_${Date.now()}`);
    console.log(`[NEWS_REPORTER] ✅ Marked news ${newsId} as used`);
  } catch (error) {
    console.warn('[NEWS_REPORTER] ⚠️ Could not mark news as used:', error);
  }
}

