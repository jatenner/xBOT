/**
 * Smart Content Generator with A/B Testing and Quality Gates
 * Generates multiple candidates and selects the best using rubric-based scoring
 */

class SmartContentGenerator {
  constructor() {
    this.viralHooks = {
      single: [
        "Just discovered:",
        "This changed everything:",
        "Unpopular opinion:",
        "Plot twist:",
        "Here's what nobody tells you:",
        "Science says:",
        "Reality check:",
        "Game changer:",
        "Mind = blown:",
        "This will save you years:"
      ],
      thread: [
        "🧵 THREAD: Everything you need to know about",
        "🧵 Here's exactly how to",
        "🧵 The truth about",
        "🧵 Why most people get this wrong:",
        "🧵 I spent 5 years researching this. Here's what I found:",
        "🧵 The science behind",
        "🧵 Breaking down the myths around",
        "🧵 Step-by-step guide to",
        "🧵 The data is clear:",
        "🧵 What I wish I knew about"
      ]
    };

    this.evidencePatterns = [
      "Studies show",
      "Research reveals",
      "Clinical trials prove",
      "Meta-analyses confirm",
      "Scientists discovered",
      "Data indicates",
      "Evidence suggests",
      "Peer-reviewed studies find"
    ];

    this.structureTemplates = {
      single: {
        hook: "Strong opener that grabs attention",
        evidence: "Scientific backing or credible source",
        insight: "Actionable insight or surprising fact",
        cta: "Clear next step or food for thought"
      },
      thread: {
        hook: "Thread announcement with clear value proposition",
        preview: "What readers will learn (bullets or numbered list)",
        body: "Structured content with evidence and examples",
        conclusion: "Key takeaway and actionable next step"
      }
    };

    this.qualityRubric = {
      hook_strength: { weight: 0.25, max: 10 },
      evidence_quality: { weight: 0.20, max: 10 },
      actionability: { weight: 0.20, max: 10 },
      clarity: { weight: 0.15, max: 10 },
      viral_potential: { weight: 0.10, max: 10 },
      health_relevance: { weight: 0.10, max: 10 }
    };
  }

  /**
   * Generate multiple content candidates and select the best
   */
  async generateWithABTesting({ topic, format, context = {} }) {
    try {
      console.log(`🎯 Generating A/B candidates for topic: "${topic}", format: ${format}`);

      // Generate multiple candidates
      const candidates = await this.generateCandidates({ topic, format, context });

      // Score each candidate using quality rubric
      const scoredCandidates = await Promise.all(
        candidates.map(async (candidate, index) => {
          const score = await this.scoreCandidate(candidate, format);
          return {
            ...candidate,
            score,
            index
          };
        })
      );

      // Select best candidate
      const bestCandidate = scoredCandidates.reduce((best, current) => 
        current.score.total > best.score.total ? current : best
      );

      console.log(`✅ Selected candidate ${bestCandidate.index + 1} with score: ${bestCandidate.score.total.toFixed(1)}/10`);

      return {
        content: bestCandidate.content,
        metadata: {
          selectedCandidate: bestCandidate.index,
          score: bestCandidate.score,
          totalCandidates: candidates.length,
          topic,
          format,
          structure: bestCandidate.structure
        },
        alternatives: scoredCandidates.filter(c => c.index !== bestCandidate.index)
      };

    } catch (error) {
      console.error('❌ Smart content generation failed:', error);
      return this.generateFallbackContent({ topic, format, context });
    }
  }

  /**
   * Generate multiple candidate versions
   */
  async generateCandidates({ topic, format, context, count = 3 }) {
    const candidates = [];

    for (let i = 0; i < count; i++) {
      const variant = await this.generateVariant({ topic, format, context, variantIndex: i });
      candidates.push(variant);
    }

    return candidates;
  }

  /**
   * Generate a single content variant
   */
  async generateVariant({ topic, format, context, variantIndex }) {
    const hook = this.selectHook(format, variantIndex);
    const evidence = this.selectEvidence(variantIndex);
    const structure = this.buildStructure(format, topic, hook, evidence);

    const prompt = this.buildPrompt({
      topic,
      format,
      hook,
      evidence,
      structure,
      context,
      variantIndex
    });

    const { OpenAIService } = await import('../services/openaiService.js');
    const openai = new OpenAIService();

    const content = await openai.generateContent({
      prompt,
      maxTokens: format === 'thread' ? 800 : 250,
      temperature: 0.7 + (variantIndex * 0.1) // Slightly different temperature for variety
    });

    return {
      content: content.trim(),
      structure,
      hook,
      evidence,
      variantIndex
    };
  }

  /**
   * Select hook based on format and variant
   */
  selectHook(format, variantIndex) {
    const hooks = this.viralHooks[format];
    return hooks[variantIndex % hooks.length];
  }

  /**
   * Select evidence pattern
   */
  selectEvidence(variantIndex) {
    return this.evidencePatterns[variantIndex % this.evidencePatterns.length];
  }

  /**
   * Build content structure
   */
  buildStructure(format, topic, hook, evidence) {
    const template = this.structureTemplates[format];
    
    return {
      format,
      hook: `${hook} ${topic}`,
      evidence,
      template,
      wordTarget: format === 'thread' ? '400-600 words' : '50-75 words',
      tweetCount: format === 'thread' ? '5-8 tweets' : '1 tweet'
    };
  }

  /**
   * Build generation prompt
   */
  buildPrompt({ topic, format, hook, evidence, structure, context, variantIndex }) {
    const strategies = [
      'contrarian', 'educational', 'storytelling'
    ];
    
    const strategy = strategies[variantIndex % strategies.length];

    const basePrompt = `You are a health expert creating viral ${format} content about: "${topic}"

STRATEGY: ${strategy}
HOOK: ${hook}
EVIDENCE FRAME: ${evidence}
TARGET: ${structure.tweetCount}

REQUIREMENTS:
- Start with the exact hook provided
- Include ${evidence} pattern for credibility
- Make it actionable and specific
- Use clear, engaging language
- Focus on health/wellness benefits
${format === 'thread' ? '- Structure as numbered tweets (1/X format)' : ''}
${strategy === 'contrarian' ? '- Challenge common assumptions' : ''}
${strategy === 'educational' ? '- Focus on teaching something new' : ''}
${strategy === 'storytelling' ? '- Include personal anecdote or case study' : ''}

${format === 'single' ? 'Generate a single tweet (max 240 chars):' : 'Generate a thread (5-8 tweets):'}`;

    return basePrompt;
  }

  /**
   * Score candidate using quality rubric
   */
  async scoreCandidate(candidate, format) {
    const scores = {};
    let totalScore = 0;

    // Hook strength (0-10)
    scores.hook_strength = this.scoreHookStrength(candidate.content, candidate.hook);
    
    // Evidence quality (0-10)
    scores.evidence_quality = this.scoreEvidenceQuality(candidate.content, candidate.evidence);
    
    // Actionability (0-10)
    scores.actionability = this.scoreActionability(candidate.content);
    
    // Clarity (0-10)
    scores.clarity = this.scoreClarity(candidate.content, format);
    
    // Viral potential (0-10)
    scores.viral_potential = this.scoreViralPotential(candidate.content, format);
    
    // Health relevance (0-10)
    scores.health_relevance = this.scoreHealthRelevance(candidate.content);

    // Calculate weighted total
    for (const [criterion, score] of Object.entries(scores)) {
      const weight = this.qualityRubric[criterion].weight;
      totalScore += score * weight;
    }

    return {
      ...scores,
      total: totalScore,
      breakdown: this.explainScoring(scores)
    };
  }

  /**
   * Score hook strength
   */
  scoreHookStrength(content, hook) {
    const firstLine = content.split('\n')[0] || content.substring(0, 100);
    
    let score = 5; // Base score
    
    // Check for strong hook elements
    if (/just discovered|changed everything|nobody tells you|mind blown/i.test(firstLine)) score += 2;
    if (/\d+/g.test(firstLine)) score += 1; // Numbers are engaging
    if (/\?|!/g.test(firstLine)) score += 1; // Punctuation adds emotion
    if (firstLine.length < 50) score += 1; // Concise hooks are better
    if (/you|your/i.test(firstLine)) score += 1; // Direct address
    
    return Math.min(10, score);
  }

  /**
   * Score evidence quality
   */
  scoreEvidenceQuality(content, evidenceFrame) {
    let score = 3; // Base score
    
    // Check for evidence patterns
    if (/studies|research|clinical|meta-analysis|peer-reviewed/i.test(content)) score += 3;
    if (/\d+%|\d+ studies|\d+ years/g.test(content)) score += 2; // Specific data
    if (/university|journal|published/i.test(content)) score += 1; // Academic sources
    if (content.includes(evidenceFrame.toLowerCase())) score += 1; // Uses requested frame
    
    return Math.min(10, score);
  }

  /**
   * Score actionability
   */
  scoreActionability(content) {
    let score = 3; // Base score
    
    // Check for actionable elements
    if (/try|start|avoid|include|consider|implement/i.test(content)) score += 2;
    if (/step|tip|hack|way|method/i.test(content)) score += 2;
    if (/minutes|daily|weekly|times/i.test(content)) score += 1; // Specific timing
    if (/how to|here's how/i.test(content)) score += 1; // Instructional
    if (/:\s*\d+\./gm.test(content)) score += 1; // Numbered lists
    
    return Math.min(10, score);
  }

  /**
   * Score clarity
   */
  scoreClarity(content, format) {
    let score = 5; // Base score
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    // Prefer shorter, clearer sentences
    if (avgSentenceLength < 80) score += 2;
    else if (avgSentenceLength > 120) score -= 1;
    
    // Check readability indicators
    if (!/however|nevertheless|furthermore|consequently/i.test(content)) score += 1; // Avoid complex connectors
    if (format === 'thread' && /\d+\/\d+|\d+\./gm.test(content)) score += 1; // Clear thread structure
    if (!/\(\w+\)|aka|i\.e\.|e\.g\./i.test(content)) score += 1; // Avoid parenthetical complexity
    
    return Math.min(10, score);
  }

  /**
   * Score viral potential
   */
  scoreViralPotential(content, format) {
    let score = 4; // Base score
    
    // Viral indicators
    if (/surprising|shocking|nobody|secret|truth|myth/i.test(content)) score += 2;
    if (/\d+ (ways|tips|secrets|hacks)/i.test(content)) score += 1; // Listicle format
    if (/before|after|transformation|changed/i.test(content)) score += 1; // Transformation stories
    if (/❌|✅|🚨|💡|🔥|⚡/g.test(content)) score += 1; // Engaging emojis
    if (format === 'thread' && /🧵/g.test(content)) score += 1; // Thread indicator
    
    return Math.min(10, score);
  }

  /**
   * Score health relevance
   */
  scoreHealthRelevance(content) {
    const healthTerms = [
      'health', 'wellness', 'nutrition', 'fitness', 'sleep', 'stress', 'recovery',
      'immune', 'metabolism', 'inflammation', 'gut', 'mental', 'physical', 'energy'
    ];
    
    let score = 2; // Base score
    
    const matches = healthTerms.filter(term => 
      new RegExp(term, 'i').test(content)
    ).length;
    
    score += Math.min(6, matches * 1.5); // Up to 6 points for health terms
    
    // Bonus for specific health advice
    if (/vitamin|mineral|protein|fiber|antioxidant/i.test(content)) score += 1;
    if (/exercise|workout|cardio|strength|movement/i.test(content)) score += 1;
    
    return Math.min(10, score);
  }

  /**
   * Explain scoring breakdown
   */
  explainScoring(scores) {
    return Object.entries(scores).map(([criterion, score]) => ({
      criterion: criterion.replace('_', ' '),
      score: score.toFixed(1),
      weight: this.qualityRubric[criterion]?.weight || 0,
      weighted: (score * (this.qualityRubric[criterion]?.weight || 0)).toFixed(2)
    }));
  }

  /**
   * Generate fallback content if main generation fails
   */
  generateFallbackContent({ topic, format, context }) {
    const hook = this.viralHooks[format][0];
    const evidence = this.evidencePatterns[0];
    
    const fallbackContent = format === 'thread' 
      ? `🧵 ${hook} ${topic}\n\n1/5 ${evidence} this is crucial for optimal health.\n\n2/5 Here's what you need to know...\n\n3/5 [More content would be generated here]\n\n4/5 Start implementing these changes gradually.\n\n5/5 Your health will thank you!`
      : `${hook} ${topic}. ${evidence} this simple change can transform your health. Try it for 30 days and see the difference.`;

    return {
      content: fallbackContent,
      metadata: {
        fallback: true,
        topic,
        format,
        score: { total: 5.0 }
      }
    };
  }
}

module.exports = { SmartContentGenerator };
