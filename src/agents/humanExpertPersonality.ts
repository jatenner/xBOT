import { openaiClient } from '../utils/openaiClient.js';
import { NewsAPIAgent } from './newsAPIAgent.js';
import { supabaseClient } from '../utils/supabaseClient.js';

/**
 * 🧠 HUMAN EXPERT PERSONALITY AGENT
 * Generates truly unique, expert-level content that sounds like a real health tech expert
 * Eliminates repetition and bot-like patterns
 */
export class HumanExpertPersonality {
  private newsAPIAgent: NewsAPIAgent;
  private usedContentPatterns: Set<string> = new Set();
  private usedImageConcepts: Set<string> = new Set();
  private expertTopicRotation: string[] = [];
  private lastExpertiseArea: string = '';
  
  // Track unique content aspects
  private recentSentenceStarters: Set<string> = new Set();
  private recentNumberFormats: Set<string> = new Set();
  private recentScientificClaims: Set<string> = new Set();

  constructor() {
    this.newsAPIAgent = NewsAPIAgent.getInstance();
    this.initializeExpertRotation();
  }

  private initializeExpertRotation(): void {
    this.expertTopicRotation = [
      'ai_diagnostics_expert',
      'digital_therapeutics_specialist', 
      'precision_medicine_researcher',
      'biotech_innovation_analyst',
      'healthcare_ai_architect',
      'clinical_informatics_expert',
      'genomics_data_scientist',
      'medical_device_engineer',
      'telemedicine_strategist',
      'health_policy_analyst',
      'pharmaceutical_ai_expert',
      'surgical_robotics_specialist',
      'digital_biomarker_researcher',
      'health_economics_expert',
      'clinical_trial_innovator'
    ];
  }

  /**
   * Generate completely unique expert content with no repetition
   */
  async generateExpertContent(): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  }> {
    // Rotate through different expertise areas
    const currentExpertise = this.getNextExpertiseArea();
    
    // Generate multiple content options and select most unique
    const contentOptions = await Promise.all([
      this.generatePersonalInsight(currentExpertise),
      this.generateIndustryAnalysis(currentExpertise),
      this.generateTechnicalBreakthrough(currentExpertise),
      this.generateFutureProjection(currentExpertise),
      this.generateControversialTake(currentExpertise)
    ]);

    // Filter for uniqueness and select best
    const uniqueContent = contentOptions.find(option => 
      option && this.isContentTrulyUnique(option.content)
    );

    if (!uniqueContent) {
      // Emergency fallback - generate completely random topic
      return await this.generateEmergencyUniqueContent();
    }

    // Track this content pattern
    this.trackContentPattern(uniqueContent.content);
    
    return uniqueContent;
  }

  private getNextExpertiseArea(): string {
    // Ensure we don't repeat expertise areas
    let nextArea;
    do {
      nextArea = this.expertTopicRotation[
        Math.floor(Math.random() * this.expertTopicRotation.length)
      ];
    } while (nextArea === this.lastExpertiseArea);
    
    this.lastExpertiseArea = nextArea;
    return nextArea;
  }

  private async generatePersonalInsight(expertise: string): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  } | null> {
    const detailedPersonalPrompts: Record<string, string[]> = {
      'ai_diagnostics_expert': [
        `You're a radiologist who's been using AI diagnostic tools for 3 years. Share a specific case where AI caught a subtle finding you initially missed - include the exact pathology, how the AI flagged it, what made it hard to detect, and why this changed your diagnostic approach. Make it a detailed story with specific medical insights.`,
        `As someone who's trained 200+ doctors on AI diagnostics, reveal the most surprising behavioral pattern you discovered about how physicians actually interact with AI recommendations. Include specific examples of resistance, adoption patterns, and the unexpected factor that determines success.`
      ],
      'digital_therapeutics_specialist': [
        `You've prescribed digital therapeutics to 500+ patients. Share your most remarkable patient case - include their specific condition, why traditional treatment wasn't working, how the digital therapeutic changed their outcome, and what this taught you about behavior change vs medication. Tell the complete story.`,
        `As someone who helped design FDA trials for digital therapeutics, reveal what pharmaceutical companies don't understand about digital interventions. Include specific trial design flaws you've seen, regulatory misconceptions, and why most digital health trials fail.`
      ],
      'precision_medicine_researcher': [
        `You've analyzed genomic data for 50,000+ patients. Share the most shocking genetic pattern you discovered that contradicts conventional medical wisdom. Include the specific genes involved, population differences you found, and why this discovery changes treatment protocols. Give detailed scientific insights.`,
        `As someone who's watched precision medicine evolve for 15 years, reveal the breakthrough moment that changed everything - include the specific technology advance, why previous approaches were limited, and how this unlocked personalized treatment possibilities that seemed impossible before.`
      ],
      'clinical_informatics_expert': [
        `You've implemented EHR systems in 30+ hospitals. Share the most counterintuitive discovery about how digital systems actually affect patient care - include specific workflow changes, unexpected efficiency bottlenecks, and why most health IT implementations fail to improve outcomes despite good intentions.`,
        `As someone who analyzes hospital data patterns, reveal a surprising correlation you discovered that changed how clinicians think about patient outcomes. Include the specific data points, why this pattern was hidden, and how it's reshaping clinical protocols.`
      ]
    };

    const prompts = detailedPersonalPrompts[expertise] || [
      `As a ${expertise.replace('_', ' ')}, share your most significant professional discovery - include specific details about the problem you were solving, your methodology, surprising findings, and why this insight matters for the field. Make it a detailed, personal account with technical depth.`
    ];
    
    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    try {
      const content = await openaiClient.generateCompletion(selectedPrompt, {
        maxTokens: 280, // Significantly increased for detailed content
        temperature: 0.85
      });

      if (!content || content.length < 50) return null;

      return {
        content: this.applyHumanVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'personal'),
        expertiseArea: expertise,
        confidenceScore: 0.85
      };
    } catch (error) {
      console.warn('Personal insight generation failed:', error);
      return null;
    }
  }

  private async generateIndustryAnalysis(expertise: string): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  } | null> {
    const detailedAnalysisPrompts: Record<string, string[]> = {
      'biotech_innovation_analyst': [
        `Analyze why 73% of biotech startups fail in year 2, but the survivors become unicorns. Include specific case studies, the exact inflection points that separate winners from losers, funding patterns you've observed, and the counterintuitive factor that most VCs miss when evaluating biotech deals. Give insider analysis.`,
        `As someone who's evaluated 1000+ biotech deals, reveal the one metric that predicts success better than any other. Include specific companies that exemplify this pattern, why traditional biotech metrics fail, and how this insight has changed your investment strategy.`
      ],
      'healthcare_ai_architect': [
        `You've designed AI systems for 50+ hospitals. Reveal why 85% of healthcare AI implementations fail within 18 months. Include specific technical architecture decisions, workflow integration challenges, physician adoption barriers, and the three critical success factors that most health systems ignore.`,
        `After building AI for Mayo Clinic, Cleveland Clinic, and Johns Hopkins, expose the biggest misconception about healthcare AI adoption. Include real examples of what works vs what doesn't, specific technical bottlenecks, and why most AI vendors fundamentally misunderstand healthcare workflows.`
      ],
      'health_economics_expert': [
        `Analyze why digital health saves money in theory but costs 23% more in practice. Include specific economic models, hidden cost factors, real ROI data from major implementations, and why health economists consistently underestimate total cost of ownership. Give detailed financial analysis.`,
        `You've calculated ROI for 200+ health tech implementations. Reveal the surprising factor that determines financial success - include specific examples, why conventional cost-benefit analysis fails in healthcare, and the economic pattern that predicts long-term sustainability.`
      ]
    };

    const prompts = detailedAnalysisPrompts[expertise] || [
      `As a ${expertise.replace('_', ' ')}, analyze the most significant trend others are missing in your field. Include specific data points, why conventional wisdom is wrong, examples of companies getting this right/wrong, and what this means for the next 2-3 years. Provide detailed expert analysis.`
    ];

    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    try {
      const content = await openaiClient.generateCompletion(selectedPrompt, {
        maxTokens: 300,
        temperature: 0.8
      });

      if (!content || content.length < 50) return null;

      return {
        content: this.applyHumanVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'analysis'),
        expertiseArea: expertise,
        confidenceScore: 0.88
      };
    } catch (error) {
      console.warn('Industry analysis generation failed:', error);
      return null;
    }
  }

  private async generateTechnicalBreakthrough(expertise: string): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  } | null> {
    // Get real recent news to base breakthrough on
    try {
      const recentNews = await this.newsAPIAgent.fetchHealthTechNews();
      const latestBreakthrough = recentNews[0];

      if (!latestBreakthrough) {
        return await this.generateFallbackBreakthrough(expertise);
      }

      const detailedTechnicalPrompt = `
        As a ${expertise.replace('_', ' ')}, provide an in-depth technical analysis of this breakthrough: "${latestBreakthrough.title}". 
        Include the specific technical challenges this solves, why previous approaches failed, the engineering innovations that made this possible, measurable improvements over existing solutions, and what this enables that wasn't possible before. Give detailed expert insights that go beyond surface-level reporting.
      `;

      const content = await openaiClient.generateCompletion(detailedTechnicalPrompt, {
        maxTokens: 320,
        temperature: 0.7
      });

      if (!content || content.length < 50) {
        return await this.generateFallbackBreakthrough(expertise);
      }

      return {
        content: this.applyHumanVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'technical'),
        expertiseArea: expertise,
        confidenceScore: 0.92
      };
    } catch (error) {
      return await this.generateFallbackBreakthrough(expertise);
    }
  }

  private async generateFallbackBreakthrough(expertise: string): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  }> {
    const breakthroughTemplates = [
      `Just tested the new ${this.getRandomTechnology()} system. The engineering is brilliant - it solves the latency problem everyone said was impossible. Here's why this changes everything...`,
      `Spent the morning analyzing ${this.getRandomCompany()}'s approach to ${this.getRandomHealthProblem()}. They've cracked something fundamental that others missed. The implications are huge...`,
      `Been following the ${this.getRandomRegulatory()} approval process for ${this.getRandomTreatment()}. What's fascinating is how they solved the safety validation problem. Game changer...`
    ];

    const template = breakthroughTemplates[Math.floor(Math.random() * breakthroughTemplates.length)];

    return {
      content: this.applyHumanVoice(template),
      imageKeywords: this.generateDiverseImageKeywords(expertise, 'breakthrough'),
      expertiseArea: expertise,
      confidenceScore: 0.75
    };
  }

  private async generateFutureProjection(expertise: string): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  } | null> {
    const detailedFuturePrompts = [
      `Predict how ${expertise.replace('_', ' ')} will evolve in the next 18 months. Include specific technological developments, regulatory changes, market forces, and competitive dynamics. What change will surprise everyone and why are most experts missing this trend? Give detailed predictions with timeline and reasoning.`,
      `As a ${expertise.replace('_', ' ')}, forecast the one technology shift that will make current approaches obsolete. Include specific technical limitations being solved, why current solutions will fail, which companies are positioning for this shift, and what new capabilities this will unlock. Detailed prediction with evidence.`,
      `Looking at your field's trajectory, what capability will exist in 2026 that seems impossible today? Include the specific scientific breakthroughs required, current research that's heading in this direction, remaining technical hurdles, and why this will fundamentally change the field. Expert foresight with technical depth.`
    ];

    const selectedPrompt = detailedFuturePrompts[Math.floor(Math.random() * detailedFuturePrompts.length)];

    try {
      const content = await openaiClient.generateCompletion(selectedPrompt, {
        maxTokens: 290,
        temperature: 0.8
      });

      if (!content || content.length < 50) return null;

      return {
        content: this.applyHumanVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'future'),
        expertiseArea: expertise,
        confidenceScore: 0.80
      };
    } catch (error) {
      console.warn('Future projection generation failed:', error);
      return null;
    }
  }

  private async generateControversialTake(expertise: string): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  } | null> {
    const detailedControversialPrompts = [
      `Share your most unpopular opinion about ${expertise.replace('_', ' ')} that you know is correct but others resist. Include specific evidence, why the industry fights this truth, examples of failures caused by conventional thinking, and what needs to change. Make a compelling contrarian case with detailed reasoning.`,
      `What conventional wisdom in ${expertise.replace('_', ' ')} is completely wrong? Challenge the industry consensus with specific data points, real-world examples of this wisdom failing, the vested interests that perpetuate this myth, and your alternative approach that actually works.`,
      `As a ${expertise.replace('_', ' ')}, explain why the current approach to your biggest challenge is backwards. Include specific flaws in current methodology, why most practitioners get this wrong, evidence that supports your contrarian view, and your alternative solution with better outcomes.`
    ];

    const selectedPrompt = detailedControversialPrompts[Math.floor(Math.random() * detailedControversialPrompts.length)];

    try {
      const content = await openaiClient.generateCompletion(selectedPrompt, {
        maxTokens: 300,
        temperature: 0.9
      });

      if (!content || content.length < 50) return null;

      return {
        content: this.applyHumanVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'controversial'),
        expertiseArea: expertise,
        confidenceScore: 0.78
      };
    } catch (error) {
      console.warn('Controversial take generation failed:', error);
      return null;
    }
  }

  private applyHumanVoice(content: string): string {
    // Remove any hashtags first
    content = content.replace(/#\w+/g, '');
    
    // Apply conversational transformations
    const transformations = [
      // Academic to conversational
      { from: /studies show/gi, to: "here's what I've found" },
      { from: /research indicates/gi, to: "what's interesting is" },
      { from: /data suggests/gi, to: "what surprised me" },
      { from: /according to/gi, to: "what I learned from" },
      { from: /results demonstrate/gi, to: "here's what happened" },
      
      // Formal to personal
      { from: /patients/gi, to: "people" },
      { from: /individuals/gi, to: "folks" },
      { from: /healthcare providers/gi, to: "doctors" },
      { from: /clinical outcomes/gi, to: "what actually happens" },
      
      // Add conversational elements
      { from: /^/, to: this.getRandomConversationStarter() + " " }
    ];

    transformations.forEach(({ from, to }) => {
      content = content.replace(from, to);
    });

    // Ensure it doesn't sound robotic
    if (this.soundsRobotic(content)) {
      content = this.makeMoreHuman(content);
    }

    return content.trim();
  }

  private getRandomConversationStarter(): string {
    const starters = [
      "Ever wonder why",
      "Here's what caught my attention:",
      "The part that blew my mind:",
      "What's fascinating is",
      "I've been thinking about",
      "Something I noticed:",
      "Here's what's wild:",
      "The thing nobody talks about:",
      "What surprised me:",
      "I just realized"
    ];

    let starter;
    do {
      starter = starters[Math.floor(Math.random() * starters.length)];
    } while (this.recentSentenceStarters.has(starter));

    this.recentSentenceStarters.add(starter);
    if (this.recentSentenceStarters.size > 5) {
      const oldest = this.recentSentenceStarters.values().next().value;
      this.recentSentenceStarters.delete(oldest);
    }

    return starter;
  }

  private soundsRobotic(content: string): boolean {
    const roboticPatterns = [
      /\d+% of/,
      /significant improvement/,
      /clinical trials/,
      /breakthrough technology/,
      /innovative solution/,
      /cutting-edge/,
      /state-of-the-art/,
      /revolutionary approach/
    ];

    return roboticPatterns.some(pattern => pattern.test(content));
  }

  private makeMoreHuman(content: string): string {
    // Add personal touches
    const personalizations = [
      { from: /(\d+)% of/, to: "$1% of the people I work with" },
      { from: /clinical trials/, to: "the studies I've been following" },
      { from: /breakthrough technology/, to: "this tech that's been fascinating me" },
      { from: /innovative solution/, to: "clever approach" },
      { from: /revolutionary approach/, to: "new way of thinking about this" }
    ];

    personalizations.forEach(({ from, to }) => {
      content = content.replace(from, to);
    });

    return content;
  }

  private generateDiverseImageKeywords(expertise: string, contentType: string): string[] {
    const baseKeywords = new Set<string>();
    
    // Generate unique keywords based on expertise and content type
    const expertiseKeywords: Record<string, string[]> = {
      'ai_diagnostics_expert': ['medical-imaging', 'radiology-screen', 'diagnostic-ai', 'medical-algorithm'],
      'digital_therapeutics_specialist': ['mobile-health', 'therapy-app', 'digital-wellness', 'patient-engagement'],
      'precision_medicine_researcher': ['genetic-testing', 'personalized-medicine', 'biomarker-analysis', 'genomic-data'],
      'biotech_innovation_analyst': ['laboratory-research', 'biotech-startup', 'scientific-innovation', 'research-facility'],
      'healthcare_ai_architect': ['healthcare-technology', 'medical-systems', 'health-data', 'ai-infrastructure'],
      'clinical_informatics_expert': ['medical-records', 'health-informatics', 'clinical-data', 'healthcare-analytics'],
      'genomics_data_scientist': ['dna-sequencing', 'genetic-research', 'bioinformatics', 'genomic-medicine'],
      'medical_device_engineer': ['medical-devices', 'biomedical-engineering', 'surgical-instruments', 'medical-innovation'],
      'telemedicine_strategist': ['telemedicine', 'remote-healthcare', 'virtual-consultation', 'digital-health'],
      'health_policy_analyst': ['healthcare-policy', 'public-health', 'health-economics', 'healthcare-reform'],
      'pharmaceutical_ai_expert': ['drug-discovery', 'pharmaceutical-research', 'medical-compounds', 'drug-development'],
      'surgical_robotics_specialist': ['robotic-surgery', 'surgical-robotics', 'minimally-invasive', 'surgical-technology'],
      'digital_biomarker_researcher': ['wearable-technology', 'health-monitoring', 'biosensors', 'digital-biomarkers'],
      'health_economics_expert': ['healthcare-costs', 'health-economics', 'medical-finance', 'healthcare-value'],
      'clinical_trial_innovator': ['clinical-research', 'medical-trials', 'pharmaceutical-testing', 'drug-trials']
    };

    // Content type specific keywords
    const contentKeywords: Record<string, string[]> = {
      'personal': ['human-connection', 'patient-care', 'personal-experience', 'real-world'],
      'analysis': ['data-visualization', 'analytics-dashboard', 'market-analysis', 'industry-trends'],
      'technical': ['technical-innovation', 'engineering-solution', 'scientific-breakthrough', 'advanced-technology'],
      'breakthrough': ['innovation', 'discovery', 'breakthrough-moment', 'scientific-advancement'],
      'future': ['future-technology', 'emerging-trends', 'next-generation', 'technological-evolution'],
      'controversial': ['debate', 'discussion', 'critical-thinking', 'alternative-perspective']
    };

    // Add expertise-specific keywords
    const expertKeywords = expertiseKeywords[expertise] || expertiseKeywords['ai_diagnostics_expert'];
    expertKeywords.forEach(keyword => baseKeywords.add(keyword));

    // Add content-type keywords
    const typeKeywords = contentKeywords[contentType] || contentKeywords['technical'];
    typeKeywords.forEach(keyword => baseKeywords.add(keyword));

    // Add unique timestamp-based keyword to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    baseKeywords.add(`unique-${contentType}-${timestamp}`);

    // Filter out recently used image concepts
    const availableKeywords = Array.from(baseKeywords).filter(keyword => 
      !this.usedImageConcepts.has(keyword)
    );

    // Track usage
    availableKeywords.slice(0, 3).forEach(keyword => {
      this.usedImageConcepts.add(keyword);
    });

    // Clean up old image concepts (keep last 20)
    if (this.usedImageConcepts.size > 20) {
      const oldestConcepts = Array.from(this.usedImageConcepts).slice(0, 5);
      oldestConcepts.forEach(concept => this.usedImageConcepts.delete(concept));
    }

    return availableKeywords.slice(0, 4);
  }

  private isContentTrulyUnique(content: string): boolean {
    const normalizedContent = content.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Check against all previous patterns
    for (const pattern of this.usedContentPatterns) {
      const similarity = this.calculateAdvancedSimilarity(normalizedContent, pattern);
      if (similarity > 0.4) { // Stricter than before
        console.log(`🚫 Content similarity detected: ${(similarity * 100).toFixed(1)}%`);
        return false;
      }
    }

    // Check for overused phrases
    const overusedPhrases = [
      'precision medicine',
      'ai diagnostics', 
      '% accuracy',
      'breakthrough',
      'revolutionary',
      'significant improvement',
      'clinical outcomes',
      'patient outcomes'
    ];

    const foundOverused = overusedPhrases.filter(phrase => 
      normalizedContent.includes(phrase.toLowerCase())
    );

    if (foundOverused.length > 1) {
      console.log(`🚫 Overused phrases detected: ${foundOverused.join(', ')}`);
      return false;
    }

    return true;
  }

  private calculateAdvancedSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ').filter(w => w.length > 3);
    const words2 = str2.split(' ').filter(w => w.length > 3);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // Check for similar sentence structure
    const structure1 = words1.slice(0, 3).join(' ');
    const structure2 = words2.slice(0, 3).join(' ');
    
    if (structure1 === structure2) return 0.8;
    
    // Check for common technical terms
    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = commonWords.length / Math.max(words1.length, words2.length);
    
    // Boost similarity if numbers are same format
    const numbers1 = str1.match(/\d+%/g) || [];
    const numbers2 = str2.match(/\d+%/g) || [];
    if (numbers1.length > 0 && numbers2.length > 0) {
      const sameFormat = numbers1.some(n1 => numbers2.some(n2 => 
        Math.abs(parseInt(n1) - parseInt(n2)) < 5
      ));
      if (sameFormat) return Math.max(similarity, 0.5);
    }
    
    return similarity;
  }

  private trackContentPattern(content: string): void {
    const pattern = content.toLowerCase().replace(/[^\w\s]/g, '');
    this.usedContentPatterns.add(pattern);
    
    // Keep only recent patterns (last 30)
    if (this.usedContentPatterns.size > 30) {
      const oldest = this.usedContentPatterns.values().next().value;
      this.usedContentPatterns.delete(oldest);
    }
  }

  private async generateEmergencyUniqueContent(): Promise<{
    content: string;
    imageKeywords: string[];
    expertiseArea: string;
    confidenceScore: number;
  }> {
    // Generate completely random unique content
    const randomTopics = [
      'quantum sensors in medical diagnostics',
      'bioengineered organ printing breakthrough',
      'neural interface therapy advancement',
      'microbiome-targeted precision drugs',
      'AI-powered surgical planning revolution',
      'digital twin patient modeling innovation',
      'blockchain clinical trial transparency',
      'nanotechnology cancer detection',
      'gene therapy delivery optimization',
      'augmented reality medical training'
    ];

    const randomTopic = randomTopics[Math.floor(Math.random() * randomTopics.length)];
    
    const emergencyPrompt = `As an expert in ${randomTopic}, share a fascinating technical insight that most people don't know. Make it conversational and specific. Under 240 chars.`;

    try {
      const content = await openaiClient.generateCompletion(emergencyPrompt, {
        maxTokens: 85,
        temperature: 1.0 // Maximum creativity
      });

      return {
        content: this.applyHumanVoice(content || "Just discovered something fascinating about how biological systems self-optimize. The engineering principles are incredible - nature solved problems we're just now understanding."),
        imageKeywords: this.generateDiverseImageKeywords('biotech_innovation_analyst', 'breakthrough'),
        expertiseArea: 'biotech_innovation_analyst',
        confidenceScore: 0.60
      };
    } catch (error) {
      return {
        content: "Been analyzing how biological systems solve complex problems. The optimization patterns are mind-blowing - 3.8 billion years of R&D built into every cell.",
        imageKeywords: ['biological-systems', 'cellular-research', 'biomimetics', 'natural-innovation'],
        expertiseArea: 'biotech_innovation_analyst',
        confidenceScore: 0.50
      };
    }
  }

  private getRandomTechnology(): string {
    const technologies = [
      'quantum sensor array', 'neural processing unit', 'bio-integrated chip',
      'organic transistor network', 'photonic computing system', 'molecular diagnostic platform',
      'synthetic biology compiler', 'protein folding predictor', 'gene circuit designer'
    ];
    return technologies[Math.floor(Math.random() * technologies.length)];
  }

  private getRandomCompany(): string {
    const companies = [
      'DeepMind', 'Illumina', 'Ginkgo Bioworks', 'Recursion Pharmaceuticals',
      'Tempus Labs', 'Foundation Medicine', 'Guardant Health', 'Veracyte',
      'Pacific Biosciences', 'Oxford Nanopore', 'Twist Bioscience'
    ];
    return companies[Math.floor(Math.random() * companies.length)];
  }

  private getRandomHealthProblem(): string {
    const problems = [
      'early Alzheimer\'s detection', 'rare disease diagnosis', 'cancer recurrence prediction',
      'drug resistance patterns', 'biomarker discovery', 'treatment response optimization',
      'genetic variant interpretation', 'immune system modeling', 'microbiome analysis'
    ];
    return problems[Math.floor(Math.random() * problems.length)];
  }

  private getRandomRegulatory(): string {
    const regulatory = ['FDA', 'EMA', 'NICE', 'Health Canada', 'TGA'];
    return regulatory[Math.floor(Math.random() * regulatory.length)];
  }

  private getRandomTreatment(): string {
    const treatments = [
      'CAR-T cell therapy', 'mRNA vaccine platform', 'gene editing protocol',
      'digital biomarker system', 'AI diagnostic tool', 'precision drug delivery',
      'bioengineered tissue', 'synthetic biology treatment', 'immunotherapy approach'
    ];
    return treatments[Math.floor(Math.random() * treatments.length)];
  }
} 