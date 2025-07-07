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
        `You've analyzed 50,000+ medical images with AI systems. Share your most shocking discovery: include the specific pathology (e.g., early-stage adenocarcinoma), the exact AI model used (e.g., ResNet-50 with attention mechanisms), sensitivity/specificity numbers (e.g., 94.2% sensitivity, 89.7% specificity), and why this finding changes diagnostic protocols. Include the peer-reviewed study citation and explain the clinical implications for patient outcomes.`,
        `As someone who's trained radiologists on AI for 5 years, reveal the surprising pattern you discovered about diagnostic accuracy. Include specific data: which conditions AI excels at (e.g., diabetic retinopathy, pulmonary nodules), false positive rates, and the counterintuitive factor that predicts physician adoption. Reference actual studies from Nature Medicine, NEJM, or Radiology.`
      ],
      'precision_medicine_researcher': [
        `You've analyzed genomic data for 100,000+ patients across 15 ethnic populations. Share your most significant discovery: include specific gene variants (e.g., BRCA1 c.68_69delAG), population frequencies, pharmacogenomic implications for drug metabolism (e.g., CYP2D6 variants affecting 40% of warfarin dosing), and why this changes treatment protocols. Cite actual studies from Nature Genetics or NEJM.`,
        `As a researcher who's published 30+ papers on precision oncology, reveal the breakthrough that surprised you most. Include specific biomarkers, response rates in clinical trials (e.g., 67% complete response vs 23% standard care), and the molecular mechanism. Reference actual clinical trial data and explain why this approach is revolutionary.`
      ],
      'biotech_innovation_analyst': [
        `You've evaluated 500+ biotech startups and seen 73% fail. Share the exact pattern that predicts success: include specific metrics (e.g., time to IND filing, patent landscape analysis, team composition), case studies of companies that exemplify this (e.g., Moderna's mRNA platform, Illumina's sequencing), and the financial data that VCs miss. Include actual funding rounds and valuations.`,
        `After analyzing $50B+ in biotech investments, reveal the counterintuitive factor that determines commercial success. Include specific examples: companies that had great science but failed (e.g., Theranos), others that succeeded despite early skepticism (e.g., Genentech), and the exact inflection points. Reference real IPO data and market performance.`
      ],
      'clinical_informatics_expert': [
        `You've implemented EHR systems in 50+ hospitals and tracked patient outcomes. Share your most surprising finding: include specific workflow metrics (e.g., 23% increase in documentation time, 15% reduction in medical errors), interoperability challenges with HL7 FHIR standards, and why most implementations fail. Reference studies from JAMIA or Health Affairs with actual ROI data.`,
        `As someone who's analyzed 10 million patient records, reveal the hidden pattern that predicts readmission risk better than traditional scores. Include the specific data elements (e.g., medication adherence patterns, social determinants), machine learning algorithms used, and how this changes care protocols. Cite validation studies with C-statistics and NRI values.`
      ],
      'digital_therapeutics_specialist': [
        `You've prescribed DTx to 2,000+ patients across 12 conditions. Share your most remarkable case: include the specific FDA-approved DTx (e.g., reSET for substance abuse, Somryst for insomnia), patient demographics, clinical outcomes (e.g., 45% reduction in substance use days), and comparison to traditional therapy. Reference the pivotal clinical trials and explain the mechanism of action.`,
        `After analyzing real-world evidence from 50,000+ DTx users, reveal the surprising factor that predicts treatment adherence. Include specific engagement metrics (e.g., session completion rates, time-to-dropout), patient phenotypes, and how this changes prescription patterns. Reference studies from Digital Medicine or NPJ Digital Medicine.`
      ],
      'surgical_robotics_specialist': [
        `You've performed 1,000+ robotic surgeries and trained 200+ surgeons. Share your most significant finding: include specific procedures (e.g., robotic prostatectomy, cardiac valve repair), learning curve data (e.g., 50 cases to achieve proficiency), complication rates compared to open surgery, and cost-effectiveness analysis. Reference studies from Annals of Surgery or JAMA Surgery.`,
        `As someone who's seen surgical robotics evolve for 15 years, reveal the breakthrough that changed everything. Include specific technical advances (e.g., haptic feedback, AI-assisted navigation), patient outcomes (e.g., 30% reduction in blood loss, 50% faster recovery), and why this represents a paradigm shift. Cite actual clinical data.`
      ]
    };

    const prompts = detailedPersonalPrompts[expertise] || [
      `As a ${expertise.replace('_', ' ')} with 15+ years of experience, share your most significant professional discovery. Include specific research data, study citations, patient outcomes, and technical details. Explain the methodology, statistical significance, and clinical implications. Make it sound like an expert sharing insider knowledge with precise scientific details.`
    ];
    
    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    try {
      const content = await openaiClient.generateCompletion(selectedPrompt, {
        maxTokens: 350, // Increased for detailed scientific content
        temperature: 0.75 // Slightly lower for more precise, factual content
      });

      if (!content || content.length < 80) return null; // Higher minimum for detailed content

      return {
        content: this.applyExpertScientificVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'personal'),
        expertiseArea: expertise,
        confidenceScore: 0.92 // Higher confidence for research-backed content
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
        `Analyze why 73% of biotech startups fail in year 2-3 despite strong Series A funding. Include specific financial metrics: average burn rate ($2.3M/month), time to clinical proof-of-concept (36 months), regulatory pathway costs ($50M+ for Phase III). Reference actual company examples (e.g., uniQure's hemophilia gene therapy, Bluebird Bio's beta-thalassemia treatment) and explain the exact inflection points that separate winners from losers. Include IPO success rates and market cap data.`,
        `After evaluating 1,000+ biotech deals worth $75B+, reveal the one metric that predicts success better than any other. Include specific examples: companies with this metric that became unicorns (e.g., Moderna's platform approach, Ginkgo's organism design), failure cases that lacked it, and quantitative analysis. Reference actual venture returns and explain why most VCs miss this pattern.`
      ],
      'healthcare_ai_architect': [
        `You've designed AI systems for Mayo Clinic, Cleveland Clinic, Johns Hopkins, and 50+ other health systems. Reveal why 85% of healthcare AI implementations fail within 18 months. Include specific technical factors: data quality issues (missing 30-40% of key variables), interoperability challenges with legacy systems, physician workflow integration failures. Reference actual implementation studies and ROI data showing why most AI projects never reach production.`,
        `After building AI for the top 10 health systems, expose the biggest misconception about healthcare AI adoption. Include real examples: successful implementations (e.g., Sepsis Watch at Duke, AI dermatology at Stanford), spectacular failures, and the three critical success factors. Reference studies from Health Affairs, NEJM Catalyst, and actual deployment metrics.`
      ],
      'health_economics_expert': [
        `Analyze why digital health saves money in theory but increases costs 23-35% in practice. Include specific economic models: total cost of ownership analysis, hidden implementation costs ($500K-$2M per system), ongoing maintenance expenses. Reference actual health system data from Kaiser, Intermountain, and Geisinger showing real ROI numbers. Explain why health economists consistently underestimate true costs.`,
        `You've calculated ROI for 200+ health tech implementations worth $500M+. Reveal the surprising factor that determines financial success. Include specific examples: technologies with negative ROI despite clinical benefits, unexpected cost savings from simple solutions, and the economic pattern that predicts long-term sustainability. Reference actual financial data from health systems.`
      ],
      'clinical_trial_innovator': [
        `Analyze why 90% of Phase II drugs fail in Phase III despite promising early data. Include specific examples: high-profile failures (e.g., Alzheimer's drugs, cancer immunotherapies), statistical power issues, endpoint selection problems. Reference actual clinical trial data from ClinicalTrials.gov and FDA advisory committee meetings. Explain the methodological flaws that cost $2B+ per failed program.`,
        `After designing 50+ clinical trials that collectively enrolled 100,000+ patients, reveal the counterintuitive factor that predicts trial success. Include specific protocol design elements, patient stratification strategies, and endpoint selection criteria. Reference successful trials (e.g., CAR-T therapies, GLP-1 agonists) and explain why this approach changes drug development.`
      ]
    };

    const prompts = detailedAnalysisPrompts[expertise] || [
      `As a ${expertise.replace('_', ' ')} with deep industry experience, analyze the most significant trend others are missing. Include specific quantitative data, study citations, company examples, financial metrics, and regulatory implications. Provide insider analysis with precise scientific details and explain why conventional wisdom is wrong. Reference peer-reviewed studies and real market data.`
    ];

    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    try {
      const content = await openaiClient.generateCompletion(selectedPrompt, {
        maxTokens: 380, // Increased for detailed analysis
        temperature: 0.7 // Lower for more precise, analytical content
      });

      if (!content || content.length < 100) return null; // Higher minimum for detailed analysis

      return {
        content: this.applyExpertScientificVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'analysis'),
        expertiseArea: expertise,
        confidenceScore: 0.94 // Higher confidence for data-driven analysis
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
    const technicalPrompts: Record<string, string[]> = {
      'ai_diagnostics_expert': [
        `Explain the breakthrough in multimodal AI that combines radiology, pathology, and genomics for cancer diagnosis. Include specific technical details: transformer architecture with cross-attention mechanisms, training on 500K+ cases, performance metrics (AUC 0.94 vs 0.87 for single modality), and validation across 15 cancer types. Reference the Nature Medicine paper and explain why this approach represents a paradigm shift in precision oncology.`,
        `Describe the revolutionary AI system that can predict drug response from medical images alone. Include the technical architecture: vision transformer with pharmacogenomic embeddings, training methodology on 100K+ patient-outcome pairs, and validation metrics (R² = 0.78 for treatment response prediction). Explain the biological mechanism and clinical implications for personalized therapy.`
      ],
      'genomics_data_scientist': [
        `Explain the breakthrough in polygenic risk scores that achieved 85% accuracy for cardiovascular disease prediction. Include specific technical details: machine learning architecture (gradient boosting with 10M+ SNPs), validation in 500K+ individuals across 5 ancestries, and comparison to traditional risk factors. Reference the Nature Genetics study and explain why this changes preventive cardiology.`,
        `Describe the revolutionary approach to pharmacogenomics that predicts drug metabolism from whole genome sequencing. Include technical methodology: deep learning on CYP enzyme variants, training on 250K+ patients, and validation across 200+ medications. Explain the clinical implications for precision dosing and adverse event prevention.`
      ],
      'biotech_innovation_analyst': [
        `Explain the breakthrough in protein design using AI that's revolutionizing drug discovery. Include specific technical details: AlphaFold integration with generative models, success rates in novel enzyme design (70% vs 5% traditional methods), and commercial applications. Reference the Science paper and explain why this approach will transform biotechnology over the next decade.`,
        `Describe the revolutionary cell therapy manufacturing process that reduces costs by 90%. Include technical innovations: automated cell processing, real-time quality control with AI, and scalable bioreactor design. Reference actual manufacturing data and explain why this makes cell therapy accessible to millions of patients.`
      ]
    };

    const prompts = technicalPrompts[expertise] || [
      `As a ${expertise.replace('_', ' ')}, explain a recent technical breakthrough in your field. Include specific scientific details: methodology, statistical results, technical architecture, validation studies, and peer-reviewed citations. Make it sound like an expert explaining cutting-edge science to colleagues, with precise technical language and quantitative data.`
    ];

    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    try {
      const content = await openaiClient.generateCompletion(selectedPrompt, {
        maxTokens: 400, // Increased for technical detail
        temperature: 0.65 // Lower for precise technical content
      });

      if (!content || content.length < 120) return null; // Higher minimum for technical content

      return {
        content: this.applyExpertScientificVoice(content),
        imageKeywords: this.generateDiverseImageKeywords(expertise, 'technical'),
        expertiseArea: expertise,
        confidenceScore: 0.96 // Highest confidence for technical breakthroughs
      };
    } catch (error) {
      console.warn('Technical breakthrough generation failed:', error);
      return null;
    }
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
    // 🚫 CRITICAL: Remove ANY hashtags (absolute zero tolerance)
    content = content.replace(/#\w+/g, '');
    
    // 🚫 Remove any formal academic language completely
    const academicReplacements = [
      { from: /Study shows?/gi, to: "Ever wonder why" },
      { from: /Research indicates?/gi, to: "Here's what caught my attention:" },
      { from: /Data suggests?/gi, to: "What blew my mind:" },
      { from: /According to/gi, to: "I learned from" },
      { from: /Results demonstrate/gi, to: "Here's what happened:" },
      { from: /Clinical trials show/gi, to: "The trials I've been following show" },
      { from: /Scientists have discovered/gi, to: "We just figured out" },
      { from: /New research reveals/gi, to: "Here's what we discovered:" },
      { from: /Analysis suggests/gi, to: "What's wild is" },
      
      // Replace formal medical terms
      { from: /patients/gi, to: "people" },
      { from: /individuals/gi, to: "folks" },
      { from: /subjects/gi, to: "people" },
      { from: /healthcare providers/gi, to: "doctors" },
      { from: /clinicians/gi, to: "doctors" },
      { from: /medical professionals/gi, to: "doctors" },
      { from: /clinical outcomes/gi, to: "what actually happens to people" },
      { from: /therapeutic interventions/gi, to: "treatments" },
      { from: /pharmaceutical interventions/gi, to: "medications" },
      
      // Remove corporate speak
      { from: /innovative solution/gi, to: "clever approach" },
      { from: /cutting-edge/gi, to: "latest" },
      { from: /state-of-the-art/gi, to: "most advanced" },
      { from: /revolutionary approach/gi, to: "new way of thinking" },
      { from: /paradigm shift/gi, to: "game changer" },
      { from: /breakthrough technology/gi, to: "tech that's changing everything" }
    ];

    // Apply all transformations
    academicReplacements.forEach(({ from, to }) => {
      content = content.replace(from, to);
    });

    // 🗣️ ENSURE conversational starters (from persona.txt)
    const conversationStarters = [
      "Ever wonder why",
      "Here's what caught my attention:",
      "The part that blew my mind:",
      "What's fascinating is",
      "Most people don't realize",
      "Here's what's wild:",
      "The thing nobody talks about:",
      "What if I told you",
      "We just crossed a line in"
    ];

    // If content doesn't start conversationally, fix it
    const hasConversationalStart = conversationStarters.some(starter => 
      content.toLowerCase().startsWith(starter.toLowerCase())
    );

    if (!hasConversationalStart) {
      const randomStarter = conversationStarters[Math.floor(Math.random() * conversationStarters.length)];
      content = `${randomStarter} ${content.charAt(0).toLowerCase()}${content.slice(1)}`;
    }

    // 🧠 Add practical impact and human context
    if (content.length < 200 && !content.includes("This means") && !content.includes("Here's why")) {
      const contextAdders = [
        " This could change how you think about your health.",
        " Here's why this matters for real people.",
        " The implications for everyday healthcare are huge.",
        " This reshapes everything we thought we knew."
      ];
      const randomContext = contextAdders[Math.floor(Math.random() * contextAdders.length)];
      content += randomContext;
    }

    // 🚫 Final check: Remove any remaining hashtags or formal language
    content = content.replace(/#[\w]+/g, ''); // Remove any hashtags
    content = content.replace(/\b(furthermore|moreover|additionally|subsequently)\b/gi, 'and'); // Remove formal connectors
    
    return content.trim();
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

  /**
   * NEW: Apply expert scientific voice with research-backed language
   */
  private applyExpertScientificVoice(content: string): string {
    // Remove academic jargon while keeping scientific precision
    let expertContent = content
      .replace(/\b(study shows|research indicates|data suggests)\b/gi, '')
      .replace(/\b(clinical trials demonstrate|evidence suggests)\b/gi, '')
      .replace(/\b(significant improvement|statistically significant)\b/gi, 'measurable improvement')
      .replace(/\b(participants|subjects)\b/gi, 'patients')
      .replace(/\b(healthcare providers|clinicians)\b/gi, 'doctors');

    // Add conversational expert intros while keeping scientific precision
    const expertIntros = [
      "After analyzing the data from",
      "Here's what the numbers tell us:",
      "The breakthrough everyone's missing:",
      "15 years in this field taught me:",
      "The data doesn't lie -",
      "What caught my attention in the latest research:",
      "Industry insider perspective:",
      "Having worked with the top research teams,",
      "The peer-reviewed data shows:",
      "Clinical reality check:"
    ];

    // Only add intro if content doesn't already start conversationally
    if (!content.match(/^(After|Here's|The|15 years|What|Industry|Having|Clinical)/)) {
      const intro = expertIntros[Math.floor(Math.random() * expertIntros.length)];
      expertContent = `${intro} ${expertContent.toLowerCase().charAt(0).toUpperCase() + expertContent.slice(1)}`;
    }

    // Ensure it ends with expert credibility
    const expertEndings = [
      "The implications are staggering.",
      "This changes everything.",
      "Mark my words - this is the future.",
      "The field will never be the same.",
      "We're witnessing history.",
      "This is just the beginning.",
      "The next 5 years will be wild.",
      "Game-changing doesn't even cover it.",
      "Thoughts on where this leads us?",
      "What's your take on these findings?"
    ];

    if (!expertContent.match(/[.!?]$/)) {
      expertContent += '.';
    }

    if (!expertContent.includes('?') && Math.random() > 0.7) {
      const ending = expertEndings[Math.floor(Math.random() * expertEndings.length)];
      expertContent += ` ${ending}`;
    }

    // Ensure proper length while preserving scientific detail
    if (expertContent.length > 280) {
      // Try to trim while keeping the most important scientific details
      const sentences = expertContent.split('. ');
      let trimmed = sentences[0];
      for (let i = 1; i < sentences.length; i++) {
        if ((trimmed + '. ' + sentences[i]).length <= 280) {
          trimmed += '. ' + sentences[i];
        } else {
          break;
        }
      }
      expertContent = trimmed;
      if (!expertContent.endsWith('.') && !expertContent.endsWith('!') && !expertContent.endsWith('?')) {
        expertContent += '.';
      }
    }

    return expertContent;
  }
} 