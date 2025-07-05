import { openaiClient } from '../utils/openaiClient.js';
import { NewsAPIAgent } from './newsAPIAgent.js';
import { supabaseClient } from '../utils/supabaseClient.js';

/**
 * 🎭 DIVERSE PERSPECTIVE ENGINE
 * 
 * Generates truly different viewpoints that spark conversations and debates
 * Eliminates repetitive patterns by forcing diverse perspectives
 */
export class DiversePerspectiveEngine {
  private newsAPIAgent: NewsAPIAgent;
  private usedPerspectives: Set<string> = new Set();
  private perspectiveRotation: string[] = [];
  private controversialTopics: string[] = [];
  private currentPerspectiveIndex = 0;

  constructor() {
    this.newsAPIAgent = NewsAPIAgent.getInstance();
    this.initializePerspectives();
    this.initializeControversialTopics();
  }

  private initializePerspectives(): void {
    this.perspectiveRotation = [
      'contrarian_expert',      // Challenges conventional wisdom
      'future_visionary',       // 10-year predictions
      'industry_insider',       // Behind-the-scenes insights
      'patient_advocate',       // Patient-first perspective
      'economic_analyst',       // Cost/ROI focus
      'technology_skeptic',     // Questions tech hype
      'regulatory_expert',      // Policy implications
      'startup_founder',        // Entrepreneurial view
      'academic_researcher',    // Evidence-based analysis
      'global_health_expert',   // International perspective
      'ethics_philosopher',     // Moral implications
      'data_scientist',         // Numbers-driven insights
      'clinical_practitioner',  // Real-world medical view
      'venture_capitalist',     // Investment perspective
      'policy_maker',          // Systemic change view
      'innovation_historian',   // Historical context
      'consumer_advocate',      // User experience focus
      'technology_evangelist',  // Optimistic tech view
      'risk_assessor',         // Safety and risk focus
      'market_disruptor'       // Competitive dynamics
    ];
  }

  private initializeControversialTopics(): void {
    this.controversialTopics = [
      'Why AI diagnostics might make doctors worse at medicine',
      'The hidden costs of "free" health apps',
      'Why precision medicine is mostly marketing hype',
      'How health tech is widening healthcare inequality',
      'The dark side of patient data collection',
      'Why telemedicine is failing rural communities',
      'How Big Tech is destroying doctor-patient relationships',
      'Why most digital therapeutics don\'t work',
      'The ethics of AI making life-or-death decisions',
      'How health tech creates new forms of medical bias',
      'Why blockchain in healthcare is mostly nonsense',
      'The psychological harm of health monitoring apps',
      'How venture capital is corrupting healthcare innovation',
      'Why FDA approval doesn\'t mean health tech actually works',
      'The environmental cost of digital health solutions',
      'How health tech is creating new addictions',
      'Why interoperability will never be solved',
      'The hidden agenda behind "patient empowerment"',
      'How AI is making healthcare more expensive, not cheaper',
      'Why most health startups are solving fake problems'
    ];
  }

  /**
   * Generate truly diverse content that sparks conversation
   */
  async generateDiverseContent(): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    // Force perspective rotation to ensure diversity
    const currentPerspective = this.getNextPerspective();
    
    // Generate different types of content
    const contentTypes = [
      () => this.generateControversialTake(currentPerspective),
      () => this.generateCounterIntuitiveFact(currentPerspective),
      () => this.generateFutureScenario(currentPerspective),
      () => this.generateIndustrySecret(currentPerspective),
      () => this.generateDebateStarter(currentPerspective),
      () => this.generateMythBuster(currentPerspective),
      () => this.generatePersonalStory(currentPerspective),
      () => this.generateDataReveal(currentPerspective)
    ];

    // Try different content types until we get something unique
    for (const contentGenerator of contentTypes) {
      try {
        const result = await contentGenerator();
        if (result && this.isContentTrulyUnique(result.content)) {
          this.trackUsedPerspective(result.content);
          return result;
        }
      } catch (error) {
        console.warn(`Content generation failed for ${currentPerspective}:`, error);
      }
    }

    // Emergency fallback
    return await this.generateEmergencyDiverseContent(currentPerspective);
  }

  private getNextPerspective(): string {
    const perspective = this.perspectiveRotation[this.currentPerspectiveIndex];
    this.currentPerspectiveIndex = (this.currentPerspectiveIndex + 1) % this.perspectiveRotation.length;
    return perspective;
  }

  private async generateControversialTake(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const controversialTopic = this.controversialTopics[
      Math.floor(Math.random() * this.controversialTopics.length)
    ];

    const prompts: Record<string, string> = {
      'contrarian_expert': `As a contrarian health tech expert, explain why "${controversialTopic}". Include specific examples, data points that contradict popular beliefs, and why the industry doesn't want to admit this truth. Make it thought-provoking and evidence-based. Be bold but professional.`,
      
      'technology_skeptic': `As someone who's seen health tech promises fail repeatedly, argue that "${controversialTopic}". Include specific failed implementations, why the tech industry oversells benefits, and what the real-world consequences are. Challenge the hype with facts.`,
      
      'patient_advocate': `From a patient rights perspective, expose how "${controversialTopic}". Include real patient stories, systemic issues being ignored, and why patients are bearing the cost of tech industry mistakes. Be passionate but factual.`,
      
      'economic_analyst': `From a healthcare economics standpoint, reveal why "${controversialTopic}". Include specific cost data, ROI failures, hidden expenses, and economic incentives that are misaligned. Show the financial reality behind the marketing.`,
      
      'ethics_philosopher': `From an ethics perspective, argue that "${controversialTopic}". Include moral implications, unintended consequences, questions of consent and autonomy, and why we're not having the right conversations about this technology.`
    };

    const prompt = prompts[perspective] || `As a ${perspective.replace('_', ' ')}, argue that "${controversialTopic}". Include specific evidence, real-world examples, and why this perspective matters. Be thought-provoking and conversation-starting.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.9
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.8,
      conversationStarters: [
        "What's your take on this?",
        "Do you agree or disagree?",
        "What am I missing here?",
        "Change my mind:",
        "Unpopular opinion:"
      ],
      imageKeywords: this.getControversialImageKeywords(controversialTopic)
    };
  }

  private async generateCounterIntuitiveFact(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const prompts: Record<string, string> = {
      'data_scientist': `Share a counterintuitive finding from health tech data that surprises everyone. Include specific statistics, why this contradicts common assumptions, and what it reveals about human behavior or technology adoption. Make it mind-blowing but accurate.`,
      
      'clinical_practitioner': `Reveal a counterintuitive truth about how health technology actually works in clinical practice. Include specific examples from patient care, why reality differs from marketing claims, and what this means for healthcare outcomes.`,
      
      'venture_capitalist': `Share a counterintuitive insight about health tech investments that most people get wrong. Include specific deal data, why conventional wisdom fails, and what really predicts success in health tech ventures.`,
      
      'academic_researcher': `Present counterintuitive research findings about health technology that challenge popular beliefs. Include study data, methodology insights, and why these findings matter for the future of healthcare.`,
      
      'innovation_historian': `Share a counterintuitive historical parallel that explains current health tech trends. Include specific historical examples, pattern recognition insights, and what history teaches us about technology adoption in healthcare.`
    };

    const prompt = prompts[perspective] || `As a ${perspective.replace('_', ' ')}, share a counterintuitive fact about health technology that most people don't know. Include specific evidence and explain why this matters.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.85
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.6,
      conversationStarters: [
        "Did you know this?",
        "This surprised me:",
        "Plot twist:",
        "Counterintuitive fact:",
        "Not what you'd expect:"
      ],
      imageKeywords: ['data', 'research', 'statistics', 'analysis', 'insights']
    };
  }

  private async generateFutureScenario(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const timeframes = ['2027', '2030', '2035'];
    const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];

    const prompts: Record<string, string> = {
      'future_visionary': `Paint a specific, detailed picture of healthcare in ${timeframe}. Include technologies that will be mainstream, how patient care will change, what will disappear, and one surprising development that few see coming. Be specific and bold.`,
      
      'technology_evangelist': `Describe the breakthrough moment in ${timeframe} when health technology finally delivers on its promises. Include the specific innovation, how it changes everything, and why it took until ${timeframe} to happen. Be optimistic but realistic.`,
      
      'risk_assessor': `Warn about the biggest health tech disaster that will happen by ${timeframe}. Include specific risks being ignored today, systemic vulnerabilities, and why we're not prepared. Be sobering but constructive.`,
      
      'policy_maker': `Describe the regulatory revolution in healthcare by ${timeframe}. Include new laws, policy frameworks, international cooperation, and how governance will adapt to technological change. Be forward-thinking.`,
      
      'market_disruptor': `Predict which health tech giants will fall and which unknowns will rise by ${timeframe}. Include specific market dynamics, disruption patterns, and why current leaders are vulnerable. Be bold with predictions.`
    };

    const prompt = prompts[perspective] || `As a ${perspective.replace('_', ' ')}, predict a specific scenario for healthcare in ${timeframe}. Include detailed changes, new technologies, and societal impacts. Be specific and thought-provoking.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.9
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.5,
      conversationStarters: [
        `What do you think ${timeframe} will look like?`,
        "Bold prediction:",
        "Future scenario:",
        "By 2030:",
        "Mark my words:"
      ],
      imageKeywords: ['future', 'innovation', 'technology', 'prediction', 'vision']
    };
  }

  private async generateIndustrySecret(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const prompts: Record<string, string> = {
      'industry_insider': `Reveal an industry secret about health tech that insiders know but never discuss publicly. Include specific practices, unspoken rules, or systemic issues. Make it eye-opening but professional.`,
      
      'startup_founder': `Share what health tech startups really do behind closed doors that they'd never admit in public. Include funding realities, product development secrets, or market manipulation tactics. Be revealing but factual.`,
      
      'regulatory_expert': `Expose how health tech companies actually navigate FDA approval and regulatory processes. Include loopholes, strategies, or systemic issues that the public doesn't understand. Be informative and shocking.`,
      
      'venture_capitalist': `Reveal how health tech investment decisions are really made behind closed doors. Include criteria that are never discussed publicly, deal-making secrets, or market manipulation. Be insider-level revealing.`,
      
      'clinical_practitioner': `Share what healthcare providers really think about health tech but can't say publicly. Include adoption challenges, vendor relationships, or patient impact realities. Be honest and professional.`
    };

    const prompt = prompts[perspective] || `As a ${perspective.replace('_', ' ')}, reveal an industry secret about health technology that most people don't know. Include insider knowledge and explain why this matters.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.85
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.7,
      conversationStarters: [
        "Industry secret:",
        "What they don't tell you:",
        "Behind the scenes:",
        "Insider perspective:",
        "The real story:"
      ],
      imageKeywords: ['industry', 'insider', 'secrets', 'business', 'healthcare']
    };
  }

  private async generateDebateStarter(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const debateTopics = [
      'Should AI be allowed to make medical decisions without human oversight?',
      'Is patient privacy worth sacrificing for better health outcomes?',
      'Should health insurance cover unproven digital therapeutics?',
      'Do patients have the right to refuse AI-assisted diagnosis?',
      'Should health data be considered a public resource?',
      'Is telemedicine making healthcare more or less personal?',
      'Should Big Tech companies be allowed to own healthcare data?',
      'Is precision medicine creating a two-tier healthcare system?',
      'Should health apps be regulated like medical devices?',
      'Do wearables make people healthier or more anxious?'
    ];

    const topic = debateTopics[Math.floor(Math.random() * debateTopics.length)];

    const prompt = `As a ${perspective.replace('_', ' ')}, take a strong stance on: "${topic}". Include specific arguments, evidence, and real-world implications. Make it thought-provoking and debate-worthy. End with a question that invites discussion.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.9
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.8,
      conversationStarters: [
        "Hot take:",
        "Debate me:",
        "Controversial opinion:",
        "What's your view?",
        "Change my mind:"
      ],
      imageKeywords: ['debate', 'discussion', 'controversy', 'opinions', 'ethics']
    };
  }

  private async generateMythBuster(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const myths = [
      'AI will replace doctors',
      'Digital health saves money',
      'Wearables prevent disease',
      'Telemedicine is just as good as in-person care',
      'Health apps protect your privacy',
      'Precision medicine works for everyone',
      'More data always leads to better outcomes',
      'Health tech reduces healthcare inequality',
      'AI eliminates medical bias',
      'Digital therapeutics are as effective as drugs'
    ];

    const myth = myths[Math.floor(Math.random() * myths.length)];

    const prompt = `As a ${perspective.replace('_', ' ')}, debunk the myth that "${myth}". Include specific evidence, real-world examples, and explain what the reality actually is. Be educational but engaging.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.8
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.6,
      conversationStarters: [
        "Myth busted:",
        "Reality check:",
        "Actually:",
        "Let's be honest:",
        "The truth is:"
      ],
      imageKeywords: ['myth', 'truth', 'reality', 'facts', 'education']
    };
  }

  private async generatePersonalStory(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const prompt = `As a ${perspective.replace('_', ' ')}, share a personal story or experience that changed your perspective on health technology. Include specific details, what you learned, and why it matters. Make it authentic and relatable.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.85
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.4,
      conversationStarters: [
        "Personal story:",
        "This changed my mind:",
        "Real experience:",
        "What I learned:",
        "Story time:"
      ],
      imageKeywords: ['story', 'experience', 'personal', 'learning', 'insight']
    };
  }

  private async generateDataReveal(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const prompt = `As a ${perspective.replace('_', ' ')}, reveal a surprising data point or statistic about health technology that most people don't know. Include the specific numbers, source credibility, and explain why this data matters. Make it shocking but accurate.`;

    const content = await openaiClient.generateCompletion(prompt, {
      maxTokens: 280,
      temperature: 0.8
    });

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.5,
      conversationStarters: [
        "Surprising data:",
        "Did you know:",
        "The numbers don't lie:",
        "Data reveal:",
        "Stats that shock:"
      ],
      imageKeywords: ['data', 'statistics', 'numbers', 'research', 'facts']
    };
  }

  private async generateEmergencyDiverseContent(perspective: string): Promise<{
    content: string;
    perspective: string;
    controversyLevel: number;
    conversationStarters: string[];
    imageKeywords: string[];
  }> {
    const emergencyPrompts = [
      `Quick take: What's the most overrated health tech trend right now and why?`,
      `Unpopular opinion: Name one health tech "solution" that's actually making problems worse.`,
      `Real talk: What's one thing the health tech industry doesn't want patients to know?`,
      `Hot take: Which health tech company is going to fail spectacularly and why?`,
      `Prediction: What will be the next big health tech scandal?`
    ];

    const prompt = emergencyPrompts[Math.floor(Math.random() * emergencyPrompts.length)];

    const content = await openaiClient.generateCompletion(
      `As a ${perspective.replace('_', ' ')}, answer this: ${prompt} Be specific, bold, and conversation-starting.`,
      {
        maxTokens: 200,
        temperature: 0.9
      }
    );

    return {
      content: this.formatForTwitter(content),
      perspective,
      controversyLevel: 0.7,
      conversationStarters: ["Hot take:", "Unpopular opinion:", "Real talk:"],
      imageKeywords: ['opinion', 'perspective', 'debate', 'discussion']
    };
  }

  private formatForTwitter(content: string): string {
    // Remove quotes and clean up
    let formatted = content.replace(/^["']|["']$/g, '').trim();
    
    // Ensure it starts with a strong opener
    const strongOpeners = [
      "Here's what nobody talks about:",
      "Unpopular opinion:",
      "Industry secret:",
      "Real talk:",
      "Plot twist:",
      "Hot take:",
      "Controversial but true:",
      "What they don't tell you:",
      "Behind the scenes:",
      "Data doesn't lie:"
    ];

    // If it doesn't start strong, add an opener
    if (!strongOpeners.some(opener => formatted.toLowerCase().startsWith(opener.toLowerCase()))) {
      const opener = strongOpeners[Math.floor(Math.random() * strongOpeners.length)];
      formatted = `${opener} ${formatted}`;
    }

    // Ensure Twitter character limit
    if (formatted.length > 280) {
      formatted = formatted.substring(0, 270) + '...';
    }

    return formatted;
  }

  private getControversialImageKeywords(topic: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'AI diagnostics': ['AI', 'medical', 'diagnosis', 'technology', 'healthcare'],
      'health apps': ['mobile', 'app', 'privacy', 'data', 'smartphone'],
      'precision medicine': ['DNA', 'genetics', 'personalized', 'medicine', 'laboratory'],
      'telemedicine': ['video', 'remote', 'consultation', 'digital', 'screen'],
      'Big Tech': ['technology', 'corporate', 'data', 'surveillance', 'digital']
    };

    for (const [key, keywords] of Object.entries(keywordMap)) {
      if (topic.toLowerCase().includes(key.toLowerCase())) {
        return keywords;
      }
    }

    return ['healthcare', 'technology', 'innovation', 'medical', 'digital'];
  }

  private isContentTrulyUnique(content: string): boolean {
    const contentSignature = this.createContentSignature(content);
    return !this.usedPerspectives.has(contentSignature);
  }

  private createContentSignature(content: string): string {
    // Create a signature based on key phrases and structure
    const words = content.toLowerCase().split(' ');
    const keyWords = words.filter(word => word.length > 4);
    const signature = keyWords.slice(0, 5).join('_');
    return signature;
  }

  private trackUsedPerspective(content: string): void {
    const signature = this.createContentSignature(content);
    this.usedPerspectives.add(signature);
    
    // Keep only last 50 signatures
    if (this.usedPerspectives.size > 50) {
      const signatures = Array.from(this.usedPerspectives);
      this.usedPerspectives.clear();
      signatures.slice(-25).forEach(sig => this.usedPerspectives.add(sig));
    }
  }
} 