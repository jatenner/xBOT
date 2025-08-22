/**
 * Viral Content Engine - Designed for ENGAGEMENT and FOLLOWS
 * Transforms generic health content into emotionally engaging, controversial, and personal content
 */

export interface ViralHook {
  type: string;
  template: string;
  controversy_level: number; // 1-10
  emotional_impact: number; // 1-10
  follow_probability: number; // 0-1
  examples: string[];
}

export interface PersonalStory {
  pain_point: string;
  investment: string; // money/time spent
  discovery: string;
  transformation: string;
  controversy: string;
}

export interface ControversialTake {
  target: string; // who this will piss off
  claim: string;
  evidence: string;
  why_controversial: string;
  follow_hook: string;
}

export class ViralContentEngine {
  private static instance: ViralContentEngine;

  // VIRAL HOOKS - Designed to stop scroll and create engagement
  private readonly VIRAL_HOOKS: ViralHook[] = [
    {
      type: "money_confession",
      template: "I spent ${amount} learning {topic} is {revelation}",
      controversy_level: 7,
      emotional_impact: 8,
      follow_probability: 0.8,
      examples: [
        "I spent $3,000 learning sleep hygiene is mostly BS",
        "I spent $1,500 to discover supplements are a scam",
        "I spent $5,000 learning fitness influencers lie about everything"
      ]
    },
    {
      type: "industry_insider",
      template: "Former {industry} insider: {industry} doesn't want you to know {secret}",
      controversy_level: 9,
      emotional_impact: 9,
      follow_probability: 0.85,
      examples: [
        "Former supplement exec: The industry doesn't want you to know most products are placebos",
        "Former fitness trainer: Gyms don't want you to know you can get fit at home in 15 mins",
        "Former nutritionist: The diet industry doesn't want you to know hunger is mostly mental"
      ]
    },
    {
      type: "painful_failure",
      template: "I tried {popular_thing} for {timeframe}. It nearly killed me.",
      controversy_level: 8,
      emotional_impact: 10,
      follow_probability: 0.75,
      examples: [
        "I tried intermittent fasting for 6 months. It nearly killed me.",
        "I tried the carnivore diet for 3 months. Worst mistake of my life.",
        "I tried biohacking for a year. Almost destroyed my health."
      ]
    },
    {
      type: "contrarian_expert",
      template: "Every {expert_type} tells you {common_advice}. They're wrong. Here's why:",
      controversy_level: 9,
      emotional_impact: 7,
      follow_probability: 0.8,
      examples: [
        "Every doctor tells you to eat breakfast. They're wrong. Here's why:",
        "Every trainer tells you to lift heavy. They're wrong. Here's why:",
        "Every nutritionist tells you to count calories. They're wrong. Here's why:"
      ]
    },
    {
      type: "uncomfortable_truth",
      template: "Uncomfortable truth: {popular_belief} is keeping you {negative_outcome}",
      controversy_level: 8,
      emotional_impact: 8,
      follow_probability: 0.7,
      examples: [
        "Uncomfortable truth: Your 'healthy' breakfast is keeping you fat",
        "Uncomfortable truth: Your workout routine is keeping you weak",
        "Uncomfortable truth: Your sleep hygiene is keeping you tired"
      ]
    },
    {
      type: "conspiracy_reveal",
      template: "Plot twist: The {industry} has been lying about {topic} for {timeframe}",
      controversy_level: 10,
      emotional_impact: 9,
      follow_probability: 0.9,
      examples: [
        "Plot twist: The fitness industry has been lying about protein for 50 years",
        "Plot twist: The wellness industry has been lying about detoxes since day one",
        "Plot twist: The supplement industry has been lying about vitamins for decades"
      ]
    },
    {
      type: "social_proof_destruction",
      template: "Everyone's doing {popular_thing}. I did the opposite and {better_result}",
      controversy_level: 6,
      emotional_impact: 7,
      follow_probability: 0.65,
      examples: [
        "Everyone's doing HIIT. I did the opposite and got stronger",
        "Everyone's tracking macros. I stopped and lost more weight",
        "Everyone's meditating. I tried anger therapy and feel better"
      ]
    },
    {
      type: "class_warfare",
      template: "Rich people know {secret} about {topic}. Poor people get told {lie}",
      controversy_level: 9,
      emotional_impact: 10,
      follow_probability: 0.85,
      examples: [
        "Rich people know sleep quality matters more than duration. Poor people get told to sleep 8 hours",
        "Rich people know stress management is worth millions. Poor people get told to work harder",
        "Rich people know recovery prevents disease. Poor people get told to push through pain"
      ]
    }
  ];

  // EMOTIONAL AMPLIFIERS - Make content more engaging
  private readonly EMOTIONAL_AMPLIFIERS = {
    anger: ["This pisses me off", "I'm sick of this BS", "This makes me furious"],
    fear: ["This scared the hell out of me", "I was terrified", "This could kill you"],
    surprise: ["I couldn't believe it", "This blew my mind", "I was shocked"],
    disgust: ["This is disgusting", "I was horrified", "This made me sick"],
    curiosity: ["You won't believe what I found", "The truth will surprise you", "Plot twist"],
    urgency: ["Stop doing this now", "This is urgent", "Time is running out"],
    exclusivity: ["Only 1% know this", "Insiders don't want you to know", "Secret the elites use"]
  };

  // CONTROVERSIAL TOPICS - Guaranteed to create debate
  private readonly CONTROVERSIAL_TOPICS = [
    { topic: "breakfast", controversy: "Breakfast is the most important meal of the day", counter: "Breakfast is making you fat and tired" },
    { topic: "cardio", controversy: "Cardio is essential for health", counter: "Cardio is destroying your metabolism" },
    { topic: "supplements", controversy: "Supplements fill nutritional gaps", counter: "99% of supplements are expensive urine" },
    { topic: "8_glasses_water", controversy: "Drink 8 glasses of water daily", counter: "8 glasses of water is a marketing myth" },
    { topic: "calories", controversy: "Calories in, calories out", counter: "Calorie counting is pseudoscience" },
    { topic: "plant_based", controversy: "Plant-based diets are healthiest", counter: "Plant-based diets are missing essential nutrients" },
    { topic: "fitness_influencers", controversy: "Follow fitness influencers for advice", counter: "Fitness influencers are selling you lies" },
    { topic: "medical_establishment", controversy: "Trust your doctor's advice", counter: "Doctors know less about nutrition than you think" }
  ];

  private constructor() {}

  public static getInstance(): ViralContentEngine {
    if (!ViralContentEngine.instance) {
      ViralContentEngine.instance = new ViralContentEngine();
    }
    return ViralContentEngine.instance;
  }

  /**
   * Generate viral content that's designed to get engagement and follows
   */
  async generateViralContent(topic: string): Promise<{
    content: string;
    hook_type: string;
    controversy_level: number;
    emotional_impact: number;
    expected_engagement: string;
    why_viral: string;
  }> {
    console.log(`🔥 VIRAL_ENGINE: Generating controversial content for "${topic}"`);

    // Select a high-impact viral hook
    const hook = this.selectViralHook();
    console.log(`🎯 Selected hook: ${hook.type} (controversy: ${hook.controversy_level}/10, emotion: ${hook.emotional_impact}/10)`);

    // Create controversial content using the hook
    const content = await this.buildViralContent(topic, hook);
    
    // Add emotional amplifiers
    const amplifiedContent = this.addEmotionalAmplifiers(content, hook);

    // Add engagement triggers
    const finalContent = this.addEngagementTriggers(amplifiedContent);

    return {
      content: finalContent,
      hook_type: hook.type,
      controversy_level: hook.controversy_level,
      emotional_impact: hook.emotional_impact,
      expected_engagement: this.predictEngagement(hook),
      why_viral: this.explainViralPotential(hook, topic)
    };
  }

  /**
   * Select viral hook based on performance and variety
   */
  private selectViralHook(): ViralHook {
    // Weight selection by follow probability and impact
    const weightedHooks = this.VIRAL_HOOKS.map(hook => ({
      ...hook,
      weight: hook.follow_probability * hook.emotional_impact * hook.controversy_level
    }));

    // Sort by weight and add randomness
    weightedHooks.sort((a, b) => b.weight - a.weight);
    
    // Select from top 3 performers with some randomness
    const topHooks = weightedHooks.slice(0, 3);
    return topHooks[Math.floor(Math.random() * topHooks.length)];
  }

  /**
   * Build viral content using specific hook patterns
   */
  private async buildViralContent(topic: string, hook: ViralHook): Promise<string> {
    const controversial = this.CONTROVERSIAL_TOPICS.find(c => 
      topic.toLowerCase().includes(c.topic) || 
      c.topic.includes(topic.toLowerCase())
    );

    switch (hook.type) {
      case "money_confession":
        return this.buildMoneyConfession(topic, controversial);
      
      case "industry_insider":
        return this.buildIndustryInsider(topic, controversial);
      
      case "painful_failure":
        return this.buildPainfulFailure(topic, controversial);
      
      case "contrarian_expert":
        return this.buildContrarianExpert(topic, controversial);
      
      case "uncomfortable_truth":
        return this.buildUncomfortableTruth(topic, controversial);
      
      case "conspiracy_reveal":
        return this.buildConspiracyReveal(topic, controversial);
      
      case "social_proof_destruction":
        return this.buildSocialProofDestruction(topic, controversial);
      
      case "class_warfare":
        return this.buildClassWarfare(topic, controversial);
      
      default:
        return this.buildContrarianExpert(topic, controversial);
    }
  }

  private buildMoneyConfession(topic: string, controversial?: any): string {
    const amounts = ["$1,200", "$2,500", "$3,800", "$5,000", "$1,800"];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];
    
    const revelations = [
      "complete bullshit",
      "a marketing scam",
      "making me worse",
      "the opposite of what works",
      "designed to keep you sick"
    ];
    
    const revelation = revelations[Math.floor(Math.random() * revelations.length)];
    
    return `I spent ${amount} learning ${topic} advice is ${revelation}. The real game-changer? ${this.generateCounterAdvice(topic, controversial)}. Most people waste money on ${this.generateWasteExample(topic)}. Don't be like me.`;
  }

  private buildIndustryInsider(topic: string, controversial?: any): string {
    const industries = ["supplement", "fitness", "wellness", "medical device", "nutrition"];
    const industry = industries[Math.floor(Math.random() * industries.length)];
    
    const secrets = [
      "most products are placebo",
      "the science is cherry-picked",
      "they target your insecurities, not your health",
      "the expensive stuff is identical to the cheap stuff",
      "they know it doesn't work but it's profitable"
    ];
    
    const secret = secrets[Math.floor(Math.random() * secrets.length)];
    
    return `Former ${industry} exec here. We don't want you to know: ${secret}. The ${topic} industry makes billions by ${this.generateIndustryTactic(topic)}. Here's what actually works: ${this.generateCounterAdvice(topic, controversial)}.`;
  }

  private buildPainfulFailure(topic: string, controversial?: any): string {
    const timeframes = ["3 months", "6 months", "a year", "2 years"];
    const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
    
    const consequences = [
      "destroyed my metabolism",
      "gave me anxiety attacks",
      "made me gain 20 pounds",
      "ruined my sleep forever",
      "triggered an eating disorder",
      "cost me my relationship"
    ];
    
    const consequence = consequences[Math.floor(Math.random() * consequences.length)];
    
    return `I tried ${controversial?.controversy || `popular ${topic} advice`} for ${timeframe}. It ${consequence}. The worst part? Everyone told me to "stick with it." Here's what I learned the hard way: ${this.generatePainfulLesson(topic, controversial)}.`;
  }

  private buildContrarianExpert(topic: string, controversial?: any): string {
    const experts = ["doctor", "trainer", "nutritionist", "wellness coach", "influencer"];
    const expert = experts[Math.floor(Math.random() * experts.length)];
    
    const advice = controversial?.controversy || `standard ${topic} advice`;
    const counter = controversial?.counter || `${topic} is more complex than they tell you`;
    
    return `Every ${expert} tells you ${advice}. They're dead wrong. Here's why: ${counter}. I've tested this with ${Math.floor(Math.random() * 500) + 100} people. The results? ${this.generateSurprisingResult(topic)}.`;
  }

  private buildUncomfortableTruth(topic: string, controversial?: any): string {
    const beliefs = controversial?.controversy || `what everyone believes about ${topic}`;
    const outcomes = ["fat", "tired", "weak", "sick", "broke", "miserable"];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    return `Uncomfortable truth: ${beliefs} is keeping you ${outcome}. I know because I believed it for years. Then I discovered ${this.generateCounterAdvice(topic, controversial)}. The change was immediate. But nobody wants to hear this because ${this.generateResistanceReason(topic)}.`;
  }

  private buildConspiracyReveal(topic: string, controversial?: any): string {
    const industries = ["supplement", "fitness", "wellness", "medical", "diet"];
    const industry = industries[Math.floor(Math.random() * industries.length)];
    const timeframes = ["decades", "50 years", "since the 1970s", "for generations"];
    const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
    
    return `Plot twist: The ${industry} industry has been lying about ${topic} for ${timeframe}. Why? Because ${this.generateProfitMotive(topic)}. The truth: ${controversial?.counter || this.generateCounterAdvice(topic, controversial)}. They're terrified you'll figure this out.`;
  }

  private buildSocialProofDestruction(topic: string, controversial?: any): string {
    const popular = controversial?.controversy || `what everyone's doing with ${topic}`;
    const opposite = controversial?.counter || `the opposite approach to ${topic}`;
    
    return `Everyone's obsessed with ${popular}. I did the complete opposite: ${opposite}. Result? ${this.generateSurprisingResult(topic)}. Turns out the crowd is wrong about ${topic}. Again.`;
  }

  private buildClassWarfare(topic: string, controversial?: any): string {
    const richSecret = this.generateEliteSecret(topic);
    const poorLie = controversial?.controversy || `what poor people get told about ${topic}`;
    
    return `Rich people know ${richSecret} about ${topic}. Poor people get told ${poorLie}. This keeps the rich healthy and the poor sick. I learned this from ${this.generateEliteSource()}. Want to level up? ${this.generateActionableAdvice(topic)}.`;
  }

  // Helper methods for content generation
  private generateCounterAdvice(topic: string, controversial?: any): string {
    return controversial?.counter || `the opposite of mainstream ${topic} advice`;
  }

  private generateWasteExample(topic: string): string {
    const wastes = [`expensive ${topic} programs`, `${topic} supplements`, `${topic} coaching`, `${topic} gadgets`];
    return wastes[Math.floor(Math.random() * wastes.length)];
  }

  private generateIndustryTactic(topic: string): string {
    const tactics = [
      "making simple things seem complicated",
      "creating problems that don't exist",
      "selling solutions to problems they created",
      "targeting your insecurities",
      "using fear to drive sales"
    ];
    return tactics[Math.floor(Math.random() * tactics.length)];
  }

  private generatePainfulLesson(topic: string, controversial?: any): string {
    return controversial?.counter || `${topic} isn't what they tell you`;
  }

  private generateSurprisingResult(topic: string): string {
    const improvements = ["300% better results", "doubled my energy", "lost 20 pounds", "gained 15 pounds of muscle", "fixed my chronic issues"];
    return improvements[Math.floor(Math.random() * improvements.length)];
  }

  private generateResistanceReason(topic: string): string {
    const reasons = [
      "it threatens the industry",
      "it's too simple to monetize",
      "people prefer complicated solutions",
      "it makes experts look stupid",
      "it ruins the business model"
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  private generateProfitMotive(topic: string): string {
    const motives = [
      "healthy people don't buy products",
      "simple solutions can't be patented",
      "confused customers spend more money",
      "the truth would destroy their business",
      "they make more from sick people"
    ];
    return motives[Math.floor(Math.random() * motives.length)];
  }

  private generateEliteSecret(topic: string): string {
    const secrets = [
      `${topic} is about optimization, not obsession`,
      `${topic} should be effortless, not stressful`,
      `quality ${topic} matters more than quantity`,
      `${topic} is a system, not a struggle`,
      `${topic} recovery is more important than ${topic} performance`
    ];
    return secrets[Math.floor(Math.random() * secrets.length)];
  }

  private generateEliteSource(): string {
    const sources = [
      "a billionaire's personal doctor",
      "Silicon Valley executives",
      "Olympic coaches",
      "Navy SEAL trainers",
      "longevity researchers"
    ];
    return sources[Math.floor(Math.random() * sources.length)];
  }

  private generateActionableAdvice(topic: string): string {
    return `stop doing what poor people do with ${topic}`;
  }

  /**
   * Add emotional amplifiers to increase engagement
   */
  private addEmotionalAmplifiers(content: string, hook: ViralHook): string {
    // Select emotional amplifier based on hook type
    let emotion = "curiosity";
    if (hook.controversy_level >= 8) emotion = "anger";
    if (hook.type.includes("failure")) emotion = "fear";
    if (hook.type.includes("conspiracy")) emotion = "surprise";

    const amplifiers = this.EMOTIONAL_AMPLIFIERS[emotion];
    const amplifier = amplifiers[Math.floor(Math.random() * amplifiers.length)];

    // Add emotional trigger at strategic points
    return content.replace(/\. /, `. ${amplifier}: `);
  }

  /**
   * Add engagement triggers that drive comments and shares
   */
  private addEngagementTriggers(content: string): string {
    const triggers = [
      "Fight me in the comments.",
      "Change my mind.",
      "Am I crazy or is this obvious?",
      "Tell me I'm wrong.",
      "This will piss off a lot of people.",
      "Unpopular opinion but someone had to say it.",
      "Most people won't like this.",
      "The industry hates when I say this."
    ];

    const trigger = triggers[Math.floor(Math.random() * triggers.length)];
    return `${content} ${trigger}`;
  }

  /**
   * Predict engagement based on hook characteristics
   */
  private predictEngagement(hook: ViralHook): string {
    const score = hook.controversy_level + hook.emotional_impact + (hook.follow_probability * 10);
    
    if (score >= 25) return "High - Likely to go viral";
    if (score >= 20) return "Medium-High - Strong engagement expected";
    if (score >= 15) return "Medium - Good engagement likely";
    return "Low-Medium - Some engagement expected";
  }

  /**
   * Explain why content has viral potential
   */
  private explainViralPotential(hook: ViralHook, topic: string): string {
    return `${hook.type} hooks work because they: 1) Challenge authority, 2) Use social proof, 3) Create curiosity gaps, 4) Target existing beliefs about ${topic}, 5) Provide insider knowledge`;
  }
}

export function getViralContentEngine(): ViralContentEngine {
  return ViralContentEngine.getInstance();
}
