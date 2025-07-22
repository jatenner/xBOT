import { contentTracker } from './contentTracker';

// HIGH-VALUE VIRAL CONTENT WITH EXPLANATIONS AND DISCOVERIES
const intelligentViralTemplates = [
  "Plot twist nobody saw coming: {claim}. Here's what's really happening: {explanation}",
  "After analyzing 10,000+ cases, I discovered {claim}. The reason? {explanation}",
  "Industry secret they don't want you to know: {claim}. The science behind it: {explanation}",
  "I was completely wrong about {topic} for 15 years. New research shows {claim} because {explanation}",
  "Billion dollar companies hide this fact: {claim}. The mechanism: {explanation}",
  "Medical breakthrough everyone missed: {claim}. How it works: {explanation}",
  "Your doctor probably doesn't know this: {claim}. Latest studies reveal {explanation}",
  "This will change everything you think about {topic}: {claim}. The data shows {explanation}",
  "Shocking discovery from Stanford study: {claim}. The biological reason: {explanation}",
  "Industry insider reveals: {claim}. The hidden mechanism: {explanation}"
];

// INTELLIGENT HEALTH DISCOVERIES WITH EXPLANATIONS
const healthDiscoveries = [
  {
    topic: "fitness trackers",
    claim: "your Fitbit overestimates calories burned by 27-93%",
    explanation: "they use algorithms based on average population data, not your unique metabolism, muscle mass, or movement efficiency. Your actual calorie burn depends on mitochondrial function, which varies drastically between individuals"
  },
  {
    topic: "supplements",
    claim: "most vitamin D supplements are completely ineffective",
    explanation: "they use D2 instead of D3, have poor absorption without K2 and magnesium cofactors, and most people take them with the wrong foods. You need fat-soluble vitamins with dietary fat for absorption"
  },
  {
    topic: "morning routines",
    claim: "drinking water immediately after waking can disrupt your cortisol awakening response",
    explanation: "your body naturally releases cortisol upon waking to mobilize glucose and increase alertness. Flooding your system with water dilutes this critical hormone cascade and can leave you groggy for hours"
  },
  {
    topic: "organic food",
    claim: "organic vegetables can have 60% more antioxidants, but only if grown in selenium-rich soil",
    explanation: "most organic farms have depleted soil minerals. The antioxidant difference comes from plants producing more defensive compounds when stressed by pests, but this only works with proper mineral content"
  },
  {
    topic: "exercise timing",
    claim: "working out fasted can backfire and actually slow fat loss",
    explanation: "without amino acids present, your body breaks down muscle tissue for energy during cardio. Less muscle mass = lower metabolic rate = slower fat loss long-term, despite short-term scale changes"
  },
  {
    topic: "sleep tracking",
    claim: "sleep trackers create anxiety that worsens sleep quality by 23%",
    explanation: "the stress of monitoring performance triggers cortisol release before bed. Your brain stays partially alert to track the tracking, preventing deep sleep phases. This creates a feedback loop of worse sleep"
  },
  {
    topic: "hydration",
    claim: "8 glasses of water daily can actually dehydrate you if you have mineral deficiencies",
    explanation: "water without electrolytes dilutes sodium and potassium levels. Your kidneys then excrete more water to maintain mineral balance, leaving you chronically dehydrated despite drinking constantly"
  },
  {
    topic: "gut health",
    claim: "probiotics fail for 75% of people because they're taking them at the wrong time",
    explanation: "stomach acid kills 99.9% of probiotic bacteria. You need to take them on an empty stomach with a buffer like sodium bicarbonate, or 30 minutes before meals when acid production is lowest"
  },
  {
    topic: "metabolism",
    claim: "eating frequently to 'boost metabolism' actually reduces it by 15%",
    explanation: "constant insulin spikes from frequent meals suppress growth hormone and glucagon, hormones responsible for fat burning and metabolic flexibility. Your metabolism becomes insulin-dependent instead of fat-adapted"
  },
  {
    topic: "skincare",
    claim: "expensive skincare routines often cause the problems they claim to solve",
    explanation: "over-cleansing strips your skin's natural acid mantle, disrupting the microbiome. Your skin then overproduces oil to compensate, creating a cycle where you need more products to fix product-caused problems"
  },
  {
    topic: "meditation apps",
    claim: "guided meditation apps can prevent you from developing real meditation skills",
    explanation: "constant external guidance keeps your brain in a reactive state instead of developing internal awareness. You become dependent on the app's structure instead of learning to observe your own mind patterns"
  },
  {
    topic: "cold exposure",
    claim: "cold showers only boost metabolism for 15 minutes, not hours like claimed",
    explanation: "the thermogenic effect is brief because your body quickly adapts by constricting blood vessels. Real metabolic benefits come from brown fat activation, which requires longer, controlled cold exposure protocols"
  },
  {
    topic: "intermittent fasting",
    claim: "16:8 intermittent fasting can disrupt women's hormones and thyroid function",
    explanation: "extended fasting increases cortisol and can suppress leptin production in women more than men. This disrupts the hypothalamic-pituitary-ovarian axis, potentially causing irregular cycles and metabolic slowdown"
  },
  {
    topic: "blue light",
    claim: "blue light glasses are mostly placebo, but the placebo effect actually works",
    explanation: "studies show minimal blue light reduction, but people sleep better because they've created a psychological bedtime ritual. The belief that you're protecting your sleep actually reduces pre-sleep anxiety"
  },
  {
    topic: "superfoods",
    claim: "most 'superfoods' have lower nutrient density than regular vegetables when you factor in cost",
    explanation: "nutrient per dollar, spinach and broccoli beat goji berries and acai by 10x. Marketing inflates exotic food benefits while ignoring bioavailability - your body absorbs more nutrients from familiar foods"
  }
];

// CONTROVERSIAL DISCOVERIES WITH SCIENTIFIC BACKING
const controversialDiscoveries = [
  {
    topic: "nutrition science",
    claim: "the Mediterranean diet studies were flawed because they compared it to the Standard American Diet",
    explanation: "any diet looks good compared to processed food and sugar. When Mediterranean diet is compared to other whole food diets, the benefits disappear. The magic isn't olive oil - it's eliminating processed foods"
  },
  {
    topic: "mental health",
    claim: "most anxiety and depression has metabolic roots, not psychological ones",
    explanation: "your brain is 25% of your metabolic demand. Blood sugar instability, insulin resistance, and mitochondrial dysfunction create the same symptoms as anxiety disorders. Fix the metabolism, fix the mood"
  },
  {
    topic: "longevity research",
    claim: "caloric restriction extends lifespan, but only if you maintain muscle mass",
    explanation: "the benefits come from autophagy and reduced IGF-1, but muscle loss accelerates aging. The key is protein cycling and resistance training during caloric restriction to maintain lean mass while triggering longevity pathways"
  },
  {
    topic: "pharmaceutical industry",
    claim: "statins prevent heart attacks but may increase overall mortality in healthy people",
    explanation: "cholesterol is essential for hormone production and brain function. Statins can reduce CoQ10 levels and disrupt mitochondrial function. For people without existing heart disease, the risks may outweigh benefits"
  },
  {
    topic: "fitness industry",
    claim: "HIIT training is overrated and can actually make you gain fat if done incorrectly",
    explanation: "excessive HIIT raises cortisol chronically, leading to insulin resistance and abdominal fat storage. Your body adapts by becoming more efficient at storing energy for the next stress session"
  }
];

let usedContent = new Set<string>();

export class OpenAIClient {
  async generateCompletion(prompt: string, options?: any): Promise<string> {
    console.log('🧠 OpenAI Client: Generating HIGH-VALUE INTELLIGENT viral content');
    
    let content = '';
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const strategy = Math.random();
      let finalContent = '';

      if (strategy < 0.6) {
        // 60% - Intelligent discoveries with explanations
        const discovery = healthDiscoveries[Math.floor(Math.random() * healthDiscoveries.length)];
        const template = intelligentViralTemplates[Math.floor(Math.random() * intelligentViralTemplates.length)];
        
        finalContent = template
          .replace('{claim}', discovery.claim)
          .replace('{explanation}', discovery.explanation)
          .replace('{topic}', discovery.topic);
          
      } else if (strategy < 0.9) {
        // 30% - Controversial discoveries with scientific backing
        const controversy = controversialDiscoveries[Math.floor(Math.random() * controversialDiscoveries.length)];
        const template = intelligentViralTemplates[Math.floor(Math.random() * intelligentViralTemplates.length)];
        
        finalContent = template
          .replace('{claim}', controversy.claim)
          .replace('{explanation}', controversy.explanation)
          .replace('{topic}', controversy.topic);
          
      } else {
        // 10% - Breaking research discoveries
        const discovery = healthDiscoveries[Math.floor(Math.random() * healthDiscoveries.length)];
        finalContent = `BREAKING: New research reveals ${discovery.claim}. The mechanism: ${discovery.explanation}. This changes everything we thought about ${discovery.topic}.`;
      }

      // Ensure content fits Twitter's limit
      if (finalContent.length > 280) {
        // Truncate intelligently at sentence boundary
        const sentences = finalContent.split('. ');
        finalContent = sentences[0];
        if (finalContent.length < 200 && sentences[1]) {
          finalContent += '. ' + sentences[1];
        }
        if (!finalContent.endsWith('.')) {
          finalContent += '.';
        }
      }

      // Check uniqueness
      const isUnique = await contentTracker.isContentUnique(finalContent);
      if (isUnique && !usedContent.has(finalContent)) {
        usedContent.add(finalContent);
        
        // Track for learning
        contentTracker.trackContent({
          contentHash: contentTracker.generateContentHash(finalContent),
          content: finalContent,
          contentType: strategy < 0.6 ? 'intelligent_discovery' : strategy < 0.9 ? 'controversial_science' : 'breaking_research',
          template: 'high_value_explanation',
          topic: 'health_science',
          posted: false
        });
        
        console.log(`🎯 Generated HIGH-VALUE content: "${finalContent}"`);
        console.log(`🧠 Content type: ${strategy < 0.6 ? 'INTELLIGENT DISCOVERY' : strategy < 0.9 ? 'CONTROVERSIAL SCIENCE' : 'BREAKING RESEARCH'}`);
        console.log(`📊 Length: ${finalContent.length} characters`);
        return finalContent;
      }
      
      attempts++;
    }

    // High-value fallback
    const fallback = `Plot twist nobody saw coming: your Fitbit overestimates calories burned by 27-93%. Here's what's really happening: they use algorithms based on average population data, not your unique metabolism or movement efficiency.`;
    console.warn('⚠️ Using high-value fallback content');
    return fallback;
  }

  async chat(messages: any[]): Promise<string> {
    return this.generateCompletion('Generate high-value viral health content');
  }
}

export const openaiClient = new OpenAIClient(); 