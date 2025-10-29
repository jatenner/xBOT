/**
 * 🎭 DYNAMIC CONTENT GENERATOR
 * 
 * This breaks the rigid, formulaic patterns by creating truly varied content
 * that feels human and engaging, not template-driven.
 */

export interface DynamicContent {
  content: string | string[];
  format: 'single' | 'thread';
  style: string;
  confidence: number;
  metadata: {
    approach: string;
    variety_score: number;
    human_like: boolean;
  };
}

export async function generateDynamicContent(params: {
  topic?: string;
  format?: 'single' | 'thread';
  mood?: 'curious' | 'confident' | 'playful' | 'serious' | 'surprised' | 'thoughtful';
  length?: 'short' | 'medium' | 'long';
  angle?: 'personal' | 'research' | 'practical' | 'philosophical' | 'controversial';
}): Promise<DynamicContent> {
  
  const { topic, format = 'single', mood, length, angle } = params;
  
  // 🎲 RANDOM CONTENT APPROACHES (no templates!)
  const approaches = [
    'casual_observation',    // "Noticed something weird about..."
    'quick_fact',           // "TIL that..."
    'personal_insight',     // "Been thinking about..."
    'research_find',        // "Just read that..."
    'practical_tip',        // "Here's what works..."
    'question_pondering',   // "Why do we..."
    'comparison_thought',   // "X vs Y is interesting because..."
    'mechanism_explanation', // "The way this works is..."
    'myth_busting',         // "Everyone thinks X but..."
    'future_prediction',    // "In 5 years we'll..."
    'historical_context',   // "Back in the day..."
    'contrarian_take',      // "Hot take: X is wrong because..."
    'story_snippet',        // "Heard about this person who..."
    'data_revelation',      // "The numbers on this are crazy..."
    'simple_reminder',      // "Don't forget that..."
    'curiosity_spark'       // "What if we..."
  ];
  
  const selectedApproach = approaches[Math.floor(Math.random() * approaches.length)];
  
  // 🎨 MOOD-BASED VOICE VARIATIONS
  const moodVoices = {
    curious: "I'm genuinely curious about this...",
    confident: "Here's what I know for sure...",
    playful: "This is actually pretty cool...",
    serious: "This is important to understand...",
    surprised: "Wait, this is wild...",
    thoughtful: "I've been thinking about this..."
  };
  
  const selectedMood = mood || Object.keys(moodVoices)[Math.floor(Math.random() * Object.keys(moodVoices).length)];
  
  // 📏 LENGTH VARIATIONS (not rigid character counts)
  const lengthStyles = {
    short: "Keep it punchy and direct",
    medium: "Give some context but stay concise", 
    long: "Go deeper with explanation and examples"
  };
  
  const selectedLength = length || Object.keys(lengthStyles)[Math.floor(Math.random() * Object.keys(lengthStyles).length)];
  
  // 🎯 ANGLE VARIATIONS
  const angleStyles = {
    personal: "Share from personal experience or observation",
    research: "Focus on studies, data, and evidence",
    practical: "Give actionable advice and steps",
    philosophical: "Explore deeper meanings and implications",
    controversial: "Challenge conventional wisdom"
  };
  
  const selectedAngle = angle || Object.keys(angleStyles)[Math.floor(Math.random() * Object.keys(angleStyles).length)];
  
  // 🎲 RANDOM TOPIC IF NONE PROVIDED
  const randomTopics = [
    'sleep patterns', 'gut health', 'exercise timing', 'stress response', 
    'nutrition timing', 'circadian rhythms', 'metabolic flexibility',
    'inflammation', 'hormone balance', 'recovery', 'focus', 'energy',
    'longevity', 'brain health', 'immune function', 'digestive health'
  ];
  
  const selectedTopic = topic || randomTopics[Math.floor(Math.random() * randomTopics.length)];
  
  // 🧠 DYNAMIC PROMPT (much simpler, more human)
  const systemPrompt = `You're a health enthusiast sharing interesting insights on Twitter. 

APPROACH: ${selectedApproach}
MOOD: ${selectedMood}
LENGTH: ${lengthStyles[selectedLength]}
ANGLE: ${angleStyles[selectedAngle]}
TOPIC: ${selectedTopic}

WRITE LIKE A HUMAN:
- Use natural, conversational language
- Vary your sentence structure
- Sometimes use questions, sometimes statements
- Be specific when you can, general when appropriate
- Sound like you're talking to a friend
- Don't follow rigid templates or formulas

FORMAT: ${format === 'thread' ? 'Create 3-4 connected tweets' : 'Single tweet'}

AVOID:
- Overly formal or academic tone
- Rigid structures or templates
- Generic health advice
- Too many technical terms
- Hashtags or excessive emojis

Just share something genuinely interesting about ${selectedTopic} in a natural, engaging way.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Share something interesting about ${selectedTopic}` }
        ],
        temperature: 0.8,
        max_tokens: format === 'thread' ? 800 : 200
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse thread content if needed
    let parsedContent: string | string[];
    if (format === 'thread' && content.includes('\n')) {
      parsedContent = content.split('\n').filter(line => line.trim().length > 0);
    } else {
      parsedContent = content;
    }
    
    return {
      content: parsedContent,
      format,
      style: `${selectedApproach}_${selectedMood}`,
      confidence: 0.85,
      metadata: {
        approach: selectedApproach,
        variety_score: Math.random() * 100,
        human_like: true
      }
    };
    
  } catch (error) {
    console.error('Dynamic content generation failed:', error);
    throw error;
  }
}

/**
 * 🎲 CHAOS INJECTOR
 * Randomly breaks patterns to create more variety
 */
export function injectContentChaos(content: string): string {
  const chaosInjections = [
    () => content.replace(/\./g, '...'), // Add trailing dots
    () => content.replace(/^/, 'Actually, '), // Add "Actually" prefix
    () => content.replace(/^/, 'Hot take: '), // Add "Hot take" prefix
    () => content.replace(/\?$/, ' Right?'), // Add "Right?" to questions
    () => content.replace(/\.$/, ' (seriously)'), // Add "(seriously)" to statements
    () => content.replace(/^/, 'Random thought: '), // Add "Random thought" prefix
    () => content.replace(/^/, 'This is wild: '), // Add "This is wild" prefix
    () => content.replace(/^/, 'Okay but '), // Add "Okay but" prefix
  ];
  
  // 20% chance to inject chaos
  if (Math.random() < 0.2) {
    const injection = chaosInjections[Math.floor(Math.random() * chaosInjections.length)];
    return injection();
  }
  
  return content;
}

/**
 * 🎭 STYLE ROTATOR
 * Ensures we don't repeat the same style patterns
 */
export class StyleRotator {
  private static usedStyles: string[] = [];
  private static maxHistory = 10;
  
  static getNextStyle(): string {
    const allStyles = [
      'casual_observation', 'quick_fact', 'personal_insight', 'research_find',
      'practical_tip', 'question_pondering', 'comparison_thought', 'mechanism_explanation',
      'myth_busting', 'future_prediction', 'historical_context', 'contrarian_take',
      'story_snippet', 'data_revelation', 'simple_reminder', 'curiosity_spark'
    ];
    
    // Remove recently used styles
    const availableStyles = allStyles.filter(style => !this.usedStyles.includes(style));
    
    // If all styles used recently, reset
    if (availableStyles.length === 0) {
      this.usedStyles = [];
      return allStyles[Math.floor(Math.random() * allStyles.length)];
    }
    
    const selectedStyle = availableStyles[Math.floor(Math.random() * availableStyles.length)];
    
    // Track usage
    this.usedStyles.push(selectedStyle);
    if (this.usedStyles.length > this.maxHistory) {
      this.usedStyles.shift();
    }
    
    return selectedStyle;
  }
}
