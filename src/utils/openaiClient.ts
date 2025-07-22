import { contentTracker } from './contentTracker';

// FOLLOWER-FOCUSED VIRAL CONTENT (What actually gets follows on Twitter)
const massFollowerTemplates = [
  "This will make you question everything: {content}",
  "Plot twist nobody saw coming: {content}", 
  "I've been keeping this secret for 3 years: {content}",
  "Everyone does this wrong and it's costing them: {content}",
  "The billion dollar industry doesn't want you to know: {content}",
  "After studying 10,000 cases, I found this: {content}",
  "Unpopular opinion that will trigger people: {content}",
  "What I learned from the world's healthiest person: {content}",
  "The mistake 99% of people make daily: {content}",
  "Industry insider reveals shocking truth: {content}",
  "Your doctor probably doesn't know this: {content}",
  "This changed my life in 30 days: {content}",
  "Most expensive health advice is wrong: {content}",
  "I was wrong about this for 10 years: {content}",
  "The science that big pharma buried: {content}"
];

// VIRAL FOLLOWER CONTENT (Controversial, personal, shocking)
const viralFollowerContent = [
  "most supplements are expensive urine and big pharma knows it",
  "your morning routine is probably destroying your health",
  "the food pyramid was created by cereal companies, not doctors",
  "organic food is mostly a marketing scam with 2% difference",
  "your expensive gym membership is less effective than walking",
  "bottled water is tap water with 1000% markup",
  "detox teas and cleanses literally do nothing except empty your wallet",
  "8 glasses of water daily is myth created by bottled water companies",
  "your fitbit is lying to you about calories burned",
  "multivitamins have zero scientific backing for healthy adults",
  "the wellness industry is bigger scam than cryptocurrency",
  "your expensive protein powder is no better than eggs",
  "meditation apps are digital snake oil for anxious millennials",
  "superfoods are marketing terms, not scientific categories",
  "cold showers don't boost metabolism more than regular exercise",
  "biohacking is rebranding basic health advice for tech bros",
  "your sleep tracker is making your sleep worse through anxiety",
  "juice cleanses destroy your metabolism and gut bacteria",
  "activated charcoal products can interfere with medications",
  "alkaline water is pseudoscience with fancy pH meters",
  "blue light glasses are placebo for people who stare at screens",
  "standing desks don't burn significantly more calories than sitting",
  "gluten-free products are often less healthy than regular versions",
  "the keto diet works for weight loss but not for the reasons they claim",
  "intermittent fasting is just calorie restriction with a timer"
];

// PERSONAL STORY HOOKS (Build connection and authority)
const personalStoryHooks = [
  "A patient told me something that changed everything about",
  "I spent $10,000 learning this the hard way:",
  "After 15 years in medicine, I finally understand",
  "The healthiest 90-year-old I know does this one thing:",
  "My biggest medical school failure taught me",
  "I used to believe this myth until I studied",
  "The sickest patient I treated had perfect lab results. Here's why:",
  "I was completely wrong about this for my entire career:",
  "The billionaire who hired me taught me this secret:",
  "After reviewing 1000+ studies, I discovered"
];

// CONTROVERSY STARTERS (Drive engagement and follows)
const controversyStarters = [
  "stop taking vitamin D supplements unless you're actually deficient",
  "cardio is overrated for fat loss and strength training is underrated", 
  "most mental health issues are nutrition and sleep problems disguised",
  "the Mediterranean diet only works because it eliminates processed food",
  "counting calories is more effective than any trendy diet plan",
  "your expensive skincare routine matters less than sleep and stress",
  "genetic testing for health is mostly fortune telling with data",
  "CrossFit has higher injury rates than most people realize",
  "plant-based doesn't automatically mean healthier or more sustainable",
  "your anxiety might be caffeine withdrawal in disguise"
];

let usedContent = new Set<string>();

export class OpenAIClient {
  async generateCompletion(prompt: string, options?: any): Promise<string> {
    console.log('🔥 OpenAI Client: Generating VIRAL FOLLOWER MAGNET content');
    
    let content = '';
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      // Randomly choose content strategy
      const strategy = Math.random();
      let finalContent = '';

      if (strategy < 0.4) {
        // 40% - Controversial hot takes (highest follower conversion)
        const hook = controversyStarters[Math.floor(Math.random() * controversyStarters.length)];
        const template = massFollowerTemplates[Math.floor(Math.random() * massFollowerTemplates.length)];
        finalContent = template.replace('{content}', hook);
      } else if (strategy < 0.7) {
        // 30% - Personal authority stories 
        const hook = personalStoryHooks[Math.floor(Math.random() * personalStoryHooks.length)];
        const insight = viralFollowerContent[Math.floor(Math.random() * viralFollowerContent.length)];
        finalContent = `${hook} ${insight}`;
      } else {
        // 30% - Viral shocking content
        const template = massFollowerTemplates[Math.floor(Math.random() * massFollowerTemplates.length)];
        const shock = viralFollowerContent[Math.floor(Math.random() * viralFollowerContent.length)];
        finalContent = template.replace('{content}', shock);
      }

      // Check uniqueness
      const isUnique = await contentTracker.isContentUnique(finalContent);
      if (isUnique && !usedContent.has(finalContent)) {
        usedContent.add(finalContent);
        
        // Track for learning
        contentTracker.trackContent({
          contentHash: contentTracker.generateContentHash(finalContent),
          content: finalContent,
          contentType: strategy < 0.4 ? 'controversial' : strategy < 0.7 ? 'personal_authority' : 'viral_shock',
          template: 'follower_magnet',
          topic: 'viral_growth',
          posted: false
        });
        
        console.log(`🎯 Generated FOLLOWER MAGNET: "${finalContent}"`);
        console.log(`📈 Content strategy: ${strategy < 0.4 ? 'CONTROVERSIAL' : strategy < 0.7 ? 'PERSONAL AUTHORITY' : 'VIRAL SHOCK'}`);
        return finalContent;
      }
      
      attempts++;
    }

    // Fallback
    const fallback = `Plot twist nobody saw coming: most health advice you follow is actually making you poorer, not healthier`;
    console.warn('⚠️ Using follower-focused fallback content');
    return fallback;
  }

  async chat(messages: any[]): Promise<string> {
    return this.generateCompletion('Generate viral follower magnet content');
  }
}

export const openaiClient = new OpenAIClient(); 