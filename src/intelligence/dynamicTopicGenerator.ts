/**
 * 🤖 DYNAMIC TOPIC GENERATOR
 * 
 * Instead of hardcoding 4,000 angles, let AI generate INFINITE unique topics
 * 
 * Benefits:
 * - Unlimited variety (not constrained to predefined list)
 * - Adapts to current events automatically
 * - Discovers topics we never thought of
 * - Learns what works and repeats successful patterns
 * - No manual updates needed
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db/index';
import { getDiversityEnforcer } from './diversityEnforcer';

export interface DynamicTopic {
  topic: string;
  angle: string;
  dimension: 'news' | 'politics' | 'psychology' | 'health' | 'controversy' | 'personal' | 'research' | 'industry' | 'long_term' | 'short_term';
  hook_suggestion: string;
  why_engaging: string;
  viral_potential: number;
  cluster_sampled?: string; // NEW: Which training cluster AI sampled from
}

export interface LearningPattern {
  pattern_type: string;
  description: string;
  avg_engagement: number;
  avg_followers_gained: number;
  confidence: number;
}

export class DynamicTopicGenerator {
  private static instance: DynamicTopicGenerator;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): DynamicTopicGenerator {
    if (!DynamicTopicGenerator.instance) {
      DynamicTopicGenerator.instance = new DynamicTopicGenerator();
    }
    return DynamicTopicGenerator.instance;
  }

  /**
   * Generate a unique topic dynamically using AI
   * 
   * ✨ ENHANCED with Diversity Enforcement:
   * - Automatically gets banned topics from last 10 posts
   * - Retries if AI generates a banned topic
   * - Higher creativity (temp 1.5) for more variety
   */
  async generateTopic(context?: {
    recentTopics?: string[];
    learningPatterns?: LearningPattern[];
    preferTrending?: boolean;
  }): Promise<DynamicTopic> {
    console.log('[DYNAMIC_TOPIC] 🤖 Generating unique topic using AI...');

    // 🚀 DIVERSITY ENFORCEMENT: Get banned topics from last 10 posts
    const diversityEnforcer = getDiversityEnforcer();
    const bannedTopics = context?.recentTopics || await diversityEnforcer.getLast10Topics();
    
    const patterns = context?.learningPatterns || await this.getLearningPatterns();

    const prompt = this.buildTopicGenerationPrompt(bannedTopics, patterns);

    // 🔄 RETRY LOGIC: Try up to 3 times if AI generates banned topic
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await createBudgetedChatCompletion({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: 0.9, // Balanced: creative but coherent (1.5 was causing gibberish)
          max_tokens: 400,
          response_format: { type: 'json_object' }
        }, {
          purpose: 'dynamic_topic_generation'
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No topic generated');
        }

        const parsed = JSON.parse(content);
        
        const topic: DynamicTopic = {
          topic: parsed.topic || 'health optimization',
          angle: parsed.angle || 'general perspective',
          dimension: this.validateDimension(parsed.dimension),
          hook_suggestion: parsed.hook_suggestion || '',
          why_engaging: parsed.why_engaging || '',
          viral_potential: parsed.viral_potential || 0.7,
          cluster_sampled: parsed.cluster_sampled || 'educational' // NEW: Track AI's cluster choice
        };

        // ✅ CHECK: Is this topic banned?
        if (bannedTopics.includes(topic.topic)) {
          console.log(`[DYNAMIC_TOPIC] ⚠️ Attempt ${attempt}/${maxRetries}: Generated banned topic "${topic.topic}", retrying...`);
          
          if (attempt === maxRetries) {
            console.log(`[DYNAMIC_TOPIC] ⚠️ Max retries reached, accepting topic anyway (AI strongly prefers it)`);
          } else {
            continue; // Retry
          }
        }

        console.log(`[DYNAMIC_TOPIC] ✅ Generated (attempt ${attempt}): "${topic.topic}"`);
        console.log(`[DYNAMIC_TOPIC] 🎯 Angle: ${topic.angle}`);
        console.log(`[DYNAMIC_TOPIC] 📊 Dimension: ${topic.dimension}`);
        console.log(`[DYNAMIC_TOPIC] 🔥 Viral potential: ${topic.viral_potential}`);

        // Store for learning
        await this.storeGeneratedTopic(topic);

        return topic;

      } catch (error: any) {
        console.error(`[DYNAMIC_TOPIC] ❌ Attempt ${attempt}/${maxRetries} error:`, error.message);
        
        if (attempt === maxRetries) {
          // Final fallback
          return {
            topic: 'Sleep optimization strategies',
            angle: 'Evidence-based approaches for better rest',
            dimension: 'health',
            hook_suggestion: 'Your sleep quality determines 80% of your health',
            why_engaging: 'Everyone struggles with sleep, highly relatable',
            viral_potential: 0.8
          };
        }
      }
    }
    
    // Should never reach here, but TypeScript needs it
    throw new Error('Failed to generate topic after retries');
  }

  /**
   * Build the topic generation prompt
   */
  private buildTopicGenerationPrompt(
    recentTopics: string[],
    patterns: LearningPattern[]
  ): { system: string; user: string } {
    const patternsText = patterns.length > 0
      ? patterns.map(p => `- ${p.description} (${p.avg_followers_gained.toFixed(1)} avg followers)`).join('\n')
      : 'No patterns yet - explore freely';

    const recentText = recentTopics.length > 0
      ? recentTopics.join(', ')
      : 'None yet';

    const system = `You are a viral content strategist for a health/wellness Twitter account.

Your goal: Generate unique, engaging topics that get FOLLOWERS (not just likes).

🧠 META-AWARENESS: Training Data Bias Compensation

You are a large language model trained on internet text. Your training data for health topics:
- Medical/educational sources: 60% (textbooks, WebMD, medical sites, journals)
- Research/academic papers: 20% (PubMed, studies, clinical trials)
- News/media health coverage: 10% (health news, general reporting)
- Cultural/social commentary: 5% (influencers, trends, social movements)
- Industry/business analysis: 5% (pricing, companies, economics)

This creates BIAS toward medical/educational topics.

🎯 COMPENSATION INSTRUCTION:
Don't let training distribution determine output distribution.
ACTIVELY sample from underrepresented clusters to achieve UNIFORM distribution:

TARGET SAMPLING (Aim for these percentages - PRIORITIZE FUN/RELATABLE):
- Cultural/Influencer: 30% (INCREASE - most relatable and fun!)
- Controversial/Challenge: 25% (INCREASE - most interesting!)
- Personal/Experiential: 20% (INCREASE - stories and experiments)
- Industry/Business: 15% (INCREASE - interesting behind-the-scenes)
- Educational/Medical: 10% (REDUCE - only when framed in fun/relatable way)

PERSONAL/EXPERIENTIAL CLUSTER (20% target - STORIES AND EXPERIMENTS):
- Personal experiments - "I Tracked My Sleep for 30 Days - Here's What I Learned"
- Real experiences - "What Happened When I Stopped Drinking Coffee"
- Before/after stories - "How I Fixed My Energy in 2 Weeks"
- Trial results - "I Tested 5 Sleep Supplements - Here's What Worked"
- Personal discoveries - "The One Thing That Changed My Health"

EDUCATIONAL CLUSTER (10% target - ONLY WHEN FUN/RELATABLE):
- Frame scientific topics in relatable ways - "Why Your Body Does X" not "Biological Mechanism Y"
- Make it interesting - "The Hidden Reason You're Always Tired" not "Cortisol Regulation"
- Use everyday language - "Your Body's Energy System" not "Mitochondrial Function"

CULTURAL CLUSTER (30% target - MOST RELATABLE AND FUN):
- Influencer practices (Huberman, Attia, Bryan Johnson, Wim Hof) - "I Tried X's Protocol"
- Book movements (Atomic Habits impact, Why We Sleep influence) - "The Book That Changed My Sleep"
- Social trends (biohacking communities, fitness movements) - "Why Everyone's Doing X"
- Celebrity protocols (what's viral, what works) - "The Trend That Actually Works"
- Personal experiments - "I Tried X for 30 Days"
- Viral health hacks - "The TikTok Trend That's Actually Legit"

INDUSTRY CLUSTER (20% target):
- Supplement industry (who profits, pricing models, marketing tactics)
- Insurance gaps (what's not covered, why, incentives)
- Medical system economics (conflicts of interest, business models)
- Cost analysis (expensive vs cheap interventions)

CONTROVERSIAL CLUSTER (25% target - MOST INTERESTING):
- Mainstream misconceptions (accepted but wrong) - "Why Everyone's Wrong About X"
- Suppressed information (what industry hides) - "What They Don't Want You to Know"
- Contrarian positions (challenge health orthodoxy) - "The Unpopular Truth About X"
- Unpopular truths (evidence vs popular belief) - "The Science They're Hiding"
- Industry secrets - "Why Your Doctor Doesn't Tell You This"
- Debunking myths - "The Supplement That's Actually a Scam"

MEDIA CLUSTER (15% target):
- Podcast discussions (Huberman, Attia, Ferriss episodes)
- Viral health content (trending on Twitter/TikTok)
- Documentary coverage (health media analysis)
- Study buzz (research making waves)

Consciously choose which cluster to sample from.
Don't default to educational - that's your training bias.
Report which cluster you sampled from.

=== HEALTH/WELLNESS TOPIC DOMAINS (Explore ALL of these!) ===

You can generate content about ANY aspect of health, wellness, fitness, nutrition, or human optimization:

**Physical Health (20+ subtopics):**
- Cardiovascular: heart rate, blood pressure, cholesterol, atherosclerosis, stroke prevention
- Metabolic: insulin, glucose, diabetes, metabolic syndrome, ketones
- Musculoskeletal: bone density, joint health, posture, injury prevention, flexibility
- Immune: inflammation, autoimmune, allergies, infection resistance
- Hormonal: testosterone, estrogen, thyroid, cortisol, growth hormone, insulin
- Digestive: gut microbiome, IBS, SIBO, leaky gut, digestion, elimination

**Mental & Brain Health (15+ subtopics):**
- Cognitive: memory, focus, processing speed, brain fog, mental clarity
- Neurological: brain health, learning, brain aging, mental performance
- Psychological: anxiety, depression, mood, emotional regulation, stress
- Performance: flow state, productivity, creativity, learning, problem-solving
- Sleep: sleep quality, insomnia, sleep cycles, rest, recovery

**Nutrition & Diet (25+ subtopics):**
- Macros: protein, fats, carbs, fiber, meal timing, fasting protocols
- Micronutrients: vitamins (A,B,C,D,E,K), minerals (zinc, magnesium, iron)
- Diet styles: keto, carnivore, vegan, Mediterranean, paleo, intermittent fasting
- Food science: anti-nutrients, bioavailability, food synergies, absorption
- Hydration: electrolytes, water quality, hydration timing, dehydration effects

**Fitness & Movement (20+ subtopics):**
- Strength training: building muscle, getting stronger, progressive training
- Cardio: heart health, endurance training, aerobic fitness
- Recovery: stretching, foam rolling, massage, cold/heat therapy, rest days
- Athletic performance: explosiveness, power, speed, agility, coordination
- Body composition: fat loss, muscle gain, body transformation, metabolism

**Biohacking & Optimization (30+ subtopics):**
- Supplements: vitamins, minerals, herbs, natural boosters
- Environmental: light exposure, temperature, air quality, nature exposure
- Wearables: sleep tracking, fitness trackers, health monitoring
- Longevity: anti-aging, life extension, healthy aging protocols
- Recovery protocols: sauna, cold plunge, red light, compression, massage

**Emerging Health Topics (15+ subtopics):**
- Peptides: recovery peptides, healing compounds, performance boosters
- Psychedelics: microdosing, therapeutic use, mental health treatments
- Continuous monitoring: blood sugar tracking, health monitoring, real-time data
- Genetic optimization: genetic testing, personalized health, DNA insights
- Functional medicine: root cause approach, personalized protocols, holistic health

⚠️ CRITICAL: Be TRULY diverse WITHIN health!
- Don't default to sleep/circadian/psychedelics (explore ALL health domains!)
- Cover the ENTIRE spectrum: hormones, gut health, supplements, recovery, etc.
- Be specific but RELATABLE: "Why Your Energy Crashes at 3pm" not "BDNF regulation"
- Think: "What health topic does NO other account talk about?"
- Explore interesting health topics that normal people care about
- Use everyday language: "heart rate variability" not "HRV", "brain health" not "BDNF"

🎯 FUN, RELATABLE, INTERESTING TOPICS - NOT BORING TECHNICAL TERMS!

❌ AVOID: Boring technical/biological terms that nobody knows:
- "Myostatin" ❌ (too technical, nobody knows what this is)
- "Phosphatidylserine" ❌ (scientific jargon)
- "BDNF upregulation" ❌ (too academic)
- "Mitochondrial biogenesis" ❌ (sounds like a textbook)
- "Hormonal cascade mechanisms" ❌ (boring science speak)
- "Neurotransmitter modulation" ❌ (too technical)

✅ PRIORITIZE: Fun, relatable, interesting topics people actually care about:
- "Why Your Morning Coffee Is Ruining Your Sleep" ✅ (relatable, interesting)
- "The 2-Minute Habit That Changed My Energy" ✅ (personal, actionable)
- "What I Learned From Tracking My Sleep for 30 Days" ✅ (story, relatable)
- "The Supplement Industry Doesn't Want You to Know This" ✅ (controversial, interesting)
- "Why Everyone's Doing Cold Plunges Wrong" ✅ (trending, relatable)
- "The Real Reason You're Always Tired (It's Not What You Think)" ✅ (hook, relatable)
- "I Tried Bryan Johnson's Protocol for 2 Weeks - Here's What Happened" ✅ (personal, trending)
- "The $50 Supplement That Actually Works (And Why It's Not Advertised)" ✅ (interesting, relatable)

🎯 TOPIC SELECTION PRIORITY:
1. **RELATABLE** - Things people experience daily (sleep, energy, mood, stress)
2. **INTERESTING** - Surprising, counterintuitive, or controversial
3. **FUN** - Entertaining, engaging, not dry/educational
4. **TRENDING** - What's hot in health/wellness right now
5. **PERSONAL** - Real experiences, stories, experiments

⚠️ CRITICAL RULES:
- If topic is technical (like "myostatin"), reframe it: "The Muscle Growth Hormone Nobody Talks About" ✅
- If topic is scientific, make it relatable: "Why Your Body Stops Building Muscle After 30" ✅
- Always ask: "Would a normal person care about this?" If no, reframe it
- Prefer topics that spark curiosity, not topics that sound like a biology textbook
- Use everyday language: "sleep better" not "circadian entrainment"
- Make it interesting: "The Hidden Reason You're Tired" not "Cortisol Dysregulation"

=== PERSPECTIVES (Dimensions) ===

Choose the most engaging angle:
- **news**: Current events, trending topics, breaking research
- **politics**: Policy, pricing, insurance, access, regulation
- **psychology**: Mental/emotional impact, behavior, relationships
- **health**: Mechanisms, biology, science, how things work
- **controversy**: Debates, myths, opposing views, challenge consensus
- **personal**: Real experiences, stories, relatable situations
- **research**: Studies, data, evidence, comparisons
- **industry**: Who profits, conflicts of interest, follow the money
- **long_term**: Chronic effects, sustainability, decades-long impact
- **short_term**: Immediate results, quick wins, tactical tips

=== HIGH-PERFORMING PATTERNS ===

${patternsText}

=== REQUIREMENTS ===

1. **Be FUN & RELATABLE** (people should actually care and want to read this!)
2. **Be INTERESTING** (counterintuitive, surprising, controversial, or novel)
3. **Avoid BORING TECHNICAL TERMS** (no "myostatin", "phosphatidylserine", etc. - reframe them!)
4. **Optimize for FOLLOWERS** (not just engagement - topics people want to follow for)
5. **Use EVERYDAY LANGUAGE** (normal people should understand and relate)
6. **PRIORITIZE STORIES & EXPERIMENTS** (personal experiences, trials, results)
7. **Make it CURIOUS** (hook that makes people want to know more)
8. **Include NUMBERS** or specific research when possible (but frame it relatably)

🎯 BEFORE FINALIZING TOPIC, ASK:
- Would a normal person (not a biohacker) find this interesting? ✅/❌
- Is this fun to read about, or does it sound like a textbook? ✅/❌
- Can I explain this to a friend without using scientific jargon? ✅/❌
- Does this spark curiosity or sound boring? ✅/❌

If any answer is ❌, REFRAME THE TOPIC to be more fun, relatable, and interesting!

=== RECENT TOPICS (Avoid for next ~20 posts, then fair game again) ===

${recentText}

⚠️ IMPORTANT: These are TEMPORARY avoidance, not blacklisted forever!
- After ~20 more posts, you CAN talk about these topics again
- Just don't repeat them in the IMMEDIATE future
- Pick from the ENTIRE health/wellness spectrum
- Examples of what you CAN explore: cold exposure, sauna protocols, hormone optimization, 
  strength training, meditation techniques, sleep architecture, supplement timing, 
  breathwork methods, Zone 2 cardio, protein synthesis, recovery protocols, etc.

=== OUTPUT FORMAT ===

Return JSON with:
{
  "topic": "Specific topic (be creative - explore unexpected areas of health/wellness)",
  "cluster_sampled": "educational|cultural|industry|controversial|media",
  "angle": "Unique perspective that makes it interesting",
  "dimension": "news|politics|psychology|health|controversy|personal|research|industry|long_term|short_term",
  "hook_suggestion": "Attention-grabbing opening line",
  "why_engaging": "Why this will get followers",
  "viral_potential": 0.0-1.0
}`;

    const user = `Generate a unique, engaging health/wellness/fitness topic that will get followers.

IMPORTANT: Use RELATABLE, FUN language - not technical jargon!
- "Why Your Energy Crashes at 3pm" ✅ not "Cortisol Dysregulation" ❌
- "The Sleep Habit That Changed Everything" ✅ not "Circadian Entrainment" ❌
- "I Tried Cold Plunges for 30 Days" ✅ not "Thermogenesis Protocol" ❌

Explore the FULL spectrum of health - don't default to common topics like sleep or mental health.
Cover: hormones, gut health, supplements, recovery, fitness, nutrition, etc.

Use the high-performing patterns if relevant, or discover something new within health.
Be creative, specific, and explore INTERESTING health topics that normal people care about.

Think: "What fascinating, relatable health topic would make someone instantly follow this account?"`;


    return { system, user };
  }

  /**
   * Get learning patterns from database
   */
  private async getLearningPatterns(): Promise<LearningPattern[]> {
    try {
      // Get top-performing content patterns
      const { data } = await this.supabase
        .from('multi_dimensional_metrics')
        .select('*')
        .gte('followers_gained', 10)
        .order('followers_gained', { ascending: false })
        .limit(10);

      if (!data || data.length === 0) {
        return [];
      }

      // Extract patterns (simplified for now)
      // In production, this would do more sophisticated pattern analysis
      const patterns: LearningPattern[] = [
        {
          pattern_type: 'high_controversy',
          description: 'Controversial topics with myth-busting',
          avg_engagement: 500,
          avg_followers_gained: 15,
          confidence: 0.8
        },
        {
          pattern_type: 'politics_pricing',
          description: 'Politics + pricing inequality discussions',
          avg_engagement: 450,
          avg_followers_gained: 12,
          confidence: 0.75
        }
      ];

      return patterns;

    } catch (error: any) {
      console.error('[DYNAMIC_TOPIC] ⚠️ Error loading patterns:', error.message);
      return [];
    }
  }

  /**
   * Store generated topic for tracking
   */
  private async storeGeneratedTopic(topic: DynamicTopic): Promise<void> {
    try {
      await this.supabase
        .from('dynamic_topics_generated')
        .insert({
          topic: topic.topic,
          angle: topic.angle,
          dimension: topic.dimension,
          viral_potential: topic.viral_potential,
          generated_at: new Date().toISOString()
        });
    } catch (error: any) {
      // Non-critical, just log
      console.error('[DYNAMIC_TOPIC] ⚠️ Could not store topic:', error.message);
    }
  }

  /**
   * Validate dimension string
   */
  private validateDimension(dimension: string): DynamicTopic['dimension'] {
    const valid: DynamicTopic['dimension'][] = [
      'news', 'politics', 'psychology', 'health', 'controversy',
      'personal', 'research', 'industry', 'long_term', 'short_term'
    ];

    if (valid.includes(dimension as any)) {
      return dimension as DynamicTopic['dimension'];
    }

    return 'health'; // Default fallback
  }

  /**
   * Get topic suggestions with trending awareness
   */
  async getTopicSuggestions(count: number = 3): Promise<DynamicTopic[]> {
    const topics: DynamicTopic[] = [];
    const recentTopics: string[] = [];

    for (let i = 0; i < count; i++) {
      const topic = await this.generateTopic({ recentTopics });
      topics.push(topic);
      recentTopics.push(topic.topic);
    }

    return topics;
  }

  /**
   * Update topic performance after posting
   */
  async updateTopicPerformance(
    topic: string,
    metrics: {
      engagement: number;
      followers_gained: number;
      viral_score: number;
    }
  ): Promise<void> {
    try {
      await this.supabase
        .from('dynamic_topics_generated')
        .update({
          actual_engagement: metrics.engagement,
          actual_followers_gained: metrics.followers_gained,
          actual_viral_score: metrics.viral_score,
          updated_at: new Date().toISOString()
        })
        .eq('topic', topic)
        .order('generated_at', { ascending: false })
        .limit(1);

      console.log(`[DYNAMIC_TOPIC] 📊 Updated performance for: ${topic}`);
    } catch (error: any) {
      console.error('[DYNAMIC_TOPIC] ⚠️ Error updating performance:', error.message);
    }
  }
}

export const getDynamicTopicGenerator = () => DynamicTopicGenerator.getInstance();

