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
  "structure_confidence": 0.0-1.0
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
    
    // Store classification
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
   */
  private async analyzeTweet(tweet: any): Promise<void> {
    const content = tweet.content;
    
    // Extract all visual patterns
    const patterns = {
      // Basic structure
      char_count: content.length,
      word_count: content.split(/\s+/).length,
      sentence_count: (content.match(/[.!?]+/g) || []).length,
      line_count: content.split('\n').length,
      line_breaks: (content.match(/\n/g) || []).length,
      
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
      uses_special_chars: content.match(/[→•▪◦≠±×÷]/) || []
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
   */
  private async getViableCombinations(): Promise<any[]> {
    // Query for combinations with 5+ tweets
    const { data } = await this.supabase.rpc('vi_get_viable_combinations', {
      min_count: 5
    });
    
    // Fallback if RPC doesn't exist yet - just get top topics
    if (!data) {
      const { data: topTopics } = await this.supabase
        .from('vi_content_classification')
        .select('topic')
        .gte('topic_confidence', 0.6);
      
      const uniqueTopics = [...new Set((topTopics || []).map(t => t.topic))];
      return uniqueTopics.map(topic => ({ topic, angle: null, tone: null, structure: null }));
    }
    
    return (data || []) as any[];
  }
  
  /**
   * Build intelligence for a specific combination
   */
  private async buildIntelligenceFor(combo: any): Promise<void> {
    // Find matching tweets (tier-weighted)
    const matches = await this.findMatches(combo);
    
    if (matches.length < 5) return; // Need at least 5 tweets
    
    // Separate by tier
    const byTier = {
      viral_unknowns: matches.filter(m => m.tier_weight === 3.0),
      micro: matches.filter(m => m.tier_weight === 2.0),
      growth: matches.filter(m => m.tier_weight === 1.0),
      established: matches.filter(m => m.tier_weight === 0.5)
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
    
    // Determine confidence level
    const confidenceLevel = 
      matches.length >= 20 ? 'high' :
      matches.length >= 10 ? 'medium' : 'low';
    
    // Store intelligence
    const queryKey = [combo.topic, combo.angle, combo.tone, combo.structure]
      .filter(v => v !== null && v !== undefined)
      .join('|');
    
    await this.supabase.from('vi_format_intelligence').upsert({
      topic: combo.topic,
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
      based_on_count: matches.length,
      weighted_avg_engagement: this.computeWeightedEngagement(tierBreakdown),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'query_key'
    });
    
    log({ 
      op: 'vi_intelligence_built', 
      query_key: queryKey, 
      count: matches.length,
      primary_tier: primaryTier,
      confidence: confidenceLevel
    });
  }
  
  /**
   * Find matching tweets for a combination
   */
  private async findMatches(combo: any): Promise<any[]> {
    // Build query
    let query = this.supabase
      .from('vi_collected_tweets')
      .select(`
        *,
        vi_content_classification!inner(topic, angle, tone, structure),
        vi_visual_formatting!inner(*)
      `)
      .eq('vi_content_classification.topic', combo.topic)
      .gte('vi_content_classification.topic_confidence', 0.6);
    
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
  
  private analyzePatterns(tweets: any[]): any {
    if (tweets.length === 0) return null;
    
    const visuals = tweets.map(t => t.vi_visual_formatting).filter(Boolean);
    if (visuals.length === 0) return null;
    
    return {
      char_count: {
        median: this.median(visuals.map(v => v.char_count)),
        range: [
          this.percentile(visuals.map(v => v.char_count), 25),
          this.percentile(visuals.map(v => v.char_count), 75)
        ]
      },
      line_breaks: {
        median: this.median(visuals.map(v => v.line_breaks)),
        mode: this.mode(visuals.map(v => v.line_breaks))
      },
      emoji_count: {
        median: this.median(visuals.map(v => v.emoji_count)),
        range: [
          Math.min(...visuals.map(v => v.emoji_count)),
          Math.max(...visuals.map(v => v.emoji_count))
        ]
      },
      emoji_positions: this.mostCommon(visuals.flatMap(v => v.emoji_positions || [])),
      hook_pattern: this.mode(visuals.map(v => v.hook_type)),
      cite_source_pct: visuals.filter(v => v.cites_source).length / visuals.length,
      caps_usage: this.analyzeCapsUsage(visuals)
    };
  }
  
  private computeWeightedRecommendation(tierBreakdown: any): any {
    // Weight by tier priority: viral_unknowns (3x) > micro (2x) > growth (1x) > established (0.5x)
    const allPatterns: any[] = [];
    
    // Add patterns with weighting
    if (tierBreakdown.viral_unknowns?.patterns) {
      for (let i = 0; i < 3; i++) allPatterns.push(tierBreakdown.viral_unknowns.patterns);
    }
    if (tierBreakdown.micro?.patterns) {
      for (let i = 0; i < 2; i++) allPatterns.push(tierBreakdown.micro.patterns);
    }
    if (tierBreakdown.growth?.patterns) {
      allPatterns.push(tierBreakdown.growth.patterns);
    }
    if (tierBreakdown.established?.patterns) {
      // Only 0.5x weight - round down if odd
      if (allPatterns.length % 2 === 0) allPatterns.push(tierBreakdown.established.patterns);
    }
    
    if (allPatterns.length === 0) return {};
    
    // Compute weighted medians
    return {
      char_count: {
        median: Math.round(this.median(allPatterns.map(p => p.char_count?.median).filter(Boolean))),
        range: [
          Math.min(...allPatterns.map(p => p.char_count?.range?.[0] || 999).filter(n => n < 999)),
          Math.max(...allPatterns.map(p => p.char_count?.range?.[1] || 0))
        ]
      },
      line_breaks: {
        median: Math.round(this.median(allPatterns.map(p => p.line_breaks?.median).filter(Boolean))),
        mode: this.mode(allPatterns.map(p => p.line_breaks?.mode).filter(Boolean))
      },
      emoji_count: {
        median: Math.round(this.median(allPatterns.map(p => p.emoji_count?.median).filter(Boolean))),
        range: [
          Math.min(...allPatterns.map(p => p.emoji_count?.range?.[0] || 999).filter(n => n < 999)),
          Math.max(...allPatterns.map(p => p.emoji_count?.range?.[1] || 0))
        ]
      },
      emoji_positions: this.mostCommon(allPatterns.flatMap(p => p.emoji_positions || [])),
      hook_pattern: this.mode(allPatterns.map(p => p.hook_pattern).filter(Boolean)),
      cite_source_pct: this.average(allPatterns.map(p => p.cite_source_pct).filter(n => n !== undefined)),
      caps_usage: this.mode(allPatterns.map(p => p.caps_usage).filter(Boolean))
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

