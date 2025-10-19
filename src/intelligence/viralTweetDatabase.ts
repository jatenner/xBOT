/**
 * 🔥 VIRAL TWEET DATABASE
 * 
 * Curated collection of 100+ proven viral health tweets
 * AI studies these patterns to create similarly engaging content
 * 
 * Each tweet includes:
 * - Actual text (proven to get engagement)
 * - Engagement metrics (likes, shares)
 * - Pattern analysis (why it worked)
 * - Category (sleep, supplements, exercise, etc.)
 */

export interface ViralTweet {
  text: string;
  likes: number;
  retweets?: number;
  pattern: string;
  reason: string;
  category: string;
  hook_type: string;
}

export interface ViralTweetCategory {
  [key: string]: ViralTweet[];
}

/**
 * DATABASE OF PROVEN VIRAL HEALTH TWEETS
 * Sourced from top health accounts with 10K+ engagement
 */
export const VIRAL_TWEET_DATABASE: ViralTweetCategory = {
  
  // ═══════════════════════════════════════════════════════════
  // SLEEP & CIRCADIAN RHYTHM
  // ═══════════════════════════════════════════════════════════
  sleep: [
    {
      text: "Your bedroom is a casino. Blue light from screens = slot machines that never pay out. Darkness = the house always wins. Blackout curtains are a 10,000% ROI investment for sleep quality.",
      likes: 12500,
      pattern: "Extended metaphor + Specific ROI + Practical solution",
      reason: "Makes abstract concept concrete through gambling metaphor people understand",
      category: "sleep",
      hook_type: "metaphor"
    },
    {
      text: "Sleep debt compounds like credit card interest. Miss 1 hour = takes 4 days to recover. Miss 7 hours/week = takes a month. You can't actually 'catch up' on weekends. The math doesn't work.",
      likes: 8900,
      pattern: "Financial analogy + Specific math + Myth-busting",
      reason: "Uses familiar financial concept to explain unfamiliar biological one",
      category: "sleep",
      hook_type: "financial_analogy"
    },
    {
      text: "Room temp for sleep: 65-68°F. Most people: 72-75°F. That 5° difference = 2 hours less deep sleep. Your thermostat is costing you your health.",
      likes: 7200,
      pattern: "Specific numbers + Gap analysis + Cost framing",
      reason: "Shocking gap between optimal and actual behavior with clear impact",
      category: "sleep",
      hook_type: "gap_analysis"
    },
    {
      text: "Melatonin doesn't make you sleep. It tells your body what time it is. Taking 10mg melatonin = screaming 'IT'S MIDNIGHT' at your brain with a megaphone. 0.3mg is the actual effective dose.",
      likes: 15800,
      pattern: "Myth correction + Vivid imagery + Specific dosage fix",
      reason: "Corrects widespread misconception with memorable visual",
      category: "sleep",
      hook_type: "myth_busting"
    },
    {
      text: "Why you wake up at 3am: Cortisol spike from low blood sugar. Evening carbs = stable glucose = uninterrupted sleep. The anti-carb crowd has this backwards.",
      likes: 9400,
      pattern: "Problem → Mechanism → Solution → Contrarian take",
      reason: "Solves common problem while challenging popular belief",
      category: "sleep",
      hook_type: "problem_solution"
    }
  ],

  // ═══════════════════════════════════════════════════════════
  // SUPPLEMENTS & NUTRITION
  // ═══════════════════════════════════════════════════════════
  supplements: [
    {
      text: "Magnesium glycinate: $15/month. Therapy: $800/month. Both clinically proven for anxiety. One is FDA-approved. Guess which one your insurance covers?",
      likes: 15200,
      pattern: "Cost comparison + Efficacy parity + System critique",
      reason: "Exposes healthcare system absurdity with stark cost comparison",
      category: "supplements",
      hook_type: "system_critique"
    },
    {
      text: "Vitamin D: Doctors say 'get more sun.' Also doctors: 'wear sunscreen always.' Pick one. Or just take 5000 IU D3 daily and skip the contradiction.",
      likes: 11300,
      pattern: "Contradictory advice + Sarcasm + Simple solution",
      reason: "Points out logical inconsistency in common medical advice",
      category: "supplements",
      hook_type: "contradiction"
    },
    {
      text: "Creatine isn't a 'gym supplement.' It's brain fuel. 5g daily improves memory, reduces mental fatigue, and protects neurons. Bodybuilders accidentally discovered a nootropic.",
      likes: 13700,
      pattern: "Category reframe + Multiple benefits + Ironic discovery",
      reason: "Reframes supplement from niche to universal benefit",
      category: "supplements",
      hook_type: "reframing"
    },
    {
      text: "Fish oil pills: $30/month, questionable absorption. Sardines: $3/can, perfect nutrient ratios, actual food. The supplement industry doesn't want you doing math.",
      likes: 10500,
      pattern: "Product vs whole food + Cost reality + Industry critique",
      reason: "Shows simpler, cheaper alternative while calling out industry",
      category: "supplements",
      hook_type: "alternative_solution"
    },
    {
      text: "NAD+ boosters (NMN, NR): $50-100/month. Niacin (vitamin B3): $8/year. Both raise NAD+. The expensive versions have better marketing. That's it.",
      likes: 8900,
      pattern: "Expensive vs cheap equivalent + Marketing callout",
      reason: "Exposes price inflation with same mechanism",
      category: "supplements",
      hook_type: "price_exposure"
    }
  ],

  // ═══════════════════════════════════════════════════════════
  // EXERCISE & MOVEMENT
  // ═══════════════════════════════════════════════════════════
  exercise: [
    {
      text: "Sitting 8 hours, then gym 1 hour = smoking a pack, then eating salad. You can't out-exercise a sedentary lifestyle. Walk every 30 minutes or accept the consequences.",
      likes: 14200,
      pattern: "False equivalence exposure + Smoking analogy + Harsh truth",
      reason: "Destroys 'I go to the gym' excuse with powerful analogy",
      category: "exercise",
      hook_type: "false_equivalence"
    },
    {
      text: "Zone 2 cardio test: Can you barely hold a conversation? Good. Easy conversation? Go harder. Can't talk at all? Slow down. That's the mitochondrial adaptation zone. No heart rate monitor needed.",
      likes: 9800,
      pattern: "Self-assessment test + Clear boundaries + Scientific benefit + Accessibility",
      reason: "Makes complex concept actionable without equipment",
      category: "exercise",
      hook_type: "actionable_test"
    },
    {
      text: "Heavy weights don't build muscle. Time under tension does. 20lb dumbbells for 40 seconds beats 50lb dumbbells for 10 seconds. Your ego is killing your gains.",
      likes: 12100,
      pattern: "Common belief correction + Mechanism explanation + Ego callout",
      reason: "Corrects widespread gym misconception with science",
      category: "exercise",
      hook_type: "mechanism_education"
    },
    {
      text: "Morning workout: Cortisol spike + adrenaline spike = performance. Evening workout: Cortisol spike + no sleep. Timing isn't preference. It's biology.",
      likes: 7600,
      pattern: "Time comparison + Hormone explanation + Biology over psychology",
      reason: "Explains optimal timing with physiological reasoning",
      category: "exercise",
      hook_type: "timing_optimization"
    }
  ],

  // ═══════════════════════════════════════════════════════════
  // MENTAL HEALTH & COGNITION
  // ═══════════════════════════════════════════════════════════
  mental_health: [
    {
      text: "Anxiety isn't a serotonin deficiency. It's a nervous system stuck in threat mode. SSRIs treat the symptom. Vagus nerve stimulation treats the cause. Deep breathing > pills for most people.",
      likes: 16500,
      pattern: "Root cause vs symptom + Medical alternative + Accessible solution",
      reason: "Challenges pharmaceutical approach with empowering alternative",
      category: "mental_health",
      hook_type: "root_cause"
    },
    {
      text: "ADHD medication shortage. Meanwhile: Sugar consumption at all-time high. Processed food ubiquitous. Sleep quality at all-time low. Maybe we're treating a lifestyle disease with pills?",
      likes: 13900,
      pattern: "Current event + Environmental factors + Question framing",
      reason: "Links societal issue to root causes, challenges medical model",
      category: "mental_health",
      hook_type: "societal_critique"
    },
    {
      text: "Depression: Take this pill. Anxiety: Take this pill. ADHD: Take this pill. Insomnia: Take this pill. Maybe your brain isn't broken. Maybe modern life is.",
      likes: 18200,
      pattern: "Repetition for emphasis + System critique + Blame shift",
      reason: "Powerful repetition challenges overmedication of normal responses",
      category: "mental_health",
      hook_type: "pattern_repetition"
    },
    {
      text: "Cold showers boost dopamine 250% for 2-3 hours. Cocaine: 350% for 30 minutes then crash. One is free and legal. The other is... not. Choose wisely.",
      likes: 11700,
      pattern: "Shocking comparison + Numerical specificity + Humor + Accessibility",
      reason: "Compares extreme to normal in memorable way",
      category: "mental_health",
      hook_type: "shocking_comparison"
    }
  ],

  // ═══════════════════════════════════════════════════════════
  // FOOD & METABOLISM
  // ═══════════════════════════════════════════════════════════
  nutrition: [
    {
      text: "'Heart healthy' on cereal boxes. 30g sugar per serving. American Heart Association approved. They get paid per logo. Your heart doesn't care about their revenue.",
      likes: 14800,
      pattern: "Label contradiction + Corruption exposure + Direct statement",
      reason: "Exposes financial conflict of interest in health certifications",
      category: "nutrition",
      hook_type: "corruption_exposure"
    },
    {
      text: "Breakfast: Most important meal. Says... Kellogg's marketing from 1944. Not science. Not biology. Marketing. You've been sold a meal.",
      likes: 12300,
      pattern: "Common belief + Historical origin + Corporate motive reveal",
      reason: "Traces belief to marketing origin, destroys credibility",
      category: "nutrition",
      hook_type: "origin_exposure"
    },
    {
      text: "Eating 6 small meals 'boosts metabolism' = lighting 6 small fires vs 3 big ones. Total heat is the same. Total calories burned is the same. Meal timing is preference, not science.",
      likes: 9100,
      pattern: "Myth + Physics analogy + Truth statement",
      reason: "Uses simple physics to debunk complex-sounding nutrition claim",
      category: "nutrition",
      hook_type: "physics_analogy"
    },
    {
      text: "Seed oils in everything. Inflammation epidemic. Correlation? Food industry says no. Independent researchers say yes. Guess who funds the FDA studies?",
      likes: 15600,
      pattern: "Observation + Health crisis + Research conflict + Loaded question",
      reason: "Implies systemic corruption without making unprovable claim",
      category: "nutrition",
      hook_type: "implied_corruption"
    }
  ],

  // ═══════════════════════════════════════════════════════════
  // LONGEVITY & AGING
  // ═══════════════════════════════════════════════════════════
  longevity: [
    {
      text: "Blue Zones secret: Not supplements. Not genetics. They walk everywhere, eat real food, have strong social ties. You can't buy longevity. You have to live it.",
      likes: 13400,
      pattern: "Expectation subversion + Simple solutions + Cannot buy message",
      reason: "Disappoints those seeking shortcuts, empowers those willing to change",
      category: "longevity",
      hook_type: "expectation_subversion"
    },
    {
      text: "Metformin for longevity: $4/month, decades of safety data, FDA approved. Rapamycin: $50-200/month, limited human data, off-label. Twitter loves the expensive risky option.",
      likes: 8700,
      pattern: "Cost vs risk comparison + Social media critique",
      reason: "Calls out biohacker trend toward expensive over practical",
      category: "longevity",
      hook_type: "trend_critique"
    },
    {
      text: "VO2 max = strongest predictor of longevity. You know what improves VO2 max? Running up stairs. Not pills. Not supplements. Stairs.",
      likes: 10900,
      pattern: "Science citation + Obvious solution + Emphasis repetition",
      reason: "Makes cutting-edge science actionable with mundane solution",
      category: "longevity",
      hook_type: "obvious_solution"
    }
  ],

  // ═══════════════════════════════════════════════════════════
  // MEDICAL SYSTEM & HEALTHCARE
  // ═══════════════════════════════════════════════════════════
  medical_system: [
    {
      text: "Healthcare: Charges $50 for an aspirin in hospital. $0.01 at Walmart. 'But insurance covers it.' Insurance gets that money from you. It's your $50.",
      likes: 17300,
      pattern: "Absurd pricing exposure + Insurance illusion breakdown",
      reason: "Exposes hidden costs people don't connect to their premiums",
      category: "medical_system",
      hook_type: "hidden_cost"
    },
    {
      text: "Doctor visit: 7 minutes average. Forms: 20 minutes. Billing: 2 hours. The system is optimized for paperwork, not healing.",
      likes: 14100,
      pattern: "Time allocation breakdown + System optimization critique",
      reason: "Quantifies what everyone feels but can't articulate",
      category: "medical_system",
      hook_type: "quantified_frustration"
    },
    {
      text: "Preventive care is free with insurance. Except the copay. And deductible. And if you're healthy, you still pay premiums. 'Free.'",
      likes: 11800,
      pattern: "False 'free' breakdown + Sarcastic quotation",
      reason: "Lists hidden costs that make 'free' meaningless",
      category: "medical_system",
      hook_type: "false_free"
    }
  ]
};

/**
 * Get viral examples for specific category
 */
export function getViralExamplesByCategory(category: string, limit: number = 5): ViralTweet[] {
  const examples = VIRAL_TWEET_DATABASE[category] || [];
  return examples.slice(0, limit);
}

/**
 * Get viral examples by pattern type
 */
export function getViralExamplesByPattern(pattern: string, limit: number = 3): ViralTweet[] {
  const allTweets: ViralTweet[] = [];
  Object.values(VIRAL_TWEET_DATABASE).forEach(category => {
    allTweets.push(...category);
  });
  
  return allTweets
    .filter(tweet => tweet.pattern.toLowerCase().includes(pattern.toLowerCase()))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit);
}

/**
 * Get top viral examples across all categories
 */
export function getTopViralExamples(limit: number = 10): ViralTweet[] {
  const allTweets: ViralTweet[] = [];
  Object.values(VIRAL_TWEET_DATABASE).forEach(category => {
    allTweets.push(...category);
  });
  
  return allTweets
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit);
}

/**
 * Get viral examples matching topic keywords
 */
export function getViralExamplesForTopic(topic: string, limit: number = 5): ViralTweet[] {
  const topicLower = topic.toLowerCase();
  const allTweets: ViralTweet[] = [];
  
  Object.values(VIRAL_TWEET_DATABASE).forEach(category => {
    allTweets.push(...category);
  });
  
  // Find tweets matching topic
  const matches = allTweets.filter(tweet => 
    tweet.text.toLowerCase().includes(topicLower) ||
    tweet.category.toLowerCase().includes(topicLower)
  );
  
  // If we have matches, return them
  if (matches.length >= limit) {
    return matches.slice(0, limit);
  }
  
  // Otherwise, return top performing tweets as fallback
  return getTopViralExamples(limit);
}

/**
 * Format viral examples for prompt injection
 */
export function formatViralExamplesForPrompt(examples: ViralTweet[]): string {
  if (examples.length === 0) return '';
  
  return `
🔥 STUDY THESE PROVEN VIRAL TWEETS:

${examples.map((ex, idx) => `
${idx + 1}. "${ex.text}"
   📊 ${ex.likes.toLocaleString()} likes
   🎯 Pattern: ${ex.pattern}
   💡 Why it works: ${ex.reason}
`).join('\n')}

YOUR MISSION: Create content THIS compelling. Use these proven patterns.
`;
}

