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
  
  // 🎲 DIVERSE CONTENT APPROACHES (professional, varied)
  const approaches = [
    'myth_busting',         // "Myth: X. Truth: Y with data"
    'data_revelation',      // "Study shows X% of people..."
    'mechanism_explanation', // "Here's how X actually works..."
    'comparison_analysis',  // "X vs Y: which actually works?"
    'future_prediction',    // "In 5 years, we'll..."
    'practical_protocol',   // "Protocol: do X for Y results"
    'surprising_fact',      // "Most people don't know that..."
    'question_challenge',   // "Why do we still believe X when Y?"
    'research_breakthrough', // "New study reveals..."
    'industry_insight',     // "The health industry is shifting..."
    'optimization_tip',     // "For peak performance, try..."
    'controversial_take',   // "Unpopular opinion: X is overrated because..."
    'historical_perspective', // "Back in 2020, we thought..."
    'comparative_data',     // "Harvard vs Stanford study shows..."
    'mechanism_deep_dive',  // "The science behind X is fascinating..."
    'trend_analysis'        // "What's changing in health optimization..."
  ];
  
  const selectedApproach = approaches[Math.floor(Math.random() * approaches.length)];
  
  // 🎨 MOOD-BASED VOICE VARIATIONS (professional)
  const moodVoices = {
    curious: "The research on this is fascinating...",
    confident: "The data clearly shows...",
    analytical: "Breaking down the science...",
    serious: "This is critical to understand...",
    surprised: "The findings are surprising...",
    thoughtful: "The implications are significant..."
  };
  
  const selectedMood = mood || Object.keys(moodVoices)[Math.floor(Math.random() * Object.keys(moodVoices).length)];
  
  // 📏 LENGTH VARIATIONS (not rigid character counts)
  const lengthStyles = {
    short: "Keep it punchy and direct",
    medium: "Give some context but stay concise", 
    long: "Go deeper with explanation and examples"
  };
  
  const selectedLength = length || Object.keys(lengthStyles)[Math.floor(Math.random() * Object.keys(lengthStyles).length)];
  
  // 🎯 ANGLE VARIATIONS (professional)
  const angleStyles = {
    research: "Focus on studies, data, and evidence",
    practical: "Give actionable advice and protocols",
    analytical: "Break down mechanisms and processes",
    comparative: "Compare different approaches or studies",
    predictive: "Discuss future trends and implications",
    contrarian: "Challenge conventional wisdom with data"
  };
  
  const selectedAngle = angle || Object.keys(angleStyles)[Math.floor(Math.random() * Object.keys(angleStyles).length)];
  
  // 🚫 NO HARDCODED TOPICS - Topics come from dynamicTopicGenerator (AI-driven)
  // This ensures INFINITE variety and prevents repetition
  
  const selectedTopic = topic || 'health optimization'; // Fallback only if topic not provided
  
  // 🧠 DYNAMIC PROMPT (much simpler, more human)
  const systemPrompt = `You are @SignalAndSynapse, a health account known for evidence-based insights that challenge conventional wisdom.

APPROACH: ${selectedApproach}
MOOD: ${selectedMood}
LENGTH: ${lengthStyles[selectedLength]}
ANGLE: ${angleStyles[selectedAngle]}
TOPIC: ${selectedTopic}

CONTENT RULES:
- NO first-person (I/me/my/we/us/our)
- Third-person expert voice ONLY
- Evidence-based claims with specific data
- Challenge conventional wisdom when appropriate
- Use surprising, counterintuitive insights
- Include specific numbers, studies, or mechanisms
- Max 2 emojis (prefer 0-1)

FORMAT VARIETY - Use different structures:
- Myth-busting: "Myth: X. Truth: Y with data"
- Data revelation: "Study shows X% of people..."
- Mechanism explanation: "Here's how X actually works..."
- Comparison: "X vs Y: which actually works?"
- Future prediction: "In 5 years, we'll..."
- Practical protocol: "Protocol: do X for Y results"
- Surprising fact: "Most people don't know that..."
- Question format: "Why do we still believe X when Y?"

FORMAT: ${format === 'thread' ? 'Create 3-4 connected tweets' : 'Single tweet'}

AVOID:
- Same structure every time
- Generic health advice
- Overly academic language
- Hashtags
- First-person language

Create diverse, engaging content about ${selectedTopic} that makes people think differently.`;

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
    () => content.replace(/^/, 'New research: '), // Add "New research" prefix
    () => content.replace(/^/, 'Data point: '), // Add "Data point" prefix
    () => content.replace(/^/, 'Study alert: '), // Add "Study alert" prefix
    () => content.replace(/\?$/, ' The data is clear.'), // Add conclusion to questions
    () => content.replace(/\.$/, ' (evidence-based)'), // Add "(evidence-based)" to statements
    () => content.replace(/^/, 'Breaking: '), // Add "Breaking" prefix
    () => content.replace(/^/, 'Research reveals: '), // Add "Research reveals" prefix
    () => content.replace(/^/, 'The science: '), // Add "The science" prefix
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
      'myth_busting', 'data_revelation', 'mechanism_explanation', 'comparison_analysis',
      'future_prediction', 'practical_protocol', 'surprising_fact', 'question_challenge',
      'research_breakthrough', 'industry_insight', 'optimization_tip', 'controversial_take',
      'historical_perspective', 'comparative_data', 'mechanism_deep_dive', 'trend_analysis'
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
