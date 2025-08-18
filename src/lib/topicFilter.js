/**
 * Health-focused topic filter for replies
 * Ensures all replies stay on-brand and health-focused
 */

// Health-related keywords for fast screening
const HEALTH_KEYWORDS = [
  'health', 'nutrition', 'fitness', 'sleep', 'stress', 'hydration', 'habits',
  'metabolism', 'recovery', 'wellness', 'mental health', 'exercise', 'diet',
  'supplements', 'meditation', 'anxiety', 'depression', 'weight', 'muscle',
  'cardio', 'protein', 'vitamins', 'calories', 'workout', 'training',
  'healthy', 'wellbeing', 'mindfulness', 'therapy', 'medical', 'doctor',
  'inflammation', 'immune', 'healing', 'preventive', 'holistic', 'chronic',
  'hormones', 'gut health', 'microbiome', 'longevity', 'biohacking'
];

// Political keywords for blocking
const POLITICAL_KEYWORDS = [
  'trump', 'biden', 'election', 'vote', 'politics', 'republican', 'democrat',
  'liberal', 'conservative', 'congress', 'senate', 'president', 'campaign',
  'political', 'policy', 'government', 'politician', 'party', 'maga',
  'gop', 'dnc', 'rnc', 'impeach', 'scandal', 'debate', 'rally', 'primary'
];

class TopicFilter {
  constructor() {
    this.mode = process.env.REPLY_TOPIC_MODE || 'health_only';
    this.healthThreshold = parseFloat(process.env.REPLY_HEALTH_THRESHOLD || '0.70');
    this.blockPolitics = process.env.BLOCK_POLITICS === 'true';
    this.allowlistTopics = (process.env.REPLY_ALLOWLIST_TOPICS || '').split(',').map(t => t.trim().toLowerCase());
    
    console.log(`🎯 TopicFilter initialized: mode=${this.mode}, threshold=${this.healthThreshold}, blockPolitics=${this.blockPolitics}`);
  }

  /**
   * Main entry point - should we reply to this content?
   */
  async shouldReply({ text, author, meta = {} }) {
    try {
      // Fast keyword screening first
      const quickScreen = this.quickScreen(text);
      
      if (this.blockPolitics && quickScreen.politics) {
        return {
          allow: false,
          reason: 'political_content_blocked',
          topic: 'politics',
          prob: quickScreen.politicsProb,
          pivot: false
        };
      }

      if (quickScreen.health && quickScreen.healthProb >= this.healthThreshold) {
        return {
          allow: true,
          reason: 'health_topic_detected',
          topic: quickScreen.healthTopic,
          prob: quickScreen.healthProb,
          pivot: false
        };
      }

      // For health_only mode, deny if not clearly health-related
      if (this.mode === 'health_only') {
        return {
          allow: false,
          reason: 'not_health_related',
          topic: quickScreen.topic || 'general',
          prob: quickScreen.healthProb,
          pivot: false
        };
      }

      // Smart ride-along mode: use LLM to classify
      if (this.mode === 'smart_ride_along') {
        const llmResult = await this.classifyWithLLM(text);
        
        if (this.blockPolitics && llmResult.politics) {
          return {
            allow: false,
            reason: 'political_content_blocked_llm',
            topic: 'politics',
            prob: llmResult.prob,
            pivot: false
          };
        }

        if (llmResult.health_relevant && llmResult.prob >= this.healthThreshold) {
          return {
            allow: true,
            reason: 'health_relevant_llm',
            topic: llmResult.topic,
            prob: llmResult.prob,
            pivot: false
          };
        }

        // Allow ride-along if not political and we can pivot to health
        if (!llmResult.politics && this.canPivotToHealth(text, llmResult)) {
          return {
            allow: true,
            reason: 'ride_along_health_pivot',
            topic: 'ride-along',
            prob: 0.5,
            pivot: true
          };
        }
      }

      return {
        allow: false,
        reason: 'no_health_relevance',
        topic: 'general',
        prob: 0.2,
        pivot: false
      };

    } catch (error) {
      console.error('❌ TopicFilter error:', error);
      // Default to allow in case of errors to avoid blocking all replies
      return {
        allow: this.mode === 'smart_ride_along',
        reason: 'filter_error',
        topic: 'unknown',
        prob: 0.5,
        pivot: false
      };
    }
  }

  /**
   * Fast keyword-based screening
   */
  quickScreen(text) {
    const lowerText = text.toLowerCase();
    
    // Check for political content
    const politicsProb = this.calculateKeywordMatch(lowerText, POLITICAL_KEYWORDS);
    const politics = politicsProb > 0.3;
    
    // Check for health content
    const healthProb = this.calculateKeywordMatch(lowerText, HEALTH_KEYWORDS);
    const health = healthProb > 0.4;
    
    let healthTopic = 'general';
    if (health) {
      // Try to identify specific health topic
      for (const topic of this.allowlistTopics) {
        if (lowerText.includes(topic)) {
          healthTopic = topic;
          break;
        }
      }
    }

    return {
      politics,
      politicsProb,
      health,
      healthProb,
      healthTopic,
      topic: politics ? 'politics' : (health ? healthTopic : 'general')
    };
  }

  /**
   * Calculate keyword match probability
   */
  calculateKeywordMatch(text, keywords) {
    const matches = keywords.filter(keyword => text.includes(keyword));
    const wordCount = text.split(/\s+/).length;
    
    if (matches.length === 0) return 0;
    
    // Base score from match ratio
    const matchRatio = matches.length / keywords.length;
    
    // Boost for multiple matches in short text
    const density = matches.length / Math.max(wordCount, 10);
    
    return Math.min(1, matchRatio * 0.7 + density * 0.3);
  }

  /**
   * LLM-based classification for nuanced cases
   */
  async classifyWithLLM(text) {
    const prompt = `SYSTEM: You label Tweets for brand-safety and topical fit.
USER: Classify the following tweet for HEALTH relevance.
Return strict JSON: {"topic":"<one or two words>","health_relevant":true|false,"prob":0..1,"politics":true|false}

TWEET:
${text}`;

    try {
      // Import OpenAI service dynamically to avoid circular dependencies
      const { OpenAIService } = await import('../services/openaiService.js');
      const openai = new OpenAIService();
      
      const response = await openai.generateContent({
        prompt,
        maxTokens: 150,
        temperature: 0.1
      });

      const result = JSON.parse(response.trim());
      
      // Validate response structure
      if (typeof result.health_relevant !== 'boolean' || 
          typeof result.politics !== 'boolean' ||
          typeof result.prob !== 'number') {
        throw new Error('Invalid LLM response format');
      }

      return result;
    } catch (error) {
      console.error('❌ LLM classification error:', error);
      // Fallback to conservative classification
      return {
        topic: 'unknown',
        health_relevant: false,
        prob: 0.3,
        politics: false
      };
    }
  }

  /**
   * Check if we can pivot non-health content to health angle
   */
  canPivotToHealth(text, llmResult) {
    // Don't pivot if it's explicitly political
    if (llmResult.politics) return false;
    
    // Look for general lifestyle, productivity, or trending topics we can connect to health
    const pivotableTopics = ['productivity', 'work', 'technology', 'lifestyle', 'food', 'travel', 'sleep', 'routine', 'habits'];
    const topic = llmResult.topic.toLowerCase();
    
    return pivotableTopics.some(pivotTopic => topic.includes(pivotTopic));
  }

  /**
   * Generate a health pivot line for ride-along replies
   */
  pivotLineFor(text) {
    const pivotLines = [
      "Speaking of health impacts:",
      "From a wellness perspective:",
      "This connects to health in an interesting way:",
      "Zooming in on the health angle:",
      "What's fascinating from a health standpoint:",
      "The health connection here is:",
      "Health-wise, this reminds me:",
      "From a longevity perspective:"
    ];
    
    return pivotLines[Math.floor(Math.random() * pivotLines.length)];
  }

  /**
   * Detect stance and context for tailored replies
   */
  analyzeStance(text) {
    const lowerText = text.toLowerCase();
    
    // Detect agreement indicators
    const agreeWords = ['agree', 'exactly', 'yes', 'true', 'right', 'absolutely', 'totally'];
    const disagreeWords = ['disagree', 'wrong', 'false', 'no', 'incorrect', 'myth', 'bullshit'];
    const questionWords = ['?', 'what', 'how', 'why', 'when', 'where', 'wonder', 'confused'];
    
    const hasAgree = agreeWords.some(word => lowerText.includes(word));
    const hasDisagree = disagreeWords.some(word => lowerText.includes(word));
    const hasQuestion = questionWords.some(word => lowerText.includes(word));
    
    if (hasQuestion) return { stance: 'question', confidence: 0.8 };
    if (hasDisagree) return { stance: 'disagree', confidence: 0.7 };
    if (hasAgree) return { stance: 'agree', confidence: 0.7 };
    
    return { stance: 'neutral', confidence: 0.5 };
  }

  /**
   * Extract key claim from tweet for focused replies
   */
  extractKeyClaim(text) {
    // Remove mentions, hashtags, URLs for cleaner analysis
    const cleanText = text
      .replace(/@\w+/g, '')
      .replace(/#\w+/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();
    
    // Split into sentences and find the main claim
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length === 0) return cleanText;
    
    // Return the longest sentence as likely main claim
    const keyClaim = sentences.reduce((longest, current) => 
      current.length > longest.length ? current : longest, sentences[0]
    ).trim();
    
    return keyClaim;
  }
}

module.exports = { TopicFilter };
