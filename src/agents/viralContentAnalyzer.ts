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
  optimizedContent: string;
  improvementReason: string;
  viralScore: number;
  followerGrowthPotential: number;
}

export class ViralContentAnalyzer {
  
  async predictViralPotential(content: string): Promise<ViralPrediction> {
    try {
      const prompt = `You are a JSON generator. Analyze this health content for viral potential:

"${content}"

OUTPUT ONLY THIS EXACT JSON STRUCTURE:
{"viralScore":7,"followerGrowthPotential":8,"engagementPrediction":6,"improvements":["add specific data","include controversy"],"shouldPost":true,"reasoning":"explains why viral"}

RULES:
- viralScore: 1-10 number only
- followerGrowthPotential: 1-10 number only  
- engagementPrediction: 1-10 number only
- improvements: array of 2 strings
- shouldPost: true or false only
- reasoning: single explanatory string

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 120,
        temperature: 0.0, // Zero temperature for maximum consistency
        model: 'gpt-4o-mini'
      });

      // Ultra-aggressive JSON extraction
      let jsonStr = response.trim();
      
      // If response doesn't start with {, it's not JSON - use fallback immediately
      if (!jsonStr.startsWith('{')) {
        console.warn('⚠️ OpenAI returned non-JSON, using fallback. Response:', jsonStr.substring(0, 50) + '...');
        return this.getFallbackAnalysis(content);
      }
      
      // Remove any markdown or extra formatting
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      jsonStr = jsonStr.replace(/^[^{]*/, ''); // Remove everything before first {
      jsonStr = jsonStr.replace(/[^}]*$/, '}'); // Ensure ends with }
      
      // Find JSON boundaries
      const jsonStart = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      
      if (jsonStart !== -1 && lastBrace !== -1 && lastBrace > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, lastBrace + 1);
      }

      // Clean up common JSON issues
      jsonStr = jsonStr.replace(/'/g, '"'); // Single to double quotes
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
      jsonStr = jsonStr.replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys

      try {
        const analysis = JSON.parse(jsonStr);
        
        // Validate and return with proper types
        return {
          viralScore: Math.max(1, Math.min(10, Number(analysis.viralScore) || 5)),
          followerGrowthPotential: Math.max(1, Math.min(10, Number(analysis.followerGrowthPotential) || 5)),
          engagementPrediction: Math.max(1, Math.min(10, Number(analysis.engagementPrediction) || 5)),
          improvements: Array.isArray(analysis.improvements) ? analysis.improvements.slice(0, 3) : ['Add data', 'More specific'],
          shouldPost: Boolean(analysis.shouldPost !== false),
          reasoning: String(analysis.reasoning || 'Content analysis completed')
        };
      } catch (parseError) {
        console.warn('⚠️ JSON parsing failed after cleanup:', parseError);
        console.warn('⚠️ Cleaned JSON was:', jsonStr.substring(0, 100) + '...');
        return this.getFallbackAnalysis(content);
      }

    } catch (error) {
      console.error('❌ Viral analysis error:', error);
      return this.getFallbackAnalysis(content);
    }
  }

  async optimizeContentForGrowth(content: string): Promise<ContentOptimization> {
    try {
      const prompt = `Optimize this health content for maximum viral potential and follower growth:

"${content}"

Create an improved version that will get more followers, engagement, and shares.

YOU MUST RESPOND WITH ONLY VALID JSON. NO OTHER TEXT.

{
  "optimizedContent": "improved version here",
  "improvementReason": "why this is better",
  "viralScore": 8,
  "followerGrowthPotential": 9
}

CRITICAL: ONLY JSON, NO EXTRA TEXT BEFORE OR AFTER.`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 150,
        temperature: 0.4,
        model: 'gpt-4o-mini'
      });

      // Extract JSON from response
      let jsonStr = response.trim();
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      try {
        const optimization = JSON.parse(jsonStr);
        
        return {
          optimizedContent: optimization.optimizedContent || content,
          improvementReason: optimization.improvementReason || 'Content optimized',
          viralScore: Math.max(1, Math.min(10, optimization.viralScore || 6)),
          followerGrowthPotential: Math.max(1, Math.min(10, optimization.followerGrowthPotential || 6))
        };
      } catch (parseError) {
        console.warn('⚠️ Optimization JSON parsing failed, using original:', parseError);
        return {
          optimizedContent: content,
          improvementReason: 'Optimization failed, using original',
          viralScore: 5,
          followerGrowthPotential: 5
        };
      }

    } catch (error) {
      console.error('❌ Content optimization error:', error);
      return {
        optimizedContent: content,
        improvementReason: 'Optimization failed',
        viralScore: 5,
        followerGrowthPotential: 5
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

  private getFallbackAnalysis(content: string): ViralPrediction {
    // Simple heuristic analysis when AI fails
    const hasNumbers = /\d/.test(content);
    const hasControversy = /(?:wrong|mistake|lie|fraud|hide|secret)/i.test(content);
    const hasSpecifics = /(?:mechanism|study|research|data)/i.test(content);
    const hasAction = /(?:boost|increase|improve|optimize|prevent)/i.test(content);
    
    let score = 5;
    if (hasNumbers) score += 1;
    if (hasControversy) score += 1;
    if (hasSpecifics) score += 1;
    if (hasAction) score += 1;
    
    return {
      viralScore: Math.min(10, score),
      followerGrowthPotential: Math.min(10, score),
      engagementPrediction: Math.min(10, score - 1),
      improvements: ['Add more specific data', 'Include controversy'],
      shouldPost: true,
      reasoning: 'Fallback analysis based on content patterns'
    };
  }
} 