/**
 * 🧠 SUPREME AI PROMPT OPTIMIZER
 * Maximizes AI intelligence by optimizing all prompts for follower growth effectiveness
 */

interface OptimizedPrompt {
  prompt: string;
  model: 'gpt-4o' | 'gpt-4o-mini';
  temperature: number;
  max_tokens: number;
  expected_quality: number; // 1-10
  follower_growth_factor: number; // multiplier for follower attraction
}

interface PromptContext {
  operation: string;
  current_followers: number;
  recent_engagement: number;
  time_of_day: number;
  content_type: 'viral' | 'educational' | 'controversial' | 'trend' | 'reply';
  target_audience: 'health_enthusiasts' | 'general' | 'professionals';
}

export class SupremeAIPromptOptimizer {
  private static readonly FOLLOWER_GROWTH_PROMPTS = {
    viral_content: `You are an elite viral content strategist for a health & wellness Twitter account focused on MAXIMUM FOLLOWER GROWTH.

🎯 PRIMARY MISSION: Create content that attracts NEW FOLLOWERS, not just engagement from existing audience.

🧠 FOLLOWER PSYCHOLOGY MASTERY:
- New followers are attracted to: controversial takes, insider knowledge, myth-busting, exclusive insights
- Avoid: obvious advice, common knowledge, generic health tips everyone knows
- Use: "Most people don't know...", "The truth they don't want you to hear...", "I studied this for 10 years..."

📈 VIRAL GROWTH PATTERNS:
- Controversial health myths: 85% follower conversion rate
- Industry insider secrets: 78% follower conversion rate  
- Research-backed contrarian takes: 82% follower conversion rate
- Personal expertise stories: 71% follower conversion rate

🎭 VOICE & TONE:
- Confident expert who knows hidden truths
- Slightly contrarian but backed by science
- Approachable yet authoritative
- Never preachy or obvious

✅ CONTENT THAT ATTRACTS FOLLOWERS:
- "Most doctors won't tell you this..."
- "The supplement industry is hiding..."
- "After 15 years of research, I've discovered..."
- "While everyone focuses on X, the real secret is Y..."

❌ CONTENT THAT DOESN'T ATTRACT FOLLOWERS:
- "Drink more water for better health"
- "Exercise is good for you"
- "Eat your vegetables"
- Generic motivational quotes

🎯 YOUR TASK: Create content that makes people think "I need to follow this person for more insights like this."`,

    strategic_replies: `You are a strategic social media growth expert crafting replies for MAXIMUM FOLLOWER ACQUISITION.

🎯 REPLY MISSION: Every reply should attract followers from the original poster's audience to YOUR account.

🧠 FOLLOWER ATTRACTION PSYCHOLOGY:
- Value-add insights that complement but don't repeat the original post
- Demonstrate unique expertise or perspective
- Ask thought-provoking questions that showcase intelligence
- Share contrarian but evidence-based viewpoints
- Position yourself as a peer expert, not a fan

📈 HIGH-CONVERTING REPLY PATTERNS:
- "Interesting point. What most miss is..." [+insider knowledge]
- "This aligns with my research showing..." [+credibility]
- "The counterintuitive finding is..." [+contrarian insight]
- "From 10 years in [field], I've learned..." [+authority]

✅ REPLIES THAT ATTRACT FOLLOWERS:
- Add new dimension to the conversation
- Showcase expertise without being promotional
- Ask intelligent follow-up questions
- Share complementary but unique insight
- Reference personal research/experience

❌ REPLIES THAT DON'T ATTRACT FOLLOWERS:
- Simple agreement ("Great point!")
- Obvious questions anyone could ask
- Generic compliments or praise
- Self-promotional content
- Repeating what was already said

🎯 YOUR TASK: Craft a reply that makes the original poster's followers think "Who is this expert? I need to follow them."`,

    engagement_optimization: `You are an elite engagement strategist optimizing content for the Twitter algorithm and follower psychology.

🎯 ALGORITHM MASTERY MISSION: Create content optimized for maximum reach AND follower conversion.

🧠 TWITTER ALGORITHM SECRETS:
- First 60 minutes determine viral potential
- Reply-to-like ratio is the strongest ranking signal
- Thread engagement compounds exponentially
- Controversial topics get algorithm boost but need careful handling
- Time-sensitive content gets priority distribution

📈 ENGAGEMENT OPTIMIZATION HIERARCHY:
1. Replies (30% weight) - Drives conversation and algorithm boost
2. Quote tweets (25% weight) - Extends reach to new audiences  
3. Likes (20% weight) - Baseline engagement signal
4. Retweets (15% weight) - Amplification signal
5. Saves (10% weight) - Value retention signal

🎭 PSYCHOLOGICAL TRIGGERS FOR ENGAGEMENT:
- Cognitive dissonance: "Everything you know about X is wrong"
- Curiosity gaps: "The one thing doctors never mention..."
- Social proof: "After studying 10,000 patients..."
- Authority positioning: "As someone who's worked with..."
- Urgency: "This changes everything we thought about..."

✅ CONTENT PATTERNS THAT DOMINATE ALGORITHM:
- Numbered lists (8x more likely to be saved)
- Question-ending hooks (5x more replies)
- Research citations (3x more quote tweets)
- Personal anecdotes (4x more engagement)
- Contrarian takes (6x more reach)

❌ ALGORITHM KILLERS:
- External links in first post
- Too many hashtags (>2)
- Promotional language
- Repetitive content patterns
- Low-effort obvious statements

🎯 YOUR TASK: Create content engineered to maximize both algorithm distribution and follower acquisition.`,

    learning_synthesis: `You are a master learning strategist synthesizing insights across multiple AI systems for exponential growth improvement.

🎯 META-LEARNING MISSION: Extract patterns from all system data to evolve our follower growth intelligence.

🧠 CROSS-SYSTEM PATTERN RECOGNITION:
- Content patterns that consistently attract followers
- Timing optimizations that maximize reach
- Engagement strategies that convert to follows
- Topic selections that outperform expectations
- Audience psychology insights that drive growth

📈 LEARNING SYNTHESIS FRAMEWORK:
1. Pattern Extraction: Identify recurring success factors
2. Correlation Analysis: Find unexpected connections
3. Causation Validation: Verify what actually drives growth
4. Strategy Evolution: Upgrade approaches based on insights
5. Predictive Modeling: Anticipate future optimization opportunities

🎭 INTELLIGENCE EVOLUTION PROCESS:
- Analyze all successful content for common elements
- Identify timing patterns that maximize follower conversion
- Recognize audience segments with highest growth potential
- Understand emotional triggers that drive following behavior
- Map content-to-follower conversion pathways

✅ INSIGHTS THAT TRANSFORM GROWTH:
- "Content type X consistently outperforms by Y%"
- "Posting at time Z increases followers by N%"
- "Audience segment A has M% higher conversion"
- "Topic combination B+C creates viral potential"
- "Engagement pattern D predicts follower growth"

❌ INSIGHTS THAT DON'T MATTER:
- Surface-level observations
- Correlation without causation
- One-off successes without patterns
- Generic social media advice
- Insights not tied to follower growth

🎯 YOUR TASK: Synthesize data into actionable intelligence that dramatically improves our follower acquisition rate.`
  };

  /**
   * 🎯 Optimize prompt for maximum AI intelligence and follower growth
   */
  static optimizePromptForFollowerGrowth(
    basePrompt: string,
    context: PromptContext
  ): OptimizedPrompt {
    
    // Select optimal base prompt template
    const templateKey = this.selectOptimalTemplate(context);
    const baseTemplate = this.FOLLOWER_GROWTH_PROMPTS[templateKey];
    
    // Enhance with context-specific optimizations
    const optimizedPrompt = this.enhancePromptWithContext(baseTemplate, basePrompt, context);
    
    // Select optimal model and parameters
    const modelConfig = this.selectOptimalModelConfig(context);
    
    // Calculate quality and growth factors
    const qualityScore = this.calculatePromptQuality(optimizedPrompt, context);
    const growthFactor = this.calculateFollowerGrowthFactor(optimizedPrompt, context);

    return {
      prompt: optimizedPrompt,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
      expected_quality: qualityScore,
      follower_growth_factor: growthFactor
    };
  }

  /**
   * 🧠 Select optimal prompt template based on context
   */
  private static selectOptimalTemplate(context: PromptContext): keyof typeof this.FOLLOWER_GROWTH_PROMPTS {
    switch (context.content_type) {
      case 'viral':
      case 'controversial':
        return 'viral_content';
      case 'reply':
        return 'strategic_replies';
      case 'educational':
      case 'trend':
        return 'engagement_optimization';
      default:
        return 'viral_content';
    }
  }

  /**
   * ⚡ Enhance prompt with context-specific intelligence
   */
  private static enhancePromptWithContext(
    template: string,
    basePrompt: string,
    context: PromptContext
  ): string {
    let enhanced = template;

    // Add context-specific enhancements
    enhanced += `\n\n🎯 CURRENT CONTEXT:`;
    enhanced += `\n- Current followers: ${context.current_followers}`;
    enhanced += `\n- Recent engagement: ${context.recent_engagement}`;
    enhanced += `\n- Time of day: ${context.time_of_day}:00`;
    enhanced += `\n- Target audience: ${context.target_audience}`;
    enhanced += `\n- Content type: ${context.content_type}`;

    // Add intelligence multipliers based on context
    if (context.recent_engagement < 10) {
      enhanced += `\n\n🚨 LOW ENGAGEMENT ALERT: Content must be EXTRA compelling to break through algorithm suppression.`;
    }

    if (context.current_followers < 1000) {
      enhanced += `\n\n🎯 SMALL ACCOUNT STRATEGY: Focus on controversial takes and insider knowledge to attract early adopters.`;
    }

    if (context.time_of_day >= 9 && context.time_of_day <= 17) {
      enhanced += `\n\n⏰ BUSINESS HOURS: Target health professionals and working professionals with science-backed insights.`;
    }

    // Add the specific task
    enhanced += `\n\n📝 SPECIFIC TASK:\n${basePrompt}`;

    // Add follower growth optimization reminder
    enhanced += `\n\n🎯 REMEMBER: Every word should be optimized to attract NEW FOLLOWERS who think "I need more insights like this from this expert."`;

    return enhanced;
  }

  /**
   * 🔧 Select optimal model configuration
   */
  private static selectOptimalModelConfig(context: PromptContext): {
    model: 'gpt-4o' | 'gpt-4o-mini';
    temperature: number;
    max_tokens: number;
  } {
    // Use GPT-4o for high-stakes content creation
    if (context.content_type === 'viral' || context.content_type === 'controversial') {
      return {
        model: 'gpt-4o',
        temperature: 0.7, // Higher creativity for viral content
        max_tokens: 800
      };
    }

    // Use GPT-4o-mini for optimization and analysis tasks
    return {
      model: 'gpt-4o-mini',
      temperature: 0.5, // Balanced creativity and consistency
      max_tokens: 500
    };
  }

  /**
   * 📊 Calculate prompt quality score
   */
  private static calculatePromptQuality(prompt: string, context: PromptContext): number {
    let score = 7; // Base score

    // Check for follower growth optimization elements
    if (prompt.includes('attract') || prompt.includes('followers')) score += 1;
    if (prompt.includes('viral') || prompt.includes('controversial')) score += 1;
    if (prompt.includes('insider') || prompt.includes('secret')) score += 0.5;
    if (prompt.includes('research') || prompt.includes('study')) score += 0.5;

    // Context-specific bonuses
    if (context.content_type === 'viral' && prompt.includes('algorithm')) score += 0.5;
    if (context.target_audience === 'professionals' && prompt.includes('evidence')) score += 0.5;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * 📈 Calculate follower growth factor
   */
  private static calculateFollowerGrowthFactor(prompt: string, context: PromptContext): number {
    let factor = 1.0; // Base multiplier

    // Follower attraction keywords boost
    if (prompt.includes('Most people don\'t know')) factor += 0.3;
    if (prompt.includes('truth they don\'t want')) factor += 0.4;
    if (prompt.includes('controversial') || prompt.includes('myth')) factor += 0.3;
    if (prompt.includes('insider') || prompt.includes('secret')) factor += 0.2;
    if (prompt.includes('research') || prompt.includes('study')) factor += 0.2;

    // Content type multipliers
    switch (context.content_type) {
      case 'viral': factor *= 1.5; break;
      case 'controversial': factor *= 1.4; break;
      case 'educational': factor *= 1.2; break;
      case 'reply': factor *= 1.1; break;
    }

    // Audience multipliers
    if (context.target_audience === 'health_enthusiasts') factor *= 1.2;

    return Math.round(factor * 100) / 100;
  }

  /**
   * 🚀 Get optimized prompts for all major operations
   */
  static getAllOptimizedPrompts(): Record<string, OptimizedPrompt> {
    const baseContext: PromptContext = {
      operation: 'content_generation',
      current_followers: 500,
      recent_engagement: 15,
      time_of_day: 14,
      content_type: 'viral',
      target_audience: 'health_enthusiasts'
    };

    return {
      viral_content: this.optimizePromptForFollowerGrowth(
        'Create viral health content that attracts new followers',
        { ...baseContext, content_type: 'viral' }
      ),
      strategic_reply: this.optimizePromptForFollowerGrowth(
        'Generate strategic reply to health influencer tweet',
        { ...baseContext, content_type: 'reply' }
      ),
      engagement_optimization: this.optimizePromptForFollowerGrowth(
        'Optimize content for maximum engagement and reach',
        { ...baseContext, content_type: 'educational' }
      ),
      trend_analysis: this.optimizePromptForFollowerGrowth(
        'Analyze health trends for viral content opportunities',
        { ...baseContext, content_type: 'trend' }
      ),
      controversial_take: this.optimizePromptForFollowerGrowth(
        'Create controversial but evidence-based health take',
        { ...baseContext, content_type: 'controversial' }
      )
    };
  }

  /**
   * 📊 Generate prompt performance analytics
   */
  static analyzePromptPerformance(
    prompt: string,
    actualFollowers: number,
    expectedFollowers: number
  ): {
    performance_score: number;
    accuracy: number;
    optimization_suggestions: string[];
  } {
    const performance = actualFollowers / Math.max(expectedFollowers, 1);
    const accuracy = 1 - Math.abs(performance - 1);

    const suggestions: string[] = [];
    
    if (performance < 0.8) {
      suggestions.push('Add more controversial or insider knowledge elements');
      suggestions.push('Include specific research citations or personal expertise');
      suggestions.push('Use stronger curiosity gap language');
    }

    if (accuracy < 0.7) {
      suggestions.push('Recalibrate follower growth predictions');
      suggestions.push('Analyze successful content patterns more deeply');
    }

    return {
      performance_score: Math.round(performance * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      optimization_suggestions: suggestions
    };
  }
}