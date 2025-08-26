/**
 * Context-Aware Reply Generator
 * Creates tailored, expert replies that add value based on stance and content analysis
 */

class ContextAwareReplyGenerator {
  constructor() {
    this.replyTemplates = {
      agree: [
        "Absolutely! And here's another angle:",
        "So true! Building on this:",
        "Exactly right! This also connects to:",
        "Great point! Research shows:",
        "This! And what's fascinating is:"
      ],
      disagree: [
        "Interesting perspective, though research suggests:",
        "I see this differently based on studies showing:",
        "While I understand this view, evidence indicates:",
        "This is a common belief, but data reveals:",
        "Respectfully, clinical evidence points to:"
      ],
      question: [
        "Great question! Here's what the research shows:",
        "This is actually well-studied! Studies indicate:",
        "Fascinating question! The science suggests:",
        "I love this question! Research reveals:",
        "Evidence-based answer:"
      ],
      neutral: [
        "Adding to this conversation:",
        "From a health perspective:",
        "What's interesting about this:",
        "The research on this shows:",
        "Evidence suggests:"
      ]
    };

    this.expertFrames = [
      "Clinical studies show",
      "Research indicates",
      "Evidence suggests",
      "Studies reveal",
      "Data demonstrates",
      "Meta-analyses find",
      "Systematic reviews show",
      "Peer-reviewed research indicates"
    ];

    this.actionableEndings = [
      "Try implementing this gradually.",
      "Start with one small change.",
      "Test this for 2-3 weeks.",
      "Consider tracking your progress.",
      "Discuss with your healthcare provider.",
      "Monitor how your body responds.",
      "Combine with other healthy habits.",
      "Be consistent for best results."
    ];
  }

  /**
   * Generate context-aware reply based on stance and content analysis
   */
  async generateReply({ originalTweet, stance, keyClaim, healthTopic, pivotLine = null }) {
    try {
      const replyStructure = this.buildReplyStructure({
        stance,
        keyClaim,
        healthTopic,
        pivotLine
      });

      // Generate content using OpenAI with specific context
      const prompt = this.buildContextPrompt({
        originalTweet,
        stance,
        keyClaim,
        healthTopic,
        replyStructure,
        pivotLine
      });

      const { OpenAIService } = await import('../services/openaiService.js');
      const openai = new OpenAIService();

      const generatedReply = await openai.generateContent({
        prompt,
        maxTokens: 200,
        temperature: 0.7
      });

      // Post-process and enhance the reply
      const finalReply = this.enhanceReply({
        generatedReply: generatedReply.trim(),
        stance,
        healthTopic,
        pivotLine
      });

      return {
        reply: finalReply,
        structure: replyStructure,
        context: {
          stance: stance.stance,
          confidence: stance.confidence,
          healthTopic,
          wordCount: finalReply.split(' ').length
        }
      };

    } catch (error) {
      console.error('❌ Context-aware reply generation failed:', error);
      // Fallback to template-based reply
      return this.generateFallbackReply({ stance, keyClaim, healthTopic, pivotLine });
    }
  }

  /**
   * Build structured reply framework
   */
  buildReplyStructure({ stance, keyClaim, healthTopic, pivotLine }) {
    const structure = {
      opener: this.selectOpener(stance),
      evidenceFrame: this.selectEvidenceFrame(),
      healthConnection: this.buildHealthConnection(keyClaim, healthTopic),
      actionableElement: this.selectActionableEnding(),
      hasPivot: !!pivotLine,
      pivotLine
    };

    return structure;
  }

  /**
   * Select appropriate opener based on stance
   */
  selectOpener(stance) {
    const templates = this.replyTemplates[stance.stance] || this.replyTemplates.neutral;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Select evidence frame for authority
   */
  selectEvidenceFrame() {
    return this.expertFrames[Math.floor(Math.random() * this.expertFrames.length)];
  }

  /**
   * Build health connection based on topic
   */
  buildHealthConnection(keyClaim, healthTopic) {
    const connections = {
      nutrition: "optimal nutrient absorption",
      fitness: "exercise performance and recovery", 
      sleep: "restorative sleep quality",
      stress: "stress hormone regulation",
      mental: "cognitive function and mood",
      metabolism: "metabolic efficiency",
      immune: "immune system strength",
      gut: "digestive health and microbiome",
      general: "overall wellness and longevity"
    };

    return connections[healthTopic] || connections.general;
  }

  /**
   * Select actionable ending
   */
  selectActionableEnding() {
    return this.actionableEndings[Math.floor(Math.random() * this.actionableEndings.length)];
  }

  /**
   * Build context-specific prompt for OpenAI
   */
  buildContextPrompt({ originalTweet, stance, keyClaim, healthTopic, replyStructure, pivotLine }) {
    const basePrompt = `You are a health expert creating a valuable reply to a Twitter conversation.

ORIGINAL TWEET: "${originalTweet}"
KEY CLAIM: "${keyClaim}"
YOUR STANCE: ${stance.stance} (${Math.round(stance.confidence * 100)}% confidence)
HEALTH TOPIC: ${healthTopic}
${pivotLine ? `PIVOT LINE: "${pivotLine}"` : ''}

REPLY STRUCTURE:
1. Opener: ${replyStructure.opener}
2. Evidence: ${replyStructure.evidenceFrame}
3. Health Connection: ${replyStructure.healthConnection}
4. Actionable: ${replyStructure.actionableElement}

REQUIREMENTS:
- Max 240 characters (Twitter limit with buffer)
- Professional but conversational tone
- Include specific, actionable insight
- Reference credible evidence/research
- Add genuine value to the conversation
- Stay relevant to the original context
${pivotLine ? '- Use the pivot line to transition to health angle' : ''}
${stance.stance === 'disagree' ? '- Be respectful while presenting alternative evidence' : ''}
${stance.stance === 'question' ? '- Provide clear, evidence-based answer' : ''}

Generate only the reply text, no quotes or extra formatting:`;

    return basePrompt;
  }

  /**
   * Enhance generated reply with final touches
   */
  enhanceReply({ generatedReply, stance, healthTopic, pivotLine }) {
    let enhanced = generatedReply;

    // Add pivot line if needed
    if (pivotLine) {
      enhanced = `${pivotLine} ${enhanced}`;
    }

    // Ensure it's within character limits
    enhanced = this.truncateToTwitterLimit(enhanced);

    // NEVER ADD HASHTAGS - Brand guideline: No hashtags allowed

    return enhanced;
  }

  /**
   * Generate fallback reply using templates
   */
  generateFallbackReply({ stance, keyClaim, healthTopic, pivotLine }) {
    const opener = this.selectOpener(stance);
    const evidenceFrame = this.selectEvidenceFrame();
    const healthConnection = this.buildHealthConnection(keyClaim, healthTopic);
    
    let fallback = `${opener} ${evidenceFrame} that ${healthConnection} is crucial for optimal health.`;
    
    if (pivotLine) {
      fallback = `${pivotLine} ${fallback}`;
    }
    
    return {
      reply: this.truncateToTwitterLimit(fallback),
      structure: {
        opener,
        evidenceFrame,
        healthConnection,
        template: true
      },
      context: {
        stance: stance.stance,
        confidence: stance.confidence,
        healthTopic,
        fallback: true
      }
    };
  }

  /**
   * Truncate reply to Twitter character limit
   */
  truncateToTwitterLimit(text, limit = 240) {
    if (text.length <= limit) return text;
    
    // Find last complete sentence within limit
    const truncated = text.substring(0, limit - 3);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastSentenceEnd > limit * 0.7) {
      return text.substring(0, lastSentenceEnd + 1);
    }
    
    // Fallback: truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return text.substring(0, lastSpace) + '...';
  }

  /**
   * Validate reply quality
   */
  validateReply(reply) {
    const checks = {
      withinLimit: reply.length <= 240,
      hasSubstance: reply.length >= 50,
      notGeneric: !reply.toLowerCase().includes('great post'),
      hasHealthFocus: /health|wellness|nutrition|fitness|sleep|stress|recovery/i.test(reply),
      notSpammy: !/follow|dm|link in bio/i.test(reply)
    };

    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
    
    return {
      passed: score >= 0.8,
      score,
      checks,
      issues: Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([check, _]) => check)
    };
  }
}

module.exports = { ContextAwareReplyGenerator };
