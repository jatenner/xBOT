/**
 * 🎨 PROFILE OPTIMIZER
 * 
 * Generates optimized bio and pinned tweet strategies
 * to maximize follower conversion
 */

interface OptimizedProfile {
  bio: string;
  pinned_tweet_strategy: 'showcase' | 'value_prop' | 'social_proof';
  pinned_tweet_content?: string;
  reasoning: string;
}

export class ProfileOptimizer {
  private static instance: ProfileOptimizer;

  private constructor() {}

  public static getInstance(): ProfileOptimizer {
    if (!ProfileOptimizer.instance) {
      ProfileOptimizer.instance = new ProfileOptimizer();
    }
    return ProfileOptimizer.instance;
  }

  /**
   * Generate optimized profile bio
   */
  generateOptimizedBio(): string {
    // For health/science account
    const bios = [
      "Distilling 1000+ health studies into threads you can actually use\nEvidence-based health optimization | No BS",
      
      "Breaking down complex health science into simple, actionable insights\nFormer burnout → Now teaching sustainable health",
      
      "Reading 50 studies/week so you don't have to\nThreads on nutrition, longevity, and performance optimization",
      
      "Your guide to evidence-based health\nBusting myths | Sharing studies | Optimizing performance\nFollow for weekly threads",
      
      "Health scientist turned Twitter educator\nTurning research into results | Threads on what actually works"
    ];

    return bios[Math.floor(Math.random() * bios.length)];
  }

  /**
   * Get pinned tweet strategy based on account maturity
   */
  getPinnedTweetStrategy(followerCount: number): OptimizedProfile {
    if (followerCount < 100) {
      // Early stage: Value proposition
      return {
        bio: this.generateOptimizedBio(),
        pinned_tweet_strategy: 'value_prop',
        pinned_tweet_content: `I read 50 health studies/week so you don't have to.

Every week, I share:
→ Evidence-based health threads
→ Myth-busting deep dives  
→ Actionable optimization strategies

Follow to level up your health game 🧠`,
        reasoning: 'Early stage accounts need clear value prop to convert visitors'
      };
    } else if (followerCount < 1000) {
      // Growth stage: Showcase best thread
      return {
        bio: this.generateOptimizedBio(),
        pinned_tweet_strategy: 'showcase',
        pinned_tweet_content: undefined, // Pin your best-performing thread
        reasoning: 'Pin your highest-engagement thread to show quality and encourage follows'
      };
    } else {
      // Established: Social proof
      return {
        bio: this.generateOptimizedBio(),
        pinned_tweet_strategy: 'social_proof',
        pinned_tweet_content: `This thread got 10K+ likes and people said it changed their lives.

If you haven't read it yet, here's everything you need to know about [topic]:

[Link to viral thread]`,
        reasoning: 'Leverage social proof to build credibility and trust'
      };
    }
  }

  /**
   * Get profile optimization recommendations
   */
  getRecommendations(currentState: {
    bio?: string;
    has_pinned_tweet: boolean;
    follower_count: number;
    avg_profile_click_rate: number;
  }): string[] {
    const recommendations: string[] = [];

    // Bio recommendations
    if (!currentState.bio || currentState.bio.length < 50) {
      recommendations.push('🔴 CRITICAL: Add a compelling bio that clearly states your value proposition');
    } else if (!currentState.bio.includes('thread') && !currentState.bio.includes('study')) {
      recommendations.push('⚠️ Bio should mention what content format you provide (e.g., "threads", "studies")');
    }

    // Pinned tweet recommendations
    if (!currentState.has_pinned_tweet) {
      recommendations.push('🔴 CRITICAL: Pin a tweet! This is your conversion tool when people visit your profile');
    }

    // Profile click rate
    if (currentState.avg_profile_click_rate < 0.03) {
      recommendations.push('⚠️ Low profile click rate (<3%). Your content may not be compelling enough to make people check your profile');
    }

    // Follower count specific
    if (currentState.follower_count < 100) {
      recommendations.push('💡 Focus on strategic replies to big accounts to drive profile visits');
    } else if (currentState.follower_count < 1000) {
      recommendations.push('💡 Pin your best-performing thread to showcase your quality');
    }

    return recommendations;
  }
}

export const getProfileOptimizer = () => ProfileOptimizer.getInstance();

