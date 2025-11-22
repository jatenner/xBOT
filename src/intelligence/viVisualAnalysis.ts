/**
 * 🎨 VI VISUAL ANALYSIS - How Tweets Actually Look
 * 
 * Analyzes the ACTUAL visual appearance of tweets, not just text parsing
 * Understands:
 * - How tweets appear on screen (visual hierarchy, spacing, flow)
 * - Structural emojis (numbers, symbols, arrows - not just faces)
 * - Visual perception (what draws the eye, how it's scanned)
 * - Simple text vs enhanced visuals (emojis, formatting, structure)
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface VisualAppearanceAnalysis {
  tweet_id: string;
  
  // 🎨 VISUAL APPEARANCE (How it actually looks)
  visual_appearance: {
    overall_style: 'minimal' | 'enhanced' | 'highly_visual' | 'mixed';
    simplicity_score: number;          // 0-100 (100 = pure text, 0 = heavily enhanced)
    visual_complexity: number;         // 0-100 (how much visual elements)
    
    // Text appearance
    text_density: number;              // How dense is the text (chars per line)
    white_space_ratio: number;         // How much white space vs text
    line_break_strategy: string;       // How line breaks are used
    paragraph_flow: string;            // How paragraphs flow visually
    
    // Visual hierarchy (what draws eye first)
    first_visual_element: string;      // What you see first (number, emoji, word, caps)
    attention_flow: string[];          // Order of what draws attention
    focal_points: Array<{              // Where eye goes
      element: string;                 // Number, emoji, caps, bold claim
      position: number;                // Position in tweet (0-100)
      strength: number;                // How strong (0-100)
    }>;
    
    // Structural elements (non-text visual markers)
    structural_emojis: {               // Emojis used for structure
      numerical: string[];             // 1️⃣ 2️⃣ 3️⃣ (numbering)
      arrows: string[];                // → ← ↑ ↓ (direction)
      symbols: string[];               // ⚠️ ✅ ❌ (status)
      separators: string[];            // ➖ ➗ ✖️ (dividers)
      visual_breaks: string[];         // Emojis that create visual breaks
    };
    
    decorative_emojis: {               // Emojis used for decoration
      faces: string[];                 // 😊 😢 (emotional)
      objects: string[];               // 🔥 💡 (decorative)
      nature: string[];                // 🌱 🌊 (thematic)
    };
    
    emoji_function: {                  // How emojis function
      structural_count: number;        // Used for structure (numbers, arrows)
      decorative_count: number;        // Used for decoration (faces, objects)
      functional_count: number;        // Used for meaning (symbols, status)
      total_count: number;
      structural_ratio: number;        // Structural / total
    };
    
    // Typography & formatting
    text_emphasis: {
      caps_usage: 'none' | 'occasional' | 'frequent' | 'excessive';
      caps_words: string[];            // Which words are ALL CAPS
      number_highlighting: boolean;    // Are numbers visually distinct?
      bold_claims: string[];           // Bold/emphasized claims
      quote_usage: string;             // How quotes are used visually
    };
    
    // Visual structure
    visual_structure: {
      format_type: 'paragraph' | 'list' | 'single_line' | 'mixed' | 'thread_like';
      list_detected: boolean;          // Is it visually a list?
      list_markers: string[];          // • 1. - (how lists are marked)
      indentation_used: boolean;       // Is indentation used?
      alignment: 'left' | 'center' | 'mixed';
      symmetry: 'symmetrical' | 'asymmetrical' | 'intentional_asymmetry';
    };
    
    // Scanning patterns (how eye moves through it)
    scanning_pattern: {
      scannable: boolean;              // Can it be quickly scanned?
      scan_path: string[];             // What order eye scans (first to last)
      scan_time_estimate: number;      // Seconds to fully scan
      skimmable: boolean;              // Can key points be skimmed?
      key_points_visible: boolean;     // Are key points obvious visually?
    };
    
    // Visual perception
    visual_perception: {
      readability_visual: number;      // How easy to read (visual, not text complexity)
      scannability_visual: number;     // How easy to scan (visual)
      engagement_visual: number;       // How visually engaging
      professional_appearance: number; // How professional it looks
      attention_grabbing: number;      // How much it grabs attention visually
    };
  };
  
  // 📊 VISUAL ELEMENT ANALYSIS
  visual_elements: {
    numbers_used: Array<{              // How numbers appear visually
      number: string;
      position: number;
      emphasis: 'highlighted' | 'normal' | 'subtle';
      visual_impact: number;
    }>;
    
    emojis_used: Array<{               // Each emoji's visual role
      emoji: string;
      position: number;
      role: 'structural' | 'decorative' | 'functional' | 'separator';
      visual_weight: number;           // How much it draws attention
    }>;
    
    line_breaks_visual: Array<{        // How line breaks function visually
      position: number;
      purpose: 'paragraph' | 'emphasis' | 'list' | 'breath' | 'dramatic';
      visual_impact: number;
    }>;
    
    formatting_moments: Array<{        // Key visual formatting moments
      element: string;                 // What's formatted (number, caps, emoji)
      position: number;
      formatting_type: string;         // How it's formatted
      purpose: string;                 // Why it's formatted this way
    }>;
  };
  
  // 🎯 VISUAL RECOMMENDATIONS
  visual_recommendations: {
    should_enhance: boolean;           // Should we add visual elements?
    enhancement_type: 'none' | 'minimal' | 'moderate' | 'significant';
    suggested_improvements: Array<{
      element: string;                 // What to improve
      suggestion: string;              // How to improve it
      impact_estimate: number;         // Expected impact (0-100)
    }>;
    optimal_visual_style: string;      // What visual style works best for this content
  };
  
  analyzed_at: Date;
}

export class VIVisualAnalysis {
  private supabase = getSupabaseClient();
  
  /**
   * Analyze how a tweet actually looks visually
   */
  async analyzeVisualAppearance(tweet: any): Promise<VisualAppearanceAnalysis | null> {
    try {
      log({ op: 'vi_visual_analysis_start', tweet_id: tweet.tweet_id });
      
      // Extract visual elements from text
      const visualElements = this.extractVisualElements(tweet.text || tweet.content);
      
      // Build comprehensive visual analysis prompt
      const prompt = this.buildVisualAnalysisPrompt(tweet, visualElements);
      
      // Get AI-driven visual analysis
      const analysis = await this.getVisualAnalysis(tweet, prompt, visualElements);
      
      // Store in database
      await this.storeVisualAnalysis(tweet.tweet_id, analysis);
      
      log({ op: 'vi_visual_analysis_complete', tweet_id: tweet.tweet_id });
      
      return analysis;
      
    } catch (error: any) {
      log({ op: 'vi_visual_analysis_error', tweet_id: tweet.tweet_id, error: error.message });
      return null;
    }
  }
  
  /**
   * Extract visual elements from tweet text
   */
  private extractVisualElements(text: string): any {
    // Count line breaks
    const lineBreaks = (text.match(/\n/g) || []).length;
    const lines = text.split('\n');
    
    // Extract all emojis with positions
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;
    const allEmojis: Array<{ emoji: string; position: number }> = [];
    let match;
    const emojiRegex2 = new RegExp(emojiRegex.source, 'gu');
    while ((match = emojiRegex2.exec(text)) !== null) {
      allEmojis.push({ emoji: match[0], position: match.index });
    }
    
    // Categorize emojis
    const structuralEmojis = {
      numerical: allEmojis.filter(e => /[\u0031-\u0039]\uFE0F\u20E3|\u{1F51F}|[0-9]\u20E3/gu.test(e.emoji)), // 1️⃣ 2️⃣ etc
      arrows: allEmojis.filter(e => /[→←↑↓↗↘↙↖]/u.test(e.emoji)),
      symbols: allEmojis.filter(e => /[⚠️✅❌⚡🔔⭐]/u.test(e.emoji)),
      separators: allEmojis.filter(e => /[➖➗✖️➰]/u.test(e.emoji)),
      visual_breaks: [] as Array<{ emoji: string; position: number }>
    };
    
    // Decorative emojis (faces, objects)
    const decorativeEmojis = {
      faces: allEmojis.filter(e => /[\u{1F600}-\u{1F64F}]/u.test(e.emoji)),
      objects: allEmojis.filter(e => /[\u{1F300}-\u{1F5FF}]/u.test(e.emoji) && !structuralEmojis.symbols.includes(e)),
      nature: allEmojis.filter(e => /[\u{1F330}-\u{1F37F}]/u.test(e.emoji))
    };
    
    // Extract numbers
    const numberMatches = Array.from(text.matchAll(/\d+(?:\.\d+)?[%xXkmKM]?/g));
    const numbers = numberMatches.map(m => ({
      number: m[0],
      position: m.index || 0,
      emphasis: 'normal' as const,
      visual_impact: 0
    }));
    
    // Extract caps words
    const capsWords = Array.from(text.matchAll(/\b[A-Z]{2,}\b/g)).map(m => m[0]);
    
    // Detect list markers
    const listMarkers = Array.from(text.matchAll(/^[\s]*[•·\-\d+\.\)]\s/gm)).map(m => m[0].trim());
    
    return {
      lineBreaks,
      lines,
      allEmojis,
      structuralEmojis,
      decorativeEmojis,
      numbers,
      capsWords,
      listMarkers,
      textLength: text.length,
      charPerLine: text.length / Math.max(lines.length, 1)
    };
  }
  
  /**
   * Build visual analysis prompt
   */
  private buildVisualAnalysisPrompt(tweet: any, visualElements: any): string {
    const engagement_rate = tweet.engagement_rate || 0;
    const impressions = tweet.views || tweet.impressions || 0;
    const likes = tweet.likes || 0;
    
    return `You are an expert in visual design and how content APPEARS on Twitter, not just what it says.

Analyze this tweet for its VISUAL APPEARANCE and how it's perceived:

TWEET TEXT:
"""
${tweet.text || tweet.content}
"""

VISUAL ELEMENTS DETECTED:
- Line breaks: ${visualElements.lineBreaks}
- Total lines: ${visualElements.lines.length}
- Characters per line: ${visualElements.charPerLine.toFixed(0)}
- Structural emojis: ${visualElements.structuralEmojis.numerical.length + visualElements.structuralEmojis.arrows.length} (numbers, arrows, symbols)
- Decorative emojis: ${visualElements.decorativeEmojis.faces.length + visualElements.decorativeEmojis.objects.length} (faces, objects)
- Numbers found: ${visualElements.numbers.length}
- Caps words: ${visualElements.capsWords.length}
- List markers: ${visualElements.listMarkers.length}

PERFORMANCE:
- Engagement Rate: ${(engagement_rate * 100).toFixed(1)}%
- Impressions: ${impressions.toLocaleString()}
- Likes: ${likes}

ANALYSIS TASK:

1. VISUAL APPEARANCE (How it actually looks):
   - Overall style: Is it minimal (pure text), enhanced (some formatting), or highly visual (lots of elements)?
   - Simplicity score: 0-100 (100 = pure text, 0 = heavily enhanced)
   - Visual complexity: How many visual elements beyond text?
   - Text density: How dense is the text (chars per line)?
   - White space ratio: How much white space vs text?
   - Line break strategy: How are line breaks used? (paragraphs, emphasis, breathing room, lists)
   - Paragraph flow: How do paragraphs flow visually?

2. VISUAL HIERARCHY (What draws the eye first):
   - First visual element: What do you see first? (number, emoji, caps word, normal word)
   - Attention flow: In what order does your eye move through it?
   - Focal points: Where does the eye naturally go? (positions and strength)
   
3. STRUCTURAL EMOJIS (Emojis used for structure, not decoration):
   - Numerical: Are number emojis used (1️⃣ 2️⃣) for structure?
   - Arrows: Are arrows used (→ ← ↑ ↓) for direction/flow?
   - Symbols: Are symbols used (⚠️ ✅ ❌) for status/meaning?
   - Separators: Are emojis used as visual breaks/dividers?
   - Visual breaks: Which emojis create visual separation?
   
4. DECORATIVE EMOJIS (Emojis used for decoration):
   - Faces: Are face emojis used for emotion?
   - Objects: Are object emojis used for decoration?
   - Nature: Are nature emojis used for theme?
   
5. EMOJI FUNCTION (How emojis actually function):
   - Structural count: How many used for structure?
   - Decorative count: How many used for decoration?
   - Functional count: How many used for meaning?
   - Structural ratio: What % are structural vs decorative?
   
6. TYPOGRAPHY & FORMATTING (How text appears):
   - Caps usage: None, occasional, frequent, or excessive?
   - Which words are ALL CAPS?
   - Are numbers visually distinct/highlighted?
   - What claims are bold/emphasized visually?
   - How are quotes used visually?
   
7. VISUAL STRUCTURE (How it's structured):
   - Format type: Paragraph, list, single line, mixed, or thread-like?
   - Is it visually a list?
   - How are lists marked? (• 1. - etc)
   - Is indentation used?
   - Alignment: Left, center, or mixed?
   - Symmetry: Is it symmetrical or asymmetrical?
   
8. SCANNING PATTERNS (How eye moves through it):
   - Is it scannable? (Can it be quickly scanned?)
   - What's the scan path? (What order does eye scan)
   - How long to fully scan? (seconds estimate)
   - Is it skimmable? (Can key points be skimmed?)
   - Are key points obvious visually?
   
9. VISUAL PERCEPTION (How it's perceived):
   - Readability (visual): How easy to read visually? (0-100)
   - Scannability (visual): How easy to scan visually? (0-100)
   - Engagement (visual): How visually engaging? (0-100)
   - Professional appearance: How professional does it look? (0-100)
   - Attention grabbing: How much does it grab attention visually? (0-100)

10. VISUAL RECOMMENDATIONS:
    - Should we enhance it visually? (add emojis, formatting, structure)
    - What enhancement level? (none, minimal, moderate, significant)
    - What improvements would help? (specific visual suggestions)
    - What visual style works best for this content type?

Return JSON in this exact format:
{
  "visual_appearance": {
    "overall_style": "minimal|enhanced|highly_visual|mixed",
    "simplicity_score": number,
    "visual_complexity": number,
    "text_density": number,
    "white_space_ratio": number,
    "line_break_strategy": "string",
    "paragraph_flow": "string",
    "first_visual_element": "string",
    "attention_flow": ["string"],
    "focal_points": [{"element": "string", "position": number, "strength": number}],
    "structural_emojis": {
      "numerical": ["string"],
      "arrows": ["string"],
      "symbols": ["string"],
      "separators": ["string"],
      "visual_breaks": ["string"]
    },
    "decorative_emojis": {
      "faces": ["string"],
      "objects": ["string"],
      "nature": ["string"]
    },
    "emoji_function": {
      "structural_count": number,
      "decorative_count": number,
      "functional_count": number,
      "total_count": number,
      "structural_ratio": number
    },
    "text_emphasis": {
      "caps_usage": "none|occasional|frequent|excessive",
      "caps_words": ["string"],
      "number_highlighting": boolean,
      "bold_claims": ["string"],
      "quote_usage": "string"
    },
    "visual_structure": {
      "format_type": "paragraph|list|single_line|mixed|thread_like",
      "list_detected": boolean,
      "list_markers": ["string"],
      "indentation_used": boolean,
      "alignment": "left|center|mixed",
      "symmetry": "symmetrical|asymmetrical|intentional_asymmetry"
    },
    "scanning_pattern": {
      "scannable": boolean,
      "scan_path": ["string"],
      "scan_time_estimate": number,
      "skimmable": boolean,
      "key_points_visible": boolean
    },
    "visual_perception": {
      "readability_visual": number,
      "scannability_visual": number,
      "engagement_visual": number,
      "professional_appearance": number,
      "attention_grabbing": number
    }
  },
  "visual_elements": {
    "numbers_used": [{"number": "string", "position": number, "emphasis": "highlighted|normal|subtle", "visual_impact": number}],
    "emojis_used": [{"emoji": "string", "position": number, "role": "structural|decorative|functional|separator", "visual_weight": number}],
    "line_breaks_visual": [{"position": number, "purpose": "paragraph|emphasis|list|breath|dramatic", "visual_impact": number}],
    "formatting_moments": [{"element": "string", "position": number, "formatting_type": "string", "purpose": "string"}]
  },
  "visual_recommendations": {
    "should_enhance": boolean,
    "enhancement_type": "none|minimal|moderate|significant",
    "suggested_improvements": [{"element": "string", "suggestion": "string", "impact_estimate": number}],
    "optimal_visual_style": "string"
  }
}`;
  }
  
  /**
   * Get visual analysis from AI
   */
  private async getVisualAnalysis(
    tweet: any,
    prompt: string,
    visualElements: any
  ): Promise<VisualAppearanceAnalysis> {
    const response = await createBudgetedChatCompletion(
      [
        {
          role: 'system',
          content: `You are an expert in visual design and how content appears on social media platforms like Twitter.

You understand:
- Visual hierarchy (what draws the eye first)
- How people actually scan content (not just read)
- Structural vs decorative emojis (numbers, arrows vs faces, objects)
- Typography and formatting impact
- White space and spacing psychology
- How simple vs enhanced visuals affect perception

Analyze tweets from a VISUAL perspective - how they LOOK, not just what they SAY.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.2, // Lower for consistent analysis
        maxTokens: 4000,
        requestType: 'vi_visual_analysis',
        priority: 'high'
      }
    );
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }
    
    // Parse JSON response
    let analysis: any;
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        analysis = JSON.parse(content);
      }
    } catch (error) {
      console.warn('[VI_VISUAL] Failed to parse JSON, using fallback...', error);
      analysis = this.buildFallbackAnalysis(visualElements);
    }
    
    return {
      tweet_id: tweet.tweet_id,
      visual_appearance: analysis.visual_appearance || {},
      visual_elements: analysis.visual_elements || {},
      visual_recommendations: analysis.visual_recommendations || {},
      analyzed_at: new Date()
    };
  }
  
  /**
   * Build fallback analysis if AI fails
   */
  private buildFallbackAnalysis(visualElements: any): any {
    return {
      visual_appearance: {
        overall_style: visualElements.allEmojis.length > 2 ? 'enhanced' : 'minimal',
        simplicity_score: visualElements.allEmojis.length === 0 ? 100 : Math.max(0, 100 - visualElements.allEmojis.length * 10),
        visual_complexity: visualElements.allEmojis.length * 10,
        text_density: visualElements.charPerLine,
        white_space_ratio: visualElements.lineBreaks / Math.max(visualElements.lines.length, 1),
        line_break_strategy: visualElements.lineBreaks > 2 ? 'paragraph' : 'single',
        paragraph_flow: 'normal',
        first_visual_element: visualElements.numbers.length > 0 ? 'number' : 
                             visualElements.allEmojis.length > 0 ? 'emoji' : 'text',
        attention_flow: [],
        focal_points: [],
        structural_emojis: visualElements.structuralEmojis,
        decorative_emojis: visualElements.decorativeEmojis,
        emoji_function: {
          structural_count: visualElements.structuralEmojis.numerical.length + visualElements.structuralEmojis.arrows.length,
          decorative_count: visualElements.decorativeEmojis.faces.length + visualElements.decorativeEmojis.objects.length,
          functional_count: visualElements.structuralEmojis.symbols.length,
          total_count: visualElements.allEmojis.length,
          structural_ratio: visualElements.allEmojis.length > 0 ? 
            (visualElements.structuralEmojis.numerical.length + visualElements.structuralEmojis.arrows.length) / visualElements.allEmojis.length : 0
        },
        text_emphasis: {
          caps_usage: visualElements.capsWords.length === 0 ? 'none' : 
                     visualElements.capsWords.length < 2 ? 'occasional' : 'frequent',
          caps_words: visualElements.capsWords,
          number_highlighting: visualElements.numbers.length > 0,
          bold_claims: [],
          quote_usage: 'none'
        },
        visual_structure: {
          format_type: visualElements.listMarkers.length > 0 ? 'list' : 
                      visualElements.lineBreaks > 2 ? 'paragraph' : 'single_line',
          list_detected: visualElements.listMarkers.length > 0,
          list_markers: visualElements.listMarkers,
          indentation_used: false,
          alignment: 'left',
          symmetry: 'asymmetrical'
        },
        scanning_pattern: {
          scannable: visualElements.lineBreaks > 0,
          scan_path: [],
          scan_time_estimate: 2,
          skimmable: visualElements.listMarkers.length > 0,
          key_points_visible: visualElements.numbers.length > 0 || visualElements.allEmojis.length > 0
        },
        visual_perception: {
          readability_visual: 80,
          scannability_visual: 70,
          engagement_visual: 60,
          professional_appearance: 75,
          attention_grabbing: 50
        }
      },
      visual_elements: {
        numbers_used: visualElements.numbers,
        emojis_used: visualElements.allEmojis.map((e: any) => ({
          emoji: e.emoji,
          position: e.position,
          role: 'decorative' as const,
          visual_weight: 50
        })),
        line_breaks_visual: [],
        formatting_moments: []
      },
      visual_recommendations: {
        should_enhance: visualElements.allEmojis.length === 0 && visualElements.lineBreaks === 0,
        enhancement_type: 'minimal' as const,
        suggested_improvements: [],
        optimal_visual_style: 'clean and structured'
      }
    };
  }
  
  /**
   * Store visual analysis in database
   */
  private async storeVisualAnalysis(
    tweet_id: string,
    analysis: VisualAppearanceAnalysis
  ): Promise<void> {
    try {
      await this.supabase
        .from('vi_visual_appearance')
        .upsert({
          tweet_id,
          visual_appearance: analysis.visual_appearance,
          visual_elements: analysis.visual_elements,
          visual_recommendations: analysis.visual_recommendations,
          analyzed_at: analysis.analyzed_at.toISOString()
        }, {
          onConflict: 'tweet_id'
        });
      
      log({ op: 'vi_visual_stored', tweet_id });
    } catch (error: any) {
      log({ op: 'vi_visual_store_error', tweet_id, error: error.message });
      throw error;
    }
  }
  
  /**
   * Process tweets for visual analysis
   */
  async processForVisualAnalysis(): Promise<number> {
    log({ op: 'vi_visual_process_start' });
    
    // Get classified tweets that haven't been visually analyzed
    const { data: tweets } = await this.supabase
      .from('vi_collected_tweets')
      .select('*')
      .eq('classified', true)
      .eq('visually_analyzed', false)
      .order('engagement_rate', { ascending: false })
      .limit(50);
    
    if (!tweets || tweets.length === 0) {
      log({ op: 'vi_visual_no_work' });
      return 0;
    }
    
    log({ op: 'vi_visual_processing', count: tweets.length });
    
    let analyzed = 0;
    for (const tweet of tweets) {
      try {
        await this.analyzeVisualAppearance(tweet);
        
        // Mark as visually analyzed
        await this.supabase
          .from('vi_collected_tweets')
          .update({ visually_analyzed: true })
          .eq('tweet_id', tweet.tweet_id);
        
        analyzed++;
        await this.sleep(300); // Rate limiting
        
      } catch (error: any) {
        log({ op: 'vi_visual_error', tweet_id: tweet.tweet_id, error: error.message });
      }
    }
    
    log({ op: 'vi_visual_complete', analyzed });
    return analyzed;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

