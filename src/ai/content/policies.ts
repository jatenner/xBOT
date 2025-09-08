/**
 * Content Policies for xBOT Health Authority
 * Defines voice, tone, format rules and health verticals
 */

export interface VoiceTonePolicy {
  forbidden: string[];
  required: string[];
  style: string[];
}

export interface HealthVertical {
  name: string;
  pillar: string;
  formats: ContentFormat[];
  enabled: boolean;
}

export interface ContentFormat {
  type: 'short_tip' | 'myth_buster' | 'how_to' | 'stat_of_day' | 'case_study' | 'thread_deep_dive';
  minLength: number;
  maxLength: number;
  structure: string[];
}

/**
 * Voice and Tone Rules - Expert, Evidence-Based Authority
 */
export const VOICE_TONE_POLICY: VoiceTonePolicy = {
  forbidden: [
    // First-person anecdotes
    "I tried", "my experience", "worked for me", "my journey", "I found", "I discovered",
    "my results", "in my case", "when I", "I noticed", "personally",
    
    // Weak filler phrases
    "who knew?", "turns out", "did you know?", "here's the thing", "the truth is",
    "amazing results", "crazy difference", "game changer", "mind blown",
    
    // Medical claims
    "cures", "treats", "heals", "prevents disease", "medical advice", "diagnose",
    "guaranteed results", "miracle", "breakthrough cure"
  ],
  
  required: [
    // Evidence markers
    "research shows", "studies find", "data reveals", "evidence suggests",
    "clinical trials", "peer-reviewed", "systematic review", "meta-analysis",
    
    // Authority indicators
    "according to", "published in", "findings indicate", "researchers found",
    "science confirms", "evidence-based", "research-backed"
  ],
  
  style: [
    "expert perspective", "evidence-based", "crisp sentences", "no meandering",
    "cite studies by title + finding", "no external links", "contrarian when useful",
    "curiosity-driven hooks", "actionable takeaways", "professional authority"
  ]
};

/**
 * Health Content Verticals and Formats
 */
export const HEALTH_VERTICALS: HealthVertical[] = [
  {
    name: "metabolic_health",
    pillar: "core",
    formats: ["myth_buster", "thread_deep_dive", "stat_of_day"],
    enabled: true
  },
  {
    name: "sleep_optimization", 
    pillar: "core",
    formats: ["how_to", "case_study", "short_tip"],
    enabled: true
  },
  {
    name: "exercise_science",
    pillar: "core", 
    formats: ["myth_buster", "thread_deep_dive", "how_to"],
    enabled: true
  },
  {
    name: "nutrition_myths",
    pillar: "core",
    formats: ["myth_buster", "stat_of_day", "case_study"],
    enabled: true
  },
  {
    name: "stress_management",
    pillar: "lifestyle",
    formats: ["how_to", "short_tip", "case_study"],
    enabled: true
  },
  {
    name: "longevity_research",
    pillar: "emerging",
    formats: ["thread_deep_dive", "stat_of_day", "case_study"],
    enabled: true
  },
  {
    name: "hormonal_health",
    pillar: "core",
    formats: ["myth_buster", "thread_deep_dive", "how_to"],
    enabled: true
  },
  {
    name: "cognitive_performance",
    pillar: "lifestyle",
    formats: ["how_to", "case_study", "short_tip"],
    enabled: true
  }
];

/**
 * Content Format Specifications
 */
export const CONTENT_FORMATS: Record<ContentFormat['type'], ContentFormat> = {
  short_tip: {
    type: 'short_tip',
    minLength: 120,
    maxLength: 240,
    structure: ['hook', 'evidence', 'actionable_tip']
  },
  
  myth_buster: {
    type: 'myth_buster', 
    minLength: 200,
    maxLength: 280,
    structure: ['myth_statement', 'evidence_correction', 'practical_reality']
  },
  
  how_to: {
    type: 'how_to',
    minLength: 240,
    maxLength: 900, // Thread territory
    structure: ['problem_hook', 'step_by_step', 'expected_outcome']
  },
  
  stat_of_day: {
    type: 'stat_of_day',
    minLength: 150,
    maxLength: 240,
    structure: ['surprising_stat', 'context_explanation', 'practical_application']
  },
  
  case_study: {
    type: 'case_study',
    minLength: 300,
    maxLength: 800,
    structure: ['study_hook', 'methodology_finding', 'real_world_application']
  },
  
  thread_deep_dive: {
    type: 'thread_deep_dive',
    minLength: 600,
    maxLength: 1200,
    structure: ['contrarian_hook', 'evidence_building', 'mechanism_explanation', 'actionable_protocol', 'summary_cta']
  }
};

/**
 * Content Quality Standards
 */
export const QUALITY_STANDARDS = {
  hookScore: {
    minimum: 0.7,
    criteria: [
      'creates curiosity gap',
      'challenges conventional wisdom', 
      'no conclusions in hook',
      'under 240 characters',
      'contrarian angle when useful'
    ]
  },
  
  clarityScore: {
    minimum: 0.7,
    criteria: [
      'one idea per tweet',
      'crisp sentences',
      'no jargon without explanation',
      'logical flow',
      'actionable language'
    ]
  },
  
  noveltyScore: {
    minimum: 0.6,
    criteria: [
      'surprising insight',
      'non-obvious information',
      'recent research findings',
      'counterintuitive facts',
      'expert-level knowledge'
    ]
  },
  
  structureScore: {
    minimum: 0.7,
    criteria: [
      'follows format structure',
      'appropriate length',
      'proper thread flow',
      'strong conclusion',
      'actionable takeaway'
    ]
  }
};

/**
 * Banned Topics and Content
 */
export const CONTENT_RESTRICTIONS = {
  bannedTopics: [
    'political health policies',
    'specific medical diagnoses', 
    'treatment recommendations',
    'supplement promotion',
    'weight loss guarantees',
    'anti-vaccine content',
    'conspiracy theories'
  ],
  
  requiresDisclaimer: [
    'exercise protocols',
    'dietary changes',
    'sleep interventions',
    'stress management techniques'
  ],
  
  standardDisclaimer: "This is educational content, not medical advice. Consult healthcare providers for personalized guidance."
};

/**
 * Study Citation Format
 */
export interface StudyCitation {
  title: string;
  finding: string;
  journal?: string;
  year?: number;
  sampleSize?: number;
}

export function formatStudyCitation(citation: StudyCitation): string {
  const base = `${citation.title}: ${citation.finding}`;
  
  if (citation.sampleSize && citation.year) {
    return `${base} (n=${citation.sampleSize}, ${citation.year})`;
  }
  
  if (citation.year) {
    return `${base} (${citation.year})`;
  }
  
  return base;
}

/**
 * Content Validation Functions
 */
export function validateVoiceTone(content: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const lowerContent = content.toLowerCase();
  
  // Check for forbidden phrases
  for (const forbidden of VOICE_TONE_POLICY.forbidden) {
    if (lowerContent.includes(forbidden.toLowerCase())) {
      violations.push(`Contains forbidden phrase: "${forbidden}"`);
    }
  }
  
  // Check for required evidence markers (at least one)
  const hasEvidence = VOICE_TONE_POLICY.required.some(required => 
    lowerContent.includes(required.toLowerCase())
  );
  
  if (!hasEvidence) {
    violations.push("Missing evidence markers (research shows, studies find, etc.)");
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

export function selectOptimalFormat(
  topic: string, 
  complexity: 'low' | 'medium' | 'high',
  predictedLength: number
): ContentFormat['type'] {
  
  // Force thread for complex topics or long content
  if (complexity === 'high' || predictedLength > 600) {
    return 'thread_deep_dive';
  }
  
  if (predictedLength > 280) {
    return Math.random() < 0.6 ? 'how_to' : 'case_study';
  }
  
  // Single tweet formats
  const singleFormats: ContentFormat['type'][] = ['short_tip', 'myth_buster', 'stat_of_day'];
  
  // Bias toward myth_buster for contrarian content
  if (topic.includes('myth') || topic.includes('wrong') || topic.includes('belief')) {
    return 'myth_buster';
  }
  
  return singleFormats[Math.floor(Math.random() * singleFormats.length)];
}

export default {
  VOICE_TONE_POLICY,
  HEALTH_VERTICALS, 
  CONTENT_FORMATS,
  QUALITY_STANDARDS,
  CONTENT_RESTRICTIONS,
  validateVoiceTone,
  selectOptimalFormat,
  formatStudyCitation
};
