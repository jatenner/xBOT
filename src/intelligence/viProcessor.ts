/**
 * 🧠 VISUAL INTELLIGENCE: Processor
 * 
 * Three-stage pipeline:
 * 1. Classifier: AI extracts topic/angle/tone/structure
 * 2. Analyzer: Extracts visual patterns (emojis, line breaks, hooks)
 * 3. Intelligence Builder: Aggregates patterns into recommendations
 * 
 * Integrated with existing data_collection job (runs every 6 hours)
 * Feature flagged: Only runs if VISUAL_INTELLIGENCE_ENABLED=true
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export class VIProcessor {
  private supabase = getSupabaseClient();
  
  /**
   * Main entry point: Process unclassified tweets
   * Called by data_collection job every 6 hours
   */
  async processAllPending(): Promise<void> {
    log({ op: 'vi_processor_start' });
    
    // Stage 1: Classify unclassified tweets
    const classified = await this.classifyPending();
    
    // Stage 2: Analyze classified tweets
    const analyzed = await this.analyzePending();
    
    // Stage 3: Build intelligence from analyzed tweets
    const patternsBuilt = await this.buildIntelligence();
    
    log({ 
      op: 'vi_processor_complete', 
      classified, 
      analyzed, 
      patterns_built: patternsBuilt 
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // STAGE 1: CLASSIFICATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Classify pending tweets with AI
   */
  private async classifyPending(): Promise<number> {
    // Get unclassified tweets from both sources
    const tweets = await this.getUnclassified();
    
    if (tweets.length === 0) {
      log({ op: 'vi_classifier_no_work' });
      return 0;
    }
    
    log({ op: 'vi_classifier_processing', count: tweets.length });
    
    // Process in batches (10 at a time to avoid overwhelming OpenAI)
    const BATCH_SIZE = 10;
    let classified = 0;
    
    for (let i = 0; i < tweets.length; i += BATCH_SIZE) {
      const batch = tweets.slice(i, i + BATCH_SIZE);
      
      for (const tweet of batch) {
        try {
          await this.classifyTweet(tweet);
          classified++;
          
          // Small delay between OpenAI calls
          await this.sleep(500);
          
        } catch (error: any) {
          log({ op: 'vi_classify_error', tweet_id: tweet.tweet_id, error: error.message });
        }
      }
    }
    
    return classified;
  }
  
  /**
   * Get unclassified tweets (max 100 per run)
   */
  private async getUnclassified(): Promise<any[]> {
    const tweets: any[] = [];
    
    // From vi_collected_tweets
    const { data: collected } = await this.supabase
      .from('vi_collected_tweets')
      .select('*')
      .eq('classified', false)
      .limit(50);
    
    if (collected) {
      tweets.push(...collected.map(t => ({ ...t, source_table: 'vi_collected_tweets' })));
    }
    
    // From vi_viral_unknowns
    const { data: viral } = await this.supabase
      .from('vi_viral_unknowns')
      .select('*')
      .eq('classified', false)
      .limit(50);
    
    if (viral) {
      tweets.push(...viral.map(t => ({ ...t, source_table: 'vi_viral_unknowns' })));
    }
    
    return tweets;
  }
  
  /**
   * Classify individual tweet with AI
   * ✅ ENHANCED: Now includes generator matching + additional insights
   */
  private async classifyTweet(tweet: any): Promise<void> {
    const prompt = `You are a content classification expert for health/longevity tweets.

Analyze this tweet and extract:

1. TOPIC (main subject):
   Options: sleep, exercise, supplements, nutrition, longevity, mental_health, biohacking, peptides, hormones, gut_health, research, policy, other
   
2. ANGLE (approach/perspective):
   Options: provocative, research_based, personal_story, controversial, practical, educational, myth_busting, comparative, data_driven, other
   
3. TONE (voice/style):
   Options: authoritative, conversational, provocative, educational, inspirational, skeptical, urgent, casual, professional, other
   
4. STRUCTURE (format):
   Options: question_hook, stat_hook, story, myth_truth, list, comparison, quote, statement, thread, other

5. ✅ NEW: GENERATOR MATCH (which of the 22 generators would create this?):
   Options: contrarian, culturalBridge, dataNerd, storyteller, coach, explorer, thoughtLeader, mythBuster, newsReporter, philosopher, provocateur, interestingContent, dynamicContent, popCultureAnalyst, teacher, investigator, connector, pragmatist, historian, translator, patternFinder, experimenter
   
   Match based on:
   - newsReporter: Breaking news, "NEW STUDY:", "JUST PUBLISHED:", journal-style
   - historian: Historical context, "We used to think", evolution over time
   - storyteller: Narratives, case studies, personal stories, transformations
   - dataNerd: Heavy data, statistics, "n=", research citations, numbers
   - mythBuster: "Myth:" / "Truth:", debunks misconceptions
   - contrarian: Challenges mainstream, questions systems, industry critique
   - coach: How-to, protocols, step-by-step, actionable
   - provocateur: Bold questions, challenges assumptions, controversial
   - philosopher: Deep meaning, wisdom, stoic, ancient wisdom
   - teacher: Educational, explains step-by-step, patient teaching
   - investigator: Deep research synthesis, multiple studies analyzed
   - connector: Systems thinking, shows interconnections
   - pragmatist: Practical, realistic, 80/20, simple
   - translator: Simple language, explains complex science
   - patternFinder: Identifies patterns across research
   - experimenter: Self-experimentation, personal trials
   - culturalBridge: Books, influencers, cultural connections
   - thoughtLeader: Big picture, future insights, paradigm shifts
   - explorer: Novel ideas, experimental, cutting-edge
   - interestingContent: Surprising, counterintuitive, fascinating
   - popCultureAnalyst: Trends, viral, pop culture connections
   - dynamicContent: Versatile, adaptive (use if doesn't fit others)

6. ✅ NEW: HOOK EFFECTIVENESS (0-100 score):
   How effective is the hook? Consider:
   - Creates curiosity gap? (0-30 points)
   - Specific and concrete? (0-25 points)
   - Challenges assumptions? (0-25 points)
   - Creates urgency/importance? (0-20 points)

7. ✅ NEW: CONTROVERSY LEVEL (0-100 score):
   How controversial is this? Consider:
   - Challenges mainstream beliefs? (0-30 points)
   - Makes bold claims? (0-25 points)
   - Opposes common wisdom? (0-25 points)
   - Provokes debate? (0-20 points)

Provide confidence score 0.0-1.0 for each classification.

Return ONLY valid JSON:
{
  "topic": "string",
  "topic_confidence": 0.0-1.0,
  "angle": "string",
  "angle_confidence": 0.0-1.0,
  "tone": "string",
  "tone_confidence": 0.0-1.0,
  "structure": "string",
  "structure_confidence": 0.0-1.0,
  "generator_match": "string",
  "generator_confidence": 0.0-1.0,
  "hook_effectiveness": 0-100,
  "controversy_level": 0-100
}

Tweet to analyze:
"${tweet.content.substring(0, 500)}"`;
    
    const completion = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Low for consistent classification
      max_tokens: 150,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'vi_classification'
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No classification returned');
    }
    
    const result = JSON.parse(content);
    
    // Store classification (✅ ENHANCED: includes generator match + insights)
    await this.supabase.from('vi_content_classification').upsert({
      tweet_id: tweet.tweet_id,
      source_table: tweet.source_table,
      topic: result.topic || 'other',
      topic_confidence: result.topic_confidence || 0,
      angle: result.angle || 'other',
      angle_confidence: result.angle_confidence || 0,
      tone: result.tone || 'other',
      tone_confidence: result.tone_confidence || 0,
      structure: result.structure || 'other',
      structure_confidence: result.structure_confidence || 0,
      // ✅ NEW: Generator matching
      generator_match: result.generator_match || 'dynamicContent',
      generator_confidence: result.generator_confidence || 0,
      // ✅ NEW: Additional insights
      hook_effectiveness: result.hook_effectiveness || 50,
      controversy_level: result.controversy_level || 0,
      classified_at: new Date().toISOString()
    }, {
      onConflict: 'tweet_id'
    });
    
    // Mark as classified in source table
    await this.supabase
      .from(tweet.source_table)
      .update({ classified: true })
      .eq('tweet_id', tweet.tweet_id);
    
    log({ 
      op: 'vi_classify_success', 
      tweet_id: tweet.tweet_id, 
      topic: result.topic 
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // STAGE 2: VISUAL ANALYSIS
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Analyze visual patterns in classified tweets
   */
  private async analyzePending(): Promise<number> {
    // Get classified but unanalyzed tweets
    const tweets = await this.getUnanalyzed();
    
    if (tweets.length === 0) {
      log({ op: 'vi_analyzer_no_work' });
      return 0;
    }
    
    log({ op: 'vi_analyzer_processing', count: tweets.length });
    
    let analyzed = 0;
    
    for (const tweet of tweets) {
      try {
        await this.analyzeTweet(tweet);
        analyzed++;
      } catch (error: any) {
        log({ op: 'vi_analyze_error', tweet_id: tweet.tweet_id, error: error.message });
      }
    }
    
    return analyzed;
  }
  
  /**
   * Get unanalyzed tweets (max 200 per run - fast operation)
   */
  private async getUnanalyzed(): Promise<any[]> {
    const tweets: any[] = [];
    
    // From vi_collected_tweets
    const { data: collected } = await this.supabase
      .from('vi_collected_tweets')
      .select('*')
      .eq('classified', true)
      .eq('analyzed', false)
      .limit(100);
    
    if (collected) {
      tweets.push(...collected.map(t => ({ ...t, source_table: 'vi_collected_tweets' })));
    }
    
    // From vi_viral_unknowns
    const { data: viral } = await this.supabase
      .from('vi_viral_unknowns')
      .select('*')
      .eq('classified', true)
      .eq('analyzed', false)
      .limit(100);
    
    if (viral) {
      tweets.push(...viral.map(t => ({ ...t, source_table: 'vi_viral_unknowns' })));
    }
    
    return tweets;
  }
  
  /**
   * Analyze visual patterns in a tweet
   * ✅ ENHANCED: Now includes readability, engagement velocity, and more
   */
  private async analyzeTweet(tweet: any): Promise<void> {
    const content = tweet.content;
    const mediaTypes = Array.isArray(tweet.media_types)
      ? (tweet.media_types as string[]).filter(Boolean)
      : [];
    const hasMedia = tweet.has_media ?? mediaTypes.length > 0;
    const screenshotDetected = hasMedia &&
      mediaTypes.includes('image') &&
      content.length <= 80 &&
      content.split('\n').length <= 2;
    const calloutDetected = /(^|\n)\s*(key takeaway|bottom line|action steps?|what to do|tl;dr|summary:?)/i.test(content);
    
    // ✅ NEW: Calculate readability scores
    const readability = this.calculateReadability(content);
    
    // ✅ NEW: Calculate engagement velocity (if timestamp available)
    const engagementVelocity = this.calculateEngagementVelocity(tweet);
    
    // ✅ NEW: Detect call-to-action
    const ctaDetected = this.detectCTA(content);
    
    // ✅ NEW: Time-based analysis
    const timeAnalysis = tweet.timestamp ? this.analyzeTiming(tweet.timestamp) : null;
    
    // Extract all visual patterns
    const patterns = {
      // Basic structure
      char_count: content.length,
      word_count: content.split(/\s+/).length,
      sentence_count: (content.match(/[.!?]+/g) || []).length,
      line_count: content.split('\n').length,
      line_breaks: (content.match(/\n/g) || []).length,
      
      // ✅ NEW: Readability metrics
      readability_score: readability.flesch,
      avg_sentence_length: readability.avgSentenceLength,
      avg_word_length: readability.avgWordLength,
      complexity_level: readability.complexity, // 'simple', 'moderate', 'complex'
      
      // Emojis
      emoji_count: this.countEmojis(content),
      emoji_list: this.extractEmojis(content),
      emoji_positions: this.getEmojiPositions(content),
      
      // Formatting
      has_bullets: /[•·▪️◦]/.test(content),
      has_numbers: /^[0-9]/.test(content) || /\n[0-9]/.test(content),
      has_caps: /[A-Z]{2,}/.test(content),
      caps_words: content.match(/\b[A-Z]{2,}\b/g) || [],
      has_quotes: /"[^"]+"|'[^']+'/.test(content),
      has_hashtags: /#\w+/.test(content),
      hashtag_count: (content.match(/#\w+/g) || []).length,
      
      // Hook detection
      hook_type: this.detectHookType(content),
      starts_with: content.substring(0, 50),
      
      // Credibility markers
      cites_source: this.citesSource(content),
      source_type: this.detectSourceType(content),
      has_stats: /\d+%|\d+x|\d+ fold|\d+\.\d+x/.test(content),
      
      // Special characters
      uses_arrows: /[↑↓→←]/.test(content),
      uses_special_chars: content.match(/[→•▪◦≠±×÷]/) || [],
      
      // Media signals
      has_media: hasMedia,
      media_types: mediaTypes,
      screenshot_detected: screenshotDetected,
      callout_detected: calloutDetected,
      
      // ✅ NEW: Engagement velocity
      engagement_velocity: engagementVelocity.velocity,
      velocity_category: engagementVelocity.category, // 'fast', 'medium', 'slow'
      early_engagement_pct: engagementVelocity.earlyEngagementPct,
      
      // ✅ NEW: Call-to-action
      has_cta: ctaDetected.hasCTA,
      cta_type: ctaDetected.type, // 'follow', 'try', 'learn', 'share', null
      cta_placement: ctaDetected.placement, // 'start', 'middle', 'end'
      
      // ✅ NEW: Time-based patterns
      hour_posted: timeAnalysis?.hour,
      day_of_week: timeAnalysis?.dayOfWeek,
      is_weekend: timeAnalysis?.isWeekend
    };
    
    // Store patterns
    await this.supabase.from('vi_visual_formatting').upsert({
      tweet_id: tweet.tweet_id,
      source_table: tweet.source_table,
      ...patterns,
      analyzed_at: new Date().toISOString()
    }, {
      onConflict: 'tweet_id'
    });
    
    // Mark as analyzed in source table
    await this.supabase
      .from(tweet.source_table)
      .update({ analyzed: true })
      .eq('tweet_id', tweet.tweet_id);
    
    log({ op: 'vi_analyze_success', tweet_id: tweet.tweet_id });
  }
  
  // ═══════════════════════════════════════════════════════════
  // STAGE 3: INTELLIGENCE BUILDING
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Build pattern intelligence from analyzed tweets
   */
  private async buildIntelligence(): Promise<number> {
    log({ op: 'vi_intelligence_builder_start' });
    
    // Get all viable combinations (topic/angle/tone/structure with 5+ tweets)
    const combinations = await this.getViableCombinations();
    
    if (combinations.length === 0) {
      log({ op: 'vi_intelligence_no_combos' });
      return 0;
    }
    
    log({ op: 'vi_intelligence_combos', count: combinations.length });
    
    let built = 0;
    
    for (const combo of combinations) {
      try {
        await this.buildIntelligenceFor(combo);
        built++;
      } catch (error: any) {
        log({ op: 'vi_intelligence_error', combo, error: error.message });
      }
    }
    
    return built;
  }
  
  /**
   * Get viable combinations with enough data
   * ✅ UPDATED: Removed topic from combinations (topics are irrelevant)
   */
  private async getViableCombinations(): Promise<any[]> {
    // Query for combinations with 5+ tweets (angle/tone/structure only, NO TOPIC)
    const { data } = await this.supabase.rpc('vi_get_viable_combinations', {
      min_count: 5
    });
    
    // Fallback if RPC doesn't exist yet - get unique angle/tone/structure combinations
    if (!data) {
      const { data: classifications } = await this.supabase
        .from('vi_content_classification')
        .select('angle, tone, structure')
        .gte('angle_confidence', 0.6)
        .gte('tone_confidence', 0.6);
      
      // Get unique combinations of angle/tone/structure
      const uniqueCombos = new Map<string, any>();
      (classifications || []).forEach(c => {
        const key = `${c.angle}|${c.tone}|${c.structure}`;
        if (!uniqueCombos.has(key)) {
          uniqueCombos.set(key, { 
            angle: c.angle, 
            tone: c.tone, 
            structure: c.structure 
          });
        }
      });
      
      return Array.from(uniqueCombos.values());
    }
    
    // Remove topic from returned combinations
    return (data || []).map((c: any) => ({
      angle: c.angle,
      tone: c.tone,
      structure: c.structure
      // topic removed - irrelevant
    })) as any[];
  }
  
  /**
   * Build intelligence for a specific combination
   * ✅ ENHANCED: Now also builds generator-specific intelligence
   */
  private async buildIntelligenceFor(combo: any): Promise<void> {
    // Find matching tweets (tier-weighted)
    const matches = await this.findMatches(combo);
    
    // ✅ NEW: Also build generator-specific intelligence
    await this.buildGeneratorIntelligence(matches);
    
    if (matches.length < 5) return; // Need at least 5 tweets
    
    // ✅ NEW: Filter by success - only learn from successful tweets
    const successfulMatches = matches.filter((m: any) => {
      const er = m.engagement_rate || 0;
      const viral = m.is_viral || false;
      const multiplier = m.viral_multiplier || 0;
      
      // Include if: 2%+ ER OR viral OR 30%+ reach
      return er >= 0.02 || viral || multiplier >= 0.3;
    });
    
    if (successfulMatches.length < 5) {
      log({ 
        op: 'vi_intelligence_insufficient_success', 
        total: matches.length, 
        successful: successfulMatches.length,
        combo: `${combo.angle}|${combo.tone}|${combo.structure}`
      });
      return; // Need at least 5 successful tweets
    }
    
    log({ 
      op: 'vi_intelligence_success_filter', 
      total: matches.length, 
      successful: successfulMatches.length,
      filter_rate: `${((successfulMatches.length / matches.length) * 100).toFixed(1)}%`
    });
    
    // Use successful matches only
    const matchesToUse = successfulMatches;
    
    // Separate by tier (using successful matches only)
    const byTier = {
      viral_unknowns: matchesToUse.filter(m => m.tier_weight === 3.0),
      micro: matchesToUse.filter(m => m.tier_weight === 2.0),
      growth: matchesToUse.filter(m => m.tier_weight === 1.0),
      established: matchesToUse.filter(m => m.tier_weight === 0.5)
    };
    
    // Analyze patterns per tier
    const tierBreakdown = {
      viral_unknowns: {
        count: byTier.viral_unknowns.length,
        avg_engagement: this.avgEngagement(byTier.viral_unknowns),
        patterns: byTier.viral_unknowns.length > 0 ? this.analyzePatterns(byTier.viral_unknowns) : null
      },
      micro: {
        count: byTier.micro.length,
        avg_engagement: this.avgEngagement(byTier.micro),
        patterns: byTier.micro.length > 0 ? this.analyzePatterns(byTier.micro) : null
      },
      growth: {
        count: byTier.growth.length,
        avg_engagement: this.avgEngagement(byTier.growth),
        patterns: byTier.growth.length > 0 ? this.analyzePatterns(byTier.growth) : null
      },
      established: {
        count: byTier.established.length,
        avg_engagement: this.avgEngagement(byTier.established),
        patterns: byTier.established.length > 0 ? this.analyzePatterns(byTier.established) : null
      }
    };
    
    // Compute tier-weighted recommendation
    const recommendedFormat = this.computeWeightedRecommendation(tierBreakdown);
    
    // Determine primary tier
    const primaryTier = this.determinePrimaryTier(tierBreakdown);
    
    // Build confidence note
    const confidenceNote = this.buildConfidenceNote(tierBreakdown);
    
    // Get top examples
    const exampleTweetIds = this.getTopExamples(byTier);
    
    // Determine confidence level (based on successful matches)
    const confidenceLevel = 
      matchesToUse.length >= 20 ? 'high' :
      matchesToUse.length >= 10 ? 'medium' : 'low';
    
    // ✅ NEW: Remove topic from query key (user says topics are irrelevant)
    // Store intelligence by angle/tone/structure only
    const queryKey = [combo.angle, combo.tone, combo.structure]
      .filter(v => v !== null && v !== undefined)
      .join('|');
    
    await this.supabase.from('vi_format_intelligence').upsert({
      topic: null, // ✅ Removed - topics are irrelevant (user has topic generator)
      angle: combo.angle,
      tone: combo.tone,
      structure: combo.structure,
      query_key: queryKey,
      recommended_format: recommendedFormat,
      tier_breakdown: tierBreakdown,
      example_tweet_ids: exampleTweetIds,
      primary_tier: primaryTier,
      confidence_level: confidenceLevel,
      confidence_note: confidenceNote,
      based_on_count: matchesToUse.length, // ✅ Count of successful tweets only
      weighted_avg_engagement: this.computeWeightedEngagement(tierBreakdown),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'query_key'
    });
    
    log({ 
      op: 'vi_intelligence_built', 
      query_key: queryKey, 
      total_matches: matches.length,
      successful_matches: matchesToUse.length,
      primary_tier: primaryTier,
      confidence: confidenceLevel
    });
  }
  
  /**
   * ✅ NEW: Build generator-specific intelligence
   * Groups tweets by generator_match and builds intelligence for each generator
   */
  private async buildGeneratorIntelligence(matches: any[]): Promise<void> {
    // Group matches by generator_match
    const byGenerator = new Map<string, any[]>();
    
    for (const match of matches) {
      const generator = match.vi_content_classification?.generator_match || 'dynamicContent';
      if (!byGenerator.has(generator)) {
        byGenerator.set(generator, []);
      }
      byGenerator.get(generator)!.push(match);
    }
    
    // Build intelligence for each generator with 5+ tweets
    for (const [generator, generatorMatches] of byGenerator.entries()) {
      if (generatorMatches.length < 5) continue;
      
      // Filter by success
      const successful = generatorMatches.filter((m: any) => {
        const er = m.engagement_rate || 0;
        return er >= 0.02 || m.is_viral || (m.viral_multiplier || 0) >= 0.3;
      });
      
      if (successful.length < 5) continue;
      
      // Analyze patterns for this generator
      const patterns = this.analyzePatterns(successful);
      
      // Build tier breakdown structure (all in one tier for generator-specific)
      const tierBreakdown = {
        all: {
          count: successful.length,
          avg_engagement: this.avgEngagement(successful),
          patterns
        }
      };
      
      const recommendedFormat = this.computeWeightedRecommendation(tierBreakdown);
      
      // Store generator-specific intelligence
      const queryKey = `generator:${generator}`;
      await this.supabase.from('vi_format_intelligence').upsert({
        topic: null,
        angle: null, // Generator-specific (not angle-specific)
        tone: null,
        structure: null,
        generator_match: generator, // ✅ NEW: Store generator
        query_key: queryKey,
        recommended_format: recommendedFormat,
        tier_breakdown: tierBreakdown,
        example_tweet_ids: {
          all: successful.slice(0, 5).map((m: any) => m.tweet_id)
        },
        primary_tier: 'generator_specific',
        confidence_level: successful.length >= 20 ? 'high' : successful.length >= 10 ? 'medium' : 'low',
        confidence_note: `Based on ${successful.length} successful ${generator} tweets`,
        based_on_count: successful.length,
        weighted_avg_engagement: this.avgEngagement(successful),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'query_key'
      });
      
      log({ 
        op: 'vi_generator_intelligence_built', 
        generator, 
        tweet_count: successful.length 
      });
    }
  }
  
  /**
   * Find matching tweets for a combination
   * ✅ UPDATED: Removed topic filter (topics are irrelevant)
   */
  private async findMatches(combo: any): Promise<any[]> {
    // Build query - NO TOPIC FILTER (user says topics are irrelevant)
    let query = this.supabase
      .from('vi_collected_tweets')
      .select(`
        *,
        vi_content_classification!inner(angle, tone, structure),
        vi_visual_formatting!inner(*)
      `)
      .gte('vi_content_classification.angle_confidence', 0.6)
      .gte('vi_content_classification.tone_confidence', 0.6);
    
    // Filter by angle, tone, structure (NO TOPIC)
    if (combo.angle) query = query.eq('vi_content_classification.angle', combo.angle);
    if (combo.tone) query = query.eq('vi_content_classification.tone', combo.tone);
    if (combo.structure) query = query.eq('vi_content_classification.structure', combo.structure);
    
    const { data } = await query;
    
    return (data || []) as any[];
  }
  
  // ═══════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  private countEmojis(text: string): number {
    const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu;
    return (text.match(emojiRegex) || []).length;
  }
  
  private extractEmojis(text: string): string[] {
    const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu;
    return text.match(emojiRegex) || [];
  }
  
  private getEmojiPositions(text: string): string[] {
    const positions: string[] = [];
    const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu;
    const matches = [...text.matchAll(emojiRegex)];
    
    for (const match of matches) {
      const index = match.index || 0;
      if (index < text.length * 0.2) positions.push('start');
      else if (index > text.length * 0.8) positions.push('end');
      else positions.push('middle');
    }
    
    return [...new Set(positions)];
  }
  
  private detectHookType(text: string): string {
    const firstLine = text.split('\n')[0]?.trim() || '';
    
    if (/^(Why|How|What|When|Where|Who)\s/i.test(firstLine)) return 'question';
    if (/^\d+%|\d+x/.test(firstLine)) return 'stat';
    if (/^(Everyone|Most people|You're|Stop|Don't|Never)/i.test(firstLine)) return 'controversy';
    if (/^(Imagine|Picture|Think about|Remember when)/i.test(firstLine)) return 'story';
    
    return 'statement';
  }
  
  private citesSource(text: string): boolean {
    return /(study|research|data|paper|journal|source|according to|shows|found|published|university|institute)/i.test(text);
  }
  
  private detectSourceType(text: string): string | null {
    if (/\b(study|research|paper|journal)\b/i.test(text)) return 'study';
    if (/\b(data|analysis|statistics)\b/i.test(text)) return 'data';
    if (/\b(expert|dr\.|professor|phd)\b/i.test(text)) return 'expert';
    if (/\b(book|author|wrote)\b/i.test(text)) return 'book';
    return null;
  }
  
  /**
   * Analyze patterns - ✅ ENHANCED: Now correlates patterns with engagement
   */
  private analyzePatterns(tweets: any[]): any {
    if (tweets.length === 0) return null;
    
    const visuals = tweets.map(t => t.vi_visual_formatting).filter(Boolean);
    if (visuals.length === 0) return null;
    
    // ✅ NEW: Correlate patterns with engagement rate
    // For each pattern value, calculate average ER
    const lineBreakER = this.correlatePatternWithER(tweets, (t: any) => t.vi_visual_formatting?.line_breaks);
    const emojiCountER = this.correlatePatternWithER(tweets, (t: any) => t.vi_visual_formatting?.emoji_count);
    const charCountER = this.correlatePatternWithER(tweets, (t: any) => t.vi_visual_formatting?.char_count);
    const hookTypeER = this.correlatePatternWithER(tweets, (t: any) => t.vi_visual_formatting?.hook_type);
    
    // Find optimal values (highest ER)
    const optimalLineBreaks = this.findOptimalValue(lineBreakER);
    const optimalEmojiCount = this.findOptimalValue(emojiCountER);
    const optimalCharCount = this.findOptimalValue(charCountER);
    const optimalHook = this.findOptimalValue(hookTypeER);
    
    return {
      char_count: {
        median: this.median(visuals.map(v => v.char_count)),
        optimal: optimalCharCount?.value, // ✅ NEW: Optimal value (highest ER)
        optimal_er: optimalCharCount?.avg_er, // ✅ NEW: ER at optimal value
        range: [
          this.percentile(visuals.map(v => v.char_count), 25),
          this.percentile(visuals.map(v => v.char_count), 75)
        ]
      },
      line_breaks: {
        median: this.median(visuals.map(v => v.line_breaks)),
        optimal: optimalLineBreaks?.value, // ✅ NEW: Optimal value
        optimal_er: optimalLineBreaks?.avg_er, // ✅ NEW: ER at optimal value
        mode: this.mode(visuals.map(v => v.line_breaks))
      },
      emoji_count: {
        median: this.median(visuals.map(v => v.emoji_count)),
        optimal: optimalEmojiCount?.value, // ✅ NEW: Optimal value
        optimal_er: optimalEmojiCount?.avg_er, // ✅ NEW: ER at optimal value
        range: [
          Math.min(...visuals.map(v => v.emoji_count)),
          Math.max(...visuals.map(v => v.emoji_count))
        ]
      },
      emoji_positions: this.mostCommon(visuals.flatMap(v => v.emoji_positions || [])),
      hook_pattern: this.mode(visuals.map(v => v.hook_type)),
      optimal_hook: optimalHook?.value, // ✅ NEW: Hook type with highest ER
      optimal_hook_er: optimalHook?.avg_er, // ✅ NEW: ER for optimal hook
      cite_source_pct: visuals.filter(v => v.cites_source).length / visuals.length,
      caps_usage: this.analyzeCapsUsage(visuals),
      media_presence_pct: visuals.filter(v => v.has_media).length / visuals.length,
      top_media_types: this.mostCommon(visuals.flatMap(v => v.media_types || [])),
      screenshot_pct: visuals.filter(v => v.screenshot_detected).length / visuals.length,
      callout_pct: visuals.filter(v => v.callout_detected).length / visuals.length
    };
  }
  
  /**
   * ✅ NEW: Correlate pattern value with engagement rate
   */
  private correlatePatternWithER(tweets: any[], extractor: (t: any) => any): Map<any, { count: number; total_er: number; avg_er: number }> {
    const byValue = new Map<any, { count: number; total_er: number }>();
    
    tweets.forEach(tweet => {
      const value = extractor(tweet);
      if (value === null || value === undefined) return;
      
      const er = tweet.engagement_rate || 0;
      const existing = byValue.get(value) || { count: 0, total_er: 0 };
      byValue.set(value, {
        count: existing.count + 1,
        total_er: existing.total_er + er
      });
    });
    
    // Calculate averages
    const result = new Map<any, { count: number; total_er: number; avg_er: number }>();
    byValue.forEach((stats, value) => {
      result.set(value, {
        ...stats,
        avg_er: stats.total_er / stats.count
      });
    });
    
    return result;
  }
  
  /**
   * ✅ NEW: Find optimal value (highest average ER)
   */
  private findOptimalValue(correlation: Map<any, { count: number; avg_er: number }>): { value: any; avg_er: number; count: number } | null {
    if (correlation.size === 0) return null;
    
    let maxER = 0;
    let optimal: { value: any; avg_er: number; count: number } | null = null;
    
    correlation.forEach((stats, value) => {
      // Only consider if we have at least 3 samples
      if (stats.count >= 3 && stats.avg_er > maxER) {
        maxER = stats.avg_er;
        optimal = { value, avg_er: stats.avg_er, count: stats.count };
      }
    });
    
    return optimal;
  }
  
  /**
   * ✅ ENHANCED: Weight by engagement rate AND tier, use optimal values
   * ✅ UPDATED: Handles generator-specific intelligence (tierBreakdown.all)
   */
  private computeWeightedRecommendation(tierBreakdown: any): any {
    // Collect all patterns with engagement-weighted priority
    const weightedPatterns: Array<{ pattern: any; weight: number }> = [];
    
    // ✅ NEW: Handle generator-specific intelligence (tierBreakdown.all)
    if (tierBreakdown.all?.patterns && tierBreakdown.all.avg_engagement) {
      const weight = 1.0 * (1 + tierBreakdown.all.avg_engagement * 10);
      weightedPatterns.push({ pattern: tierBreakdown.all.patterns, weight });
    }
    
    // Weight by tier AND engagement rate
    if (tierBreakdown.viral_unknowns?.patterns && tierBreakdown.viral_unknowns.avg_engagement) {
      const weight = 3.0 * (1 + tierBreakdown.viral_unknowns.avg_engagement * 10); // Higher ER = more weight
      weightedPatterns.push({ pattern: tierBreakdown.viral_unknowns.patterns, weight });
    }
    if (tierBreakdown.micro?.patterns && tierBreakdown.micro.avg_engagement) {
      const weight = 2.0 * (1 + tierBreakdown.micro.avg_engagement * 10);
      weightedPatterns.push({ pattern: tierBreakdown.micro.patterns, weight });
    }
    if (tierBreakdown.growth?.patterns && tierBreakdown.growth.avg_engagement) {
      const weight = 1.0 * (1 + tierBreakdown.growth.avg_engagement * 10);
      weightedPatterns.push({ pattern: tierBreakdown.growth.patterns, weight });
    }
    if (tierBreakdown.established?.patterns && tierBreakdown.established.avg_engagement) {
      const weight = 0.5 * (1 + tierBreakdown.established.avg_engagement * 10);
      weightedPatterns.push({ pattern: tierBreakdown.established.patterns, weight });
    }
    
    if (weightedPatterns.length === 0) return {};
    
    // ✅ NEW: Prefer optimal values (highest ER) over medians
    const getOptimalOrMedian = (key: string, subKey: string = 'median') => {
      const optimals = weightedPatterns
        .map(wp => wp.pattern?.[key]?.optimal)
        .filter(v => v !== null && v !== undefined);
      
      if (optimals.length > 0) {
        // Use optimal value from highest-weighted pattern
        const bestPattern = weightedPatterns.reduce((best, current) => 
          current.weight > best.weight ? current : best
        );
        return bestPattern.pattern?.[key]?.optimal ?? bestPattern.pattern?.[key]?.[subKey];
      }
      
      // Fallback to weighted median
      const values = weightedPatterns.flatMap(wp => {
        const val = wp.pattern?.[key]?.[subKey];
        return val !== undefined ? Array(Math.round(wp.weight)).fill(val) : [];
      });
      return values.length > 0 ? this.median(values) : null;
    };
    
    return {
      char_count: {
        optimal: getOptimalOrMedian('char_count'), // ✅ Prefer optimal (highest ER)
        median: Math.round(this.median(weightedPatterns.flatMap(wp => {
          const val = wp.pattern?.char_count?.median;
          return val !== undefined ? Array(Math.round(wp.weight)).fill(val) : [];
        }))),
        range: [
          Math.min(...weightedPatterns.map(wp => wp.pattern?.char_count?.range?.[0] || 999).filter(n => n < 999)),
          Math.max(...weightedPatterns.map(wp => wp.pattern?.char_count?.range?.[1] || 0))
        ]
      },
      line_breaks: {
        optimal: getOptimalOrMedian('line_breaks'), // ✅ Prefer optimal
        median: Math.round(this.median(weightedPatterns.flatMap(wp => {
          const val = wp.pattern?.line_breaks?.median;
          return val !== undefined ? Array(Math.round(wp.weight)).fill(val) : [];
        }))),
        mode: this.mode(weightedPatterns.flatMap(wp => {
          const val = wp.pattern?.line_breaks?.mode;
          return val !== undefined ? Array(Math.round(wp.weight)).fill(val) : [];
        }))
      },
      emoji_count: {
        optimal: getOptimalOrMedian('emoji_count'), // ✅ Prefer optimal
        median: Math.round(this.median(weightedPatterns.flatMap(wp => {
          const val = wp.pattern?.emoji_count?.median;
          return val !== undefined ? Array(Math.round(wp.weight)).fill(val) : [];
        }))),
        range: [
          Math.min(...weightedPatterns.map(wp => wp.pattern?.emoji_count?.range?.[0] || 999).filter(n => n < 999)),
          Math.max(...weightedPatterns.map(wp => wp.pattern?.emoji_count?.range?.[1] || 0))
        ]
      },
      emoji_positions: this.mostCommon(weightedPatterns.flatMap(wp => wp.pattern?.emoji_positions || [])),
      hook_pattern: getOptimalOrMedian('hook_pattern', 'hook_pattern') || this.mode(weightedPatterns.map(wp => wp.pattern?.hook_pattern).filter(Boolean)),
      optimal_hook: weightedPatterns.reduce((best, current) => {
        const bestOptimal = best.pattern?.hook_pattern?.optimal_hook;
        const currentOptimal = current.pattern?.hook_pattern?.optimal_hook;
        if (!bestOptimal) return current;
        if (!currentOptimal) return best;
        return current.weight > best.weight ? current : best;
      }, weightedPatterns[0])?.pattern?.hook_pattern?.optimal_hook,
      cite_source_pct: this.average(weightedPatterns.map(wp => wp.pattern?.cite_source_pct).filter(n => n !== undefined)),
      caps_usage: this.mode(weightedPatterns.map(wp => wp.pattern?.caps_usage).filter(Boolean)),
      media_presence_pct: this.average(weightedPatterns.map(wp => wp.pattern?.media_presence_pct).filter(n => typeof n === 'number')),
      top_media_types: this.mostCommon(weightedPatterns.flatMap(wp => wp.pattern?.top_media_types || [])),
      screenshot_pct: this.average(weightedPatterns.map(wp => wp.pattern?.screenshot_pct).filter(n => typeof n === 'number')),
      callout_pct: this.average(weightedPatterns.map(wp => wp.pattern?.callout_pct).filter(n => typeof n === 'number'))
    };
  }
  
  private determinePrimaryTier(tierBreakdown: any): string {
    const weighted = {
      viral_unknowns: tierBreakdown.viral_unknowns.count * 3.0,
      micro: tierBreakdown.micro.count * 2.0,
      growth: tierBreakdown.growth.count * 1.0,
      established: tierBreakdown.established.count * 0.5
    };
    
    let maxWeight = 0;
    let primaryTier = 'micro';
    
    for (const [tier, weight] of Object.entries(weighted)) {
      if (weight > maxWeight) {
        maxWeight = weight;
        primaryTier = tier;
      }
    }
    
    return primaryTier;
  }
  
  private buildConfidenceNote(tierBreakdown: any): string {
    const parts: string[] = [];
    
    if (tierBreakdown.viral_unknowns.count > 0) {
      parts.push(`${tierBreakdown.viral_unknowns.count} viral unknowns`);
    }
    if (tierBreakdown.micro.count > 0) {
      parts.push(`${tierBreakdown.micro.count} micro-influencers`);
    }
    if (tierBreakdown.growth.count > 0) {
      parts.push(`${tierBreakdown.growth.count} growth accounts`);
    }
    if (tierBreakdown.established.count > 0) {
      parts.push(`${tierBreakdown.established.count} established accounts`);
    }
    
    return parts.length > 0 
      ? `Based on ${parts.join(', ')}. Prioritized ${this.determinePrimaryTier(tierBreakdown)} patterns.`
      : 'Insufficient data';
  }
  
  private getTopExamples(byTier: any): any {
    return {
      viral_unknowns: (byTier.viral_unknowns || []).slice(0, 3).map((t: any) => t.tweet_id),
      micro: (byTier.micro || []).slice(0, 3).map((t: any) => t.tweet_id),
      growth: (byTier.growth || []).slice(0, 2).map((t: any) => t.tweet_id),
      established: (byTier.established || []).slice(0, 2).map((t: any) => t.tweet_id)
    };
  }
  
  private computeWeightedEngagement(tierBreakdown: any): number {
    let totalWeighted = 0;
    let totalWeight = 0;
    
    const tiers = [
      { data: tierBreakdown.viral_unknowns, weight: 3.0 },
      { data: tierBreakdown.micro, weight: 2.0 },
      { data: tierBreakdown.growth, weight: 1.0 },
      { data: tierBreakdown.established, weight: 0.5 }
    ];
    
    for (const { data, weight } of tiers) {
      if (data.count > 0 && data.avg_engagement) {
        totalWeighted += data.avg_engagement * data.count * weight;
        totalWeight += data.count * weight;
      }
    }
    
    return totalWeight > 0 ? totalWeighted / totalWeight : 0;
  }
  
  private avgEngagement(tweets: any[]): number {
    if (tweets.length === 0) return 0;
    const sum = tweets.reduce((acc: number, t: any) => acc + (t.engagement_rate || 0), 0);
    return sum / tweets.length;
  }
  
  private analyzeCapsUsage(visuals: any[]): string {
    const withCaps = visuals.filter(v => v.has_caps);
    const singleWord = withCaps.filter(v => v.caps_words && v.caps_words.length === 1);
    const multiWord = withCaps.filter(v => v.caps_words && v.caps_words.length > 1);
    
    if (singleWord.length > visuals.length * 0.3) return 'single_word';
    if (multiWord.length > visuals.length * 0.2) return 'multiple';
    return 'none';
  }
  
  // Math helpers
  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  private mode(arr: any[]): any {
    if (arr.length === 0) return null;
    const counts = new Map();
    arr.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    let maxCount = 0;
    let modeValue = arr[0];
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count;
        modeValue = value;
      }
    });
    return modeValue;
  }
  
  private mostCommon(arr: string[]): string[] {
    if (arr.length === 0) return [];
    const counts = new Map<string, number>();
    arr.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 3).map(([value]) => value);
  }
  
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
  
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  // ✅ NEW: Readability calculation
  private calculateReadability(content: string): {
    flesch: number;
    avgSentenceLength: number;
    avgWordLength: number;
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    
    if (sentences.length === 0 || words.length === 0) {
      return { flesch: 50, avgSentenceLength: 0, avgWordLength: 0, complexity: 'moderate' };
    }
    
    const avgSentenceLength = words.length / sentences.length;
    const avgWordLength = syllables / words.length;
    
    // Flesch Reading Ease (0-100, higher = easier)
    const flesch = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgWordLength);
    const normalizedFlesch = Math.max(0, Math.min(100, flesch));
    
    let complexity: 'simple' | 'moderate' | 'complex';
    if (normalizedFlesch >= 60) complexity = 'simple';
    else if (normalizedFlesch >= 30) complexity = 'moderate';
    else complexity = 'complex';
    
    return {
      flesch: normalizedFlesch,
      avgSentenceLength,
      avgWordLength,
      complexity
    };
  }
  
  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    const matches = word.match(/[aeiouy]+/g);
    if (!matches) return 1;
    let count = matches.length;
    if (word.endsWith('e')) count--;
    if (word.endsWith('le') && word.length > 2) count++;
    return Math.max(1, count);
  }
  
  // ✅ NEW: Engagement velocity calculation
  private calculateEngagementVelocity(tweet: any): {
    velocity: number;
    category: 'fast' | 'medium' | 'slow';
    earlyEngagementPct: number;
  } {
    // If we have timestamp and current metrics, estimate velocity
    // For now, use engagement rate as proxy (high ER = likely fast velocity)
    const er = tweet.engagement_rate || 0;
    const totalEngagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
    
    // Estimate: High ER tweets likely got engagement fast
    // Low ER tweets might be slow burn or algorithm boost
    let velocity = 0;
    let category: 'fast' | 'medium' | 'slow' = 'medium';
    let earlyEngagementPct = 0.5; // Default assumption
    
    if (er >= 0.03) {
      // High ER = likely fast engagement (format-driven)
      velocity = 0.7;
      category = 'fast';
      earlyEngagementPct = 0.6; // 60% in first 30min
    } else if (er >= 0.015) {
      // Medium ER = medium velocity
      velocity = 0.5;
      category = 'medium';
      earlyEngagementPct = 0.4; // 40% in first 30min
    } else {
      // Low ER = slow or algorithm boost
      velocity = 0.3;
      category = 'slow';
      earlyEngagementPct = 0.2; // 20% in first 30min
    }
    
    return { velocity, category, earlyEngagementPct };
  }
  
  // ✅ NEW: Call-to-action detection
  private detectCTA(content: string): {
    hasCTA: boolean;
    type: 'follow' | 'try' | 'learn' | 'share' | null;
    placement: 'start' | 'middle' | 'end';
  } {
    const lower = content.toLowerCase();
    const words = content.split(/\s+/);
    const firstThird = words.slice(0, Math.floor(words.length / 3)).join(' ').toLowerCase();
    const lastThird = words.slice(-Math.floor(words.length / 3)).join(' ').toLowerCase();
    
    // Follow CTAs
    if (/(follow|subscribe|join|connect)/i.test(lower)) {
      const placement = firstThird.includes('follow') || firstThird.includes('subscribe') ? 'start' :
                       lastThird.includes('follow') || lastThird.includes('subscribe') ? 'end' : 'middle';
      return { hasCTA: true, type: 'follow', placement };
    }
    
    // Try/action CTAs
    if (/(try|do this|implement|start|begin|test)/i.test(lower)) {
      const placement = firstThird.includes('try') || firstThird.includes('do this') ? 'start' :
                       lastThird.includes('try') || lastThird.includes('do this') ? 'end' : 'middle';
      return { hasCTA: true, type: 'try', placement };
    }
    
    // Learn CTAs
    if (/(learn|read|study|check out|see|watch)/i.test(lower)) {
      const placement = firstThird.includes('learn') || firstThird.includes('read') ? 'start' :
                       lastThird.includes('learn') || lastThird.includes('read') ? 'end' : 'middle';
      return { hasCTA: true, type: 'learn', placement };
    }
    
    // Share CTAs
    if (/(share|retweet|rt|spread)/i.test(lower)) {
      const placement = lastThird.includes('share') || lastThird.includes('retweet') ? 'end' : 'middle';
      return { hasCTA: true, type: 'share', placement };
    }
    
    return { hasCTA: false, type: null, placement: 'end' };
  }
  
  // ✅ NEW: Time-based analysis
  private analyzeTiming(timestamp: string | Date): {
    hour: number;
    dayOfWeek: number;
    isWeekend: boolean;
  } {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    return { hour, dayOfWeek, isWeekend };
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Export function to be called by data_collection job
 */
export async function processVITweets(): Promise<void> {
  const processor = new VIProcessor();
  await processor.processAllPending();
}

