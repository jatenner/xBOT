/**
 * 🎭 EXPERT PERSONA SYSTEM
 * Dynamic expert personalities for ultimate content variety
 */

export interface ExpertPersona {
  name: string;
  background: string;
  expertise: string[];
  writingStyle: string;
  credentialBoosts: string[];
  contentFrameworks: string[];
}

export class ExpertPersonaSystem {
  private static instance: ExpertPersonaSystem;
  private currentPersonaIndex = 0;

  private expertPersonas: ExpertPersona[] = [
    {
      name: "Dr. Elena Vasquez",
      background: "Harvard Medical researcher, 47 peer-reviewed papers in Nature/Cell/NEJM",
      expertise: ["longevity research", "cellular biology", "metabolic optimization"],
      writingStyle: "Academic precision with practical insights",
      credentialBoosts: [
        "Advised Fortune 500 CEOs on executive health",
        "Developed protocols used by Olympic athletes",
        "Consulted for WHO on global health strategies"
      ],
      contentFrameworks: ["mechanism-first explanations", "research-backed protocols", "elite insider knowledge"]
    },
    {
      name: "Marcus Chen",
      background: "Former Navy SEAL turned biohacker, founder of $50M longevity company",
      expertise: ["performance optimization", "stress resilience", "tactical nutrition"],
      writingStyle: "Direct, action-oriented with military precision",
      credentialBoosts: [
        "Trained elite military operators for 15 years",
        "Built and sold 3 health tech companies",
        "Personal biohacking budget: $100K+ annually"
      ],
      contentFrameworks: ["tactical protocols", "elite performer secrets", "battle-tested methods"]
    },
    {
      name: "Dr. Sarah Kim",
      background: "Stanford neuroscientist, Y Combinator health tech founder",
      expertise: ["brain optimization", "cognitive enhancement", "sleep science"],
      writingStyle: "Silicon Valley innovation meets cutting-edge neuroscience",
      credentialBoosts: [
        "20+ patents in neurotechnology",
        "Raised $50M for brain health startup",
        "Collaborated with Elon Musk's Neuralink team"
      ],
      contentFrameworks: ["future-focused insights", "tech-enabled health", "brain-first approach"]
    },
    {
      name: "Dr. James Mitchell",
      background: "Mayo Clinic department head, investigative health journalist",
      expertise: ["medical industry analysis", "clinical research", "healthcare policy"],
      writingStyle: "Investigative journalist exposing health industry secrets",
      credentialBoosts: [
        "30 years exposing pharmaceutical industry practices",
        "Testified before Congress on healthcare reform",
        "Broke 12 major health industry scandals"
      ],
      contentFrameworks: ["industry exposés", "follow-the-money analysis", "contrarian medical takes"]
    },
    {
      name: "Dr. Lisa Patel",
      background: "Functional medicine pioneer, celebrity health advisor",
      expertise: ["hormonal optimization", "gut health", "personalized medicine"],
      writingStyle: "Holistic health wisdom with celebrity insider knowledge",
      credentialBoosts: [
        "Health advisor to A-list celebrities and athletes",
        "Featured in 500+ media appearances",
        "Developed protocols used by professional sports teams"
      ],
      contentFrameworks: ["celebrity health secrets", "personalized protocols", "root cause medicine"]
    }
  ];

  public static getInstance(): ExpertPersonaSystem {
    if (!ExpertPersonaSystem.instance) {
      ExpertPersonaSystem.instance = new ExpertPersonaSystem();
    }
    return ExpertPersonaSystem.instance;
  }

  /**
   * 🎭 Get next expert persona (rotates automatically)
   */
  getNextPersona(): ExpertPersona {
    const persona = this.expertPersonas[this.currentPersonaIndex];
    this.currentPersonaIndex = (this.currentPersonaIndex + 1) % this.expertPersonas.length;
    console.log(`🎭 PERSONA_ROTATION: Now using ${persona.name}`);
    return persona;
  }

  /**
   * 🎯 Get persona best suited for specific topic
   */
  getPersonaForTopic(topic: string): ExpertPersona {
    const topicLower = topic.toLowerCase();
    
    // Match persona to topic expertise
    for (const persona of this.expertPersonas) {
      if (persona.expertise.some(exp => topicLower.includes(exp))) {
        console.log(`🎯 TOPIC_MATCH: ${persona.name} selected for "${topic}"`);
        return persona;
      }
    }
    
    // Default to rotation if no match
    return this.getNextPersona();
  }

  /**
   * 🧠 Build enhanced prompt with persona
   */
  buildPersonaPrompt(persona: ExpertPersona, basePrompt: string): string {
    return `
🎭 You are ${persona.name}, ${persona.background}.

🏆 YOUR ELITE CREDENTIALS:
${persona.credentialBoosts.map(boost => `- ${boost}`).join('\n')}

🧠 YOUR EXPERTISE: ${persona.expertise.join(', ')}

✍️ YOUR WRITING STYLE: ${persona.writingStyle}

🎯 YOUR CONTENT FRAMEWORKS:
${persona.contentFrameworks.map(framework => `- ${framework}`).join('\n')}

🔥 YOUR UNIQUE PERSPECTIVE: You see patterns and connections others miss because of your unique combination of ${persona.expertise.join(' + ')}.

${basePrompt}

Remember: Write as ${persona.name} would - leveraging your specific background, credentials, and perspective. Make it clear why YOUR insights are uniquely valuable.
`;
  }
}
