/**
 * NARRATIVE ENGINE
 * Identifies opportunities to reference previous posts and build narratives
 */

import { getPostHistory, PostRecord } from './postHistory';

export interface NarrativeOpportunity {
  type: 'callback' | 'continuation' | 'answer_question' | 'expansion';
  previousPost: PostRecord;
  suggestion: string;
  confidence: number;
}

export class NarrativeEngine {
  private static instance: NarrativeEngine;
  
  private constructor() {}
  
  public static getInstance(): NarrativeEngine {
    if (!NarrativeEngine.instance) {
      NarrativeEngine.instance = new NarrativeEngine();
    }
    return NarrativeEngine.instance;
  }
  
  /**
   * Find narrative opportunities based on recent posts
   */
  async findNarrativeOpportunities(currentTopic: string): Promise<NarrativeOpportunity | null> {
    const postHistory = getPostHistory();
    const recentPosts = postHistory.getRecentPosts(15);
    
    if (recentPosts.length === 0) {
      return null;
    }
    
    // CALLBACK OPPORTUNITY: Reference post from 3-7 days ago
    const callbackPost = recentPosts.find((p, idx) => 
      idx >= 3 && idx <= 7 && 
      this.areTopicsRelated(currentTopic, p.topic)
    );
    
    if (callbackPost) {
      return {
        type: 'callback',
        previousPost: callbackPost,
        suggestion: `Reference your previous post about ${callbackPost.topic} to create continuity`,
        confidence: 0.8
      };
    }
    
    // CONTINUATION: Build on yesterday's post
    const yesterdayPost = recentPosts[0];
    if (yesterdayPost && this.areTopicsRelated(currentTopic, yesterdayPost.topic)) {
      return {
        type: 'continuation',
        previousPost: yesterdayPost,
        suggestion: `Build on yesterday's ${yesterdayPost.topic} post`,
        confidence: 0.9
      };
    }
    
    // EXPANSION: Dive deeper into recent topic
    const expandablePost = recentPosts.find((p, idx) =>
      idx >= 1 && idx <= 5 &&
      p.content.length < 500 && // Was a short post, could expand
      this.areTopicsRelated(currentTopic, p.topic)
    );
    
    if (expandablePost) {
      return {
        type: 'expansion',
        previousPost: expandablePost,
        suggestion: `Expand on the ${expandablePost.topic} post with more depth`,
        confidence: 0.7
      };
    }
    
    return null;
  }
  
  /**
   * Check if two topics are related
   */
  private areTopicsRelated(topic1: string, topic2: string): boolean {
    const t1 = topic1.toLowerCase();
    const t2 = topic2.toLowerCase();
    
    // Direct match
    if (t1.includes(t2) || t2.includes(t1)) {
      return true;
    }
    
    // Related concepts
    const relatedGroups = [
      ['sleep', 'rest', 'recovery', 'circadian'],
      ['protein', 'nutrition', 'diet', 'eating'],
      ['exercise', 'fitness', 'training', 'workout'],
      ['stress', 'cortisol', 'anxiety', 'mental health'],
      ['longevity', 'aging', 'lifespan', 'healthspan']
    ];
    
    for (const group of relatedGroups) {
      const t1Match = group.some(word => t1.includes(word));
      const t2Match = group.some(word => t2.includes(word));
      if (t1Match && t2Match) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Generate narrative context for generator
   */
  getNarrativeContext(opportunity: NarrativeOpportunity | null): string {
    if (!opportunity) {
      return '';
    }
    
    switch (opportunity.type) {
      case 'callback':
        // NO META REFERENCES - Just give the topic, let AI make natural connections
        return `Related to previous content on: ${opportunity.previousPost.topic}. Make a natural connection if relevant, but don't explicitly reference "your post" or "remember that post".`;
      
      case 'continuation':
        return `Previously covered: ${opportunity.previousPost.topic}. Build on this naturally without meta-references.`;
      
      case 'expansion':
        return `Topic relates to: ${opportunity.previousPost.topic}. Dive deeper without saying "let's expand on..." - just do it.`;
      
      case 'answer_question':
        return `Related question about: ${opportunity.previousPost.topic}. Answer it directly without meta-commentary.`;
      
      default:
        return '';
    }
  }
}

export const getNarrativeEngine = () => NarrativeEngine.getInstance();

