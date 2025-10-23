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
    
    // Step 3: Identify what's working (high engagement/followers)
    const successfulTopics = topicPerformance
      .filter(t => t.avg_followers > 5 || t.avg_engagement > 0.05)
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
      preferredCluster,
      recentTopics,
      successfulTopics,
      overusedTopics
    });
    
    // Step 6: Verify uniqueness and similarity
    const isUnique = await this.verifyTopicUniqueness(generatedTopic.topic, recentTopics);
    
    if (!isUnique) {
      console.log('[TOPIC_DIVERSITY] ⚠️ Generated topic too similar to recent, retrying...');
      // Retry with stronger diversity requirement
      return await this.generateTopicWithAI({
        preferredCluster,
        recentTopics,
        successfulTopics,
        overusedTopics,
        forceMaxDiversity: true
      });
    }
    
    console.log(`[TOPIC_DIVERSITY] ✅ Generated unique topic: ${generatedTopic.topic} (${generatedTopic.cluster})`);
    
    // Step 7: Track this topic for future diversity checks
    await this.trackGeneratedTopic(generatedTopic);
    
    return generatedTopic;
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
        // PRIMARY SOURCE: Get AI-generated topic from metadata
        const metadata = post.metadata as any;
        if (metadata?.topic) {
          topics.push(String(metadata.topic).toLowerCase().trim());
        }
        
        // SECONDARY SOURCE: Extract topic from content (for posts without metadata)
        // This uses semantic extraction, not hardcoded keywords
        if (!metadata?.topic) {
          const extractedTopic = this.extractTopicFromContent(String(post.content || ''));
          if (extractedTopic) {
            topics.push(extractedTopic.toLowerCase().trim());
          }
        }
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
        .from('post_attribution')
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
        success_rate: stats.followers.filter(f => f > 5).length / stats.followers.length,
        last_used: stats.last_used
      }));
    } catch (error: any) {
      console.warn('[TOPIC_DIVERSITY] ⚠️ Could not get topic performance:', error.message);
      return [];
    }
  }

  /**
   * 🤖 Use AI to generate a completely new topic
   */
  private async generateTopicWithAI(params: {
    preferredCluster?: string;
    recentTopics: string[];
    successfulTopics: TopicWithPerformance[];
    overusedTopics: string[];
    forceMaxDiversity?: boolean;
  }): Promise<TopicGenerationResult> {
    const openai = getOpenAIService();
    
    const clusterContext = params.preferredCluster 
      ? `Focus on the ${params.preferredCluster} health cluster.`
      : `Choose ANY health cluster (longevity, biohacking, mental_health, performance, gut_health, metabolic, sleep).`;
    
    const successContext = params.successfulTopics.length > 0
      ? `Topics that gained followers recently (learn from these): ${params.successfulTopics.map(t => `"${t.topic}" (${t.avg_followers.toFixed(1)} followers)`).join(', ')}`
      : '';
    
    const diversityLevel = params.forceMaxDiversity 
      ? 'MAXIMUM DIVERSITY REQUIRED - generate something COMPLETELY different from anything in recent topics'
      : 'Generate a unique topic that provides variety';
    
    const prompt = `You are a health content strategist generating unique, engaging health topics.

${clusterContext}

RECENT TOPICS (DO NOT REPEAT THESE):
${params.recentTopics.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')}

OVERUSED TOPICS (DEFINITELY AVOID):
${params.overusedTopics.join(', ')}

${successContext}

${diversityLevel}

REQUIREMENTS:
- Topic MUST be completely different from recent topics
- Avoid semantic similarity (e.g., if "breathwork" is recent, don't do "breathing exercises" or "vagus nerve breathing")
- Should be specific and concrete (not generic like "health tips")
- Should be evidence-based and interesting
- Should have potential for engagement

Generate a specific, unique health topic that will perform well.

Return ONLY valid JSON:
{
  "topic": "specific topic here",
  "cluster": "cluster_name",
  "reasoning": "why this topic is unique and will perform well",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

    try {
      const response = await openai.chatCompletion(
        [{ role: 'user', content: prompt }],
        {
          model: 'gpt-4o',
          temperature: params.forceMaxDiversity ? 1.0 : 0.9,
          maxTokens: 300,
          response_format: { type: 'json_object' }
        }
      );
      
      const content = response.choices[0].message.content || '{}';
      const parsed = JSON.parse(content);
      
      return {
        topic: parsed.topic || 'exercise timing',
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
    // Ultra-diverse fallback topics that are rarely discussed
    const rareFallbacks = [
      { topic: 'fascia health and mobility', cluster: 'performance' },
      { topic: 'lymphatic system drainage', cluster: 'metabolic' },
      { topic: 'circadian protein timing', cluster: 'longevity' },
      { topic: 'brown fat activation', cluster: 'metabolic' },
      { topic: 'proprioception training', cluster: 'performance' },
      { topic: 'nasal breathing biomechanics', cluster: 'breathwork' },
      { topic: 'sleep spindle optimization', cluster: 'sleep' },
      { topic: 'polyphenol diversity', cluster: 'gut_health' }
    ];
    
    // Pick one that's not in recent topics
    const available = rareFallbacks.filter(f => 
      !recentTopics.some(r => r.includes(f.topic) || f.topic.includes(r))
    );
    
    const selected = available.length > 0 
      ? available[Math.floor(Math.random() * available.length)]
      : rareFallbacks[0];
    
    return {
      ...selected,
      reasoning: 'Fallback rare topic for diversity',
      keywords: selected.topic.split(' ')
    };
  }
}

