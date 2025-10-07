/**
 * 🎭 DYNAMIC PROMPT GENERATOR
 * Creates unique, diverse prompts for each tweet to eliminate similarity
 */

import { contentDiversityEngine } from './contentDiversityEngine';

export class DynamicPromptGenerator {
  private static instance: DynamicPromptGenerator;

  public static getInstance(): DynamicPromptGenerator {
    if (!DynamicPromptGenerator.instance) {
      DynamicPromptGenerator.instance = new DynamicPromptGenerator();
    }
    return DynamicPromptGenerator.instance;
  }

  /**
   * 🎨 Generate completely unique prompt for each tweet
   */
  generateDiversePrompt(topic?: string): string {
    const diversity = contentDiversityEngine.selectDiverseElements();
    const selectedTopic = topic || this.getRandomHealthTopic();
    
    console.log(`🎭 PROMPT_GEN: Creating ${diversity.format} about ${selectedTopic} in ${diversity.style} style`);
    
    return this.buildPromptFromElements(selectedTopic, diversity);
  }

  /**
   * 🏗️ Build specific prompt based on selected elements
   */
  private buildPromptFromElements(topic: string, diversity: any): string {
    const basePrompt = this.getBasePrompt();
    const formatInstructions = this.getFormatInstructions(diversity.format, topic);
    const styleInstructions = this.getStyleInstructions(diversity.style, diversity.tone);
    const hookInstructions = this.getHookInstructions(diversity.hook);
    const lengthInstructions = this.getLengthInstructions(diversity.length);
    
    return `${basePrompt}

🎯 TOPIC: ${topic}

📝 FORMAT: ${formatInstructions}

🎭 STYLE & TONE: ${styleInstructions}

🪝 OPENING: ${hookInstructions}

📏 LENGTH: ${lengthInstructions}

🚫 AVOID:
- Generic health advice
- Overused phrases like "Did you know" or "Studies show"
- Medical disclaimers
- Hashtags
- Emoji overuse (max 1-2 if any)

✅ REQUIREMENTS:
- Be specific and actionable
- Include surprising or non-obvious information
- Write like you're talking to a friend
- Make it memorable and shareable
- No medical advice, just interesting facts/insights

Generate ONE tweet only:`;
  }

  /**
   * 📋 Base prompt foundation
   */
  private getBasePrompt(): string {
    return `You are a health content creator known for diverse, engaging tweets that never sound repetitive. Each tweet should feel completely different from the last - different structure, different approach, different voice.`;
  }

  /**
   * 📐 Format-specific instructions
   */
  private getFormatInstructions(format: string, topic: string): string {
    const formats: Record<string, string> = {
      single_fact: `Share ONE fascinating fact about ${topic}. Make it surprising.`,
      before_after: `Show a transformation or change related to ${topic}. "Before X, after Y" style.`,
      numbered_list: `Give 3 quick, actionable tips about ${topic}. Use numbers (1., 2., 3.)`,
      question_answer: `Start with an intriguing question about ${topic}, then answer it.`,
      story_based: `Tell a mini-story or scenario involving ${topic}. Make it relatable.`,
      data_driven: `Share specific numbers, percentages, or research findings about ${topic}.`,
      how_to: `Explain HOW to do something related to ${topic}. Step-by-step.`,
      myth_buster: `Debunk a common myth or misconception about ${topic}.`,
      comparison: `Compare two things related to ${topic}. Show which is better/worse.`,
      timeline: `Show what happens over time with ${topic}. "In 30 days... In 6 months..."`,
      thread_starter: `Create the first tweet of a potential thread about ${topic}.`,
      quote_react: `React to or build upon a common saying/belief about ${topic}.`,
      personal_insight: `Share a personal observation or "aha moment" about ${topic}.`,
      contrarian_take: `Take an unpopular or contrarian stance on ${topic}. Be bold.`,
      simple_reminder: `Give a gentle, helpful reminder about ${topic}.`
    };
    
    return formats[format] || formats.single_fact;
  }

  /**
   * 🎨 Style and tone instructions
   */
  private getStyleInstructions(style: string, tone: string): string {
    const styleMap: Record<string, string> = {
      educational: "Teach something new, but keep it accessible and interesting.",
      conversational: "Write like you're chatting with a friend over coffee.",
      authoritative: "Sound knowledgeable and confident, but not arrogant.",
      curious: "Express wonder and genuine curiosity about the topic.",
      motivational: "Inspire action and positive change.",
      humorous: "Add light humor or wit, but keep it tasteful.",
      serious: "Be respectful and professional about important health info.",
      storytelling: "Use narrative elements - characters, situations, outcomes.",
      scientific: "Reference research, but make it understandable.",
      practical: "Focus on what people can actually do or use.",
      philosophical: "Explore deeper meanings and broader implications.",
      urgent: "Convey importance without being alarmist.",
      reassuring: "Provide comfort and reduce anxiety about the topic.",
      challenging: "Question assumptions and push people to think differently.",
      simple: "Use clear, straightforward language anyone can understand."
    };
    
    const toneMap: Record<string, string> = {
      friendly: "Warm, welcoming, and approachable.",
      professional: "Polished but personable.",
      casual: "Relaxed and informal, like texting a friend.",
      enthusiastic: "Show genuine excitement about the topic.",
      thoughtful: "Reflective and contemplative.",
      direct: "Get straight to the point, no fluff.",
      encouraging: "Supportive and uplifting.",
      matter_of_fact: "Straightforward, just the facts.",
      conversational: "Natural dialogue style.",
      inspiring: "Uplift and motivate the reader."
    };
    
    return `${styleMap[style] || styleMap.educational} Tone: ${toneMap[tone] || toneMap.friendly}`;
  }

  /**
   * 🪝 Hook-specific instructions
   */
  private getHookInstructions(hook: string): string {
    if (!hook || hook === "") {
      return "Start directly with your main point. No hook needed.";
    }
    
    return `Start with: "${hook}" and then seamlessly continue with your content.`;
  }

  /**
   * 📏 Length instructions
   */
  private getLengthInstructions(length: string): string {
    const lengthMap: Record<string, string> = {
      ultra_short: "Keep it very brief - 50-80 characters. Punchy and memorable.",
      short: "Short and sweet - 80-120 characters. Quick to read.",
      medium: "Medium length - 120-200 characters. Room for detail.",
      long: "Use more space - 200-280 characters. Be comprehensive.",
      tweet_storm: "Write the first tweet of a series. Hint at more to come."
    };
    
    return lengthMap[length] || lengthMap.medium;
  }

  /**
   * 🎲 Get random health topic
   */
  private getRandomHealthTopic(): string {
    const topics = [
      'hydration', 'sleep quality', 'gut health', 'metabolism', 'stress management',
      'immune system', 'brain health', 'heart health', 'muscle recovery', 'bone health',
      'mental clarity', 'energy levels', 'inflammation', 'antioxidants', 'fiber intake',
      'protein timing', 'meal timing', 'exercise recovery', 'posture', 'breathing',
      'vitamin D', 'omega-3s', 'probiotics', 'meditation', 'walking', 'stretching',
      'sunlight exposure', 'cold exposure', 'heat therapy', 'fasting', 'meal prep'
    ];
    
    return topics[Math.floor(Math.random() * topics.length)];
  }
}

// Export singleton
export const dynamicPromptGenerator = DynamicPromptGenerator.getInstance();
