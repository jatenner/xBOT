/**
 * 🔬 REAL RESEARCH FETCHER
 * 
 * Provides credible research citations for replies and content generation
 */

import { secureSupabaseClient } from '../utils/secureSupabaseClient';

export interface ResearchCitation {
  id: number;
  topic: string;
  citationText: string;
  sourceUrl?: string;
  pubmedId?: string;
  credibilityScore: number;
  usageCount: number;
  effectivenessScore: number;
}

export class RealResearchFetcher {
  private static instance: RealResearchFetcher;

  private constructor() {}

  static getInstance(): RealResearchFetcher {
    if (!RealResearchFetcher.instance) {
      RealResearchFetcher.instance = new RealResearchFetcher();
    }
    return RealResearchFetcher.instance;
  }

  /**
   * 🎯 Get best citation for a specific topic
   */
  async fetchCitation(topic: string): Promise<ResearchCitation | null> {
    try {
      console.log(`🔬 Fetching citation for topic: ${topic}`);

      // Normalize topic for database lookup
      const normalizedTopic = this.normalizeTopic(topic);

      if (!secureSupabaseClient.supabase) {
        console.error('❌ Supabase client not available');
        return this.getFallbackCitation(topic);
      }

      const { data, error } = await secureSupabaseClient.supabase
        .from('research_citations')
        .select('*')
        .eq('topic', normalizedTopic)
        .order('effectiveness_score', { ascending: false })
        .order('credibility_score', { ascending: false })
        .limit(3);

      if (error) {
        console.error('❌ Database error fetching citation:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️ No citations found for topic: ${normalizedTopic}`);
        return this.getFallbackCitation(topic);
      }

      // Select citation with lowest recent usage
      const selectedCitation = this.selectOptimalCitation(data);
      
      // Update usage count
      await this.incrementUsageCount(selectedCitation.id);

      console.log(`✅ Selected citation: "${selectedCitation.citation_text.substring(0, 60)}..."`);
      
      return {
        id: selectedCitation.id,
        topic: selectedCitation.topic,
        citationText: selectedCitation.citation_text,
        sourceUrl: selectedCitation.source_url,
        pubmedId: selectedCitation.pubmed_id,
        credibilityScore: selectedCitation.credibility_score,
        usageCount: selectedCitation.usage_count,
        effectivenessScore: selectedCitation.effectiveness_score
      };

    } catch (error) {
      console.error('❌ Error fetching citation:', error);
      return this.getFallbackCitation(topic);
    }
  }

  /**
   * 🔄 Normalize topic names for consistent lookup
   */
  private normalizeTopic(topic: string): string {
    const topicMap: { [key: string]: string } = {
      'longevity_science': 'longevity',
      'longevity_medicine': 'longevity',
      'aging_research': 'longevity',
      'nutrition_science': 'nutrition',
      'nutrition_myths': 'nutrition',
      'clinical_nutrition': 'nutrition',
      'functional_medicine': 'nutrition',
      'gut_health': 'nutrition',
      'womens_health': 'nutrition',
      'natural_health': 'nutrition',
      'autoimmune': 'nutrition',
      'neuroscience': 'exercise',
      'biohacking': 'supplements',
      'fitness': 'exercise',
      'performance': 'exercise',
      'mental_performance': 'stress',
      'hormones': 'stress'
    };

    const normalized = topicMap[topic.toLowerCase()] || topic.toLowerCase();
    
    // If still no match, try partial matching
    if (!['longevity', 'nutrition', 'exercise', 'sleep', 'stress', 'supplements'].includes(normalized)) {
      if (topic.includes('nutrition') || topic.includes('diet')) return 'nutrition';
      if (topic.includes('exercise') || topic.includes('fitness')) return 'exercise';
      if (topic.includes('sleep') || topic.includes('circadian')) return 'sleep';
      if (topic.includes('stress') || topic.includes('mental')) return 'stress';
      if (topic.includes('supplement') || topic.includes('vitamin')) return 'supplements';
      if (topic.includes('longevity') || topic.includes('aging')) return 'longevity';
    }

    return normalized;
  }

  /**
   * 🎯 Select optimal citation from available options
   */
  private selectOptimalCitation(citations: any[]): any {
    // Prefer citations with lower usage count (for variety)
    // But also consider effectiveness and credibility
    return citations.reduce((best, current) => {
      const bestScore = (best.effectiveness_score * 0.4) + 
                       (best.credibility_score * 0.4) + 
                       ((10 - Math.min(best.usage_count, 10)) * 0.2);
      
      const currentScore = (current.effectiveness_score * 0.4) + 
                          (current.credibility_score * 0.4) + 
                          ((10 - Math.min(current.usage_count, 10)) * 0.2);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * 📈 Increment usage count for tracking
   */
  private async incrementUsageCount(citationId: number): Promise<void> {
    try {
      if (!secureSupabaseClient.supabase) {
        console.error('❌ Supabase client not available');
        return;
      }

      // First get current usage count
      const { data: currentData } = await secureSupabaseClient.supabase
        .from('research_citations')
        .select('usage_count')
        .eq('id', citationId)
        .single();

      const newUsageCount = (currentData?.usage_count || 0) + 1;

      const { error } = await secureSupabaseClient.supabase
        .from('research_citations')
        .update({ 
          usage_count: newUsageCount,
          last_used: new Date().toISOString()
        })
        .eq('id', citationId);

      if (error) {
        console.error('❌ Failed to update citation usage:', error);
      }
    } catch (error) {
      console.error('❌ Usage count update error:', error);
    }
  }

  /**
   * 🔄 Get fallback citation when database lookup fails
   */
  private getFallbackCitation(topic: string): ResearchCitation {
    const fallbacks: { [key: string]: string } = {
      longevity: 'Research suggests certain lifestyle interventions may impact aging biomarkers',
      nutrition: 'Multiple studies indicate diet quality correlates with health outcomes',
      exercise: 'Exercise research demonstrates significant metabolic and cognitive benefits',
      sleep: 'Sleep research consistently shows impacts on recovery and performance',
      stress: 'Chronic stress research indicates effects on multiple physiological systems',
      supplements: 'Supplement research shows variable efficacy depending on individual status'
    };

    const normalizedTopic = this.normalizeTopic(topic);
    const fallbackText = fallbacks[normalizedTopic] || 'Research in this area continues to evolve';

    return {
      id: -1,
      topic: normalizedTopic,
      citationText: fallbackText,
      credibilityScore: 0.7,
      usageCount: 0,
      effectivenessScore: 0.5
    };
  }

  /**
   * 📚 Get multiple citations for comprehensive content
   */
  async fetchMultipleCitations(topics: string[], limit: number = 3): Promise<ResearchCitation[]> {
    const citations: ResearchCitation[] = [];

    for (const topic of topics) {
      const citation = await this.fetchCitation(topic);
      if (citation) {
        citations.push(citation);
      }
      
      if (citations.length >= limit) break;
    }

    return citations;
  }

  /**
   * 🆕 Add new research citation to database
   */
  async addCitation(citation: Omit<ResearchCitation, 'id' | 'usageCount' | 'effectivenessScore'>): Promise<boolean> {
    try {
      if (!secureSupabaseClient.supabase) {
        console.error('❌ Supabase client not available');
        return false;
      }

      const { error } = await secureSupabaseClient.supabase
        .from('research_citations')
        .insert({
          topic: citation.topic,
          citation_text: citation.citationText,
          source_url: citation.sourceUrl,
          pubmed_id: citation.pubmedId,
          credibility_score: citation.credibilityScore,
          usage_count: 0,
          effectiveness_score: 0.5
        });

      if (error) {
        console.error('❌ Failed to add citation:', error);
        return false;
      }

      console.log('✅ Added new citation to database');
      return true;
    } catch (error) {
      console.error('❌ Citation addition error:', error);
      return false;
    }
  }

  /**
   * 📊 Update citation effectiveness based on engagement
   */
  async updateCitationEffectiveness(citationId: number, engagementRate: number): Promise<void> {
    try {
      if (!secureSupabaseClient.supabase) {
        console.error('❌ Supabase client not available');
        return;
      }

      // Convert engagement rate to effectiveness score (0-1)
      const effectivenessScore = Math.min(Math.max(engagementRate / 0.1, 0), 1);

      const { error } = await secureSupabaseClient.supabase
        .from('research_citations')
        .update({ effectiveness_score: effectivenessScore })
        .eq('id', citationId);

      if (error) {
        console.error('❌ Failed to update effectiveness:', error);
      } else {
        console.log(`✅ Updated citation ${citationId} effectiveness: ${effectivenessScore.toFixed(2)}`);
      }
    } catch (error) {
      console.error('❌ Effectiveness update error:', error);
    }
  }

  /**
   * 📈 Get research fetcher statistics
   */
  async getStats(): Promise<{
    totalCitations: number;
    citationsByTopic: { [topic: string]: number };
    mostUsedCitations: Array<{ topic: string; citationText: string; usageCount: number }>;
    avgCredibilityScore: number;
  }> {
    try {
      if (!secureSupabaseClient.supabase) {
        console.error('❌ Supabase client not available');
        return {
          totalCitations: 0,
          citationsByTopic: {},
          mostUsedCitations: [],
          avgCredibilityScore: 0
        };
      }

      const { data } = await secureSupabaseClient.supabase
        .from('research_citations')
        .select('*');

      if (!data) {
        return {
          totalCitations: 0,
          citationsByTopic: {},
          mostUsedCitations: [],
          avgCredibilityScore: 0
        };
      }

      const citationsByTopic: { [topic: string]: number } = {};
      let totalCredibility = 0;

      data.forEach(citation => {
        citationsByTopic[citation.topic] = (citationsByTopic[citation.topic] || 0) + 1;
        totalCredibility += citation.credibility_score;
      });

      const mostUsed = data
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 5)
        .map(c => ({
          topic: c.topic,
          citationText: c.citation_text.substring(0, 80) + '...',
          usageCount: c.usage_count
        }));

      return {
        totalCitations: data.length,
        citationsByTopic,
        mostUsedCitations: mostUsed,
        avgCredibilityScore: data.length > 0 ? totalCredibility / data.length : 0
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return {
        totalCitations: 0,
        citationsByTopic: {},
        mostUsedCitations: [],
        avgCredibilityScore: 0
      };
    }
  }
}

export const realResearchFetcher = RealResearchFetcher.getInstance(); 