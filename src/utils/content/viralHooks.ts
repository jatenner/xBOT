/**
 * Viral Hook Generator
 * Creates engaging hooks using proven psychological triggers
 */

export interface HookTemplate {
  pattern: string;
  variables: string[];
  examples: string[];
  psychologyTrigger: string;
}

export interface GeneratedHooks {
  hook_A: string;
  hook_B: string;
  pattern_used: string;
  psychology_trigger: string;
}

export class ViralHookGenerator {
  private static instance: ViralHookGenerator;

  // Proven viral hook patterns
  private hookTemplates: HookTemplate[] = [
    {
      pattern: "Most people think {misconception}. The ones who {result} do {truth} instead.",
      variables: ["misconception", "result", "truth"],
      examples: [
        "Most people think you need 8 hours of sleep. The ones who feel energized do 6.5 hours at the right time instead.",
        "Most people think protein timing matters. The ones who build muscle focus on total daily intake instead."
      ],
      psychologyTrigger: "Social proof + contrarian wisdom"
    },
    {
      pattern: "A study of {number} {group} found {counter_intuitive_result}. Here's how to use it today:",
      variables: ["number", "group", "counter_intuitive_result"],
      examples: [
        "A study of 50,000 professionals found that 6-hour sleepers outperform 8-hour sleepers. Here's how to use it today:",
        "A study of 2,400 athletes found that cold showers reduce performance by 23%. Here's how to use it today:"
      ],
      psychologyTrigger: "Authority + curiosity gap"
    },
    {
      pattern: "If you're {identity}, stop doing {common_practice}. Do {alternative} instead ({why_it_works}).",
      variables: ["identity", "common_practice", "alternative", "why_it_works"],
      examples: [
        "If you're a night owl, stop forcing early bedtimes. Optimize your natural rhythm instead (cortisol peaks later).",
        "If you're always tired, stop drinking more coffee. Fix your blood sugar swings instead (caffeine masks the real issue)."
      ],
      psychologyTrigger: "Identity + solution framing"
    },
    {
      pattern: "The {number} changes that increased {metric} by {percentage}% in {timeframe}:",
      variables: ["number", "metric", "percentage", "timeframe"],
      examples: [
        "The 3 changes that increased my energy by 40% in 14 days:",
        "The 4 changes that improved focus by 65% in 3 weeks:"
      ],
      psychologyTrigger: "Specificity + achievable outcome"
    },
    {
      pattern: "{percentage}% of people don't know {hidden_truth}. This {simple_action} changes everything:",
      variables: ["percentage", "hidden_truth", "simple_action"],
      examples: [
        "90% of people don't know their gut produces 90% of serotonin. This 5-minute habit changes everything:",
        "85% of people don't know dehydration looks like hunger. This water timing trick changes everything:"
      ],
      psychologyTrigger: "Exclusivity + simple solution"
    },
    {
      pattern: "I tracked {behavior} for {timeframe}. The results surprised me:",
      variables: ["behavior", "timeframe"],
      examples: [
        "I tracked my energy levels for 30 days. The results surprised me:",
        "I tracked what made me productive for 6 months. The results surprised me:"
      ],
      psychologyTrigger: "Personal experiment + curiosity"
    },
    {
      pattern: "Everyone says {conventional_wisdom}. After {credibility}, I disagree. Here's why:",
      variables: ["conventional_wisdom", "credibility"],
      examples: [
        "Everyone says breakfast is essential. After studying 200+ studies, I disagree. Here's why:",
        "Everyone says you need 10,000 steps. After working with 500+ clients, I disagree. Here's why:"
      ],
      psychologyTrigger: "Contrarian authority + credibility"
    },
    {
      pattern: "The billion-dollar {industry} doesn't want you to know {hidden_truth}. But science shows:",
      variables: ["industry", "hidden_truth"],
      examples: [
        "The billion-dollar sleep industry doesn't want you to know temperature matters more than duration. But science shows:",
        "The billion-dollar supplement industry doesn't want you to know timing beats dosage. But science shows:"
      ],
      psychologyTrigger: "Conspiracy + scientific truth"
    }
  ];

  private constructor() {}

  public static getInstance(): ViralHookGenerator {
    if (!ViralHookGenerator.instance) {
      ViralHookGenerator.instance = new ViralHookGenerator();
    }
    return ViralHookGenerator.instance;
  }

  /**
   * Generate two viral hooks for A/B testing
   */
  generateHooks(topic: string, pillar: string, angle: string, spice_level: number): GeneratedHooks {
    console.log(`🎣 Generating viral hooks for: ${topic} (${pillar}/${angle}, spice=${spice_level})`);

    // Select appropriate templates based on spice level
    const availableTemplates = this.filterTemplatesBySpice(spice_level);
    
    // Generate hook A
    const templateA = this.selectTemplate(availableTemplates, pillar, angle);
    const hookA = this.generateHookFromTemplate(templateA, topic, pillar);

    // Generate hook B (different template)
    const remainingTemplates = availableTemplates.filter(t => t !== templateA);
    const templateB = this.selectTemplate(remainingTemplates, pillar, angle);
    const hookB = this.generateHookFromTemplate(templateB, topic, pillar);

    console.log(`🎯 Hook A: ${hookA.substring(0, 80)}...`);
    console.log(`🎯 Hook B: ${hookB.substring(0, 80)}...`);

    return {
      hook_A: hookA,
      hook_B: hookB,
      pattern_used: `A: ${templateA.psychologyTrigger}, B: ${templateB.psychologyTrigger}`,
      psychology_trigger: templateA.psychologyTrigger
    };
  }

  private filterTemplatesBySpice(spice_level: number): HookTemplate[] {
    // Spice 1: Safe, conventional
    // Spice 2: Moderate contrarian takes
    // Spice 3: Strong POV, controversial (but not rude)

    switch (spice_level) {
      case 1:
        return this.hookTemplates.filter(t => 
          !t.psychologyTrigger.includes('Contrarian') && 
          !t.psychologyTrigger.includes('Conspiracy')
        );
      case 2:
        return this.hookTemplates.filter(t => 
          !t.psychologyTrigger.includes('Conspiracy')
        );
      case 3:
        return this.hookTemplates; // All templates available
      default:
        return this.hookTemplates.slice(0, 4); // Safe defaults
    }
  }

  private selectTemplate(templates: HookTemplate[], pillar: string, angle: string): HookTemplate {
    // Prefer templates that match the angle
    const angleMatches = templates.filter(template => {
      if (angle === 'contrarian_take' && template.psychologyTrigger.includes('Contrarian')) return true;
      if (angle === 'study_breakdown' && template.psychologyTrigger.includes('Authority')) return true;
      if (angle === 'mistakes_with_fix' && template.pattern.includes('stop doing')) return true;
      return false;
    });

    const candidateTemplates = angleMatches.length > 0 ? angleMatches : templates;
    return candidateTemplates[Math.floor(Math.random() * candidateTemplates.length)];
  }

  private generateHookFromTemplate(template: HookTemplate, topic: string, pillar: string): string {
    // Topic-specific variable mappings
    const variables = this.getVariablesForTopic(topic, pillar);
    
    let hook = template.pattern;
    
    // Replace template variables
    template.variables.forEach(variable => {
      const value = variables[variable] || `[${variable}]`;
      hook = hook.replace(`{${variable}}`, value);
    });

    // Ensure hook is within character limits (120-200)
    if (hook.length > 200) {
      hook = hook.substring(0, 197) + '...';
    }
    
    if (hook.length < 120) {
      // Add specific benefit or timeframe
      const benefits = [
        ' Starting today.',
        ' In under 10 minutes.',
        ' No expensive tools needed.',
        ' Works even if you\'re busy.',
        ' Based on 50+ studies.'
      ];
      hook += benefits[Math.floor(Math.random() * benefits.length)];
    }

    return hook;
  }

  private getVariablesForTopic(topic: string, pillar: string): Record<string, string> {
    const baseVariables: Record<string, string> = {
      number: this.getRandomNumber(),
      percentage: this.getRandomPercentage(),
      timeframe: this.getRandomTimeframe()
    };

    // Pillar-specific variables
    switch (pillar) {
      case 'sleep':
        return {
          ...baseVariables,
          misconception: 'you need exactly 8 hours of sleep',
          result: 'wake up energized',
          truth: 'optimize sleep timing',
          group: 'sleep-tracked adults',
          counter_intuitive_result: 'quality beats quantity by 3:1',
          identity: 'a night owl',
          common_practice: 'forcing early bedtimes',
          alternative: 'working with your natural rhythm',
          why_it_works: 'cortisol peaks vary by 4+ hours',
          metric: 'sleep quality',
          hidden_truth: 'temperature matters more than duration',
          behavior: 'what affects my sleep quality',
          conventional_wisdom: 'everyone needs 8 hours',
          credibility: 'analyzing 200+ sleep studies',
          industry: 'sleep supplement',
          simple_action: 'temperature adjustment'
        };
      
      case 'nutrition':
        return {
          ...baseVariables,
          misconception: 'all calories are equal',
          result: 'stay lean effortlessly',
          truth: 'focus on meal timing',
          group: 'metabolic health participants',
          counter_intuitive_result: 'when you eat beats what you eat',
          identity: 'always hungry',
          common_practice: 'counting every calorie',
          alternative: 'stabilizing blood sugar',
          why_it_works: 'insulin sensitivity varies by 40%',
          metric: 'energy stability',
          hidden_truth: 'your gut produces 90% of serotonin',
          behavior: 'my energy and food timing',
          conventional_wisdom: 'breakfast is the most important meal',
          credibility: 'working with 500+ nutrition clients',
          industry: 'supplement',
          simple_action: 'protein timing shift'
        };

      case 'habit design':
        return {
          ...baseVariables,
          misconception: 'willpower is enough',
          result: 'stick to habits long-term',
          truth: 'design their environment',
          group: 'habit formation studies',
          counter_intuitive_result: 'environment beats motivation 5:1',
          identity: 'struggling with consistency',
          common_practice: 'relying on motivation',
          alternative: 'habit stacking',
          why_it_works: 'neural pathways need triggers',
          metric: 'habit consistency',
          hidden_truth: 'context is stronger than willpower',
          behavior: 'what makes habits stick',
          conventional_wisdom: 'it takes 21 days to form a habit',
          credibility: 'studying behavior change for 10 years',
          industry: 'productivity',
          simple_action: 'environment trigger'
        };

      case 'cognition':
        return {
          ...baseVariables,
          misconception: 'multitasking makes you productive',
          result: 'maintain deep focus',
          truth: 'protect attention like energy',
          group: 'cognitive performance studies',
          counter_intuitive_result: 'single-tasking is 40% faster',
          identity: 'easily distracted',
          common_practice: 'trying to focus harder',
          alternative: 'managing cognitive load',
          why_it_works: 'attention is a finite resource',
          metric: 'focus duration',
          hidden_truth: 'decision fatigue starts at breakfast',
          behavior: 'what affects my mental clarity',
          conventional_wisdom: 'the brain never gets tired',
          credibility: 'researching cognitive science for 8 years',
          industry: 'nootropic',
          simple_action: 'attention protection protocol'
        };

      default:
        return baseVariables;
    }
  }

  private getRandomNumber(): string {
    const numbers = ['3', '4', '5', '7', '8', '12', '15', '23', '47', '73'];
    return numbers[Math.floor(Math.random() * numbers.length)];
  }

  private getRandomPercentage(): string {
    const percentages = ['67', '73', '82', '85', '90', '93', '95'];
    return percentages[Math.floor(Math.random() * percentages.length)];
  }

  private getRandomTimeframe(): string {
    const timeframes = ['7 days', '14 days', '3 weeks', '30 days', '6 weeks', '90 days'];
    return timeframes[Math.floor(Math.random() * timeframes.length)];
  }
}
