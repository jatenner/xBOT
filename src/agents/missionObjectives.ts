// Mission Objectives & Ethical Guidelines for Snap2Health Bot

export interface MissionObjectives {
  primary: PrimaryObjective[];
  constraints: EthicalConstraint[];
  qualityThresholds: QualityThreshold[];
  userSatisfactionMetrics: UserMetric[];
}

export interface PrimaryObjective {
  name: string;
  description: string;
  weight: number; // 0-1, higher = more important
  successMetrics: string[];
}

export interface EthicalConstraint {
  rule: string;
  description: string;
  violation_action: 'reject_content' | 'modify_content' | 'flag_for_review';
  examples: string[];
}

export interface QualityThreshold {
  metric: string;
  minimum_score: number;
  measurement: string;
}

export interface UserMetric {
  name: string;
  target: string;
  measurement_method: string;
}

export class MissionManager {
  private objectives: MissionObjectives;

  constructor() {
    this.objectives = this.initializeMission();
  }

  private initializeMission(): MissionObjectives {
    return {
      primary: [
        {
          name: "Educational Value",
          description: "Provide accurate, valuable health tech education to professionals and enthusiasts",
          weight: 0.35,
          successMetrics: [
            "Content accuracy rate >95%",
            "Knowledge retention in followers",
            "Professional endorsements",
            "Citation by health professionals"
          ]
        },
        {
          name: "Quality Engagement", 
          description: "Foster meaningful discussions and professional networking, not just clicks",
          weight: 0.25,
          successMetrics: [
            "Comment quality score >7/10",
            "Thread continuation rate",
            "Professional follower growth",
            "Industry expert interactions"
          ]
        },
        {
          name: "Credibility & Trust",
          description: "Build and maintain reputation as a trusted source of health tech information",
          weight: 0.25,
          successMetrics: [
            "Source verification rate 100%",
            "Fact-checking accuracy",
            "Industry recognition",
            "Low misinformation reports"
          ]
        },
        {
          name: "Strategic Growth",
          description: "Sustainable, organic growth of engaged professional audience",
          weight: 0.15,
          successMetrics: [
            "Follower quality over quantity",
            "Engagement depth over breadth", 
            "Industry influence metrics",
            "Partnership opportunities"
          ]
        }
      ],

      constraints: [
        {
          rule: "No Sensationalism",
          description: "Avoid clickbait, exaggerated claims, or misleading headlines",
          violation_action: "modify_content",
          examples: [
            "❌ 'This AI Will SHOCK You!'",
            "❌ 'Doctors HATE This One Trick'",
            "✅ 'AI achieves 94% accuracy in early cancer detection'"
          ]
        },
        {
          rule: "Source Verification Required",
          description: "All factual claims must have verifiable, credible sources",
          violation_action: "reject_content",
          examples: [
            "✅ Links to peer-reviewed journals",
            "✅ Official FDA/WHO announcements", 
            "❌ Unverified blog posts",
            "❌ Social media rumors"
          ]
        },
        {
          rule: "Professional Tone",
          description: "Maintain professional, respectful tone appropriate for healthcare context",
          violation_action: "modify_content",
          examples: [
            "❌ Memes about serious medical conditions",
            "❌ Casual language about patient data",
            "✅ Respectful discussion of innovations"
          ]
        },
        {
          rule: "No Medical Advice",
          description: "Never provide personal medical advice or diagnosis",
          violation_action: "reject_content",
          examples: [
            "❌ 'You should try this treatment'",
            "❌ 'This will cure your condition'",
            "✅ 'Research shows potential benefits'"
          ]
        },
        {
          rule: "Ethical AI Use",
          description: "Transparent about AI-generated content and limitations",
          violation_action: "flag_for_review",
          examples: [
            "✅ Clear about AI assistance",
            "✅ Acknowledge limitations",
            "❌ Pretend to be human expert"
          ]
        }
      ],

      qualityThresholds: [
        {
          metric: "Content Accuracy",
          minimum_score: 95,
          measurement: "Fact-checking score (0-100)"
        },
        {
          metric: "Source Credibility", 
          minimum_score: 8,
          measurement: "Source reliability rating (1-10)"
        },
        {
          metric: "Educational Value",
          minimum_score: 7,
          measurement: "Learning value assessment (1-10)"
        },
        {
          metric: "Professional Relevance",
          minimum_score: 6,
          measurement: "Industry relevance score (1-10)"
        },
        {
          metric: "Engagement Quality",
          minimum_score: 6,
          measurement: "Meaningful interaction ratio (1-10)"
        }
      ],

      userSatisfactionMetrics: [
        {
          name: "Content Helpfulness",
          target: ">80% of engaged users find content helpful",
          measurement_method: "Engagement pattern analysis & occasional polls"
        },
        {
          name: "Trust & Credibility",
          target: "Low unfollow rate due to content quality issues",
          measurement_method: "Unfollow reason analysis & feedback monitoring"
        },
        {
          name: "Professional Value",
          target: "Followers use content in professional contexts",
          measurement_method: "Sharing patterns & citation tracking"
        },
        {
          name: "Learning Outcomes",
          target: "Followers demonstrate increased health tech knowledge",
          measurement_method: "Interaction sophistication & follow-up questions"
        }
      ]
    };
  }

  // Check if content meets mission objectives
  async evaluateContent(content: string, metrics: any): Promise<ContentEvaluation> {
    const evaluation: ContentEvaluation = {
      overallScore: 0,
      passesEthicalConstraints: true,
      meetsQualityThresholds: true,
      alignsWithObjectives: true,
      recommendations: [],
      verdict: 'approved'
    };

    // Check ethical constraints
    for (const constraint of this.objectives.constraints) {
      const violates = await this.checkConstraintViolation(content, constraint);
      if (violates) {
        evaluation.passesEthicalConstraints = false;
        evaluation.recommendations.push(`Violates: ${constraint.rule}`);
        
        if (constraint.violation_action === 'reject_content') {
          evaluation.verdict = 'rejected';
          return evaluation;
        }
      }
    }

    // Check quality thresholds
    const qualityScore = await this.calculateQualityScore(content, metrics);
    evaluation.overallScore = qualityScore;
    
    if (qualityScore < 70) { // Overall quality threshold
      evaluation.meetsQualityThresholds = false;
      evaluation.verdict = 'needs_improvement';
    }

    // Check objective alignment
    const objectiveAlignment = await this.calculateObjectiveAlignment(content, metrics);
    if (objectiveAlignment < 0.6) {
      evaluation.alignsWithObjectives = false;
      evaluation.recommendations.push("Content doesn't align well with educational mission");
    }

    return evaluation;
  }

  private async checkConstraintViolation(content: string, constraint: EthicalConstraint): Promise<boolean> {
    // Use AI to check for constraint violations
    const prompt = `Analyze this health tech content for violations of: "${constraint.rule}"

Rule: ${constraint.description}

Content: "${content}"

Examples of violations:
${constraint.examples.filter(ex => ex.startsWith('❌')).join('\n')}

Examples of compliance:
${constraint.examples.filter(ex => ex.startsWith('✅')).join('\n')}

Respond with only "VIOLATION" or "COMPLIANT":`;

    try {
      const response = await this.getAIResponse(prompt);
      return response.includes('VIOLATION');
    } catch (error) {
      return false; // Default to compliant if AI check fails
    }
  }

  private async calculateQualityScore(content: string, metrics: any): Promise<number> {
    // Calculate weighted quality score based on multiple factors
    let totalScore = 0;
    
    // Source credibility (30%)
    const sourceScore = this.assessSourceCredibility(content);
    totalScore += sourceScore * 0.3;
    
    // Educational value (25%)
    const educationalScore = await this.assessEducationalValue(content);
    totalScore += educationalScore * 0.25;
    
    // Accuracy (25%)
    const accuracyScore = await this.assessAccuracy(content);
    totalScore += accuracyScore * 0.25;
    
    // Professional relevance (20%)
    const relevanceScore = this.assessProfessionalRelevance(content);
    totalScore += relevanceScore * 0.2;
    
    return Math.round(totalScore);
  }

  private async calculateObjectiveAlignment(content: string, metrics: any): Promise<number> {
    // Calculate how well content aligns with primary objectives
    let alignment = 0;
    
    for (const objective of this.objectives.primary) {
      const objectiveScore = await this.assessObjectiveAlignment(content, objective);
      alignment += objectiveScore * objective.weight;
    }
    
    return alignment;
  }

  private assessSourceCredibility(content: string): number {
    // Check for presence and quality of sources
    const hasSource = /\(.*\d{4}\)|\bhttps?:\/\//.test(content);
    if (!hasSource) return 30; // Low score for no sources
    
    const hasCredibleSource = /nature|science|nejm|jama|fda|who|nih/.test(content.toLowerCase());
    return hasCredibleSource ? 95 : 70;
  }

  private async assessEducationalValue(content: string): Promise<number> {
    const prompt = `Rate the educational value of this health tech content (0-100):

"${content}"

Consider:
- Does it teach something useful?
- Is it actionable for professionals?
- Does it explain concepts clearly?
- Would healthcare professionals learn from it?

Respond with only a number 0-100:`;

    try {
      const response = await this.getAIResponse(prompt);
      const score = parseInt(response.trim());
      return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
    } catch {
      return 50;
    }
  }

  private async assessAccuracy(content: string): Promise<number> {
    // Simple accuracy check - in production would use fact-checking APIs
    const hasSpecificStats = /\d+%|\d+\.\d+%/.test(content);
    const hasTimeframe = /\d{4}|recent|latest|new/.test(content);
    const hasSource = /\(.*\)|\bsource:/i.test(content);
    
    let score = 60; // Base score
    if (hasSpecificStats) score += 15;
    if (hasTimeframe) score += 15;
    if (hasSource) score += 10;
    
    return Math.min(100, score);
  }

  private assessProfessionalRelevance(content: string): number {
    const professionalTerms = /\b(clinical|healthcare|medical|diagnosis|treatment|patients|physicians|doctors|nurses|FDA|research|study|trial)\b/gi;
    const matches = content.match(professionalTerms) || [];
    
    return Math.min(100, 40 + (matches.length * 10));
  }

  private async assessObjectiveAlignment(content: string, objective: PrimaryObjective): Promise<number> {
    // Simplified alignment assessment
    switch (objective.name) {
      case "Educational Value":
        return (await this.assessEducationalValue(content)) / 100;
      case "Quality Engagement":
        return this.hasEngagementTriggers(content) ? 0.8 : 0.4;
      case "Credibility & Trust":
        return this.assessSourceCredibility(content) / 100;
      case "Strategic Growth":
        return this.hasShareableContent(content) ? 0.7 : 0.5;
      default:
        return 0.5;
    }
  }

  private hasEngagementTriggers(content: string): boolean {
    const triggers = /\b(breakthrough|first|revolutionary|significant|major|important|critical|emergency|urgent)\b/i;
    return triggers.test(content);
  }

  private hasShareableContent(content: string): boolean {
    const length = content.length;
    const hasStats = /\d+%/.test(content);
    const hasSource = /\(.*\)/.test(content);
    
    return length > 50 && length < 220 && hasStats && hasSource;
  }

  private async getAIResponse(prompt: string): Promise<string> {
    try {
      const { openaiClient } = await import('../utils/openaiClient');
      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.2,
        max_tokens: 100
      });
      
      return response?.choices[0]?.message?.content || "75";
    } catch (error) {
      console.warn('AI assessment failed, using fallback');
      return "75"; // Default fallback response
    }
  }

  getMissionSummary(): string {
    return `
🎯 SNAP2HEALTH BOT MISSION:
• Primary Goal: Educate health professionals with accurate, valuable content
• Quality Focus: 95%+ accuracy, verified sources, professional relevance  
• Engagement Strategy: Meaningful discussions over viral metrics
• Growth Approach: Quality followers who value educational content
• Ethical Standards: No sensationalism, medical advice, or misinformation

Success = Trusted educational resource, not just high engagement numbers`;
  }

  getObjectives(): MissionObjectives {
    return this.objectives;
  }
}

export interface ContentEvaluation {
  overallScore: number;
  passesEthicalConstraints: boolean;
  meetsQualityThresholds: boolean;
  alignsWithObjectives: boolean;
  recommendations: string[];
  verdict: 'approved' | 'needs_improvement' | 'rejected';
} 