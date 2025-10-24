/**
 * 🎨 TOPIC DIVERSITY ENGINE
 * 
 * REPLACES hardcoded topic pools with AI-generated infinite topic variety
 * 
 * LEARNING LOOPS:
 * 1. Tracks which topics get engagement/followers (performance-based)
 * 2. Tracks topic repetition (prevents talking about same thing)
 * 3. Detects topic similarity (breathwork ≈ breathing ≈ vagus nerve)
 * 4. Generates new topics based on what's working, avoiding what's repetitive
 * 
 * PHILOSOPHY:
 * - Don't BAN topics (breathwork, anxiety, etc.)
 * - Let AI learn WHEN to talk about them based on performance
 * - Ensure variety by tracking recent topics and their semantic similarity
 * - Generate unlimited unique topics within each cluster
 */

import { getSupabaseClient } from '../db';
import { getOpenAIService } from '../services/openAIService';

export interface TopicWithPerformance {
  topic: string;
  cluster: string;
  posts_count: number;
  avg_followers: number;
  avg_engagement: number;
  success_rate: number;
  last_used: Date;
}

export interface TopicGenerationResult {
  topic: string;
  cluster: string;
  reasoning: string;
  keywords: string[];
}

export class TopicDiversityEngine {
  private static instance: TopicDiversityEngine;

  private constructor() {}

  public static getInstance(): TopicDiversityEngine {
    if (!TopicDiversityEngine.instance) {
      TopicDiversityEngine.instance = new TopicDiversityEngine();
    }
    return TopicDiversityEngine.instance;
  }

  /**
   * 🎯 MAIN METHOD: Generate a unique topic based on learning + diversity
   * 
   * This is the core method that replaces hardcoded topic pools
   */
  public async generateUniqueTopic(
    preferredCluster?: string
  ): Promise<TopicGenerationResult> {
    console.log('[TOPIC_DIVERSITY] 🎨 Generating unique topic...');
    
    // Step 1: Get recent topics to avoid repetition
    const recentTopics = await this.getRecentTopics();
    console.log(`[TOPIC_DIVERSITY] 📚 Recent topics (last 20): ${recentTopics.slice(0, 5).join(', ')}...`);
    
    // Step 2: Get topic performance data (learning loop)
    const topicPerformance = await this.getTopicPerformance();
    console.log(`[TOPIC_DIVERSITY] 📊 Tracking performance for ${topicPerformance.length} topics`);
    
    // Step 3: Identify what's TRULY working (realistic thresholds)
    // USER REQUIREMENT: Success = 1000+ views, 100+ likes (viral territory)
    // For topic-level averages: 5+ followers/post AND 5% ER minimum
    const successfulTopics = topicPerformance
      .filter(t => t.avg_followers > 5 && t.avg_engagement > 0.05)
      .slice(0, 5);
    
    // Step 4: Identify overused topics (appeared multiple times recently)
    const topicCounts = recentTopics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const overusedTopics = Object.entries(topicCounts)
      .filter(([_, count]) => count >= 2)
      .map(([topic]) => topic);
    
    console.log(`[TOPIC_DIVERSITY] 🚫 Overused topics to avoid: ${overusedTopics.join(', ')}`);
    
    // Step 5: Use AI to generate a NEW, UNIQUE topic
    const generatedTopic = await this.generateTopicWithAI({
      recentTopics,
      overusedTopics,
      successful: successfulTopics.length > 0 ? successfulTopics : null,
      mode: 'exploration'
    });
    
    // Step 6: Verify uniqueness and similarity
    const isUnique = await this.verifyTopicUniqueness(generatedTopic.topic, recentTopics);
    
    if (!isUnique) {
      console.log('[TOPIC_DIVERSITY] ⚠️ Generated topic too similar to recent, retrying...');
      // Retry with stronger diversity requirement
      return await this.generateTopicWithAI({
        recentTopics,
        overusedTopics,
        successful: successfulTopics.length > 0 ? successfulTopics : null,
        mode: 'exploration',
        forceMaxDiversity: true
      });
    }
    
    console.log(`[TOPIC_DIVERSITY] ✅ Generated unique topic: ${generatedTopic.topic} (${generatedTopic.cluster})`);
    
    // Step 7: Track this topic for future diversity checks
    await this.trackGeneratedTopic(generatedTopic);
    
    return generatedTopic;
  }

  /**
   * 🚀 ULTIMATE TOPIC GENERATION: Adaptive Multi-Strategy System
   * 
   * Intelligently switches between:
   * - Pure Exploration (random topics)
   * - Trending (viral topics)
   * - Performance-Driven (successful patterns)
   * 
   * Adapts exploration rate based on recent performance
   */
  public async generateUltimateTopic(
    preferredCluster?: string
  ): Promise<TopicGenerationResult> {
    console.log('[ULTIMATE_TOPIC] 🚀 Starting adaptive topic generation...');
    
    // Step 1: Gather ALL intelligence
    const [recentTopics, topicPerformance, trendingTopics, recentEngagement] = await Promise.all([
      this.getRecentTopics(),
      this.getTopicPerformance(),
      this.getTrendingTopics(),
      this.getRecentEngagement()
    ]);
    
    const successfulTopics = topicPerformance
      .filter(t => t.avg_followers > 5 && t.avg_engagement > 0.05)
      .slice(0, 5);
    
    const overusedTopics = Object.entries(
      recentTopics.reduce((acc, topic) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .filter(([_, count]) => count >= 2)
      .map(([topic]) => topic);
    
    // Step 2: ADAPTIVE EXPLORATION - adjust based on performance
    let explorationRate = 0.3; // Default 30%
    
    if (recentEngagement < 0.01) {
      explorationRate = 0.6; // Low engagement = explore more (60%)
      console.log('[ULTIMATE_TOPIC] 📉 Low engagement detected - INCREASING exploration to 60%');
    } else if (recentEngagement > 0.05) {
      explorationRate = 0.2; // High engagement = exploit more (20%)
      console.log('[ULTIMATE_TOPIC] 📈 High engagement detected - DECREASING exploration to 20%');
    } else {
      console.log('[ULTIMATE_TOPIC] ⚖️ Normal engagement - balanced exploration (30%)');
    }
    
    // Step 3: PICK STRATEGY randomly based on adaptive rates
    const strategyRoll = Math.random();
    let mode: 'exploration' | 'trending' | 'performance';
    let strategyContext: any;
    
    if (strategyRoll < explorationRate) {
      // PURE EXPLORATION MODE
      mode = 'exploration';
      console.log('[ULTIMATE_TOPIC] 🎲 Strategy: PURE EXPLORATION (complete randomness)');
      strategyContext = {
        recentTopics,
        overusedTopics,
        trending: null,
        successful: null
      };
    } else if (strategyRoll < explorationRate + 0.3) {
      // TRENDING MODE
      mode = 'trending';
      console.log('[ULTIMATE_TOPIC] 🔥 Strategy: TRENDING (ride viral wave)');
      console.log(`[ULTIMATE_TOPIC] 📊 Found ${trendingTopics.length} trending topics`);
      strategyContext = {
        recentTopics,
        overusedTopics,
        trending: trendingTopics.length > 0 ? trendingTopics : null,
        successful: null
      };
    } else {
      // PERFORMANCE MODE
      mode = 'performance';
      console.log('[ULTIMATE_TOPIC] 📈 Strategy: PERFORMANCE (learn from success)');
      console.log(`[ULTIMATE_TOPIC] 📊 Found ${successfulTopics.length} successful patterns`);
      strategyContext = {
        recentTopics,
        overusedTopics,
        trending: null,
        successful: successfulTopics.length > 0 ? successfulTopics : null
      };
    }
    
    // Step 4: Generate 5 candidate topics in parallel
    console.log('[ULTIMATE_TOPIC] 🎲 Generating 5 candidate topics...');
    
    const candidatePromises = Array.from({ length: 5 }, (_, i) => 
      this.generateTopicWithAI({
        ...strategyContext,
        candidateNumber: i + 1,
        mode
      }).catch(err => {
        console.log(`[ULTIMATE_TOPIC] ⚠️ Candidate ${i + 1} failed: ${err.message}`);
        return null;
      })
    );
    
    const candidates = (await Promise.all(candidatePromises)).filter(c => c !== null) as TopicGenerationResult[];
    
    console.log(`[ULTIMATE_TOPIC] ✅ Generated ${candidates.length}/5 candidates`);
    
    if (candidates.length === 0) {
      console.log('[ULTIMATE_TOPIC] ❌ All candidates failed, using fallback');
      return this.getFallbackTopic(recentTopics);
    }
    
    // Step 5: Score each candidate based on mode
    console.log('[ULTIMATE_TOPIC] 📊 Scoring candidates...');
    
    const scoredCandidates = await Promise.all(
      candidates.map(async (candidate, i) => {
        const uniquenessScore = await this.scoreUniqueness(candidate.topic, recentTopics);
        const trendingScore = mode === 'trending' && trendingTopics.length > 0
          ? await this.scoreTrendingAlignment(candidate.topic, trendingTopics)
          : 0;
        const keywordScore = candidate.keywords.length * 10;
        
        const totalScore = uniquenessScore + trendingScore + keywordScore;
        
        console.log(`[ULTIMATE_TOPIC] 📊 Candidate ${i + 1}: "${candidate.topic.substring(0, 40)}..." = ${totalScore} pts`);
        console.log(`   Mode: ${mode}, Uniqueness: ${uniquenessScore}, Trending: ${trendingScore}, Keywords: ${keywordScore}`);
        
        return {
          ...candidate,
          score: totalScore,
          breakdown: { uniquenessScore, trendingScore, keywordScore },
          mode
        };
      })
    );
    
    // Step 6: Pick the best
    const best = scoredCandidates.sort((a, b) => b.score - a.score)[0];
    
    console.log(`[ULTIMATE_TOPIC] 🏆 WINNER (${best.mode} mode): "${best.topic}"`);
    console.log(`[ULTIMATE_TOPIC] 📊 Score: ${best.score}`);
    console.log(`[ULTIMATE_TOPIC] 💡 Reasoning: ${best.reasoning}`);
    
    // Track the winner
    await this.trackGeneratedTopic(best);
    
    return best;
  }

  /**
   * 📚 Get recent topics (last 20 posts) to avoid repetition
   * 🚀 USES ACTUAL AI-GENERATED TOPICS FROM DATABASE (not keywords!)
   */
  private async getRecentTopics(): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data } = await supabase
        .from('content_metadata')
        .select('content, topic_cluster, metadata')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!data) return [];
      
      const topics: string[] = [];
      
      for (const post of data) {
        // PRIMARY SOURCE: Get topic from topic_cluster field (where AI-generated topics are stored)
        if (post.topic_cluster && post.topic_cluster !== 'health') {
          topics.push(String(post.topic_cluster).toLowerCase().trim());
        }
        // FALLBACK 1: Check metadata.ai_generated_topic
        else if (post.metadata && (post.metadata as any).ai_generated_topic) {
          topics.push(String((post.metadata as any).ai_generated_topic).toLowerCase().trim());
        }
        // FALLBACK 2: Extract from content using NLP
        else {
          const extractedTopic = this.extractTopicFromContent(String(post.content || ''));
          if (extractedTopic) {
            topics.push(extractedTopic.toLowerCase().trim());
          }
        }
      }
      
      console.log(`[TOPIC_DIVERSITY] 📚 Extracted ${topics.length} recent topics from database`);
      if (topics.length > 0) {
        console.log(`[TOPIC_DIVERSITY] 📝 Recent topics: ${topics.slice(0, 5).join(', ')}...`);
      }
      
      return [...new Set(topics)]; // Remove duplicates
    } catch (error: any) {
      console.warn('[TOPIC_DIVERSITY] ⚠️ Could not fetch recent topics:', error.message);
      return [];
    }
  }

  /**
   * 🔍 Extract topic from content text (NO HARDCODED TOPICS!)
   * 
   * Works for ANY AI-generated content:
   * - "psilocybin microdosing for anxiety" → extracts "psilocybin microdosing"
   * - "NAD+ supplementation timing" → extracts "NAD+ supplementation"  
   * - "zone 2 cardio optimization" → extracts "zone 2 cardio"
   * 
   * The AI decides the topics, we just extract them from the content
   */
  private extractTopicFromContent(content: string): string | null {
    try {
      // Strategy 1: Extract capitalized multi-word phrases (e.g., "Psilocybin Microdosing")
      const capitalizedPhrases = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g);
      if (capitalizedPhrases && capitalizedPhrases.length > 0) {
        return capitalizedPhrases[0].trim();
      }
      
      // Strategy 2: Extract scientific/technical terms
      const text = content.toLowerCase();
      const scientificTerms = text.match(/\b(?:[a-z]+-\d+|nad\+|omega-\d+|vitamin\s+[a-z]\d*|zone\s+\d+|hrv|vo2|dha|epa|nmn)\b/gi);
      if (scientificTerms && scientificTerms.length > 0) {
        // Get surrounding words for context
        const term = scientificTerms[0];
        const index = text.indexOf(term);
        const before = text.substring(Math.max(0, index - 30), index).split(/\s+/).filter(w => w.length > 0);
        const after = text.substring(index + term.length, Math.min(text.length, index + term.length + 30)).split(/\s+/).filter(w => w.length > 0);
        
        // Build phrase: 1 word before + term + 1 word after
        const phrase = [
          before[before.length - 1] || '',
          term,
          after[0] || ''
        ].filter(w => w).join(' ');
        
        return phrase.trim();
      }
      
      // Strategy 3: Extract first meaningful multi-word phrase (2-3 words)
      // Remove common filler words first
      const fillerWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'for', 'with', 'about', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among']);
      
      const words = text.split(/\s+/)
        .filter(w => w.length > 2 && !fillerWords.has(w))
        .slice(0, 10); // First 10 meaningful words
      
      if (words.length >= 2) {
        return `${words[0]} ${words[1]}`;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 📊 Get topic performance data from learning system
   */
  private async getTopicPerformance(): Promise<TopicWithPerformance[]> {
    try {
      const supabase = getSupabaseClient();
      
      // Get post attribution data with topics
      const { data } = await supabase
        .from('content_with_outcomes')  // ✅ ROOT CAUSE FIX: Use table with actual data
        .select('metadata, followers_gained, engagement_rate, posted_at')
        .order('posted_at', { ascending: false })
        .limit(50);
      
      if (!data) return [];
      
      // Aggregate performance by topic
      const topicStats: Record<string, {
        posts: number;
        followers: number[];
        engagement: number[];
        last_used: Date;
      }> = {};
      
      for (const post of data) {
        const metadata = post.metadata as any;
        const topic = String(metadata?.topic || 'unknown').toLowerCase();
        
        if (!topicStats[topic]) {
          topicStats[topic] = {
            posts: 0,
            followers: [],
            engagement: [],
            last_used: new Date(String(post.posted_at))
          };
        }
        
        topicStats[topic].posts++;
        topicStats[topic].followers.push(Number(post.followers_gained) || 0);
        topicStats[topic].engagement.push(Number(post.engagement_rate) || 0);
        
        const postDate = new Date(String(post.posted_at));
        if (postDate > topicStats[topic].last_used) {
          topicStats[topic].last_used = postDate;
        }
      }
      
      // Convert to array with averages
      return Object.entries(topicStats).map(([topic, stats]) => ({
        topic,
        cluster: 'health', // Will be inferred
        posts_count: stats.posts,
        avg_followers: stats.followers.reduce((a, b) => a + b, 0) / stats.followers.length,
        avg_engagement: stats.engagement.reduce((a, b) => a + b, 0) / stats.engagement.length,
        success_rate: stats.followers.filter(f => f > 5).length / stats.followers.length, // Success = 5+ followers
        last_used: stats.last_used
      }));
    } catch (error: any) {
      console.warn('[TOPIC_DIVERSITY] ⚠️ Could not get topic performance:', error.message);
      return [];
    }
  }

  /**
   * 🤖 Use AI to generate a completely new topic
   * 
   * Builds different prompts based on mode (exploration/trending/performance)
   */
  private async generateTopicWithAI(params: {
    recentTopics: string[];
    overusedTopics: string[];
    trending?: any[] | null;
    successful?: TopicWithPerformance[] | null;
    mode?: 'exploration' | 'trending' | 'performance';
    candidateNumber?: number;
    forceMaxDiversity?: boolean;
  }): Promise<TopicGenerationResult> {
    const openai = getOpenAIService();
    
    const mode = params.mode || 'exploration';
    
    // Build base prompt - NO LIMITING CATEGORIES!
    let prompt = `Generate a unique health topic.

Avoid these recent topics:
${params.recentTopics.length > 0 ? params.recentTopics.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n') : 'None yet - complete freedom'}

${params.overusedTopics.length > 0 ? `\nDo not use: ${params.overusedTopics.join(', ')}` : ''}
`;

    // Add mode-specific context
    if (mode === 'trending' && params.trending && params.trending.length > 0) {
      prompt += `\nTRENDING NOW (consider incorporating):
${params.trending.map((t: any) => `- ${t.topic || t}`).join('\n')}
`;
    } else if (mode === 'performance' && params.successful && params.successful.length > 0) {
      prompt += `\nThese performed well (learn from them):
${params.successful.map(t => `- "${t.topic}" (${t.avg_followers.toFixed(1)} followers)`).join('\n')}
`;
    } else {
      // Exploration mode - NO HINTS!
      prompt += `\nComplete creative freedom. Surprise me.
`;
    }

    if (params.forceMaxDiversity) {
      prompt += `\n⚠️ MAXIMUM DIVERSITY - be radically different from recent topics.\n`;
    }

    prompt += `\nReturn ONLY valid JSON:
{
  "topic": "your unique topic",
  "cluster": "your category (can be anything)",
  "reasoning": "why this will work",
  "keywords": ["key1", "key2", "key3"]
}`;

    try {
      // Adjust temperature based on mode
      let temperature = 0.9;
      if (mode === 'exploration' || params.forceMaxDiversity) {
        temperature = 1.0; // Maximum creativity for exploration
      } else if (mode === 'performance') {
        temperature = 0.7; // More focused when using successful patterns
      }
      
      console.log(`[TOPIC_GEN] 🌡️ Candidate ${params.candidateNumber || 1}: mode=${mode}, temp=${temperature}`);
      
      const response = await openai.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: 'gpt-4o',
          temperature,
          maxTokens: 300,
          response_format: { type: 'json_object' },
          requestType: `topic_gen_${mode}`
        }
      );
      
      const content = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(content);
      
      return {
        topic: parsed.topic || 'Generate completely unique health/wellness topic',
        cluster: parsed.cluster || 'health',
        reasoning: parsed.reasoning || 'AI generated unique topic',
        keywords: parsed.keywords || []
      };
    } catch (error: any) {
      console.error('[TOPIC_DIVERSITY] ❌ AI generation failed:', error.message);
      
      // Fallback: Generate a random unique topic
      return this.getFallbackTopic(params.recentTopics);
    }
  }

  /**
   * ✅ Verify topic uniqueness using semantic similarity
   */
  private async verifyTopicUniqueness(
    newTopic: string,
    recentTopics: string[]
  ): Promise<boolean> {
    const newTopicLower = newTopic.toLowerCase();
    
    // Check exact matches
    if (recentTopics.some(t => t === newTopicLower)) {
      return false;
    }
    
    // Check semantic similarity (keyword overlap)
    const newWords = new Set(newTopicLower.split(/\s+/).filter(w => w.length > 3));
    
    for (const recentTopic of recentTopics.slice(0, 10)) {
      const recentWords = new Set(recentTopic.split(/\s+/).filter(w => w.length > 3));
      
      // Calculate word overlap
      const overlap = [...newWords].filter(w => recentWords.has(w)).length;
      const similarity = overlap / Math.min(newWords.size, recentWords.size);
      
      // If more than 50% word overlap, consider it too similar
      if (similarity > 0.5) {
        console.log(`[TOPIC_DIVERSITY] ⚠️ Too similar to "${recentTopic}" (${(similarity * 100).toFixed(0)}% overlap)`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * 📝 Track generated topic for future diversity checks
   */
  private async trackGeneratedTopic(topic: TopicGenerationResult): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Store in a tracking table (lightweight, just for diversity)
      await supabase
        .from('generated_topics')
        .insert({
          topic: topic.topic,
          cluster: topic.cluster,
          keywords: topic.keywords,
          generated_at: new Date().toISOString()
        });
      
    } catch (error: any) {
      // Non-critical, just log
      console.warn('[TOPIC_DIVERSITY] ⚠️ Could not track topic:', error.message);
    }
  }

  /**
   * 🔄 Fallback topic generator (when AI fails)
   */
  private getFallbackTopic(recentTopics: string[]): TopicGenerationResult {
    // NO HARDCODED TOPICS - delegate to AI even in fallback
    // This ensures unlimited creative freedom
    console.log('[TOPIC_DIVERSITY] 🤖 Fallback: Delegating to AI for creativity');
    
    return {
      topic: 'Generate a completely unique health/wellness topic not covered in recent posts',
      cluster: 'health',
      reasoning: 'Fallback rare topic for diversity',
      keywords: ['health', 'wellness', 'unique']
    };
  }

  /**
   * 🔥 Get trending topics from ViralTrendMonitor
   * TODO: Integrate with actual ViralTrendMonitor when monitoring is active
   */
  private async getTrendingTopics(): Promise<any[]> {
    try {
      // For now, return empty array (trending integration disabled)
      // ViralTrendMonitor requires continuous monitoring to be active
      // Will integrate once monitoring service is running
      console.log(`[TOPIC_DIVERSITY] 🔥 Trending integration: Disabled (monitor not running)`);
      return [];
    } catch (error: any) {
      console.warn('[TOPIC_DIVERSITY] ⚠️ Could not get trending topics:', error.message);
      return [];
    }
  }

  /**
   * 📊 Get recent engagement rate
   */
  private async getRecentEngagement(): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      
      const { data } = await supabase
        .from('content_with_outcomes')  // ✅ ROOT CAUSE FIX: Use table with actual data
        .select('engagement_rate')
        .order('posted_at', { ascending: false })
        .limit(10);
      
      if (!data || data.length === 0) return 0;
      
      const avgEngagement = data.reduce((sum, p) => sum + (Number(p.engagement_rate) || 0), 0) / data.length;
      return avgEngagement;
    } catch (error: any) {
      console.warn('[TOPIC_DIVERSITY] ⚠️ Could not get recent engagement:', error.message);
      return 0.02; // Default to normal range
    }
  }

  /**
   * 📊 Score topic uniqueness (0-100 points)
   */
  private async scoreUniqueness(topic: string, recentTopics: string[]): Promise<number> {
    const topicLower = topic.toLowerCase();
    const topicWords = new Set(topicLower.split(/\s+/).filter(w => w.length > 3));
    
    if (recentTopics.length === 0) return 100; // Perfect uniqueness if no recent topics
    
    let minSimilarity = 1.0;
    
    for (const recentTopic of recentTopics.slice(0, 10)) {
      const recentWords = new Set(recentTopic.split(/\s+/).filter(w => w.length > 3));
      const overlap = [...topicWords].filter(w => recentWords.has(w)).length;
      const similarity = overlap / Math.max(topicWords.size, recentWords.size, 1);
      
      minSimilarity = Math.min(minSimilarity, similarity);
    }
    
    // Convert similarity to uniqueness score (inverse)
    const uniquenessScore = Math.round((1 - minSimilarity) * 100);
    
    return uniquenessScore;
  }

  /**
   * 🔥 Score alignment with trending topics (0-100 points)
   */
  private async scoreTrendingAlignment(topic: string, trendingTopics: any[]): Promise<number> {
    if (!trendingTopics || trendingTopics.length === 0) return 0;
    
    const topicLower = topic.toLowerCase();
    let maxAlignment = 0;
    
    for (const trend of trendingTopics) {
      const trendTopic = String(trend.topic || trend).toLowerCase();
      const trendWords = new Set(trendTopic.split(/\s+/));
      const topicWords = topicLower.split(/\s+/);
      
      // Check keyword overlap
      const matchingWords = topicWords.filter(w => trendWords.has(w)).length;
      const alignment = (matchingWords / Math.max(topicWords.length, trendWords.size, 1)) * 100;
      
      // Weight by trend strength if available
      const trendStrength = trend.trend_strength || 5;
      const weightedAlignment = alignment * (trendStrength / 10);
      
      maxAlignment = Math.max(maxAlignment, weightedAlignment);
    }
    
    return Math.round(maxAlignment);
  }
}

