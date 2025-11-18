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
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<NewsReporterContent> {
  
  const { topic, angle = 'journalistic', tone = 'balanced', formatStrategy = 'news-focused', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  // 🗞️ GET REAL SCRAPED NEWS (curated → strict)
  const realNews = await getRealNewsForTopic(topic);
  
  if (realNews) {
    console.log(`[NEWS_REPORTER] 📰 Using real news: "${realNews.headline}"`);
  }
  
  const patterns = getGeneratorPatterns('news_reporter');
  
  // Compute AI-driven policy only if we have real news
  const policy = realNews ? computeNewsPolicy(realNews) : null;

  const systemPrompt = `
IDENTITY:
You are a health news reporter who covers breaking research, new studies,
and timely health developments with appropriate context and skepticism.

VOICE:
- Timely and current: Cover what just published or emerged
- Journalistic: Report fairly with context, naturally use news-style formatting
- Contextualizing: Place findings in broader research landscape
- Skeptical but fair: Note limitations, don't oversell
- Accessible: Make new research understandable
- News-native: You naturally think in news formats - headlines, breaking news style, journalistic structure

VISUAL PERSONALITY:
You naturally format content like a news reporter would:
- Breaking news: "⚡ BREAKING:" or "NEW STUDY:" prefixes when appropriate
- Headline-style openings for important findings
- Journalistic structure: Lead with what, then context, then implications
- News formatting: Clean, scannable, professional news presentation
- You experiment with different news formats and learn what works

STANDARDS:
- Timeliness: Cover actual recent developments
- Context: Don't sensationalize single studies
- Accuracy: Report findings correctly
- Skepticism: Note need for replication
- Usefulness: Explain what this means

CONSTRAINTS:
- Format: Twitter (MAXIMUM 200 characters - optimized for viral engagement)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

🎯 CRITICAL: RELATABLE NEWS REPORTING
Even if the topic is technical, report it in relatable language:
- "Myostatin research" → "New research on muscle growth hormones"
- "BDNF study" → "Study on your brain's growth factor"
- Use everyday language that normal people understand
- Make news INTERESTING and ACCESSIBLE, not academic

ALWAYS ask: "Would a normal person care about this news?" If no, reframe it.

${realNews ? `
BREAKING NEWS:
${realNews.headline}
Key claim: ${realNews.key_claim}
Source: @${realNews.author_username}
Report this with appropriate context.
` : ''}

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
This is newly published - contextualize it.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the new finding is
- Who conducted it and how
- What it adds to existing knowledge
- What limitations exist
- What it means practically (if anything)

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a news-style format that matches your personality" }
Let your news reporter personality guide the visual format - experiment with news styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a news-style format that matches your personality" }
Express your news reporter personality naturally - use news formatting that feels right for this story.
`}

You will be asked to defend your reporting. Be prepared to:
- Cite the study/source accurately
- Explain study design and limitations
- Contextualize within broader research
- Justify practical implications claimed
- No hashtags
- Max 1 emoji (prefer 0)`;

  const labelPrefix = realNews
    ? (policy?.label === 'breaking' ? '⚡ Breaking — ' : 'News — ')
    : '';

  const recencyBadge = realNews ? policy?.recencyBadge ?? '' : '';

  const userPrompt = realNews 
    ? `Report on: "${realNews.headline}" - ${realNews.key_claim}. Use label prefix "${labelPrefix}" and include recency badge "${recencyBadge}" and source "@${realNews.author_username}" at the end like: — ${realNews.author_username}.`
    : `NO REAL NEWS AVAILABLE. Do NOT generate content.`;

  try {
    // If no real news, skip instead of fallback (enforce real-news-only)
    if (!realNews) {
      throw new Error('NO_REAL_NEWS_AVAILABLE');
    }

    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === "thread" ? 400 : 90, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'news_reporter_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    // Mark news as used
    await markNewsAsUsed(realNews.id);
    
    // Post-process to ensure distinct labeling and source trail
    const extracted = validateAndExtractContent(parsed, format, 'GENERATOR');
    const contentWithLabel = applyNewsStyling(extracted, {
      label: policy?.label || 'news',
      recencyBadge: policy?.recencyBadge || '',
      sourceUsername: realNews.author_username
    });

    return {
      content: contentWithLabel,
      format,
      confidence: 0.95,
      visualFormat: 'news-report'
    };
    
  } catch (error: any) {
    console.error('[NEWS_REPORTER_GEN] Error:', error.message);
    
    // Hard skip when no real news; caller can decide to pick another generator
    throw error;
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
 * Compute AI-driven news policy decisions
 * - label: 'breaking' vs 'news'
 * - recency badge: (today)/(24h)/(this week)
 */
function computeNewsPolicy(realNews: any): { label: 'breaking' | 'news'; recencyBadge: string } {
  const postedAt = realNews.posted_at ? new Date(realNews.posted_at).getTime() : Date.now();
  const ageHours = Math.max(0, (Date.now() - postedAt) / 36e5);
  const credibility = (realNews.source_credibility || 'medium') as 'high' | 'medium' | 'low';
  const viral = Number(realNews.viral_score || 0);
  const freshness = Number(realNews.freshness_score || 0);

  // Simple learned-friendly scoring (weights can be adjusted online later)
  const recencyScore = Math.max(0, 100 - Math.min(100, ageHours)); // 0–100
  const credScore = credibility === 'high' ? 100 : credibility === 'medium' ? 65 : 35;
  const score = 0.4 * recencyScore + 0.3 * credScore + 0.2 * freshness + 0.1 * Math.min(100, viral);

  const label: 'breaking' | 'news' = score >= 75 ? 'breaking' : 'news';

  const recencyBadge =
    ageHours < 6 ? '(today)' : ageHours < 24 ? '(24h)' : ageHours < 168 ? '(this week)' : '';

  return { label, recencyBadge };
}

/**
 * Apply distinct news styling to content
 * - Prepend label + keep thread structure
 * - Append source at end of each tweet or single
 */
function applyNewsStyling(
  extracted: string | string[],
  opts: { label: 'breaking' | 'news'; recencyBadge: string; sourceUsername?: string }
): string | string[] {
  const prefix = opts.label === 'breaking' ? '⚡ Breaking — ' : 'News — ';
  const sourceTrail = opts.sourceUsername ? ` — ${opts.sourceUsername}` : '';
  const recency = opts.recencyBadge ? ` ${opts.recencyBadge}` : '';

  if (Array.isArray(extracted)) {
    return extracted.map((t, idx) => {
      if (idx === 0) {
        return `${prefix}${t}${recency}${sourceTrail}`.trim();
      }
      return `${t}${sourceTrail}`.trim();
    });
  }
  return `${prefix}${extracted}${recency}${sourceTrail}`.trim();
}

/**
 * Get real scraped news for topic
 * FIXED: Uses flexible keyword matching instead of exact topic match
 */
async function getRealNewsForTopic(topic: string): Promise<any | null> {
  try {
    const { NewsCuratorService } = await import('../news/newsCuratorService');
    const curator = NewsCuratorService.getInstance();
    
    // Extract keywords from topic (e.g., "sleep optimization" -> ["sleep", "optimization"])
    const topicKeywords = extractHealthKeywords(topic);
    
    // Try exact match first
    let news = await curator.getCuratedNews({
      topic,
      minCredibility: 'medium',
      minFreshnessScore: 60,
      unused: true,
      limit: 1
    });
    
    // If no exact match, try keyword-based matching
    if (news.length === 0 && topicKeywords.length > 0) {
      console.log(`[NEWS_REPORTER] 🔍 No exact match for "${topic}", trying keywords: ${topicKeywords.join(', ')}`);
      
      // Get all unused health news
      const allNews = await curator.getCuratedNews({
        minCredibility: 'medium',
        minFreshnessScore: 60,
        unused: true,
        limit: 30 // Get more to find best match
      });
      
      if (allNews.length === 0) {
        console.log(`[NEWS_REPORTER] ⚠️ No unused health news available at all`);
        return null;
      }
      
      // Find news that matches any keyword
      const matchedNews = allNews.filter(item => {
        const newsTopic = item.topic?.toLowerCase() || '';
        const headline = item.headline?.toLowerCase() || '';
        const keyClaim = item.key_claim?.toLowerCase() || '';
        const combined = `${newsTopic} ${headline} ${keyClaim}`;
        
        // Check if any keyword appears in the news
        return topicKeywords.some(keyword => 
          combined.includes(keyword.toLowerCase())
        );
      });
      
      if (matchedNews.length > 0) {
        // Sort by relevance (more keyword matches = better)
        matchedNews.sort((a, b) => {
          const aText = `${a.topic} ${a.headline} ${a.key_claim}`.toLowerCase();
          const bText = `${b.topic} ${b.headline} ${b.key_claim}`.toLowerCase();
          const aMatches = topicKeywords.filter(k => aText.includes(k.toLowerCase())).length;
          const bMatches = topicKeywords.filter(k => bText.includes(k.toLowerCase())).length;
          return bMatches - aMatches; // More matches first
        });
        
        news = [matchedNews[0]]; // Use best match
        console.log(`[NEWS_REPORTER] ✅ Found keyword match: "${news[0].topic}" for topic "${topic}"`);
      } else {
        // FALLBACK: If no keyword match, use the most relevant health news anyway
        // This ensures news_reporter can still work even with imperfect matches
        console.log(`[NEWS_REPORTER] ⚠️ No keyword match found, using best available health news as fallback`);
        
        // Filter to only health-related topics (exclude non-health like "quantum physics", "births", etc.)
        const healthTopics = ['supplement', 'nutrition', 'mental health', 'health', 'wellness', 
                             'exercise', 'fitness', 'medication', 'treatment', 'research', 
                             'immunology', 'medical devices'];
        const healthNews = allNews.filter(item => 
          healthTopics.some(ht => item.topic?.toLowerCase().includes(ht))
        );
        
        if (healthNews.length > 0) {
          // Use the freshest, most viral health news
          healthNews.sort((a, b) => {
            const scoreA = a.freshness_score + (a.viral_score / 1000);
            const scoreB = b.freshness_score + (b.viral_score / 1000);
            return scoreB - scoreA;
          });
          
          news = [healthNews[0]];
          console.log(`[NEWS_REPORTER] ✅ Using fallback health news: "${news[0].topic} - ${news[0].headline.substring(0, 50)}..."`);
        }
      }
    }
    
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
 * Extract health-related keywords from topic string
 * Handles topics like "sleep optimization (health: circadian rhythm)" -> ["sleep", "optimization", "circadian", "rhythm"]
 * IMPROVED: Also includes related/synonym keywords for better matching
 */
function extractHealthKeywords(topic: string): string[] {
  // Remove parenthetical content but keep the words inside
  const cleaned = topic
    .replace(/\([^)]*\)/g, ' ') // Remove parentheses but keep content
    .replace(/[^\w\s]/g, ' ') // Remove special chars
    .toLowerCase()
    .trim();
  
  // Split into words
  const words = cleaned.split(/\s+/).filter(w => w.length > 2); // Filter out short words
  
  // Health-related keywords to prioritize
  const healthKeywords = [
    'sleep', 'nutrition', 'exercise', 'fitness', 'health', 'wellness', 'diet',
    'supplement', 'vitamin', 'protein', 'metabolism', 'cardio', 'strength',
    'recovery', 'mental', 'brain', 'cognitive', 'immune', 'hormone', 'stress',
    'gut', 'microbiome', 'circadian', 'fasting', 'keto', 'muscle', 'bone',
    'heart', 'blood', 'sugar', 'insulin', 'testosterone', 'estrogen', 'thyroid',
    'inflammation', 'anxiety', 'depression', 'focus', 'memory', 'energy',
    'longevity', 'aging', 'biohack', 'optimization', 'performance'
  ];
  
  // Extract direct matches
  const directMatches = words.filter(w => healthKeywords.includes(w));
  
  // Extract partial matches (word contains keyword or vice versa)
  const partialMatches = words.filter(word => 
    healthKeywords.some(hk => word.includes(hk) || hk.includes(word))
  );
  
  // Add related keywords based on topic context
  const relatedKeywords: string[] = [];
  const topicLower = topic.toLowerCase();
  
  // Sleep-related
  if (topicLower.includes('sleep') || topicLower.includes('circadian') || topicLower.includes('rest')) {
    relatedKeywords.push('sleep', 'rest', 'recovery', 'mental health', 'brain');
  }
  
  // Nutrition-related
  if (topicLower.includes('nutrition') || topicLower.includes('diet') || topicLower.includes('food') || topicLower.includes('eating')) {
    relatedKeywords.push('nutrition', 'diet', 'food', 'supplement', 'vitamin', 'health');
  }
  
  // Exercise-related
  if (topicLower.includes('exercise') || topicLower.includes('workout') || topicLower.includes('cardio') || topicLower.includes('fitness')) {
    relatedKeywords.push('exercise', 'fitness', 'cardio', 'strength', 'recovery', 'muscle');
  }
  
  // Mental health-related
  if (topicLower.includes('mental') || topicLower.includes('brain') || topicLower.includes('cognitive') || topicLower.includes('anxiety') || topicLower.includes('depression')) {
    relatedKeywords.push('mental health', 'brain', 'cognitive', 'anxiety', 'depression', 'stress');
  }
  
  // Gut health-related
  if (topicLower.includes('gut') || topicLower.includes('microbiome') || topicLower.includes('digest')) {
    relatedKeywords.push('gut', 'microbiome', 'nutrition', 'health', 'immune');
  }
  
  // Combine all keywords and remove duplicates
  const allKeywordsArray = [...directMatches, ...partialMatches, ...relatedKeywords];
  const uniqueKeywords = Array.from(new Set(allKeywordsArray));
  
  return uniqueKeywords;
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

