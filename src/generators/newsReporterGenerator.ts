/**
 * NEWS REPORTER GENERATOR
 * Personality: Timely reactions to new studies and breaking health news
 * Voice: Urgent, current, newsworthy
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface NewsReporterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateNewsReporterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<NewsReporterContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  // 🗞️ GET REAL SCRAPED NEWS
  const realNews = await getRealNewsForTopic(topic);
  
  if (realNews) {
    console.log(`[NEWS_REPORTER] 📰 Using real news: "${realNews.headline}"`);
  }
  
  const patterns = getGeneratorPatterns('news_reporter');
  
  const systemPrompt = `You report breaking research and timely science news.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE IDEAL: 200-270 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 270 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

Your personality:
• I love sharing breaking health news and research
• I make new science accessible to everyone
• I focus on what's happening right now in health
• I share the latest findings that matter
• I translate complex research into understandable insights

You can express your personality however feels natural:
• Sometimes report breaking news
• Sometimes analyze recent studies
• Sometimes share emerging trends
• Sometimes explain what new research means
• Sometimes highlight important developments

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags


🎨 CREATE SOMETHING NEW: Invent fresh approaches every time. Surprise people. Experiment wildly.

 news reporter content:
${patterns.examples.map(ex => `• ${ex}`).join('\n')}

⚠️ REMINDER: 260 CHARACTER ABSOLUTE LIMIT ⚠️

The topic, tone, and angle should guide how you express your personality.
Be creative and varied - don't follow the same pattern every time.

What makes news reporting work:
• Recent and timely (not old news)
• Credible sources (reputable journals)
• Clear implications (so what?)
• Accessible (translate jargon)
• Makes people think differently about health

${realNews ? `
Breaking News: ${realNews.headline}
Key Claim: ${realNews.key_claim}
Source: @${realNews.author_username}
Freshness: ${realNews.freshness_score}/100

Frame as NEWS, not just science.
` : ''}

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

${format === 'thread' ? `
Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"}
`}`;

  const userPrompt = realNews 
    ? `Report on: "${realNews.headline}" - ${realNews.key_claim}`
    : `Report breaking science about ${topic}.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
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
      confidence: realNews ? 0.95 : 0.8, // Higher confidence with real news
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[NEWS_REPORTER_GEN] Error:', error.message);
    
    // IMPROVED FALLBACK: News-style framing even without real news
    return {
      content: format === 'thread'
        ? generateHighQualityThreadFallback(topic)
        : generateHighQualitySingleFallback(topic),
      format,
      confidence: 0.7 // Higher confidence with improved fallbacks
    };
  }
}

/**
 * Generate high-quality single tweet fallback with news-style framing
 */
function generateHighQualitySingleFallback(topic: string): string {
  const templates = [
    // Product/Service style
    `${capitalizeFirst(topic)} products just hit major retailers - here's what changed`,
    `Breaking: New ${topic} option now available nationwide`,
    
    // Expert recommendation style
    `Health experts now recommend 3 key changes for ${topic} - here's why`,
    `Top doctors are changing their ${topic} recommendations - what you need to know`,
    
    // Trend/Movement style
    `Why everyone's talking about ${topic} this week (and what it means for you)`,
    `${capitalizeFirst(topic)} trend hits mainstream - 5 things you should know`,
    
    // Regulatory/Official style
    `Health officials update ${topic} guidelines - here's what's different`,
    `Medical community shifts stance on ${topic} - key takeaways`,
    
    // Discovery/Finding style  
    `Doctors identify 7 overlooked factors in ${topic} - most people miss #3`,
    `${capitalizeFirst(topic)} breakthrough: What researchers found that changes everything`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate high-quality thread fallback with news-style framing
 */
function generateHighQualityThreadFallback(topic: string): string[] {
  const threadTemplates = [
    // Product launch style
    [
      `🚨 Major ${topic} products just launched nationwide`,
      `Here's what's different: New formulations, lower prices, and better accessibility`,
      `Key changes doctors want you to know about before trying`,
      `What this means for your health routine (and your wallet)`
    ],
    // Expert consensus style
    [
      `Health experts just updated their ${topic} recommendations`,
      `The science: 3 recent developments that changed the guidance`,
      `What top doctors now recommend (it's different than last year)`,
      `Action steps: How to adjust your approach starting today`
    ],
    // Breakthrough style
    [
      `Researchers identify overlooked factor in ${topic} that changes everything`,
      `The mechanism: Why previous approaches missed this connection`,
      `Real-world impact: What this means for 60% of people trying ${topic}`,
      `Next steps: Specific changes experts recommend based on new findings`
    ],
    // Trend analysis style
    [
      `Why ${topic} suddenly became the #1 health topic this month`,
      `Behind the trend: The data that sparked mainstream attention`,
      `What separates real science from social media hype`,
      `Bottom line: What actually works (according to clinical evidence)`
    ]
  ];
  
  return threadTemplates[Math.floor(Math.random() * threadTemplates.length)];
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
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

