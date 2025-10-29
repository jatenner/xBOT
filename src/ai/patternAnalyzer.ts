/**
 * PATTERN ANALYZER
 * Analyzes recent patterns and generates creativity recommendations
 */

import { createClient } from '@supabase/supabase-js';
import { ContentPatterns } from './patternExtractor';

export interface PatternFeedback {
  opening_patterns: {
    most_common_word: string;
    most_common_type: string;
    variety_score: number;
    recommendation: string;
  };
  structure_patterns: {
    most_common: string;
    variety_score: number;
    recommendation: string;
  };
  sentence_patterns: {
    avg_length: number;
    length_variety: number;
    recommendation: string;
  };
  ending_patterns: {
    most_common: string;
    variety_score: number;
    recommendation: string;
  };
  creativity_instructions: string;
}

export class PatternAnalyzer {
  private supabase: ReturnType<typeof createClient>;
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  
  /**
   * Analyze patterns from entire database with time-based weighting
   */
  async analyzeRecentPatterns(timeWindowDays: number = 30): Promise<PatternFeedback> {
    try {
      // Get patterns from the last 30 days (or all if less than 30 days of data)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
      
      let recentPatterns: any[] = [];
      const { data: recentData, error } = await this.supabase
        .from('content_patterns')
        .select('patterns, created_at')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching recent patterns:', error);
        return this.getDefaultFeedback();
      }
      
      recentPatterns = recentData || [];
      
      // If we don't have enough recent data, get all available patterns
      if (recentPatterns.length < 10) {
        console.log('📊 Not enough recent patterns, analyzing all available data...');
        const { data: allPatterns, error: allError } = await this.supabase
          .from('content_patterns')
          .select('patterns, created_at')
          .order('created_at', { ascending: false })
          .limit(100); // Cap at 100 for performance
        
        if (allError) {
          console.error('Error fetching all patterns:', allError);
          return this.getDefaultFeedback();
        }
        
        recentPatterns = allPatterns || [];
      }
      
      if (error) {
        console.error('Error fetching recent patterns:', error);
        return this.getDefaultFeedback();
      }
      
      if (!recentPatterns || recentPatterns.length === 0) {
        return this.getDefaultFeedback();
      }
      
      // Extract patterns from JSONB and apply time-based weighting
      const patternsWithWeights = recentPatterns.map((p: any) => ({
        patterns: p.patterns as ContentPatterns,
        weight: this.calculateTimeWeight(new Date(p.created_at), cutoffDate)
      }));
      
      console.log(`📊 Analyzing ${patternsWithWeights.length} posts with time-based weighting`);
      
      // Analyze each pattern type with weighting
      const openingAnalysis = this.analyzeOpeningsWeighted(patternsWithWeights);
      const structureAnalysis = this.analyzeStructuresWeighted(patternsWithWeights);
      const sentenceAnalysis = this.analyzeSentencesWeighted(patternsWithWeights);
      const endingAnalysis = this.analyzeEndingsWeighted(patternsWithWeights);
      
      // Generate creativity instructions
      const creativityInstructions = this.generateCreativityInstructions(
        openingAnalysis,
        structureAnalysis,
        sentenceAnalysis,
        endingAnalysis
      );
      
      return {
        opening_patterns: openingAnalysis,
        structure_patterns: structureAnalysis,
        sentence_patterns: sentenceAnalysis,
        ending_patterns: endingAnalysis,
        creativity_instructions: creativityInstructions
      };
      
    } catch (error) {
      console.error('Error in pattern analysis:', error);
      return this.getDefaultFeedback();
    }
  }
  
  /**
   * Calculate time-based weight (more recent = higher weight)
   */
  private calculateTimeWeight(postDate: Date, cutoffDate: Date): number {
    const daysDiff = (postDate.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24);
    // Recent posts get weight 1.0, older posts get exponentially less weight
    return Math.max(0.1, Math.exp(-daysDiff / 7)); // 7-day half-life
  }

  /**
   * Analyze opening patterns with time weighting
   */
  private analyzeOpeningsWeighted(patternsWithWeights: Array<{patterns: ContentPatterns, weight: number}>) {
    const openingWords = patternsWithWeights.map(p => ({ word: p.patterns.opening_word, weight: p.weight }));
    const openingTypes = patternsWithWeights.map(p => ({ type: p.patterns.opening_type, weight: p.weight }));
    
    const mostCommonWord = this.getMostCommonWeighted(openingWords.map(p => p.word), openingWords.map(p => p.weight));
    const mostCommonType = this.getMostCommonWeighted(openingTypes.map(p => p.type), openingTypes.map(p => p.weight));
    const varietyScore = this.calculateVarietyWeighted(openingWords.map(p => p.word), openingWords.map(p => p.weight));
    
    const recommendation = this.getOpeningRecommendation(mostCommonWord, mostCommonType, varietyScore);
    
    return {
      most_common_word: mostCommonWord,
      most_common_type: mostCommonType,
      variety_score: varietyScore,
      recommendation: recommendation
    };
  }

  /**
   * Analyze opening patterns (legacy method)
   */
  private analyzeOpenings(patterns: ContentPatterns[]) {
    const openingWords = patterns.map(p => p.opening_word);
    const openingTypes = patterns.map(p => p.opening_type);
    
    const mostCommonWord = this.getMostCommon(openingWords);
    const mostCommonType = this.getMostCommon(openingTypes);
    const varietyScore = this.calculateVariety(openingWords);
    
    const recommendation = this.getOpeningRecommendation(mostCommonWord, mostCommonType, varietyScore);
    
    return {
      most_common_word: mostCommonWord,
      most_common_type: mostCommonType,
      variety_score: varietyScore,
      recommendation: recommendation
    };
  }
  
  /**
   * Analyze structure patterns with time weighting
   */
  private analyzeStructuresWeighted(patternsWithWeights: Array<{patterns: ContentPatterns, weight: number}>) {
    const structures = patternsWithWeights.map(p => ({ structure: p.patterns.structure_type, weight: p.weight }));
    const mostCommon = this.getMostCommonWeighted(structures.map(p => p.structure), structures.map(p => p.weight));
    const varietyScore = this.calculateVarietyWeighted(structures.map(p => p.structure), structures.map(p => p.weight));
    
    const recommendation = this.getStructureRecommendation(mostCommon, varietyScore);
    
    return {
      most_common: mostCommon,
      variety_score: varietyScore,
      recommendation: recommendation
    };
  }

  /**
   * Analyze structure patterns (legacy method)
   */
  private analyzeStructures(patterns: ContentPatterns[]) {
    const structures = patterns.map(p => p.structure_type);
    const mostCommon = this.getMostCommon(structures);
    const varietyScore = this.calculateVariety(structures);
    
    const recommendation = this.getStructureRecommendation(mostCommon, varietyScore);
    
    return {
      most_common: mostCommon,
      variety_score: varietyScore,
      recommendation: recommendation
    };
  }
  
  /**
   * Analyze sentence patterns with time weighting
   */
  private analyzeSentencesWeighted(patternsWithWeights: Array<{patterns: ContentPatterns, weight: number}>) {
    const lengths = patternsWithWeights.map(p => ({ length: p.patterns.avg_sentence_length, weight: p.weight }));
    const totalWeight = lengths.reduce((sum, l) => sum + l.weight, 0);
    const avgLength = lengths.reduce((sum, l) => sum + (l.length * l.weight), 0) / totalWeight;
    const lengthVariety = this.calculateVarietyWeighted(lengths.map(l => l.length.toString()), lengths.map(l => l.weight));
    
    const recommendation = this.getSentenceRecommendation(avgLength, lengthVariety);
    
    return {
      avg_length: Math.round(avgLength),
      length_variety: lengthVariety,
      recommendation: recommendation
    };
  }

  /**
   * Analyze sentence patterns (legacy method)
   */
  private analyzeSentences(patterns: ContentPatterns[]) {
    const lengths = patterns.map(p => p.avg_sentence_length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const lengthVariety = this.calculateVariety(lengths.map(l => l.toString()));
    
    const recommendation = this.getSentenceRecommendation(avgLength, lengthVariety);
    
    return {
      avg_length: Math.round(avgLength),
      length_variety: lengthVariety,
      recommendation: recommendation
    };
  }
  
  /**
   * Analyze ending patterns with time weighting
   */
  private analyzeEndingsWeighted(patternsWithWeights: Array<{patterns: ContentPatterns, weight: number}>) {
    const endings = patternsWithWeights.map(p => ({ ending: p.patterns.ending_type, weight: p.weight }));
    const mostCommon = this.getMostCommonWeighted(endings.map(p => p.ending), endings.map(p => p.weight));
    const varietyScore = this.calculateVarietyWeighted(endings.map(p => p.ending), endings.map(p => p.weight));
    
    const recommendation = this.getEndingRecommendation(mostCommon, varietyScore);
    
    return {
      most_common: mostCommon,
      variety_score: varietyScore,
      recommendation: recommendation
    };
  }

  /**
   * Analyze ending patterns (legacy method)
   */
  private analyzeEndings(patterns: ContentPatterns[]) {
    const endings = patterns.map(p => p.ending_type);
    const mostCommon = this.getMostCommon(endings);
    const varietyScore = this.calculateVariety(endings);
    
    const recommendation = this.getEndingRecommendation(mostCommon, varietyScore);
    
    return {
      most_common: mostCommon,
      variety_score: varietyScore,
      recommendation: recommendation
    };
  }
  
  /**
   * Get most common item in array with weights
   */
  private getMostCommonWeighted<T>(items: T[], weights: number[]): T {
    const weightedCounts = new Map<T, number>();
    
    items.forEach((item, index) => {
      const weight = weights[index] || 1;
      weightedCounts.set(item, (weightedCounts.get(item) || 0) + weight);
    });
    
    let mostCommon = items[0];
    let maxWeightedCount = 0;
    
    weightedCounts.forEach((weightedCount, item) => {
      if (weightedCount > maxWeightedCount) {
        maxWeightedCount = weightedCount;
        mostCommon = item;
      }
    });
    
    return mostCommon;
  }

  /**
   * Get most common item in array (legacy method)
   */
  private getMostCommon<T>(arr: T[]): T {
    const counts = new Map<T, number>();
    arr.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });
    
    let mostCommon = arr[0];
    let maxCount = 0;
    
    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });
    
    return mostCommon;
  }
  
  /**
   * Calculate variety score with weights (0-100)
   */
  private calculateVarietyWeighted<T>(items: T[], weights: number[]): number {
    const uniqueItems = new Set(items);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const uniqueWeight = uniqueItems.size * (totalWeight / items.length);
    return Math.round((uniqueWeight / totalWeight) * 100);
  }

  /**
   * Calculate variety score (0-100) - legacy method
   */
  private calculateVariety<T>(arr: T[]): number {
    const unique = new Set(arr).size;
    const total = arr.length;
    return Math.round((unique / total) * 100);
  }
  
  /**
   * Generate opening recommendations
   */
  private getOpeningRecommendation(mostCommonWord: string, mostCommonType: string, varietyScore: number): string {
    if (varietyScore < 60) {
      return `Avoid starting with "${mostCommonWord}" (used too often). Try different opening words and types.`;
    }
    return `Good variety in openings. Continue experimenting with different words and types.`;
  }
  
  /**
   * Generate structure recommendations
   */
  private getStructureRecommendation(mostCommon: string, varietyScore: number): string {
    if (varietyScore < 60) {
      return `Avoid "${mostCommon}" structure (overused). Try different content structures.`;
    }
    return `Good variety in structures. Continue experimenting with different approaches.`;
  }
  
  /**
   * Generate sentence recommendations
   */
  private getSentenceRecommendation(avgLength: number, varietyScore: number): string {
    if (varietyScore < 60) {
      return `Vary sentence lengths more dramatically. Mix short and long sentences.`;
    }
    return `Good sentence variety. Continue mixing different lengths.`;
  }
  
  /**
   * Generate ending recommendations
   */
  private getEndingRecommendation(mostCommon: string, varietyScore: number): string {
    if (varietyScore < 60) {
      return `Avoid ending with "${mostCommon}" (overused). Try different ending types.`;
    }
    return `Good variety in endings. Continue experimenting with different conclusions.`;
  }
  
  /**
   * Generate overall creativity instructions
   */
  private generateCreativityInstructions(
    opening: any,
    structure: any,
    sentence: any,
    ending: any
  ): string {
    const instructions = [];
    
    if (opening.variety_score < 60) {
      instructions.push(`- Start with different word than "${opening.most_common_word}"`);
      instructions.push(`- Use different opening type than "${opening.most_common_type}"`);
    }
    
    if (structure.variety_score < 60) {
      instructions.push(`- Avoid "${structure.most_common}" structure`);
    }
    
    if (sentence.length_variety < 60) {
      instructions.push(`- Mix short and long sentences dramatically`);
    }
    
    if (ending.variety_score < 60) {
      instructions.push(`- End differently than "${ending.most_common}"`);
    }
    
    if (instructions.length === 0) {
      instructions.push(`- Continue experimenting with creative approaches`);
      instructions.push(`- Surprise people with unexpected presentation`);
    }
    
    return instructions.join('\n');
  }
  
  /**
   * Get default feedback when no patterns available
   */
  private getDefaultFeedback(): PatternFeedback {
    return {
      opening_patterns: {
        most_common_word: 'none',
        most_common_type: 'other',
        variety_score: 100,
        recommendation: 'No recent patterns - experiment freely!'
      },
      structure_patterns: {
        most_common: 'other',
        variety_score: 100,
        recommendation: 'No recent patterns - try any structure!'
      },
      sentence_patterns: {
        avg_length: 15,
        length_variety: 100,
        recommendation: 'No recent patterns - vary sentence lengths!'
      },
      ending_patterns: {
        most_common: 'statement',
        variety_score: 100,
        recommendation: 'No recent patterns - experiment with endings!'
      },
      creativity_instructions: '- Experiment freely with any approach\n- Surprise people with creative presentation'
    };
  }
}
