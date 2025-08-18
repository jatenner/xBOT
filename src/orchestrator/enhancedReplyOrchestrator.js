/**
 * Enhanced Reply Orchestrator
 * Integrates topic filtering, context analysis, and smart reply generation
 */

const { TopicFilter } = require('../lib/topicFilter');
const { ContextAwareReplyGenerator } = require('../lib/contextAwareReplies');
const { getBrowserManager } = require('../lib/browser');

class EnhancedReplyOrchestrator {
  constructor() {
    this.topicFilter = new TopicFilter();
    this.replyGenerator = new ContextAwareReplyGenerator();
    this.browserManager = getBrowserManager();
    
    console.log('🎯 Enhanced reply orchestrator initialized');
  }

  /**
   * Main entry point for reply evaluation and generation
   */
  async evaluateAndGenerateReply({ text, author, meta = {}, candidateTweet = null }) {
    try {
      console.log(`🔍 Evaluating reply candidate from @${author}: "${text.substring(0, 100)}..."`);

      // Step 1: Topic filtering
      const filterResult = await this.topicFilter.shouldReply({ text, author, meta });
      
      if (!filterResult.allow) {
        console.log(`❌ REPLY_FILTER_DENY topic=${filterResult.topic} prob=${filterResult.prob.toFixed(2)} reason=${filterResult.reason}`);
        return {
          shouldReply: false,
          reason: filterResult.reason,
          filterResult,
          score: 0
        };
      }

      console.log(`✅ REPLY_FILTER_ALLOW topic=${filterResult.topic} prob=${filterResult.prob.toFixed(2)} reason=${filterResult.reason} pivot=${filterResult.pivot}`);

      // Step 2: Context analysis
      const contextAnalysis = this.analyzeContext({ text, author, meta, filterResult });

      // Step 3: Generate tailored reply
      const replyResult = await this.generateTailoredReply({
        originalTweet: text,
        contextAnalysis,
        filterResult,
        author,
        meta
      });

      // Step 4: Quality validation
      const qualityCheck = this.replyGenerator.validateReply(replyResult.reply);
      
      if (!qualityCheck.passed) {
        console.log(`❌ REPLY_QUALITY_FAIL score=${qualityCheck.score.toFixed(2)} issues=${qualityCheck.issues.join(',')}`);
        return {
          shouldReply: false,
          reason: 'quality_gate_failed',
          qualityCheck,
          score: qualityCheck.score * 10
        };
      }

      console.log(`✅ REPLY_GENERATED quality=${qualityCheck.score.toFixed(2)} chars=${replyResult.reply.length} stance=${contextAnalysis.stance.stance}`);

      return {
        shouldReply: true,
        reply: replyResult.reply,
        metadata: {
          filterResult,
          contextAnalysis,
          replyResult,
          qualityCheck
        },
        score: this.calculateReplyScore(filterResult, contextAnalysis, qualityCheck)
      };

    } catch (error) {
      console.error('❌ Enhanced reply orchestrator failed:', error);
      return {
        shouldReply: false,
        reason: 'orchestrator_error',
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Analyze context and stance of the original tweet
   */
  analyzeContext({ text, author, meta, filterResult }) {
    // Extract key claim from the tweet
    const keyClaim = this.topicFilter.extractKeyClaim(text);
    
    // Analyze stance and sentiment
    const stance = this.topicFilter.analyzeStance(text);
    
    // Determine health topic category
    const healthTopic = this.categorizeHealthTopic(text, filterResult.topic);
    
    return {
      keyClaim,
      stance,
      healthTopic,
      author,
      tweetLength: text.length,
      hasQuestion: text.includes('?'),
      hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(text),
      mentionsHealth: /health|wellness|nutrition|fitness|sleep|stress/i.test(text)
    };
  }

  /**
   * Categorize health topic for targeted response
   */
  categorizeHealthTopic(text, filterTopic) {
    const categories = {
      nutrition: /nutrition|diet|food|eating|vitamin|mineral|supplement|calorie/i,
      fitness: /fitness|exercise|workout|training|muscle|cardio|strength/i,
      sleep: /sleep|rest|insomnia|tired|energy|recovery/i,
      stress: /stress|anxiety|mental|mood|depression|mindfulness/i,
      gut: /gut|digestive|microbiome|bloating|ibs|probiotic/i,
      immune: /immune|immunity|sick|cold|infection|inflammation/i,
      metabolism: /metabolism|metabolic|weight|fat|burn|energy/i
    };

    for (const [category, regex] of Object.entries(categories)) {
      if (regex.test(text)) {
        return category;
      }
    }

    return filterTopic === 'ride-along' ? 'general' : 'health';
  }

  /**
   * Generate tailored reply based on context
   */
  async generateTailoredReply({ originalTweet, contextAnalysis, filterResult, author, meta }) {
    const pivotLine = filterResult.pivot ? this.topicFilter.pivotLineFor(originalTweet) : null;

    const replyParams = {
      originalTweet,
      stance: contextAnalysis.stance,
      keyClaim: contextAnalysis.keyClaim,
      healthTopic: contextAnalysis.healthTopic,
      pivotLine
    };

    const replyResult = await this.replyGenerator.generateReply(replyParams);

    // Add pivot line logging if used
    if (pivotLine) {
      console.log(`🔄 REPLY_PIVOT_APPLIED pivot_line="${pivotLine}"`);
    }

    return replyResult;
  }

  /**
   * Calculate overall reply score
   */
  calculateReplyScore(filterResult, contextAnalysis, qualityCheck) {
    let score = 50; // Base score

    // Topic relevance bonus
    score += filterResult.prob * 30;

    // Stance confidence bonus
    score += contextAnalysis.stance.confidence * 10;

    // Quality bonus
    score += qualityCheck.score * 10;

    // Health topic bonus
    if (contextAnalysis.mentionsHealth) score += 5;

    // Question bonus (questions get better engagement)
    if (contextAnalysis.hasQuestion) score += 5;

    return Math.min(100, Math.round(score));
  }

  /**
   * Get orchestrator status for monitoring
   */
  getStatus() {
    return {
      topicFilter: {
        mode: this.topicFilter.mode,
        threshold: this.topicFilter.healthThreshold,
        blockPolitics: this.topicFilter.blockPolitics
      },
      browser: this.browserManager.getStatus(),
      lastActivity: new Date().toISOString()
    };
  }
}

module.exports = { EnhancedReplyOrchestrator };
