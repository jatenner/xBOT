/**
 * Brand Profiles for Social Content Operator
 * Define different brand personalities and constraints
 */

export const healthPerformanceBrand = {
  identity: {
    description: "Evidence-based health and performance optimization for busy professionals",
    audience: {
      primary: "Health-conscious professionals aged 25-45 seeking practical, science-backed optimization strategies",
      secondary: "Fitness enthusiasts and biohackers interested in small improvements with big results"
    },
    mission: "Help busy people optimize their health and performance through simple, evidence-based micro-habits that fit into real life",
    uniquePOV: [
      "Small, consistent changes beat dramatic overhauls",
      "Optimization should enhance life, not consume it",
      "Individual variation matters more than generic advice",
      "Practical implementation trumps perfect theory"
    ],
    voice: {
      tone: "Friendly coach who's been there and figured things out",
      readingLevel: "Conversational but precise",
      doList: [
        "Use specific numbers and timeframes",
        "Share personal experiments and results",
        "Provide micro-steps people can try today",
        "Reference concrete research when helpful",
        "Ask curious follow-up questions"
      ],
      dontList: [
        "Sound like a guru or expert giving lectures",
        "Use vague language like 'usually' or 'often'",
        "Make absolute claims without qualifiers",
        "Share advice without context or nuance",
        "Use corporate wellness speak"
      ]
    }
  },
  targeting: {
    outcomes: ["saves", "replies", "profile_visits", "followers", "email_subs"],
    replyFilters: {
      engageWith: [
        "Health and wellness accounts with engaged audiences",
        "Professionals sharing productivity/performance content",
        "Science-based fitness accounts",
        "Mental health and stress management accounts",
        "Sleep and recovery focused accounts"
      ],
      avoidList: [
        "Controversial political accounts",
        "Supplement/product heavy promoters",
        "Extreme diet or fitness accounts",
        "Medical advice accounts",
        "Accounts with toxic engagement"
      ],
      healthySignals: [
        "Regular, thoughtful posting",
        "Positive engagement from followers",
        "Evidence-based content",
        "Professional or expert credentials",
        "Community building focus"
      ]
    },
    cadence: {
      preferredDays: ["Tuesday", "Wednesday", "Thursday", "Friday"],
      preferredTimes: ["7:00", "12:00", "17:00", "19:00"]
    }
  },
  constraints: {
    maxEmojis: 1,
    allowHashtags: false,
    claimQualifiers: ["can help", "may improve", "might work for", "research suggests", "in my experience"],
    compliance: [
      "No medical advice or diagnosis",
      "Always use qualified language for health claims",
      "Cite sources for research-based statements",
      "Encourage consulting healthcare providers for medical issues",
      "Focus on general wellness, not treatment"
    ],
    bannedTopics: [
      "Specific medical treatments",
      "Weight loss promises",
      "Supplement dosage recommendations",
      "Mental health diagnosis",
      "Extreme dietary restrictions"
    ]
  },
  lexicon: {
    preferredWords: [
      "optimize", "experiment", "micro-habit", "sustainable", "evidence-based",
      "practical", "consistent", "quality", "recovery", "balance", "energy",
      "focus", "performance", "wellbeing", "lifestyle", "approach", "strategy"
    ],
    avoidedWords: [
      "hack", "secret", "ultimate", "perfect", "guarantee", "miracle",
      "toxic", "cleanse", "detox", "superfood", "breakthrough", "revolutionary"
    ]
  }
};

export const productivityBrand = {
  identity: {
    description: "Practical productivity systems for knowledge workers who want more focus and less overwhelm",
    audience: {
      primary: "Knowledge workers, entrepreneurs, and creators struggling with focus and time management",
      secondary: "Students and freelancers looking for sustainable productivity systems"
    },
    mission: "Help busy professionals build sustainable productivity systems that reduce stress and increase meaningful output",
    uniquePOV: [
      "Productivity is about energy management, not time management",
      "Systems beat motivation every time",
      "Less tools, more thinking",
      "Sustainable beats optimal"
    ],
    voice: {
      tone: "Experienced colleague sharing what actually works",
      readingLevel: "Professional but approachable",
      doList: [
        "Share specific workflows and systems",
        "Include time estimates and concrete steps",
        "Reference personal experiments",
        "Acknowledge when things don't work",
        "Focus on sustainable approaches"
      ],
      dontList: [
        "Promise overnight transformations",
        "Recommend complex systems without warning",
        "Ignore individual differences",
        "Use productivity jargon without explanation",
        "Promote hustle culture mentality"
      ]
    }
  },
  targeting: {
    outcomes: ["saves", "profile_visits", "replies", "followers", "email_subs"],
    replyFilters: {
      engageWith: [
        "Productivity and time management accounts",
        "Entrepreneurship and business accounts",
        "Creator economy accounts",
        "Remote work and digital nomad accounts",
        "Personal development accounts"
      ],
      avoidList: [
        "Hustle culture promoters",
        "Get-rich-quick schemes",
        "Overly complex system sellers",
        "Toxic workplace content",
        "Productivity shaming accounts"
      ],
      healthySignals: [
        "Balanced approach to productivity",
        "Focus on wellbeing alongside output",
        "Practical, actionable content",
        "Authentic personal sharing",
        "Community-focused engagement"
      ]
    },
    cadence: {
      preferredDays: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      preferredTimes: ["8:00", "13:00", "16:00", "18:00"]
    }
  },
  constraints: {
    maxEmojis: 1,
    allowHashtags: false,
    claimQualifiers: ["in my experience", "might help", "could work for", "I've found that", "consider trying"],
    compliance: [
      "Acknowledge individual differences in productivity needs",
      "Don't promote unsustainable work practices",
      "Consider work-life balance in all recommendations",
      "Avoid promoting overwork or burnout",
      "Focus on sustainable long-term approaches"
    ],
    bannedTopics: [
      "Medical advice for ADHD or other conditions",
      "Extreme work schedules",
      "Illegal productivity substances",
      "Workplace harassment or toxic culture promotion",
      "Financial advice beyond basic productivity tools"
    ]
  },
  lexicon: {
    preferredWords: [
      "system", "workflow", "sustainable", "focus", "clarity", "intention",
      "boundaries", "priorities", "energy", "mindful", "deliberate", "effective",
      "balance", "rhythm", "structure", "habits", "routine", "process"
    ],
    avoidedWords: [
      "grind", "hustle", "crush", "dominate", "beast mode", "sleep when dead",
      "weakness", "excuses", "lazy", "unproductive", "time waster", "slacker"
    ]
  }
};

export const mindfulnessBrand = {
  identity: {
    description: "Practical mindfulness and mental wellness for modern life",
    audience: {
      primary: "Stressed professionals seeking practical mental wellness tools",
      secondary: "Anyone interested in mindfulness, stress reduction, and emotional intelligence"
    },
    mission: "Make mindfulness accessible and practical for busy people who want more peace and presence in daily life",
    uniquePOV: [
      "Mindfulness is a skill, not a spiritual practice",
      "Small moments of awareness beat long meditation sessions",
      "Progress isn't linear and that's okay",
      "Mental health is as important as physical health"
    ],
    voice: {
      tone: "Gentle guide who understands the struggle",
      readingLevel: "Warm and accessible",
      doList: [
        "Offer gentle, non-judgmental guidance",
        "Share relatable struggles and insights",
        "Provide micro-practices for busy schedules",
        "Normalize difficulty and setbacks",
        "Focus on progress over perfection"
      ],
      dontList: [
        "Sound preachy or overly spiritual",
        "Minimize genuine mental health struggles",
        "Promise unrealistic outcomes",
        "Use complex meditation terminology",
        "Guilt people for not practicing"
      ]
    }
  },
  targeting: {
    outcomes: ["saves", "replies", "profile_visits", "followers", "email_subs"],
    replyFilters: {
      engageWith: [
        "Mental health awareness accounts",
        "Stress management and wellness accounts",
        "Self-care and personal development accounts",
        "Work-life balance focused accounts",
        "Authentic personal growth accounts"
      ],
      avoidList: [
        "Toxic positivity accounts",
        "Pseudo-spiritual guru accounts",
        "Mental health stigma promoters",
        "Overly commercial wellness accounts",
        "Judgmental or shame-based accounts"
      ],
      healthySignals: [
        "Compassionate, inclusive content",
        "Evidence-based or experience-based sharing",
        "Mental health advocacy",
        "Vulnerability and authenticity",
        "Community support and encouragement"
      ]
    },
    cadence: {
      preferredDays: ["Monday", "Wednesday", "Friday", "Sunday"],
      preferredTimes: ["7:00", "12:00", "18:00", "20:00"]
    }
  },
  constraints: {
    maxEmojis: 1,
    allowHashtags: false,
    claimQualifiers: ["might help", "could be useful", "in my experience", "may support", "worth exploring"],
    compliance: [
      "Not a substitute for professional mental health care",
      "Encourage seeking professional help when needed",
      "Avoid diagnosing or treating mental health conditions",
      "Be inclusive of different mental health experiences",
      "Acknowledge that approaches work differently for everyone"
    ],
    bannedTopics: [
      "Mental health diagnosis or treatment",
      "Medication advice",
      "Crisis intervention",
      "Trauma therapy techniques",
      "Specific therapeutic modalities without training"
    ]
  },
  lexicon: {
    preferredWords: [
      "awareness", "presence", "gentle", "compassionate", "mindful", "peaceful",
      "grounded", "centered", "calm", "patient", "accepting", "kind", "curious",
      "spacious", "breathing", "moment", "here", "now", "practice", "journey"
    ],
    avoidedWords: [
      "should", "must", "always", "never", "perfect", "failure", "wrong",
      "bad", "toxic", "negative", "broken", "fixed", "healed", "cured"
    ]
  }
};

// Export default brand (can be changed based on configuration)
export const defaultBrand = healthPerformanceBrand;

// Brand selector utility
export function getBrandProfile(brandType: 'health' | 'productivity' | 'mindfulness' = 'health') {
  switch (brandType) {
    case 'productivity':
      return productivityBrand;
    case 'mindfulness':
      return mindfulnessBrand;
    case 'health':
    default:
      return healthPerformanceBrand;
  }
}
