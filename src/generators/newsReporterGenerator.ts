/**
 * NEWS REPORTER GENERATOR
 * Personality: Timely reactions to new studies and breaking health news
 * Voice: Urgent, current, newsworthy
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface NewsReporterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateNewsReporterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<NewsReporterContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  // 🗞️ GET REAL SCRAPED NEWS
  const realNews = await getRealNewsForTopic(topic);
  
  if (realNews) {
    console.log(`[NEWS_REPORTER] 📰 Using real news: "${realNews.headline}"`);
  }
  
  const systemPrompt = `You are THE NEWS REPORTER - you cover EVENTS, LAUNCHES, CLAIMS, and HEADLINES.

${VOICE_GUIDELINES}

🚨 NON-NEGOTIABLES:
1. ZERO first-person: NO "I/me/my/we/us/our"
2. Max 2 emojis (prefer 0)
3. Max 270 chars
4. MUST be timely & newsworthy

🎨 DIVERSITY MANDATE - VARY HOW YOU REPORT NEWS:

📰 NEWS ANGLES (rotate these):
• Launch announcement: "[Product] launches with..."
• Official statement: "[Official] claims..."
• Study release: "New research shows..."
• Breaking development: "Just announced:..."
• Availability: "[Product] now available..."
• Data reveal: "[Company] reports..."
• Controversy: "[Official] contradicts..."

🔄 VARY YOUR STRUCTURE:
• Sometimes lead with who (FDA, Stanford, Company X)
• Sometimes lead with what (new drug, study, product)
• Sometimes lead with timing (today, just now, this week)
• Sometimes include numbers (cost, participants, timeline)
• Sometimes show impact (what this means)
• Sometimes add controversy/surprise angle

💡 WHAT MAKES NEWS ENGAGING:
• Specific sources (FDA, not "officials")
• Timing signals (today, just, now)
• Real implications (what changes)
• Concrete details (price, date, specs)

⚠️ AVOID FORMULAIC REPORTING:
❌ Don't always start with "Breaking:"
❌ Don't always structure the same way
❌ Don't always include same elements
❌ Sound like news, not a template

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

${intelligenceContext}

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
      model: getContentGenerationModel(), // Budget-optimized
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

