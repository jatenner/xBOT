/**
 * Content Orchestrator
 * 
 * Integrates the Social Content Operator with the existing xBOT posting system
 */

import { SocialContentOperator } from './SocialContentOperator';
import { getBrandProfile } from './brandProfiles';
import { QualityGate } from './qualityGate';

interface ContentRequest {
  type: 'single' | 'thread' | 'reply';
  topic?: string;
  targetPost?: {
    content: string;
    author: string;
    context?: string;
  };
  brandType?: 'health' | 'productivity' | 'mindfulness';
  urgency?: 'low' | 'medium' | 'high';
}

interface GeneratedContent {
  content: string[];
  type: 'single' | 'thread' | 'reply';
  qualityScore: number;
  metadata: {
    hook: string;
    template?: string;
    topic: string;
    brandType: string;
  };
}

export class ContentOrchestrator {
  private socialOperator: SocialContentOperator;
  private qualityGate: QualityGate;

  constructor(brandType: 'health' | 'productivity' | 'mindfulness' = 'health') {
    const brandProfile = getBrandProfile(brandType);
    this.socialOperator = new SocialContentOperator(brandProfile);
    this.qualityGate = new QualityGate();
  }

  /**
   * Generate content for the xBOT posting system
   */
  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    const brandType = request.brandType || 'health';
    
    try {
      switch (request.type) {
        case 'single':
          return await this.generateSingle(request);
        case 'thread':
          return await this.generateThread(request);
        case 'reply':
          return await this.generateReply(request);
        default:
          throw new Error(`Unsupported content type: ${request.type}`);
      }
    } catch (error) {
      console.error('Content generation failed:', error);
      throw new Error(`Failed to generate ${request.type} content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a single post
   */
  private async generateSingle(request: ContentRequest): Promise<GeneratedContent> {
    const topic = request.topic || 'health optimization';
    const seed = {
      topic,
      priority: 'high' as const
    };

    // Use the social operator to generate singles
    const contentPack = await this.socialOperator.generateContentPack([seed], [], [], []);
    
    if (contentPack.singles.length === 0) {
      throw new Error('Failed to generate single post');
    }

    const content = contentPack.singles[0];
    const evaluation = await this.qualityGate.evaluateThread([content]);

    return {
      content: [content],
      type: 'single',
      qualityScore: evaluation.score.overallScore,
      metadata: {
        hook: this.extractHook(content),
        topic,
        brandType: request.brandType || 'health'
      }
    };
  }

  /**
   * Generate a thread
   */
  private async generateThread(request: ContentRequest): Promise<GeneratedContent> {
    const topic = request.topic || 'health optimization';
    const seed = {
      topic,
      priority: 'high' as const
    };

    const contentPack = await this.socialOperator.generateContentPack([seed], [], [], []);
    
    if (contentPack.threads.length === 0) {
      throw new Error('Failed to generate thread');
    }

    const thread = contentPack.threads[0];
    const evaluation = await this.qualityGate.evaluateThread(thread.tweets);

    return {
      content: thread.tweets,
      type: 'thread',
      qualityScore: evaluation.score.overallScore,
      metadata: {
        hook: thread.tweets[0] || '',
        template: thread.template,
        topic,
        brandType: request.brandType || 'health'
      }
    };
  }

  /**
   * Generate a reply
   */
  private async generateReply(request: ContentRequest): Promise<GeneratedContent> {
    if (!request.targetPost) {
      throw new Error('Target post is required for reply generation');
    }

    const targetPost = {
      author: request.targetPost.author,
      handle: `@${request.targetPost.author}`,
      url: '',
      content: request.targetPost.content,
      quotedDetail: request.targetPost.context || request.targetPost.content.slice(0, 50),
      stance: 'add_nuance' as const,
      goal: 'Provide helpful, relevant response'
    };

    const contentPack = await this.socialOperator.generateContentPack([], [], [targetPost], []);
    
    if (contentPack.replies.length === 0) {
      throw new Error('Failed to generate reply');
    }

    const reply = contentPack.replies[0];
    const evaluation = await this.qualityGate.evaluateReply(reply.response, request.targetPost.content);

    return {
      content: [reply.response],
      type: 'reply',
      qualityScore: evaluation.score.overallScore,
      metadata: {
        hook: reply.response.slice(0, 50) + '...',
        topic: request.topic || 'reply',
        brandType: request.brandType || 'health'
      }
    };
  }

  /**
   * Extract hook from content
   */
  private extractHook(content: string): string {
    // Extract first sentence or up to first punctuation
    const sentences = content.split(/[.!?]+/);
    return sentences[0]?.trim() || content.slice(0, 100);
  }

  /**
   * Get content suggestions based on recent performance
   */
  async getContentSuggestions(recentPosts: any[] = []): Promise<{
    recommendedTopics: string[];
    avoidPatterns: string[];
    nextExperiments: string[];
  }> {
    try {
      const contentPack = await this.socialOperator.generateContentPack([], recentPosts, [], []);
      
      return {
        recommendedTopics: contentPack.learningNotes.doMore,
        avoidPatterns: contentPack.learningNotes.avoid,
        nextExperiments: contentPack.learningNotes.experiments
      };
    } catch (error) {
      console.error('Failed to get content suggestions:', error);
      return {
        recommendedTopics: ['Focus on specific, actionable health tips'],
        avoidPatterns: ['Avoid vague, generic advice'],
        nextExperiments: ['Test personal result hooks vs research-based hooks']
      };
    }
  }

  /**
   * Validate content meets brand standards
   */
  async validateContent(content: string[], type: 'single' | 'thread' | 'reply'): Promise<{
    isValid: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const evaluation = type === 'reply' 
        ? await this.qualityGate.evaluateReply(content[0], '')
        : await this.qualityGate.evaluateThread(content);

      return {
        isValid: evaluation.passed,
        score: evaluation.score.overallScore,
        issues: evaluation.passed ? [] : ['Content does not meet quality threshold'],
        suggestions: evaluation.suggestions || []
      };
    } catch (error) {
      return {
        isValid: false,
        score: 0,
        issues: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
        suggestions: ['Try regenerating with different parameters']
      };
    }
  }

  /**
   * Get brand-specific content guidelines
   */
  getBrandGuidelines(brandType: 'health' | 'productivity' | 'mindfulness' = 'health'): {
    voice: string[];
    constraints: string[];
    preferredTopics: string[];
    avoidedTopics: string[];
  } {
    const brand = getBrandProfile(brandType);

    return {
      voice: brand.identity.voice.doList,
      constraints: brand.constraints.compliance,
      preferredTopics: brand.identity.uniquePOV,
      avoidedTopics: brand.constraints.bannedTopics
    };
  }
}

// Export singleton instance for easy integration
export const contentOrchestrator = new ContentOrchestrator('health');
