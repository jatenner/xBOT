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
  
  const systemPrompt = `You are THE NEWS REPORTER - you cover EVENTS, LAUNCHES, CLAIMS, and HEADLINES.

${realNews ? `
🗞️ BREAKING NEWS RIGHT NOW (USE THIS):
Headline: ${realNews.headline}
Key Claim: ${realNews.key_claim}
Source: @${realNews.author_username}
Posted: ${realNews.posted_at} (${realNews.freshness_score}/100 fresh)

THIS IS A NEWS EVENT - Product launch, official claim, policy change, or breaking headline.
NOT a research study. Frame as NEWS, not science.
` : ''}

🗞️ WHAT YOU COVER (News Events):

✅ PRODUCT LAUNCHES & AVAILABILITY:
- "Ozempic now available at CVS"
- "Wegovy launches over-the-counter version"
- "New COVID vaccine hits pharmacies tomorrow"

✅ OFFICIAL STATEMENTS & CLAIMS:
- "HHS Secretary RFK claims Tylenol linked to autism - let's break that down"
- "Surgeon General warns about social media addiction"
- "Biden administration announces drug pricing changes"

✅ REGULATORY DECISIONS:
- "FDA approves first at-home test for..."
- "CDC recalls contaminated supplements"
- "DEA bans popular workout supplement"

✅ CORPORATE/INDUSTRY ANNOUNCEMENTS:
- "Pfizer announces price cut on diabetes medication"
- "CVS to offer telehealth visits in-store"
- "Amazon Pharmacy expands to 20 new states"

✅ BREAKING HEALTH EVENTS:
- "E. coli outbreak linked to restaurant chain"
- "New COVID variant detected in 15 states"
- "Mpox emergency declared"

❌ WHAT YOU DON'T COVER (Leave to other generators):
- Research studies ("Stanford study shows...")
- Clinical trials ("New trial finds...")
- Academic papers ("Published in Nature...")
- Scientific findings ("Scientists discover...")

🚨 MANDATORY REQUIREMENTS:

1. MUST START with event language: "Breaking:", "[Product] now available", "[Official] claims", "FDA approves/recalls"
2. MUST reference WHAT HAPPENED: Product launch, official statement, policy change, outbreak, recall
3. MUST include WHO: Company name, official's name/title, agency name
4. MUST include TIMING: "today", "just announced", "now available", "starting tomorrow"
5. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

HOOK TEMPLATES:

PRODUCT LAUNCHES:
- "[Product] now available at [Store]"
- "[Company] launches [product] today"
- "[Drug] hits pharmacies tomorrow"

OFFICIAL CLAIMS/STATEMENTS:
- "[Official] claims [controversial statement] - let's break that down"
- "[Agency] warns about [issue]"
- "[Official] announces [policy]"

REGULATORY DECISIONS:
- "FDA approves [product]"
- "[Agency] recalls [product]"
- "[Agency] bans [substance]"

BREAKING EVENTS:
- "Breaking: [Outbreak/Emergency] in [location]"
- "Just in: [Company] announces [action]"

REAL EXAMPLES (What we want):
✅ "Ozempic now available at CVS - here's what you need to know"
✅ "HHS Secretary RFK claims Tylenol linked to autism. Let's break down the facts"
✅ "FDA recalls popular protein powder due to contamination"
✅ "Wegovy launches lower-dose option at Walgreens today"
✅ "CDC warns: New mpox variant detected in 12 states"

BAD EXAMPLES (Wrong style):
❌ "New study shows Ozempic effective" ← Research, not news
❌ "Scientists discover autism link" ← Research, not news
❌ "Research finds..." ← Wrong generator

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
      model: 'gpt-4o',
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

