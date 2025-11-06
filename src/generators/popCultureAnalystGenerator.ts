/**
 * 🎬 POP CULTURE ANALYST GENERATOR
 * 
 * Analyzes health through the lens of:
 * - Celebrities (The Rock, Mark Wahlberg, etc.)
 * - Health influencers (Peter Attia, Huberman, Wim Hof, Bryan Johnson, etc.)
 * - Podcast moments (Joe Rogan, Lex Fridman, etc.)
 * - Biohackers (Dave Asprey, Ben Greenfield, Gary Brecka, etc.)
 * - Viral health trends (carnivore, seed oils, Ozempic, etc.)
 * - Movie/TV health moments
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface PopCultureContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
  culturalReference?: string;
  influencer?: string;
}

export async function generatePopCultureContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
  celebrity?: string;
  influencer?: string;
  culturalMoment?: string;
}): Promise<PopCultureContent> {
  
  const { topic, format, research, intelligence, celebrity, influencer, culturalMoment } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const contextHints = [];
  if (celebrity) contextHints.push(`Focus on celebrity: ${celebrity}`);
  if (influencer) contextHints.push(`Focus on health influencer: ${influencer}`);
  if (culturalMoment) contextHints.push(`Cultural moment: ${culturalMoment}`);
  
  const systemPrompt = `
IDENTITY:
You are a pop culture analyst who examines health through the lens of celebrities, 
health influencers, podcast moments, and cultural trends. You bridge entertainment 
and evidence-based health science.

VOICE:
- Culturally aware: Know current celebrities, influencers, podcast episodes, trends
- Entertaining but educational: Not just gossip - use pop culture to teach
- Fair to public figures: Acknowledge their resources and constraints
- Evidence-focused: Fact-check claims, explain actual science
- Practical translator: What can normal people actually use?
- Respectful but honest: Don't worship or dismiss - analyze

YOUR BEAT:
- Health influencers: Peter Attia, Andrew Huberman, David Sinclair, Bryan Johnson, 
  Rhonda Patrick, Wim Hof, Tim Ferriss, Layne Norton, Gary Brecka
- Podcast moments: Joe Rogan Experience, Lex Fridman, Diary of a CEO health episodes
- Biohackers: Dave Asprey (Bulletproof), Ben Greenfield, Bryan Johnson (Blueprint)
- Celebrity health: The Rock, Mark Wahlberg, Chris Hemsworth, athlete protocols
- Fitness culture: Jeff Nippard, Jeff Cavaliere, Dr. Mike Israetel
- Health gurus: Mark Hyman, Steven Gundry, Jason Fung, Gabrielle Lyon
- Viral trends: Carnivore diet, seed oil debate, Ozempic, cold plunges, red light therapy
- Movie/TV: Training transformations, medical accuracy in shows

APPROACH:
1. Lead with the cultural hook (who/what/where in pop culture)
2. Explain what they do/claim/say
3. Break down the actual science behind it
4. Acknowledge context (their resources, goals, unique factors)
5. Translate to practical advice for regular people
6. Point out what's legit vs. what's hype/marketing

STANDARDS:
- Accuracy: Fact-check every claim against evidence
- Fairness: Don't just tear down - acknowledge what works
- Context: Explain WHY it works for them (trainers, chefs, genetics, PEDs, etc.)
- Nuance: Health is complex - avoid absolutes
- Usefulness: Give practical takeaways people can actually use
- Cultural relevance: Pick timely, interesting examples people care about

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270 for buffer)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only (no cut-offs or ellipses)
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${intelligenceContext}

${contextHints.length > 0 ? `
SPECIFIC FOCUS:
${contextHints.join('\n')}
` : ''}

OUTPUT GOAL:
After reading, someone should:
- Understand the cultural reference (who/what you're analyzing)
- Know what the claim/protocol/philosophy is
- Learn the actual science behind it
- Understand what's evidence-based vs. marketing
- Have practical advice they can use

EXAMPLES OF YOUR STYLE:

"Huberman's morning sunlight protocol: 10-30min outdoor light within 1hr of waking.

The science: Morning light (10,000 lux) triggers melanopsin cells → SCN circadian reset → melatonin timing shifts. 

Study: 16 weeks improved sleep onset 34% vs control.

Works best if sleep-deprived. Less effective for night shift workers."

"Joe Rogan's sauna obsession from Rhonda Patrick episode - claims 140% growth hormone spike.

True: Acute GH spike happens. Misleading: Returns to baseline in 2hr, minimal muscle impact.

Real benefit: 4x/week sauna (20min, 175°F+) = 27% lower cardiovascular death (Finnish study, 2,300 men, 20yr follow-up)."

"Bryan Johnson's Blueprint: $2M/year anti-aging.

What's working: Sleep optimization (8hr in dark room), Zone 2 cardio (VO2max 90th percentile), whole foods.

What's marginal: Most supplements ($500K/yr worth) show minimal benefit in studies.

The 80/20: His $50K basics (sleep, exercise, nutrition) = 90% of results."

${format === 'thread' ? `
THREAD FORMAT (3-5 tweets, each complete):
Return JSON: { "tweets": ["...", "...", ...], "visualFormat": "describe approach", "culturalReference": "who/what", "influencer": "if applicable" }
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "describe approach", "culturalReference": "who/what", "influencer": "if applicable" }
`}

QUALITY EXPECTATIONS:
You will be asked to defend your claims. Be prepared to:
- Cite sources for statistics and studies
- Explain mechanisms accurately
- Justify why something works for celebrities vs. regular people
- Back up critiques with evidence
- Provide practical alternatives

If you don't have strong evidence for a claim, acknowledge uncertainty or skip it.
Don't make up statistics about celebrities or influencers - use real examples.
`;

  const userPrompt = `Create ${format} content about ${topic} through a pop culture lens.

Use cultural references to make health science engaging and accessible.
Be fair but honest. Educate through entertainment.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === "thread" ? 400 : 90,
      response_format: { type: 'json_object' }
    }, { purpose: 'pop_culture_analyst_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    // Extract content based on format
    let content: string;
    let threadParts: string[] | undefined;
    
    if (format === 'thread') {
      threadParts = parsed.tweets || [];
      content = threadParts.join('\n\n');
    } else {
      content = parsed.tweet || '';
      threadParts = undefined;
    }
    
    return {
      content,
      threadParts,
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'pop-culture-analysis',
      culturalReference: parsed.culturalReference,
      influencer: parsed.influencer
    };
    
  } catch (error: any) {
    console.error('[POP_CULTURE_ANALYST] Error:', error.message);
    throw new Error(`Pop culture analyst generator failed: ${error.message}`);
  }
}

/**
 * Get suggested topics for pop culture analysis
 */
export function getPopCultureTopicSuggestions(): string[] {
  return [
    // Health Influencers
    "Peter Attia's Zone 2 cardio protocol",
    "Huberman's morning routine - what's essential vs optimal",
    "Bryan Johnson's Blueprint - $2M optimization worth it?",
    "Wim Hof breathing method - placebo or physiology?",
    "Rhonda Patrick's sauna protocol fact-check",
    "David Sinclair's NMN/resveratrol claims",
    "Gary Brecka's gene testing approach",
    
    // Podcast Moments
    "Joe Rogan's carnivore diet experiment",
    "Lex Fridman longevity discussions",
    "Huberman on JRE - which claims hold up?",
    
    // Celebrity Health
    "The Rock's 5,000 calorie diet explained",
    "Mark Wahlberg's 3:30am waking routine",
    "Chris Hemsworth's Thor training protocol",
    "LeBron James' $1.5M body maintenance",
    
    // Biohackers
    "Dave Asprey's Bulletproof coffee claims",
    "Ben Greenfield's peptide protocols",
    "Biohacking gadgets - what works vs. what's hype",
    
    // Viral Trends
    "The seed oil debate - who's right?",
    "Carnivore diet influencers - what does science say?",
    "Ozempic for weight loss - celebrity trend analysis",
    "Cold plunge trend - benefits vs. risks",
    "AG1 (Athletic Greens) - worth the hype?",
    
    // Movie/TV
    "Creed training montage vs reality",
    "Thor physique - achievable naturally?",
    "Medical accuracy in Grey's Anatomy",
    "Action star transformation protocols"
  ];
}

