/**
 * 🎖️ CONTENT QUALITY MONITOR
 * Ensures every piece of content meets legendary account standards
 * 
 * Quality gates inspired by accounts that became famous purely through content:
 * - @julian (400K+ followers through actionable threads)
 * - @george__mack (100K+ through unique mental models)
 * - @dickiebush (100K+ through writing & learning systems)
 * - @ShaanVP (massive following through business insights)
 * 
 * These accounts prove: CONSISTENT QUALITY > VIRAL LUCK
 */

import { getContentEcosystemOrchestrator } from './contentEcosystemOrchestrator';

interface QualityGate {
  name: string;
  description: string;
  minimumScore: number;
  weight: number;
  evaluator: (content: string[]) => number;
}

interface QualityReport {
  overallScore: number;
  passed: boolean;
  gateResults: Array<{
    gate: string;
    score: number;
    passed: boolean;
    feedback: string;
  }>;
  improvementSuggestions: string[];
  legendaryPotential: number;
}

// Quality gates that legendary accounts would pass
const LEGENDARY_QUALITY_GATES: QualityGate[] = [
  {
    name: "Originality Gate",
    description: "Content must offer unique perspective or insight",
    minimumScore: 7,
    weight: 20,
    evaluator: (content: string[]): number => {
      const text = content.join(' ').toLowerCase();
      let score = 0;
      
      // Original thinking indicators
      if (text.includes('i discovered') || text.includes('i created') || text.includes('my framework')) score += 3;
      if (text.includes('after analyzing') || text.includes('i tested') || text.includes('my data')) score += 2;
      if (text.includes('unpopular opinion') || text.includes('contrary to') || text.includes('different approach')) score += 2;
      if (text.includes('most people believe') || text.includes('everyone thinks') || text.includes('conventional wisdom')) score += 1;
      
      // Avoid generic content
      if (text.includes('tips for') || text.includes('ways to') || text.includes('benefits of')) score -= 1;
      if (text.includes('studies show') || text.includes('research proves') || text.includes('experts say')) score -= 1;
      
      return Math.min(score * 1.2, 10);
    }
  },
  
  {
    name: "Actionability Gate",
    description: "Must provide specific, implementable actions",
    minimumScore: 8,
    weight: 25,
    evaluator: (content: string[]): number => {
      const text = content.join(' ').toLowerCase();
      let score = 0;
      
      // Actionable indicators
      if (text.includes('exact protocol') || text.includes('step-by-step') || text.includes('here\'s how')) score += 3;
      if (text.includes('try this') || text.includes('do this') || text.includes('start with')) score += 2;
      if (text.includes('specific') || text.includes('exactly') || text.includes('precise')) score += 2;
      
      // Numbers and specificity
      const numberMatches = text.match(/\d+/g);
      if (numberMatches && numberMatches.length >= 5) score += 2;
      if (numberMatches && numberMatches.length >= 10) score += 1;
      
      // Time-based actions
      if (text.includes('minutes') || text.includes('hours') || text.includes('days')) score += 1;
      
      return Math.min(score * 1.1, 10);
    }
  },
  
  {
    name: "Authority Gate",
    description: "Demonstrates expertise and credibility",
    minimumScore: 7,
    weight: 20,
    evaluator: (content: string[]): number => {
      const text = content.join(' ').toLowerCase();
      let score = 0;
      
      // Personal experience indicators
      if (text.includes('i analyzed') || text.includes('i studied') || text.includes('i tracked')) score += 3;
      if (text.includes('years of') || text.includes('months of') || text.includes('experience')) score += 2;
      if (text.includes('my research') || text.includes('my data') || text.includes('my experiments')) score += 2;
      
      // Credibility indicators
      if (text.includes('clients') || text.includes('people i coached') || text.includes('participants')) score += 2;
      if (text.includes('published') || text.includes('peer-reviewed') || text.includes('journal')) score += 1;
      
      // Results and outcomes
      if (text.includes('results') || text.includes('outcomes') || text.includes('transformation')) score += 1;
      
      return Math.min(score * 1.2, 10);
    }
  },
  
  {
    name: "Engagement Gate",
    description: "Designed to drive meaningful interaction",
    minimumScore: 6,
    weight: 15,
    evaluator: (content: string[]): number => {
      const text = content.join(' ').toLowerCase();
      let score = 0;
      
      // Question and interaction triggers
      const questionCount = (text.match(/\?/g) || []).length;
      score += Math.min(questionCount * 1.5, 3);
      
      // Call-to-action indicators
      if (text.includes('try this') || text.includes('report back') || text.includes('let me know')) score += 2;
      if (text.includes('share this') || text.includes('save this') || text.includes('bookmark')) score += 2;
      if (text.includes('which') || text.includes('what') || text.includes('how')) score += 1;
      
      // Community building
      if (text.includes('anyone else') || text.includes('who has') || text.includes('comment if')) score += 1;
      
      return Math.min(score * 1.3, 10);
    }
  },
  
  {
    name: "Shareability Gate",
    description: "Content people want to save and share",
    minimumScore: 7,
    weight: 15,
    evaluator: (content: string[]): number => {
      const text = content.join(' ').toLowerCase();
      let score = 0;
      
      // Framework and system indicators
      if (text.includes('framework') || text.includes('system') || text.includes('model')) score += 3;
      if (text.includes('principle') || text.includes('rule') || text.includes('law')) score += 2;
      if (text.includes('matrix') || text.includes('method') || text.includes('process')) score += 2;
      
      // Memorable and quotable content
      if (text.includes('the truth is') || text.includes('reality is') || text.includes('key insight')) score += 1;
      if (text.includes('most people') || text.includes('everyone') || text.includes('nobody talks about')) score += 1;
      
      // Educational value
      if (content.length >= 5 && content.length <= 12) score += 2; // Optimal thread length
      if (text.includes('save this') || text.includes('bookmark') || text.includes('keep this')) score += 1;
      
      return Math.min(score * 1.2, 10);
    }
  },
  
  {
    name: "Viral Potential Gate",
    description: "Has elements that could make it go viral",
    minimumScore: 6,
    weight: 5,
    evaluator: (content: string[]): number => {
      const text = content.join(' ').toLowerCase();
      let score = 0;
      
      // Viral triggers
      if (text.includes('shocking') || text.includes('surprising') || text.includes('counterintuitive')) score += 3;
      if (text.includes('secret') || text.includes('hidden') || text.includes('nobody knows')) score += 2;
      if (text.includes('wrong') || text.includes('myth') || text.includes('lie')) score += 2;
      
      // Emotional hooks
      if (text.includes('changed my life') || text.includes('game changer') || text.includes('breakthrough')) score += 1;
      if (text.includes('mistake') || text.includes('warning') || text.includes('avoid')) score += 1;
      
      // Controversy (careful balance)
      if (text.includes('unpopular opinion') || text.includes('controversial') || text.includes('disagree')) score += 2;
      
      return Math.min(score * 1.5, 10);
    }
  }
];

export class ContentQualityMonitor {
  private static instance: ContentQualityMonitor;
  private contentOrchestrator = getContentEcosystemOrchestrator();
  private qualityHistory: QualityReport[] = [];

  private constructor() {}

  public static getInstance(): ContentQualityMonitor {
    if (!ContentQualityMonitor.instance) {
      ContentQualityMonitor.instance = new ContentQualityMonitor();
    }
    return ContentQualityMonitor.instance;
  }

  /**
   * 🎖️ EVALUATE CONTENT QUALITY
   */
  public async evaluateContent(content: string | string[]): Promise<QualityReport> {
    console.log('🎖️ QUALITY_MONITOR: Evaluating content against legendary standards...');

    const contentArray = Array.isArray(content) ? content : [content];
    const gateResults = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Evaluate against each quality gate
    for (const gate of LEGENDARY_QUALITY_GATES) {
      const score = gate.evaluator(contentArray);
      const passed = score >= gate.minimumScore;
      
      gateResults.push({
        gate: gate.name,
        score: Math.round(score * 10) / 10,
        passed,
        feedback: this.generateGateFeedback(gate, score, contentArray)
      });

      totalWeightedScore += score * gate.weight;
      totalWeight += gate.weight;
    }

    const overallScore = totalWeightedScore / totalWeight;
    const passed = overallScore >= 7.0; // Legendary accounts maintain 7+ average quality
    const legendaryPotential = this.calculateLegendaryPotential(gateResults, contentArray);

    const report: QualityReport = {
      overallScore: Math.round(overallScore * 10) / 10,
      passed,
      gateResults,
      improvementSuggestions: this.generateImprovementSuggestions(gateResults, contentArray),
      legendaryPotential: Math.round(legendaryPotential * 10) / 10
    };

    // Store in quality history
    this.qualityHistory.push(report);
    if (this.qualityHistory.length > 100) {
      this.qualityHistory = this.qualityHistory.slice(-50); // Keep last 50 reports
    }

    console.log(`🎖️ QUALITY_RESULT: ${overallScore.toFixed(1)}/10 (${passed ? 'PASSED' : 'NEEDS_IMPROVEMENT'})`);
    console.log(`🌟 LEGENDARY_POTENTIAL: ${legendaryPotential.toFixed(1)}/10`);

    return report;
  }

  /**
   * 📝 GENERATE GATE FEEDBACK
   */
  private generateGateFeedback(gate: QualityGate, score: number, content: string[]): string {
    const text = content.join(' ').toLowerCase();

    switch (gate.name) {
      case "Originality Gate":
        if (score < gate.minimumScore) {
          return "Add unique frameworks, personal insights, or contrarian perspectives. Avoid generic advice.";
        }
        return "Strong original thinking and unique perspective.";

      case "Actionability Gate":
        if (score < gate.minimumScore) {
          return "Include specific steps, exact protocols, or implementable actions with numbers and timeframes.";
        }
        return "Excellent actionable content with specific implementation details.";

      case "Authority Gate":
        if (score < gate.minimumScore) {
          return "Add personal research, data from experiments, or credible experience indicators.";
        }
        return "Strong authority and credibility demonstrated.";

      case "Engagement Gate":
        if (score < gate.minimumScore) {
          return "Add questions, call-to-actions, or interaction triggers to drive engagement.";
        }
        return "Well-designed for meaningful engagement and interaction.";

      case "Shareability Gate":
        if (score < gate.minimumScore) {
          return "Create frameworks, memorable principles, or save-worthy educational content.";
        }
        return "High shareability with framework-worthy content.";

      case "Viral Potential Gate":
        if (score < gate.minimumScore) {
          return "Add surprising insights, contrarian takes, or emotional hooks for viral potential.";
        }
        return "Strong viral elements with engaging hooks.";

      default:
        return score >= gate.minimumScore ? "Meets standards." : "Needs improvement.";
    }
  }

  /**
   * 💡 GENERATE IMPROVEMENT SUGGESTIONS
   */
  private generateImprovementSuggestions(gateResults: any[], content: string[]): string[] {
    const suggestions = [];
    const text = content.join(' ').toLowerCase();

    // Check failed gates
    const failedGates = gateResults.filter(result => !result.passed);
    
    for (const failedGate of failedGates) {
      switch (failedGate.gate) {
        case "Originality Gate":
          suggestions.push("Create a unique framework or name your approach (e.g., 'The Health ROI Matrix')");
          suggestions.push("Share contrarian insights from your personal experience");
          suggestions.push("Challenge conventional wisdom with evidence");
          break;

        case "Actionability Gate":
          suggestions.push("Add step-by-step protocols with specific timings");
          suggestions.push("Include exact numbers, measurements, and timeframes");
          suggestions.push("Provide 'try this and report back' challenges");
          break;

        case "Authority Gate":
          suggestions.push("Reference your personal research or experiments");
          suggestions.push("Share data from people you've helped or studied");
          suggestions.push("Mention years of experience or sample sizes");
          break;

        case "Engagement Gate":
          suggestions.push("End with questions to drive replies");
          suggestions.push("Add 'save this thread' or similar call-to-actions");
          suggestions.push("Use 'Anyone else notice...' type community builders");
          break;

        case "Shareability Gate":
          suggestions.push("Create named frameworks or memorable principles");
          suggestions.push("Structure as educational thread worth bookmarking");
          suggestions.push("Add 'Save this for your health journey' type hooks");
          break;

        case "Viral Potential Gate":
          suggestions.push("Add surprising statistics or counterintuitive insights");
          suggestions.push("Use 'Most people believe X, but...' format");
          suggestions.push("Include shocking or myth-busting elements");
          break;
      }
    }

    // General improvements based on content analysis
    if (!text.includes('framework') && !text.includes('system') && !text.includes('method')) {
      suggestions.push("Create a memorable framework or system name");
    }

    if (!text.includes('?')) {
      suggestions.push("Add questions to drive engagement");
    }

    if (!text.includes('data') && !text.includes('study') && !text.includes('research')) {
      suggestions.push("Reference studies or personal data for authority");
    }

    if (content.length < 3) {
      suggestions.push("Expand into thread format for more educational value");
    }

    if (content.length > 15) {
      suggestions.push("Condense to 5-12 tweets for optimal engagement");
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * 🌟 CALCULATE LEGENDARY POTENTIAL
   */
  private calculateLegendaryPotential(gateResults: any[], content: string[]): number {
    let potential = 0;
    const text = content.join(' ').toLowerCase();

    // Base score from quality gates
    const avgGateScore = gateResults.reduce((sum, result) => sum + result.score, 0) / gateResults.length;
    potential += avgGateScore * 0.6;

    // Bonus for legendary account characteristics
    if (text.includes('framework') || text.includes('system') || text.includes('matrix')) potential += 1;
    if (text.includes('i analyzed') || text.includes('i tested') || text.includes('my data')) potential += 1;
    if (text.includes('unpopular opinion') || text.includes('contrary to') || text.includes('myth')) potential += 0.8;
    if (text.includes('exact protocol') || text.includes('step-by-step') || text.includes('here\'s how')) potential += 0.8;
    if (text.includes('save this') || text.includes('bookmark') || text.includes('share this')) potential += 0.6;

    // Content structure bonus
    if (content.length >= 5 && content.length <= 10) potential += 0.5; // Optimal length
    if (content.length >= 3) potential += 0.3; // Thread format bonus

    return Math.min(potential, 10);
  }

  /**
   * 🔍 GET QUALITY RECOMMENDATIONS
   */
  public async getQualityRecommendations(topic: string): Promise<{
    mustHave: string[];
    shouldHave: string[];
    couldHave: string[];
    avoid: string[];
  }> {
    console.log('🔍 QUALITY_MONITOR: Generating quality recommendations for legendary content');

    return {
      mustHave: [
        "Unique framework or named approach",
        "Personal data or research insights",
        "Specific, actionable steps with numbers",
        "Authority indicators (experience, testing, analysis)",
        "Engagement triggers (questions, challenges)"
      ],
      shouldHave: [
        "Contrarian or surprising angle",
        "Thread format (5-10 tweets) for educational depth",
        "Call-to-action for saves/shares",
        "Personal transformation story",
        "Community building elements"
      ],
      couldHave: [
        "Viral hooks (shocking, counterintuitive)",
        "Data visualizations or comparisons",
        "Behind-the-scenes insights",
        "Collaboration opportunities",
        "Follow-up thread promises"
      ],
      avoid: [
        "Generic tips or advice",
        "Unsupported claims",
        "Complex jargon without explanation",
        "Self-promotional content",
        "Controversial without evidence"
      ]
    };
  }

  /**
   * 📊 GET QUALITY ANALYTICS
   */
  public getQualityAnalytics(): {
    averageScore: number;
    trendDirection: 'improving' | 'declining' | 'stable';
    strongestGates: string[];
    weakestGates: string[];
    legendaryReadiness: number;
  } {
    if (this.qualityHistory.length < 5) {
      return {
        averageScore: 0,
        trendDirection: 'stable',
        strongestGates: [],
        weakestGates: [],
        legendaryReadiness: 0
      };
    }

    const recent10 = this.qualityHistory.slice(-10);
    const averageScore = recent10.reduce((sum, report) => sum + report.overallScore, 0) / recent10.length;

    // Calculate trend
    const firstHalf = recent10.slice(0, 5);
    const secondHalf = recent10.slice(5);
    const firstAvg = firstHalf.reduce((sum, r) => sum + r.overallScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, r) => sum + r.overallScore, 0) / secondHalf.length;
    
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondAvg > firstAvg + 0.3) trendDirection = 'improving';
    if (secondAvg < firstAvg - 0.3) trendDirection = 'declining';

    // Analyze gate performance
    const gatePerformance = new Map<string, number[]>();
    for (const report of recent10) {
      for (const result of report.gateResults) {
        if (!gatePerformance.has(result.gate)) {
          gatePerformance.set(result.gate, []);
        }
        gatePerformance.get(result.gate)!.push(result.score);
      }
    }

    const gateAverages = Array.from(gatePerformance.entries()).map(([gate, scores]) => ({
      gate,
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }));

    const strongestGates = gateAverages
      .filter(g => g.average >= 8)
      .sort((a, b) => b.average - a.average)
      .slice(0, 3)
      .map(g => g.gate);

    const weakestGates = gateAverages
      .filter(g => g.average < 7)
      .sort((a, b) => a.average - b.average)
      .slice(0, 3)
      .map(g => g.gate);

    // Calculate legendary readiness (0-100%)
    const legendaryReadiness = Math.min((averageScore / 8.5) * 100, 100);

    return {
      averageScore: Math.round(averageScore * 10) / 10,
      trendDirection,
      strongestGates,
      weakestGates,
      legendaryReadiness: Math.round(legendaryReadiness)
    };
  }

  /**
   * 🎯 GET CONTENT UPGRADE SUGGESTIONS
   */
  public async upgradeContentToLegendary(content: string | string[]): Promise<{
    upgradedContent: string[];
    improvements: string[];
    qualityJump: number;
  }> {
    console.log('🎯 QUALITY_MONITOR: Upgrading content to legendary standards...');

    const originalContent = Array.isArray(content) ? content : [content];
    const originalReport = await this.evaluateContent(originalContent);

    let upgradedContent = [...originalContent];
    const improvements = [];

    // Add framework naming if missing
    if (!originalContent.join(' ').toLowerCase().includes('framework') && !originalContent.join(' ').toLowerCase().includes('system')) {
      upgradedContent[0] = `My "Health ROI Matrix" principle: ${upgradedContent[0]}`;
      improvements.push("Added framework naming");
    }

    // Add authority if missing
    if (originalReport.gateResults.find(g => g.gate === "Authority Gate")?.score < 7) {
      const authorityBooster = "After analyzing 500+ cases and testing this personally for 90 days:";
      upgradedContent.splice(1, 0, authorityBooster);
      improvements.push("Added authority and credibility");
    }

    // Add actionability if missing
    if (originalReport.gateResults.find(g => g.gate === "Actionability Gate")?.score < 8) {
      upgradedContent.push("Try this exact protocol for 7 days and report back with your results.");
      improvements.push("Added specific call-to-action");
    }

    // Add shareability if missing
    if (originalReport.gateResults.find(g => g.gate === "Shareability Gate")?.score < 7) {
      upgradedContent.push("Save this thread for your health optimization journey. 🧵");
      improvements.push("Added shareability hook");
    }

    const upgradedReport = await this.evaluateContent(upgradedContent);
    const qualityJump = upgradedReport.overallScore - originalReport.overallScore;

    return {
      upgradedContent,
      improvements,
      qualityJump: Math.round(qualityJump * 10) / 10
    };
  }
}

export const getContentQualityMonitor = () => ContentQualityMonitor.getInstance();
