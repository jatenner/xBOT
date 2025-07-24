import { openaiClient } from '../utils/openaiClient';

interface ViralPrediction {
  viralScore: number;
  followerGrowthPotential: number;
  engagementPrediction: number;
  improvements: string[];
  shouldPost: boolean;
  reasoning: string;
}

interface ContentOptimization {
  originalContent: string;
  optimizedContent: string;
  improvements: string[];
  expectedLift: number;
}

export class ViralContentAnalyzer {
  
  async predictViralPotential(content: string): Promise<ViralPrediction> {
    try {
      console.log('🧠 AI analyzing viral potential...');
      
      const prompt = `
You are a legendary social media growth expert who has helped accounts gain millions of followers.

Analyze this health/wellness tweet for MAXIMUM FOLLOWER GROWTH potential:

CONTENT: "${content}"

Rate each factor 1-10 and explain:

1. VIRAL POTENTIAL (1-10):
   - Hook strength
   - Controversy/surprise factor
   - Shareability
   - Emotional impact

2. FOLLOWER CONVERSION (1-10):
   - Authority demonstration
   - Value provided
   - Credibility signals
   - Follow-worthy factor

3. ENGAGEMENT PREDICTION (1-10):
   - Comment-bait potential
   - Discussion starter
   - Quote tweet worthy
   - Save/bookmark appeal

4. IMPROVEMENTS NEEDED:
   - Specific changes to increase scores
   - Better hooks/openings
   - More compelling data
   - Stronger positioning

OVERALL RECOMMENDATION:
- Should we post this? (Yes/No)
- What's the follower growth potential?
- Key reasoning

CRITICAL: You must respond with ONLY valid JSON in this exact format:
{
  "viralScore": 7,
  "followerGrowthPotential": 8, 
  "engagementPrediction": 6,
  "improvements": ["improvement1", "improvement2"],
  "shouldPost": true,
  "reasoning": "detailed explanation"
}

Do not include any text before or after the JSON. Only return the JSON object.`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 500,
        temperature: 0.3,
        model: 'gpt-4o-mini'
      });

      const analysis = JSON.parse(response) as ViralPrediction;
      
      console.log(`🎯 Viral Analysis: ${analysis.viralScore}/10 viral, ${analysis.followerGrowthPotential}/10 growth`);
      console.log(`📊 Recommendation: ${analysis.shouldPost ? 'POST IT' : 'IMPROVE FIRST'}`);
      
      return analysis;

    } catch (error) {
      console.warn('⚠️ Viral analysis failed:', error);
      return {
        viralScore: 5,
        followerGrowthPotential: 5,
        engagementPrediction: 5,
        improvements: ['Analysis failed - posting with default scoring'],
        shouldPost: true,
        reasoning: 'Fallback due to analysis error'
      };
    }
  }

  async optimizeContentForGrowth(content: string, targetAudience: string = 'health-conscious professionals'): Promise<ContentOptimization> {
    try {
      console.log('🚀 AI optimizing content for maximum growth...');
      
      const prompt = `
You are a legendary health content creator who consistently goes viral and gains thousands of followers per month.

ORIGINAL CONTENT: "${content}"
TARGET AUDIENCE: ${targetAudience}

Your task: Create a MORE POWERFUL version that will:
1. Get MORE followers
2. Drive MORE engagement  
3. Establish MORE authority
4. Create MORE viral potential

OPTIMIZATION TECHNIQUES:
- Stronger hooks (numbers, controversy, surprise)
- More compelling data/statistics
- Better emotional triggers
- Clearer value proposition
- Enhanced credibility signals
- Optimal length and structure

RULES:
- Keep under 280 characters
- Maintain factual accuracy
- Include specific data/numbers
- Make it immediately valuable
- Create follow-worthy authority

CRITICAL: You must respond with ONLY valid JSON in this exact format:
{
  "originalContent": "original text",
  "optimizedContent": "improved version", 
  "improvements": ["what was changed", "what was improved"],
  "expectedLift": 25
}

Do not include any text before or after the JSON. Only return the JSON object.`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 400,
        temperature: 0.4,
        model: 'gpt-4o-mini'
      });

      const optimization = JSON.parse(response) as ContentOptimization;
      
      console.log(`🎯 Content optimized: ${optimization.expectedLift}% expected improvement`);
      console.log(`✨ Key improvements: ${optimization.improvements.join(', ')}`);
      
      return optimization;

    } catch (error) {
      console.warn('⚠️ Content optimization failed:', error);
      return {
        originalContent: content,
        optimizedContent: content,
        improvements: ['Optimization failed - using original'],
        expectedLift: 0
      };
    }
  }

  async generateViralHealthTopics(): Promise<string[]> {
    try {
      console.log('🔥 AI generating viral health topics...');
      
      const prompt = `
You are a health content strategist who identifies viral trends before they explode.

Generate 10 health/wellness topics with MAXIMUM viral potential and follower growth:

CRITERIA:
- Controversial but scientifically accurate
- Surprising/counterintuitive facts
- Trending health concerns
- Debunks common myths
- Provides immediate value
- Appeals to health-conscious professionals

EXAMPLES OF VIRAL HEALTH CONTENT:
- "Why 8 glasses of water daily is actually harmful"
- "The exercise that's worse than being sedentary" 
- "Why healthy foods are making you sick"
- "The supplement that blocks fat loss"

FORMAT: Return as JSON array of strings
["topic 1", "topic 2", "topic 3", ...]

Focus on topics that will:
1. Make people want to follow for more insights
2. Generate debate and discussion
3. Position us as a contrarian health authority
4. Provide shocking but true information`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 300,
        temperature: 0.6,
        model: 'gpt-4o-mini'
      });

      const topics = JSON.parse(response) as string[];
      
      console.log(`🎯 Generated ${topics.length} viral health topics`);
      
      return topics;

    } catch (error) {
      console.warn('⚠️ Viral topic generation failed:', error);
      return [
        'Sleep optimization secrets',
        'Exercise timing mistakes',
        'Nutrition timing hacks',
        'Supplement timing facts',
        'Recovery optimization'
      ];
    }
  }
} 