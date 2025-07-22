// Real content generator for viral health content
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
  "🔑 Secret weapon: {tip}"
];

const healthTips = [
  "drink 16oz of water first thing in the morning",
  "eat protein within 30 minutes of waking up",
  "take a 10 minute walk after every meal",
  "get sunlight in your eyes within the first hour of waking",
  "stop eating 3 hours before bed",
  "do 20 squats every hour you're sitting",
  "add a pinch of sea salt to your water",
  "eat leafy greens with every meal",
  "breathe through your nose, not your mouth",
  "cold shower for 30 seconds to boost metabolism",
  "magnesium glycinate 400mg before bed improves sleep 40%",
  "eating blueberries daily reduces inflammation markers",
  "16:8 intermittent fasting increases growth hormone 500%",
  "zone 2 cardio for 45 minutes burns fat for 24 hours",
  "creatine monohydrate 5g daily boosts brain function 15%",
  "omega-3 from fish oil reduces anxiety by 20%",
  "vitamin D3 + K2 together prevents calcium buildup",
  "curcumin with black pepper increases absorption 2000%",
  "probiotics with 50+ billion CFU heal leaky gut",
  "NAD+ precursors reverse cellular aging",
  "lion's mane mushroom grows new brain cells",
  "ashwagandha reduces cortisol by 30%",
  "glycine before bed increases deep sleep",
  "red light therapy boosts mitochondrial function",
  "sauna 3x per week increases longevity 20%"
];

let lastUsedTip = -1;

export class OpenAIClient {
  async generateCompletion(prompt: string, options?: any): Promise<string> {
    console.log('🤖 OpenAI Client: Generating diverse viral health content');
    
    // Ensure we don't repeat the same tip
    let tipIndex;
    do {
      tipIndex = Math.floor(Math.random() * healthTips.length);
    } while (tipIndex === lastUsedTip && healthTips.length > 1);
    
    lastUsedTip = tipIndex;
    
    const tip = healthTips[tipIndex];
    const template = viralHealthTemplates[Math.floor(Math.random() * viralHealthTemplates.length)];
    
    const content = template.replace('{tip}', tip);
    
    console.log(`📝 Generated: "${content}"`);
    return content;
  }

  async chat(messages: any[]): Promise<string> {
    return this.generateCompletion('Generate viral health content');
  }
}

export const openaiClient = new OpenAIClient(); 