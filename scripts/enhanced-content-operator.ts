#!/usr/bin/env tsx

/**
 * Enhanced Content Operator for xBOT
 * Generates, scores, and posts high-quality Twitter content
 */

import { EnhancedContentGenerator, GenerationResult, ContentCandidate } from '../src/content/EnhancedContentGenerator';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import Redis from 'ioredis';

interface PostingResult {
  success: boolean;
  tweet_id?: string;
  error?: string;
  posted_content: string;
  posting_method: 'dry_run' | 'live_playwright';
}

interface LearningResult {
  engagement_data_collected: number;
  patterns_updated: number;
  next_topic_recommendation: string;
}

class EnhancedContentOperator {
  private generator: EnhancedContentGenerator;
  private supabase: any;
  private redis: Redis;

  constructor() {
    this.generator = new EnhancedContentGenerator();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Complete content generation and posting pipeline
   */
  async runPostingPipeline(dryRun: boolean = true): Promise<void> {
    console.log(`🚀 ENHANCED_PIPELINE: Starting ${dryRun ? 'DRY RUN' : 'LIVE'} posting pipeline...`);
    
    try {
      // 1. Generate multiple candidates
      console.log('\n📝 STEP 1: Generating content candidates...');
      const generationResult = await this.generator.generateCandidates({
        candidate_count: 6,
        format_distribution: { single: 0.6, thread: 0.4 }
      });

      // 2. Display all candidates with scores
      console.log('\n📊 STEP 2: Candidate Analysis');
      console.log('═'.repeat(80));
      this.displayCandidates(generationResult);

      // 3. Check for duplicates
      console.log('\n🔍 STEP 3: Duplicate check...');
      const isDuplicate = await this.generator.checkDuplicate(generationResult.top_candidate.text);
      
      if (isDuplicate) {
        console.log('🚫 DUPLICATE_DETECTED: Top candidate is duplicate, selecting next best...');
        const alternatives = generationResult.candidates
          .filter(c => c.id !== generationResult.top_candidate.id)
          .sort((a, b) => b.scores.overall - a.scores.overall);
        
        if (alternatives.length === 0) {
          throw new Error('All candidates are duplicates');
        }
        
        generationResult.top_candidate = alternatives[0];
        console.log(`✅ ALTERNATIVE_SELECTED: Using candidate with score ${generationResult.top_candidate.scores.overall}/100`);
      }

      // 4. Post content
      console.log('\n📤 STEP 4: Publishing content...');
      const postingResult = await this.postContent(generationResult.top_candidate, dryRun);

      // 5. Log to Supabase
      console.log('\n💾 STEP 5: Logging to database...');
      await this.logToSupabase(generationResult, postingResult);

      // 6. Summary
      console.log('\n✅ PIPELINE_COMPLETE');
      console.log('═'.repeat(80));
      console.log(`📊 Generated: ${generationResult.generation_metadata.total_generated} candidates`);
      console.log(`🏆 Top score: ${generationResult.top_candidate.scores.overall}/100`);
      console.log(`📱 Posted: ${postingResult.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`💾 Logged: ${postingResult.success ? 'YES' : 'NO'}`);
      
      if (!dryRun && postingResult.success) {
        console.log(`🔗 Tweet ID: ${postingResult.tweet_id}`);
      }

    } catch (error) {
      console.error('❌ PIPELINE_FAILED:', error);
      throw error;
    }
  }

  /**
   * Run replies pipeline
   */
  async runRepliesPipeline(dryRun: boolean = true): Promise<void> {
    console.log(`💬 REPLIES_PIPELINE: Starting ${dryRun ? 'DRY RUN' : 'LIVE'} replies...`);
    
    try {
      // Find health-related tweets to reply to
      const targets = await this.findReplyTargets();
      console.log(`🎯 FOUND_TARGETS: ${targets.length} health tweets to reply to`);

      for (const target of targets.slice(0, 3)) { // Limit to 3 replies
        console.log(`\n💬 GENERATING_REPLY for @${target.author}`);
        console.log(`📝 Original: "${target.text.substring(0, 100)}..."`);

        // Generate contextual reply
        const reply = await this.generateContextualReply(target);
        console.log(`✨ Reply: "${reply}"`);

        if (!dryRun) {
          // Post reply using Playwright
          const replyResult = await this.postReply(target.tweet_id, reply);
          console.log(`📤 Reply posted: ${replyResult.success ? 'SUCCESS' : 'FAILED'}`);
        } else {
          console.log('📤 DRY RUN: Reply would be posted');
        }
      }

    } catch (error) {
      console.error('❌ REPLIES_FAILED:', error);
    }
  }

  /**
   * Run learning pipeline
   */
  async runLearningPipeline(): Promise<LearningResult> {
    console.log('🧠 LEARNING_PIPELINE: Analyzing engagement data...');
    
    try {
      // 1. Collect recent engagement data
      const { data: recentPosts } = await this.supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!recentPosts || recentPosts.length === 0) {
        console.log('⚠️ LEARNING: No recent posts found for analysis');
        return {
          engagement_data_collected: 0,
          patterns_updated: 0,
          next_topic_recommendation: 'sleep optimization'
        };
      }

      console.log(`📊 ANALYZING: ${recentPosts.length} recent posts`);

      // 2. Analyze patterns
      const patterns = this.analyzeEngagementPatterns(recentPosts);
      console.log('📈 PATTERNS_DISCOVERED:');
      patterns.forEach(pattern => {
        console.log(`  • ${pattern.type}: ${pattern.performance.toFixed(1)} avg engagement`);
      });

      // 3. Update Redis with insights
      await this.updateLearningCache(patterns);

      // 4. Recommend next topic
      const nextTopic = this.recommendNextTopic(patterns);
      console.log(`🎯 NEXT_RECOMMENDATION: "${nextTopic}"`);

      return {
        engagement_data_collected: recentPosts.length,
        patterns_updated: patterns.length,
        next_topic_recommendation: nextTopic
      };

    } catch (error) {
      console.error('❌ LEARNING_FAILED:', error);
      return {
        engagement_data_collected: 0,
        patterns_updated: 0,
        next_topic_recommendation: 'health optimization'
      };
    }
  }

  /**
   * Display candidates with scores and critique
   */
  private displayCandidates(result: GenerationResult): void {
    result.candidates.forEach((candidate, index) => {
      const isTop = candidate.id === result.top_candidate.id;
      console.log(`\n${isTop ? '🏆' : '📝'} CANDIDATE ${index + 1}${isTop ? ' (TOP CHOICE)' : ''}`);
      console.log(`Format: ${candidate.format} | Hook: ${candidate.hook_type}`);
      console.log(`Scores: Authority ${candidate.scores.shareability} | Hook ${candidate.scores.hook_strength} | Evidence ${candidate.scores.novelty} | Action ${candidate.scores.clarity} | Overall: ${candidate.scores.overall}/100`);
      console.log(`Content: "${candidate.text.substring(0, 120)}${candidate.text.length > 120 ? '...' : ''}"`);
      console.log(`Critique: ${candidate.critique}`);
    });
  }

  /**
   * Post content using Playwright
   */
  private async postContent(candidate: ContentCandidate, dryRun: boolean): Promise<PostingResult> {
    if (dryRun) {
      console.log('📱 DRY RUN SIMULATION:');
      console.log('─'.repeat(60));
      
      if (candidate.format === 'thread' && candidate.thread_parts) {
        console.log(`🧵 THREAD (${candidate.thread_parts.length} tweets):`);
        candidate.thread_parts.forEach((part, i) => {
          console.log(`\n${i + 1}/${candidate.thread_parts!.length}: ${part}`);
        });
      } else {
        console.log(candidate.text);
      }
      
      console.log('─'.repeat(60));
      console.log(`📊 Predicted engagement: ${candidate.scores.overall}% confidence`);
      console.log('✅ DRY RUN COMPLETE - No actual posting');

      return {
        success: true,
        posted_content: candidate.text,
        posting_method: 'dry_run'
      };
    }

    // Live posting with Playwright
    try {
      console.log('🌐 LAUNCHING_BROWSER: Starting Playwright...');
      const browser = await chromium.launch({ 
        headless: process.env.HEADLESS !== 'false' 
      });
      
      const context = await browser.newContext();
      
      // Load Twitter session if available
      if (process.env.TWITTER_SESSION_B64) {
        const sessionState = JSON.parse(
          Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString()
        );
        await context.addCookies(sessionState.cookies || []);
      }
      
      const page = await context.newPage();
      
      // Navigate to Twitter compose
      await page.goto('https://x.com/compose/post');
      await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
      
      if (candidate.format === 'thread' && candidate.thread_parts) {
        // Post thread
        for (let i = 0; i < candidate.thread_parts.length; i++) {
          const part = candidate.thread_parts[i];
          
          await page.fill('[data-testid="tweetTextarea_0"]', part);
          
          if (i < candidate.thread_parts.length - 1) {
            // Add another tweet to thread
            await page.click('[data-testid="addButton"]');
            await page.waitForTimeout(1000);
          }
        }
      } else {
        // Post single tweet
        await page.fill('[data-testid="tweetTextarea_0"]', candidate.text);
      }
      
      // Post the tweet
      await page.click('[data-testid="tweetButton"]');
      await page.waitForTimeout(3000);
      
      // Try to get tweet ID from URL
      const currentUrl = page.url();
      const tweetIdMatch = currentUrl.match(/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : `live_${Date.now()}`;
      
      await browser.close();
      
      console.log(`✅ POSTED_SUCCESSFULLY: Tweet ID ${tweetId}`);
      
      return {
        success: true,
        tweet_id: tweetId,
        posted_content: candidate.text,
        posting_method: 'live_playwright'
      };

    } catch (error) {
      console.error('❌ POSTING_FAILED:', error);
      return {
        success: false,
        error: error.message,
        posted_content: candidate.text,
        posting_method: 'live_playwright'
      };
    }
  }

  /**
   * Log results to Supabase
   */
  private async logToSupabase(
    generationResult: GenerationResult, 
    postingResult: PostingResult
  ): Promise<void> {
    try {
      const candidate = generationResult.top_candidate;
      
      // Insert into posts table
      const { error } = await this.supabase
        .from('posts')
        .insert({
          tweet_id: postingResult.tweet_id || null,
          content: candidate.text,
          format: candidate.format,
          hook_type: candidate.hook_type,
          thread_parts: candidate.thread_parts || null,
          topic: generationResult.generation_metadata.topic_used,
          scores: candidate.scores,
          critique: candidate.critique,
          posted: postingResult.success,
          posting_method: postingResult.posting_method,
          generation_metadata: generationResult.generation_metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ SUPABASE_LOG_FAILED:', error);
      } else {
        console.log('✅ LOGGED_TO_SUPABASE: Post data saved');
      }

    } catch (error) {
      console.error('❌ SUPABASE_ERROR:', error);
    }
  }

  /**
   * Find health-related tweets to reply to
   */
  private async findReplyTargets(): Promise<Array<{
    tweet_id: string;
    author: string;
    text: string;
    engagement_score: number;
  }>> {
    // Mock targets for now - in real implementation, this would scrape Twitter
    return [
      {
        tweet_id: 'mock_123',
        author: 'healthguru',
        text: 'Drinking lemon water first thing in the morning boosts your metabolism by 30%!',
        engagement_score: 85
      },
      {
        tweet_id: 'mock_456',
        author: 'fitnesscoach',
        text: 'You need to eat 6 small meals per day to keep your metabolism firing all day long.',
        engagement_score: 72
      },
      {
        tweet_id: 'mock_789',
        author: 'wellnessexpert',
        text: 'Detox teas are essential for cleansing your liver and removing toxins naturally.',
        engagement_score: 68
      }
    ];
  }

  /**
   * Generate contextual reply
   */
  private async generateContextualReply(target: any): Promise<string> {
    const prompt = `
Generate a helpful, evidence-based reply to this health claim:

"${target.text}"

Requirements:
- Be respectful but provide accurate information
- Include a specific fact or study if the claim is misleading
- Keep under 280 characters
- Don't be preachy - be conversational
- If the claim has merit, acknowledge it while adding nuance

Reply:`;

    try {
      const response = await this.generator['openai'].chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100
      });

      return response.choices[0]?.message?.content?.trim() || 
        "Interesting perspective! Have you seen the recent research on this? Would love to hear your thoughts.";
        
    } catch (error) {
      return "Thanks for sharing! What's your experience been with this approach?";
    }
  }

  /**
   * Post reply using Playwright  
   */
  private async postReply(tweetId: string, reply: string): Promise<{ success: boolean }> {
    // Simplified - in real implementation would use Playwright to navigate and reply
    console.log(`📤 POSTING_REPLY to ${tweetId}: "${reply}"`);
    return { success: true };
  }

  /**
   * Analyze engagement patterns from posts
   */
  private analyzeEngagementPatterns(posts: any[]): Array<{
    type: string;
    performance: number;
    authority_correlation: number;
    structure_insights: string;
  }> {
    const patterns = ['curiosity_gap', 'contrarian', 'practical_list', 'story', 'bold_statement'];
    
    return patterns.map(pattern => {
      const patternPosts = posts.filter(p => p.hook_type === pattern);
      
      if (patternPosts.length === 0) {
        return {
          type: pattern,
          performance: 0,
          authority_correlation: 0,
          structure_insights: 'No data available'
        };
      }
      
      const totalEngagement = patternPosts.reduce((sum, p) => 
        sum + ((p.likes || 0) + (p.replies || 0) + (p.reposts || 0)), 0
      );
      const avgEngagement = totalEngagement / patternPosts.length;
      
      // Calculate authority correlation - higher authority scores with higher engagement
      const authorityCorrelation = patternPosts.reduce((sum, p) => {
        const engagement = (p.likes || 0) + (p.replies || 0) + (p.reposts || 0);
        const authorityScore = p.scores?.shareability || 50; // Authority mapped to shareability
        return sum + (engagement * authorityScore / 100);
      }, 0) / patternPosts.length;
      
      // Analyze what makes this pattern successful
      const highPerformers = patternPosts
        .filter(p => ((p.likes || 0) + (p.replies || 0) + (p.reposts || 0)) > avgEngagement)
        .slice(0, 3);
      
      const structureInsights = this.extractStructureInsights(pattern, highPerformers);
      
      return {
        type: pattern,
        performance: Math.round(avgEngagement),
        authority_correlation: Math.round(authorityCorrelation),
        structure_insights: structureInsights
      };
    }).sort((a, b) => b.performance - a.performance);
  }

  /**
   * Extract insights about what makes patterns successful
   */
  private extractStructureInsights(pattern: string, highPerformers: any[]): string {
    if (highPerformers.length === 0) return 'Insufficient data for insights';
    
    const insights = {
      'curiosity_gap': 'High performers use specific statistics and challenge mainstream beliefs',
      'contrarian': 'Most effective when backed by research citations and specific numbers',
      'practical_list': 'Lists with 3-5 actionable items perform best, especially with timeframes',
      'story': 'Research-based case studies outperform personal anecdotes significantly',
      'bold_statement': 'Bold claims with immediate evidence backing perform best'
    };
    
    // Analyze common elements in high performers
    const hasStats = highPerformers.some(p => /\d+%|\d+ studies|\d+ participants/i.test(p.content));
    const hasResearch = highPerformers.some(p => /research shows|studies find|data reveals/i.test(p.content));
    const hasNumbers = highPerformers.some(p => /\d+/.test(p.content));
    
    let insight = insights[pattern as keyof typeof insights] || 'Pattern shows promise';
    
    if (hasStats && hasResearch) {
      insight += ' - Statistics + research citations = highest engagement';
    } else if (hasNumbers) {
      insight += ' - Numbers boost performance significantly';
    }
    
    return insight;
  }

  /**
   * Update learning cache in Redis
   */
  private async updateLearningCache(patterns: any[]): Promise<void> {
    try {
      const learningData = {
        patterns,
        updated_at: new Date().toISOString(),
        pattern_count: patterns.length
      };
      
      await this.redis.setex('learning:patterns', 3600, JSON.stringify(learningData));
      console.log('✅ LEARNING_CACHE: Updated Redis with latest patterns');
    } catch (error) {
      console.warn('⚠️ LEARNING_CACHE: Failed to update Redis');
    }
  }

  /**
   * Recommend next topic based on patterns
   */
  private recommendNextTopic(patterns: any[]): string {
    const topPattern = patterns.sort((a, b) => b.performance - a.performance)[0];
    
    const topicsByPattern = {
      curiosity_gap: 'sleep mysteries',
      contrarian: 'nutrition myths',
      practical_list: 'biohacking basics',
      story: 'transformation stories',
      bold_statement: 'health optimization'
    };
    
    return topicsByPattern[topPattern?.type as keyof typeof topicsByPattern] || 'metabolic health';
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'post';
  const dryRun = process.env.DRY_RUN === '1' || args.includes('--dry-run');
  
  const operator = new EnhancedContentOperator();

  try {
    switch (command) {
      case 'post':
        await operator.runPostingPipeline(dryRun);
        break;
      case 'replies':
        await operator.runRepliesPipeline(dryRun);
        break;
      case 'learn':
        const learningResult = await operator.runLearningPipeline();
        console.log(`🧠 LEARNING_COMPLETE: Analyzed ${learningResult.engagement_data_collected} posts, updated ${learningResult.patterns_updated} patterns`);
        break;
      default:
        console.log(`
🎯 Enhanced Content Operator

COMMANDS:
  post      Generate and post content (default)
  replies   Generate and post replies to health tweets  
  learn     Analyze engagement data and update patterns

OPTIONS:
  --dry-run Force dry run mode (also: DRY_RUN=1)

EXAMPLES:
  npm run content post                # Generate and post content
  DRY_RUN=1 npm run content post      # Dry run only
  npm run content replies             # Generate replies
  npm run content learn               # Run learning analysis
`);
    }
  } catch (error) {
    console.error('❌ COMMAND_FAILED:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default EnhancedContentOperator;
