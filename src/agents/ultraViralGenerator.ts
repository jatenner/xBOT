import { openaiClient } from '../utils/openaiClient.js';
import { realLinkProvider } from '../utils/realLinkProvider.js';

interface ViralContent {
  content: string;
  style: string;
  viralScore: number;
  engagement_triggers: string[];
  characterCount: number;
  hasUrl: boolean;
}

export class UltraViralGenerator {
  private contentStyles = [
    {
      name: "BREAKING_NEWS",
      pattern: "🚨 JUST IN: {headline}\n\n{impact}\n\n{link}",
      examples: [
        "🚨 JUST IN: Google's AI predicts heart disease 5 years early with 94% accuracy\n\nThis could save millions of lives annually\n\nhttps://nature.com/study"
      ]
    },
    {
      name: "HOT_TAKE", 
      pattern: "🔥 HOT TAKE: {bold_statement}\n\n{evidence} {question}",
      examples: [
        "🔥 HOT TAKE: AI will replace radiologists faster than lawyers\n\nStanford's AI already outperforms doctors by 34% in cancer detection. Ready for robot doctors? 🤖"
      ]
    },
    {
      name: "EDUCATION",
      pattern: "💡 ELI5: {complex_concept} = {simple_analogy}\n\nWhy it matters: {impact}",
      examples: [
        "💡 ELI5: CRISPR gene editing = Microsoft Word but for DNA\n\nWhy it matters: We can now fix genetic diseases like typos"
      ]
    },
    {
      name: "CULTURAL_REFERENCE",
      pattern: "{pop_culture_ref} but for healthcare:\n\n{description}\n\n{impact} {question}",
      examples: [
        "ChatGPT but for drug discovery:\n\nAI designs new medicines in weeks instead of decades\n\nYour pills might be AI-designed soon. Thoughts? 💊"
      ]
    },
    {
      name: "DATA_STORY",
      pattern: "📊 Wild stat: {percentage}% of {demographic} {surprising_fact}\n\n{context} {link}",
      examples: [
        "📊 Wild stat: 89% of rare diseases still have no treatment\n\nAI is changing this faster than ever\n\nhttps://rarediseases.org"
      ]
    },
    {
      name: "PREDICTION",
      pattern: "🔮 In {timeframe}, {prediction}\n\nCurrent: {status_quo}\nFuture: {transformation}\n\nReady? 🚀",
      examples: [
        "🔮 In 5 years, your smartwatch will diagnose cancer\n\nCurrent: Wait for symptoms\nFuture: Prevention mode 24/7\n\nReady? 🚀"
      ]
    },
    {
      name: "COMPARISON",
      pattern: "{old_thing} vs {new_thing}:\n• Old: {limitation}\n• New: {improvement}\n\nThe future is here 💫",
      examples: [
        "Traditional drug trials vs AI drug trials:\n• Old: 10+ years, billions in cost\n• New: Months, fraction of cost\n\nThe future is here 💫"
      ]
    },
    {
      name: "QUESTION_STARTER",
      pattern: "Quick question: {thought_provoking_question}\n\n{context}\n\nWhat's your take? 🤔",
      examples: [
        "Quick question: Would you trust an AI surgeon over a human?\n\nRobots already perform surgery with 2x precision\n\nWhat's your take? 🤔"
      ]
    }
  ];

  private healthTechTopics = [
    "AI drug discovery", "precision medicine", "digital therapeutics", "brain-computer interfaces",
    "gene therapy", "robotic surgery", "telemedicine", "health monitoring", "longevity research",
    "medical imaging AI", "biomarker detection", "personalized treatment", "rare disease research",
    "cancer immunotherapy", "mental health AI", "fitness tracking", "medical devices", "health data"
  ];

  private viralTriggers = {
    controversy: ["HOT TAKE", "UNPOPULAR OPINION", "Plot twist", "Reality check"],
    surprise: ["Wild stat", "THIS WILL BLOW YOUR MIND", "Shocking discovery", "Unexpected finding"],
    urgency: ["JUST IN", "BREAKING", "Happening now", "Latest update"],
    curiosity: ["Quick question", "Ever wonder", "What if", "Imagine if"],
    comparison: ["vs", "before/after", "then vs now", "old way vs new way"],
    cultural: ["like ChatGPT for", "Netflix for", "Uber for", "iPhone moment for"]
  };

  async generateViralTweet(topic?: string): Promise<ViralContent> {
    // Select random style for variety
    const style = this.contentStyles[Math.floor(Math.random() * this.contentStyles.length)];
    const selectedTopic = topic || this.healthTechTopics[Math.floor(Math.random() * this.healthTechTopics.length)];
    
    let content = '';
    let engagement_triggers: string[] = [];
    
    try {
      // Try to use OpenAI for high-quality, varied content
      const prompt = this.buildVariedPrompt(style, selectedTopic);
      content = await openaiClient.generateTweet(prompt, 'viral');
      engagement_triggers = ['AI_GENERATED', 'STYLE_VARIED', 'OPTIMIZED_HOOK'];
      
    } catch (error) {
      // Fallback to template-based generation (offline)
      content = this.generateFromTemplate(style, selectedTopic);
      engagement_triggers = ['TEMPLATE_BASED', 'OFFLINE_GENERATED'];
    }

    // Ensure proper formatting and URL preservation
    content = this.optimizeContentFormat(content);

    const viralScore = this.calculateViralScore(content, style.name);
    const characterCount = content.length;
    const hasUrl = /https?:\/\//.test(content);

    return {
      content,
      style: style.name,
      viralScore,
      engagement_triggers,
      characterCount,
      hasUrl
    };
  }

  private buildVariedPrompt(style: any, topic: string): string {
    return `Create a viral health tech tweet about "${topic}" using the ${style.name} style.

Style Pattern: ${style.pattern}

Requirements:
- Use this EXACT style pattern but make it unique
- Include specific numbers/percentages when possible
- Keep under 250 characters (leave room for potential additions)
- Make it engaging and shareable
- If including a URL, use a realistic research source
- Avoid repetitive "AI just cracked the code" openings
- Be specific and compelling
- End with engagement hooks when appropriate
- DO NOT wrap the entire tweet in quotation marks - generate direct content only
- Generate original content, not quoted content

Topic: ${topic}
Style: ${style.name}

Generate engaging, varied content that follows the pattern but feels fresh and specific.`;
  }

  private generateFromTemplate(style: any, topic: string): string {
    // Enhanced offline generation with more variety
    const numbers = ['87', '92', '73', '94', '89', '76', '95', '81', '88', '91'];
    const timeframes = ['3 months', '6 weeks', '2 years', '5 years', '18 months', 'next decade'];
    const companies = ['Google', 'Stanford', 'MIT', 'DeepMind', 'OpenAI', 'Microsoft'];
    
    const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
    const randomTimeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
    const randomCompany = companies[Math.floor(Math.random() * companies.length)];

    // Get a real, working link for this topic
    const realLink = realLinkProvider.getRealLinkForTopic(topic);
    const linkToUse = realLink?.url || ''; // Use real link or no link

    switch (style.name) {
      case 'BREAKING_NEWS':
        const newsContent = `🚨 JUST IN: ${randomCompany}'s AI achieves ${randomNumber}% accuracy in ${topic}

This could revolutionize healthcare within ${randomTimeframe}`;
        return linkToUse ? `${newsContent}\n\n${linkToUse}` : newsContent;

      case 'HOT_TAKE':
        return `🔥 HOT TAKE: ${topic} will replace traditional methods faster than expected

${randomCompany}'s study shows ${randomNumber}% improvement. Ready for this shift? 🤖`;

      case 'EDUCATION':
        return `💡 ELI5: ${topic} = Netflix recommendations but for your health

Why it matters: Personalized medicine for everyone, not just the wealthy`;

      case 'CULTURAL_REFERENCE':
        return `ChatGPT moment for ${topic}:

AI achieves ${randomNumber}% accuracy, ${randomTimeframe} faster than humans

Your healthcare is about to get very interesting 🚀`;

      case 'DATA_STORY':
        const dataContent = `📊 Wild stat: ${randomNumber}% of patients could benefit from ${topic}

Yet most people have never heard of it`;
        return linkToUse ? `${dataContent}\n\n${linkToUse}` : dataContent;

      case 'PREDICTION':
        return `🔮 In ${randomTimeframe}, ${topic} will be everywhere

Current: Limited access
Future: Standard healthcare

Ready for this transformation? 🚀`;

      case 'COMPARISON':
        return `Traditional healthcare vs ${topic}:
• Old: Slow, expensive, one-size-fits-all
• New: Fast, precise, personalized

The future is here 💫`;

      case 'QUESTION_STARTER':
        return `Quick question: Would you trust AI for ${topic}?

${randomNumber}% accuracy rate vs human baseline

What's your comfort level? 🤔`;

      default:
        const defaultContent = `🚀 ${topic} breakthrough: ${randomNumber}% improvement in patient outcomes

The future of healthcare is accelerating faster than we imagined`;
        return linkToUse ? `${defaultContent}\n\n${linkToUse}` : defaultContent;
    }
  }

  private optimizeContentFormat(content: string): string {
    // Clean up formatting issues
    content = content.trim();
    
    // Remove any wrapper quotes around the entire content (similar to OpenAI client)
    while ((content.startsWith('"') && content.endsWith('"')) || 
           (content.startsWith("'") && content.endsWith("'")) ||
           (content.startsWith('"') && content.endsWith('"')) ||
           (content.startsWith("'") && content.endsWith("'"))) {
      content = content.slice(1, -1).trim();
    }
    
    // Ensure proper line breaks and spacing
    content = content.replace(/\n\n+/g, '\n\n'); // Normalize double line breaks
    content = content.replace(/\s+/g, ' '); // Remove extra spaces within lines
    content = content.replace(/\n /g, '\n'); // Remove spaces after line breaks
    
    // Ensure URLs are properly spaced
    content = content.replace(/([^\s])https?:\/\//g, '$1 https://');
    content = content.replace(/https?:\/\/[^\s]+([^\s.])/g, '$& ');
    
    // Final cleanup
    return content.trim();
  }

  private calculateViralScore(content: string, styleName: string): number {
    let score = 50; // Base score
    
    // Content length optimization (shorter can be punchier)
    if (content.length >= 120 && content.length <= 220) score += 20;
    else if (content.length >= 100 && content.length <= 250) score += 15;
    else if (content.length < 100) score += 10; // Punchy can be good
    
    // Engagement factors
    if (/🚨|🔥|⚡|💥|🤯|💡|📊|🔮/.test(content)) score += 15; // Strong emoji hooks
    if (/\d+%/.test(content)) score += 15; // Specific percentages
    if (/\d+[x×]/.test(content)) score += 10; // Multiplication factors
    if (/vs|versus|before|after/.test(content.toLowerCase())) score += 10; // Comparisons
    
    // Question engagement
    if (/\?/.test(content)) score += 10;
    if (/thoughts\?|take\?|ready\?|comfort/i.test(content)) score += 5;
    
    // Controversy and surprise indicators
    if (/hot take|unpopular|plot twist|shocking/i.test(content)) score += 15;
    if (/wild stat|blow your mind|just in/i.test(content)) score += 10;
    
    // Cultural relevance
    if (/chatgpt|netflix|uber|iphone|google/i.test(content)) score += 10;
    
    // Style-specific bonuses
    switch (styleName) {
      case 'HOT_TAKE':
      case 'CONTROVERSIAL_TAKE':
        score += 10; // Controversy drives engagement
        break;
      case 'BREAKING_NEWS':
      case 'DATA_STORY':
        score += 8; // News and data perform well
        break;
      case 'CULTURAL_REFERENCE':
      case 'COMPARISON':
        score += 12; // Very shareable
        break;
    }
    
    // URL bonus (research backing)
    if (/https?:\/\//.test(content)) score += 5;
    
    return Math.min(100, Math.max(30, score));
  }

  async generateMultipleViralTweets(count: number = 5): Promise<ViralContent[]> {
    const tweets = [];
    const usedStyles = new Set();
    
    for (let i = 0; i < count; i++) {
      // Ensure style variety
      let attempts = 0;
      let style;
      do {
        style = this.contentStyles[Math.floor(Math.random() * this.contentStyles.length)];
        attempts++;
      } while (usedStyles.has(style.name) && attempts < 10 && usedStyles.size < this.contentStyles.length);
      
      usedStyles.add(style.name);
      
      const topic = this.healthTechTopics[Math.floor(Math.random() * this.healthTechTopics.length)];
      const tweet = await this.generateViralTweet(topic);
      tweets.push(tweet);
    }
    
    // Sort by viral score (highest first)
    return tweets.sort((a, b) => b.viralScore - a.viralScore);
  }

  getStyleVariety(): string[] {
    return this.contentStyles.map(style => style.name);
  }

  addCustomStyle(name: string, pattern: string, examples: string[]): void {
    this.contentStyles.push({
      name: name.toUpperCase(),
      pattern,
      examples
    });
  }
} 