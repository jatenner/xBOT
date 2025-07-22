import { contentTracker } from './contentTracker';

// Significantly expanded content pools for maximum diversity
const viralHealthTemplates = [
  "💡 {tip} - try this for 7 days and see the difference",
  "🔥 Scientists just discovered: {tip}",
  "⚡ Game changer: {tip}",
  "🧠 Your body will thank you: {tip}",
  "💪 Simple habit that works: {tip}",
  "🎯 Health hack: {tip}",
  "✨ This changed everything: {tip}",
  "🚀 Pro tip: {tip}",
  "💎 Golden rule: {tip}",
  "🔑 Secret weapon: {tip}",
  "📈 Breakthrough: {tip}",
  "🌟 Life hack: {tip}",
  "⚡ Quick win: {tip}",
  "🎯 Daily reminder: {tip}",
  "🔥 Hot tip: {tip}",
  "💡 Simple truth: {tip}",
  "🚀 Level up: {tip}",
  "💪 Power move: {tip}",
  "🧬 Biohack: {tip}",
  "⭐ Pro secret: {tip}"
];

const healthNews = [
  "new Stanford study shows drinking green tea 30 minutes before meals burns 23% more fat",
  "Harvard researchers find taking magnesium before bed improves deep sleep by 40%",
  "Mayo Clinic confirms: walking after meals reduces blood sugar spikes by 30%",
  "Johns Hopkins study: morning sunlight exposure regulates circadian rhythm in 3 days",
  "MIT research reveals cold showers boost metabolism for 24 hours",
  "UCLA finds: probiotics with 50+ billion CFU heal leaky gut in 2 weeks",
  "Yale study: zone 2 cardio burns fat for 12 hours post-workout",
  "Cleveland Clinic: omega-3 from fish oil reduces anxiety by 25%",
  "New research: intermittent fasting increases growth hormone 500%",
  "Latest study: vitamin D3 + K2 prevents calcium buildup in arteries"
];

const biohackTips = [
  "breathe through your nose - mouth breathing kills gains",
  "eat protein within 30 minutes of waking to boost metabolism",
  "add sea salt to water for better hydration",
  "stop eating 3 hours before bed for deeper sleep",
  "do 20 squats every hour you sit",
  "chew your food 30 times for better digestion",
  "drink 16oz water first thing every morning",
  "take cold showers for 30 seconds to boost immune system",
  "get sunlight in your eyes within first hour of waking",
  "walk barefoot on grass for 10 minutes daily"
];

const supplementTips = [
  "creatine monohydrate 5g daily boosts brain function 15%",
  "magnesium glycinate 400mg before bed = perfect sleep",
  "vitamin D3 4000IU + K2 100mcg together prevents deficiency",
  "omega-3 fish oil 2g daily reduces inflammation markers",
  "curcumin with black pepper increases absorption 2000%",
  "NAD+ precursors reverse cellular aging at the mitochondrial level",
  "lion's mane mushroom grows new brain cells",
  "ashwagandha 600mg reduces cortisol by 30%",
  "glycine 3g before bed increases deep sleep phases",
  "zinc 15mg daily boosts immune system and testosterone"
];

const exerciseTips = [
  "zone 2 cardio for 45 minutes burns fat for 24 hours",
  "strength training 3x week prevents muscle loss after 30",
  "morning walks regulate blood sugar better than evening",
  "10,000 steps daily reduces all-cause mortality by 40%",
  "high-intensity intervals boost metabolism for 48 hours",
  "resistance bands build muscle anywhere, anytime",
  "deadlifts activate more muscles than any other exercise",
  "swimming is the only exercise that works every muscle",
  "yoga increases flexibility and reduces stress hormones",
  "pilates strengthens core better than traditional ab work"
];

const nutritionSecrets = [
  "eating blueberries daily reduces inflammation markers by 25%",
  "fermented foods heal gut microbiome in 2 weeks",
  "bone broth provides collagen for joint health",
  "avocados increase nutrient absorption from vegetables",
  "dark chocolate 70%+ improves cognitive function",
  "green leafy vegetables prevent cognitive decline",
  "wild-caught salmon has 10x more omega-3 than farmed",
  "grass-fed beef contains natural CLA for fat burning",
  "organic vegetables have 60% more antioxidants",
  "apple cider vinegar before meals stabilizes blood sugar"
];

// Content type mapping for learning
const contentTypes = {
  'health_news': healthNews,
  'biohack_tips': biohackTips,
  'supplement_tips': supplementTips,
  'exercise_tips': exerciseTips,
  'nutrition_secrets': nutritionSecrets
};

let usedContent = new Set<string>();

export class OpenAIClient {
  async generateCompletion(prompt: string, options?: any): Promise<string> {
    console.log('🤖 OpenAI Client: Generating diverse viral health content');
    
    let content = '';
    let attempts = 0;
    const maxAttempts = 50;

    // Keep generating until we get unique content
    while (attempts < maxAttempts) {
      // Randomly select content type and template
      const typeKeys = Object.keys(contentTypes);
      const selectedType = typeKeys[Math.floor(Math.random() * typeKeys.length)];
      const tips = contentTypes[selectedType as keyof typeof contentTypes];
      const tip = tips[Math.floor(Math.random() * tips.length)];
      const template = viralHealthTemplates[Math.floor(Math.random() * viralHealthTemplates.length)];
      
      content = template.replace('{tip}', tip);
      
      // Check if content is unique
      const isUnique = await contentTracker.isContentUnique(content);
      if (isUnique && !usedContent.has(content)) {
        usedContent.add(content);
        
        // Track the content generation
        contentTracker.trackContent({
          contentHash: contentTracker.generateContentHash(content),
          content,
          contentType: selectedType,
          template,
          topic: tip,
          posted: false
        });
        
        console.log(`📝 Generated unique ${selectedType}: "${content}"`);
        return content;
      }
      
      attempts++;
    }

    // Fallback if somehow we can't generate unique content
    const fallback = `🚀 Health tip: ${Date.now()} - stay hydrated, move daily, sleep well`;
    console.warn('⚠️ Using fallback content after max attempts');
    return fallback;
  }

  async chat(messages: any[]): Promise<string> {
    return this.generateCompletion('Generate viral health content');
  }
}

export const openaiClient = new OpenAIClient(); 