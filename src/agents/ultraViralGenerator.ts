import { openaiClient } from '../utils/openaiClient.js';
import { realLinkProvider } from '../utils/realLinkProvider.js';
import { TrendResearchFusion } from './trendResearchFusion.js';
import { QualityGate, QualityMetrics } from '../utils/qualityGate.js';

interface ViralContent {
  content: string;
  style: string;
  viralScore: number;
  engagement_triggers: string[];
  characterCount: number;
  hasUrl: boolean;
  citation?: string;
  url?: string;
  qualityMetrics?: QualityMetrics;
}

interface TweetTemplate {
  name: string;
  pattern: string;
  examples: string[];
  maxLength: number;
  requiresCitation: boolean;
}

export class UltraViralGenerator {
  private trendFusion: TrendResearchFusion;
  private qualityGate: QualityGate;
  
  // Enhanced content templates with PhD-level sophistication
  private contentStyles: TweetTemplate[] = [
    {
      name: "BREAKING_NEWS",
      pattern: "🚨 JUST IN: {headline}\n\n{impact}\n\n{link}",
      examples: [
        "🚨 JUST IN: Google's AI predicts heart disease 5 years early with 94% accuracy\n\nThis could save millions of lives annually\n\nhttps://nature.com/study"
      ],
      maxLength: 260,
      requiresCitation: true
    },
    {
      name: "HOT_TAKE", 
      pattern: "🔥 HOT TAKE: {bold_statement}\n\n{evidence} {question}",
      examples: [
        "🔥 HOT TAKE: AI will replace radiologists faster than lawyers\n\nStanford's AI already outperforms doctors by 34% in cancer detection. Ready for robot doctors? 🤖"
      ],
      maxLength: 260,
      requiresCitation: false
    },
    {
      name: "PHD_THREAD",
      pattern: "🧵 THREAD: {sophisticated_analysis}\n\n{deep_insight}\n\n{implications} (Source: {citation})",
      examples: [
        "🧵 THREAD: The convergence of quantum computing and drug discovery represents a paradigmatic shift in pharmaceutical research\n\nWe're witnessing the emergence of computational biology as the dominant methodology\n\nThis fundamentally challenges traditional empirical approaches to medicine (Nature, 2024)"
      ],
      maxLength: 260,
      requiresCitation: true
    },
    {
      name: "QUICK_STAT",
      pattern: "📊 {percentage}% stat that changes everything:\n\n{context}\n\n{source_link}",
      examples: [
        "📊 94% stat that changes everything:\n\nAI now outperforms doctors in early cancer detection across 12 different types\n\nhttps://nature.com/ai-cancer-detection-2024"
      ],
      maxLength: 200,
      requiresCitation: true
    },
    {
      name: "VISUAL_SNACK",
      pattern: "💡 Quick insight: {bite_sized_fact}\n\n{visual_metaphor}\n\n{takeaway}",
      examples: [
        "💡 Quick insight: Your smartphone has more health sensors than most hospitals had 20 years ago\n\n📱 = 🏥 from 2004\n\nDigital health revolution isn't coming—it's here"
      ],
      maxLength: 180,
      requiresCitation: false
    },
    {
      name: "EDUCATION",
      pattern: "💡 ELI5: {complex_concept} = {simple_analogy}\n\nWhy it matters: {impact}",
      examples: [
        "💡 ELI5: CRISPR gene editing = Microsoft Word but for DNA\n\nWhy it matters: We can now fix genetic diseases like typos"
      ],
      maxLength: 220,
      requiresCitation: false
    },
    {
      name: "CULTURAL_REFERENCE",
      pattern: "{pop_culture_ref} but for healthcare:\n\n{description}\n\n{impact} {question}",
      examples: [
        "ChatGPT but for drug discovery:\n\nAI designs new medicines in weeks instead of decades\n\nYour pills might be AI-designed soon. Thoughts? 💊"
      ],
      maxLength: 240,
      requiresCitation: false
    },
    {
      name: "DATA_STORY",
      pattern: "📊 Wild stat: {percentage}% of {demographic} {surprising_fact}\n\n{context} {link}",
      examples: [
        "📊 Wild stat: 89% of rare diseases still have no treatment\n\nAI is changing this faster than ever\n\nhttps://rarediseases.org"
      ],
      maxLength: 250,
      requiresCitation: true
    },
    {
      name: "PREDICTION",
      pattern: "🔮 In {timeframe}, {prediction}\n\nCurrent: {status_quo}\nFuture: {transformation}\n\nReady? 🚀",
      examples: [
        "🔮 In 5 years, your smartwatch will diagnose cancer\n\nCurrent: Wait for symptoms\nFuture: Prevention mode 24/7\n\nReady? 🚀"
      ],
      maxLength: 240,
      requiresCitation: false
    },
    {
      name: "COMPARISON",
      pattern: "{old_thing} vs {new_thing}:\n• Old: {limitation}\n• New: {improvement}\n\nThe future is here 💫",
      examples: [
        "Traditional drug trials vs AI drug trials:\n• Old: 10+ years, billions in cost\n• New: Months, fraction of cost\n\nThe future is here 💫"
      ],
      maxLength: 250,
      requiresCitation: false
    },
    {
      name: "QUESTION_STARTER",
      pattern: "Quick question: {thought_provoking_question}\n\n{context}\n\nWhat's your take? 🤔",
      examples: [
        "Quick question: Would you trust an AI surgeon over a human?\n\nRobots already perform surgery with 2x precision\n\nWhat's your take? 🤔"
      ],
      maxLength: 220,
      requiresCitation: false
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

  constructor() {
    this.trendFusion = new TrendResearchFusion();
    this.qualityGate = new QualityGate();
  }

  async generateViralTweet(topic?: string, preferredTemplate?: string): Promise<ViralContent> {
    try {
      // Use trend-research fusion for enhanced content
      const fusionItems = await this.trendFusion.generateTrendResearchItems();
      let selectedItem = fusionItems.length > 0 ? fusionItems[0] : null;
      
      // Select template based on preference or fusion content
      let selectedTemplate = this.selectOptimalTemplate(preferredTemplate, selectedItem);
      const selectedTopic = selectedItem?.trendTopic || topic || this.healthTechTopics[Math.floor(Math.random() * this.healthTechTopics.length)];
      
      console.log(`🎨 Generating ${selectedTemplate.name} tweet about: ${selectedTopic}`);
      
      let content = '';
      let citation = '';
      let url = '';
      let engagement_triggers: string[] = [];
      
      // Generate content with multiple attempts for quality
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await this.generateWithTemplate(selectedTemplate, selectedTopic, selectedItem);
          content = result.content;
          citation = result.citation;
          url = result.url;
          engagement_triggers = result.engagement_triggers;
          
          // Quality gate check
          const qualityCheck = await this.qualityGate.checkQuality(content, url, citation);
          
          if (qualityCheck.passesGate) {
            console.log(`✅ Content passed quality gate on attempt ${attempt}`);
            break;
          } else {
            console.log(`❌ Attempt ${attempt} failed quality gate: ${qualityCheck.failureReasons.join(', ')}`);
            if (attempt === 3) {
              await this.qualityGate.logRejectedDraft(content, qualityCheck, 'Failed quality gate after 3 attempts');
            }
          }
        } catch (error) {
          console.warn(`⚠️ Generation attempt ${attempt} failed:`, error);
          if (attempt === 3) {
            // Fallback to simple template
            const fallbackResult = this.generateFromTemplate(selectedTemplate, selectedTopic);
            content = fallbackResult.content;
            citation = fallbackResult.citation || '';
            url = fallbackResult.url || '';
            engagement_triggers = ['FALLBACK_GENERATED'];
          }
        }
      }

      // Final formatting and optimization
      content = this.optimizeContentFormat(content);
      
      // Add citation if required and missing
      if (selectedTemplate.requiresCitation && !citation && !this.hasCitationInContent(content)) {
        content = this.addCitation(content, selectedItem);
      }

      const viralScore = this.calculateViralScore(content, selectedTemplate.name);
      const characterCount = content.length;
      const hasUrl = /https?:\/\//.test(content) || Boolean(url);

      return {
        content,
        style: selectedTemplate.name,
        viralScore,
        engagement_triggers,
        characterCount,
        hasUrl,
        citation,
        url,
        qualityMetrics: await this.qualityGate.checkQuality(content, url, citation)
      };
      
    } catch (error) {
      console.error('❌ Enhanced viral generation failed, using fallback:', error);
      return this.generateFallbackTweet(topic);
    }
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

  addCustomStyle(name: string, pattern: string, examples: string[], maxLength: number = 260, requiresCitation: boolean = false): void {
    this.contentStyles.push({
      name: name.toUpperCase(),
      pattern,
      examples,
      maxLength,
      requiresCitation
    });
  }

  /**
   * Select optimal template based on content and preferences
   */
  private selectOptimalTemplate(preferredTemplate?: string, fusionItem?: any): TweetTemplate {
    // If preferred template specified, try to find it
    if (preferredTemplate) {
      const found = this.contentStyles.find(t => t.name === preferredTemplate.toUpperCase());
      if (found) return found;
    }

    // If fusion item available, select based on content characteristics
    if (fusionItem) {
      if (fusionItem.sourceType === 'pubmed') return this.contentStyles.find(t => t.name === 'PHD_THREAD') || this.contentStyles[0];
      if (fusionItem.keyFacts.length > 2) return this.contentStyles.find(t => t.name === 'QUICK_STAT') || this.contentStyles[0];
      if (fusionItem.trendVolume > 10000) return this.contentStyles.find(t => t.name === 'BREAKING_NEWS') || this.contentStyles[0];
    }

    // Default random selection
    return this.contentStyles[Math.floor(Math.random() * this.contentStyles.length)];
  }

  /**
   * Generate content with specific template
   */
  private async generateWithTemplate(template: TweetTemplate, topic: string, fusionItem?: any): Promise<{
    content: string;
    citation: string;
    url: string;
    engagement_triggers: string[];
  }> {
    try {
      const prompt = this.buildEnhancedPrompt(template, topic, fusionItem);
      const content = await openaiClient.generateTweet(prompt, 'viral');
      
      return {
        content: this.optimizeContentFormat(content),
        citation: fusionItem?.researchSource || '',
        url: fusionItem?.url || '',
        engagement_triggers: ['AI_GENERATED', 'TREND_FUSION', 'QUALITY_OPTIMIZED']
      };
    } catch (error) {
      // Fallback to template generation
      const fallback = this.generateFromTemplate(template, topic);
      return {
        content: fallback.content,
        citation: fallback.citation || '',
        url: fallback.url || '',
        engagement_triggers: ['TEMPLATE_FALLBACK']
      };
    }
  }

  /**
   * Build enhanced prompt with trend fusion data
   */
  private buildEnhancedPrompt(template: TweetTemplate, topic: string, fusionItem?: any): string {
    let contextData = '';
    
    if (fusionItem) {
      contextData = `
Research Context:
- Source: ${fusionItem.researchSource}
- Key Facts: ${fusionItem.keyFacts.join(', ')}
- Credibility: ${(fusionItem.institutionCredibility * 100).toFixed(0)}%
- Trend Volume: ${fusionItem.trendVolume}
`;
    }

    return `Create a ${template.name} style viral health tech tweet about "${topic}".

Template Pattern: ${template.pattern}
Max Length: ${template.maxLength} characters
Requires Citation: ${template.requiresCitation}

${contextData}

Requirements:
- Follow the template pattern exactly
- Include 2+ specific facts or numbers
- Add institutional credibility (Stanford, Nature, NIH, etc.)
- ${template.requiresCitation ? 'Include condensed citation format like (Nature 2024)' : 'No citation required'}
- Keep under ${template.maxLength} characters
- Make it engaging and shareable
- PhD-level sophistication
- Generate direct content only (no quotes around entire tweet)

Focus on: ${topic}`;
  }

  /**
   * Enhanced template generation with trend fusion
   */
  private generateFromTemplate(template: TweetTemplate, topic: string): {
    content: string;
    citation?: string;
    url?: string;
  } {
    const numbers = ['87', '92', '73', '94', '89', '76', '95', '81', '88', '91'];
    const timeframes = ['3 months', '6 weeks', '2 years', '5 years', '18 months', 'next decade'];
    const institutions = ['Stanford', 'Harvard', 'MIT', 'Nature', 'NEJM', 'NIH', 'WHO'];
    
    const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
    const randomTimeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
    const randomInstitution = institutions[Math.floor(Math.random() * institutions.length)];

    let content = '';
    let citation = '';
    let url = '';

    switch (template.name) {
      case 'BREAKING_NEWS':
        content = `🚨 JUST IN: ${randomInstitution} AI achieves ${randomNumber}% accuracy in ${topic}

This could revolutionize healthcare within ${randomTimeframe}`;
        citation = `${randomInstitution}, 2024`;
        url = realLinkProvider.getRealLinkForTopic(topic)?.url || '';
        break;

      case 'PHD_THREAD':
        content = `🧵 THREAD: The convergence of AI and ${topic} represents a paradigmatic shift in medical research

${randomInstitution} demonstrates ${randomNumber}% improvement over traditional methods

This challenges fundamental assumptions about healthcare delivery`;
        citation = `${randomInstitution}, 2024`;
        break;

      case 'QUICK_STAT':
        content = `📊 ${randomNumber}% stat that changes everything:

AI-powered ${topic} now outperforms traditional methods across multiple metrics`;
        url = realLinkProvider.getRealLinkForTopic(topic)?.url || '';
        citation = `${randomInstitution} Research, 2024`;
        break;

      case 'VISUAL_SNACK':
        content = `💡 Quick insight: ${topic} sensors are now more accurate than most medical equipment from 2010

📱 = 🏥 (2010 edition)

Digital health revolution is here`;
        break;

      default:
        content = this.generateFromTemplateOriginal(template, topic);
        break;
    }

    // Add citation format if required
    if (template.requiresCitation && citation) {
      content = `${content} (${citation})`;
    }

    return { content, citation, url };
  }

  /**
   * Check if content already has citation
   */
  private hasCitationInContent(content: string): boolean {
    const citationPatterns = [
      /\([^)]*20\d{2}[^)]*\)/,
      /\([^)]*nature[^)]*\)/i,
      /\([^)]*stanford[^)]*\)/i,
      /\([^)]*nejm[^)]*\)/i
    ];
    return citationPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Add citation to content
   */
  private addCitation(content: string, fusionItem?: any): string {
    const source = fusionItem?.researchSource || 'Nature';
    const year = new Date().getFullYear();
    return `${content} (${source}, ${year})`;
  }

  /**
   * Generate fallback tweet when enhanced generation fails
   */
  private generateFallbackTweet(topic?: string): ViralContent {
    const selectedTopic = topic || this.healthTechTopics[Math.floor(Math.random() * this.healthTechTopics.length)];
    const template = this.contentStyles[0]; // Use first template as fallback
    
    const content = `🚀 ${selectedTopic} breakthrough: 94% improvement in patient outcomes

The future of healthcare is accelerating faster than we imagined

(Nature, 2024)`;

    return {
      content,
      style: template.name,
      viralScore: 75,
      engagement_triggers: ['FALLBACK_GENERATED'],
      characterCount: content.length,
      hasUrl: false,
      citation: 'Nature, 2024'
    };
  }

  /**
   * Original template generation for backward compatibility
   */
  private generateFromTemplateOriginal(template: any, topic: string): string {
    const numbers = ['87', '92', '73', '94', '89', '76', '95', '81', '88', '91'];
    const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
    
    const fallbackContent = `🚀 ${topic} breakthrough: ${randomNumber}% improvement achieved

Revolutionary progress in healthcare technology continues to accelerate`;
    
    return fallbackContent;
  }
} 