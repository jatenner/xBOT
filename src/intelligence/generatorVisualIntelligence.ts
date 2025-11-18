/**
 * 🎨 GENERATOR-SPECIFIC VISUAL INTELLIGENCE
 * 
 * Analyzes visual formatting patterns from posted tweets by generator
 * Provides generator-specific recommendations for visual formatting
 * 
 * Example: "NewsReporter performs best with 0-1 line breaks, no emojis, stat hooks"
 */

import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';

export interface GeneratorVisualPatterns {
  generator: string;
  optimalLineBreaks: number | null;
  optimalEmojiCount: number | null;
  optimalCharCount: number | null;
  optimalHookType: string | null;
  topFormats: Array<{ format: string; avgER: number; count: number }>;
  spacingPatterns: Array<{ pattern: string; avgER: number; count: number }>;
  // 🆕 Content structure and style patterns
  contentStructurePatterns: Array<{ pattern: string; description: string; avgER: number; count: number; examples: string[] }>;
  styleElements: Array<{ element: string; avgER: number; count: number; examples: string[] }>;
  sampleCount: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Get generator-specific visual patterns from posted tweets
 */
export async function getGeneratorVisualPatterns(
  generator: string
): Promise<GeneratorVisualPatterns | null> {
  log({ op: 'generator_vi_query', generator });
  
  const supabase = getSupabaseClient();
  
  // Query posted tweets for this generator
  const { data: posts, error } = await supabase
    .from('content_metadata')
    .select('content, visual_format, actual_engagement_rate, actual_impressions, posted_at')
    .eq('generator_name', generator)
    .eq('status', 'posted')
    .not('actual_engagement_rate', 'is', null)
    .gt('actual_impressions', 0)
    .order('posted_at', { ascending: false })
    .limit(100); // Last 100 posts for this generator
  
  if (error) {
    log({ op: 'generator_vi_error', generator, error: error.message });
    return null;
  }
  
  if (!posts || posts.length < 5) {
    log({ op: 'generator_vi_insufficient_data', generator, count: posts?.length || 0 });
    return null; // Need at least 5 posts to analyze
  }
  
  // Analyze visual patterns
  const patterns = analyzeVisualPatterns(posts, generator);
  
  log({ 
    op: 'generator_vi_found', 
    generator, 
    sample_count: patterns.sampleCount,
    confidence: patterns.confidence
  });
  
  return patterns;
}

/**
 * Analyze visual patterns from posts
 */
function analyzeVisualPatterns(
  posts: any[],
  generator: string
): GeneratorVisualPatterns {
  // Extract visual patterns from visual_format field
  // visual_format is a string describing the formatting approach
  
  // Group by visual format
  const formatGroups: Record<string, { posts: any[]; totalER: number }> = {};
  
  // Analyze spacing patterns (count line breaks in content)
  const spacingGroups: Record<string, { posts: any[]; totalER: number }> = {};
  
  // 🆕 Analyze content structure and style patterns
  const structureGroups: Record<string, { posts: any[]; totalER: number; examples: string[] }> = {};
  const styleGroups: Record<string, { posts: any[]; totalER: number; examples: string[] }> = {};
  
  posts.forEach(post => {
    const format = post.visual_format || 'unknown';
    const er = Number(post.actual_engagement_rate) || 0;
    
    // Group by format
    if (!formatGroups[format]) {
      formatGroups[format] = { posts: [], totalER: 0 };
    }
    formatGroups[format].posts.push(post);
    formatGroups[format].totalER += er;
    
    // Analyze spacing (count line breaks in content)
    const lineBreaks = (post.content?.match(/\n\n/g) || []).length;
    const spacingKey = lineBreaks === 0 ? 'compact' 
      : lineBreaks === 1 ? 'single_break'
      : lineBreaks === 2 ? 'double_break'
      : 'multi_break';
    
    if (!spacingGroups[spacingKey]) {
      spacingGroups[spacingKey] = { posts: [], totalER: 0 };
    }
    spacingGroups[spacingKey].posts.push(post);
    spacingGroups[spacingKey].totalER += er;
    
    // 🆕 Analyze content structure patterns
    const structurePattern = detectContentStructure(post.content);
    if (structurePattern) {
      if (!structureGroups[structurePattern.type]) {
        structureGroups[structurePattern.type] = { posts: [], totalER: 0, examples: [] };
      }
      structureGroups[structurePattern.type].posts.push(post);
      structureGroups[structurePattern.type].totalER += er;
      // Store example (first 100 chars)
      if (structureGroups[structurePattern.type].examples.length < 3) {
        structureGroups[structurePattern.type].examples.push(
          post.content.substring(0, 100) + '...'
        );
      }
    }
    
    // 🆕 Analyze style elements
    const styleElements = detectStyleElements(post.content);
    styleElements.forEach(element => {
      if (!styleGroups[element]) {
        styleGroups[element] = { posts: [], totalER: 0, examples: [] };
      }
      styleGroups[element].posts.push(post);
      styleGroups[element].totalER += er;
      // Store example
      if (styleGroups[element].examples.length < 2) {
        styleGroups[element].examples.push(
          post.content.substring(0, 80) + '...'
        );
      }
    });
  });
  
  // Calculate average ER for each format
  const topFormats = Object.entries(formatGroups)
    .map(([format, data]) => ({
      format,
      avgER: data.totalER / data.posts.length,
      count: data.posts.length
    }))
    .filter(f => f.count >= 2) // At least 2 uses
    .sort((a, b) => b.avgER - a.avgER)
    .slice(0, 5); // Top 5 formats
  
  // Calculate average ER for spacing patterns
  const spacingPatterns = Object.entries(spacingGroups)
    .map(([pattern, data]) => ({
      pattern,
      avgER: data.totalER / data.posts.length,
      count: data.posts.length
    }))
    .filter(s => s.count >= 2)
    .sort((a, b) => b.avgER - a.avgER);
  
  // Find optimal spacing (highest ER)
  const optimalSpacing = spacingPatterns.length > 0 
    ? spacingPatterns[0] 
    : null;
  
  // Map spacing pattern to line breaks
  const spacingToLineBreaks: Record<string, number> = {
    'compact': 0,
    'single_break': 1,
    'double_break': 2,
    'multi_break': 3
  };
  
  const optimalLineBreaks = optimalSpacing 
    ? spacingToLineBreaks[optimalSpacing.pattern] ?? null
    : null;
  
  // Analyze emoji usage (count emojis in content)
  const emojiGroups: Record<number, { posts: any[]; totalER: number }> = {};
  posts.forEach(post => {
    const emojiCount = (post.content?.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (!emojiGroups[emojiCount]) {
      emojiGroups[emojiCount] = { posts: [], totalER: 0 };
    }
    emojiGroups[emojiCount].posts.push(post);
    emojiGroups[emojiCount].totalER += Number(post.actual_engagement_rate) || 0;
  });
  
  const optimalEmojiCount = Object.entries(emojiGroups)
    .map(([count, data]) => ({
      count: parseInt(count),
      avgER: data.totalER / data.posts.length,
      uses: data.posts.length
    }))
    .filter(e => e.uses >= 2)
    .sort((a, b) => b.avgER - a.avgER)[0]?.count ?? null;
  
  // Analyze character count
  const charGroups: Record<string, { posts: any[]; totalER: number }> = {};
  posts.forEach(post => {
    const charCount = post.content?.length || 0;
    const charRange = charCount < 150 ? 'short'
      : charCount < 200 ? 'medium'
      : charCount < 250 ? 'long'
      : 'very_long';
    
    if (!charGroups[charRange]) {
      charGroups[charRange] = { posts: [], totalER: 0 };
    }
    charGroups[charRange].posts.push(post);
    charGroups[charRange].totalER += Number(post.actual_engagement_rate) || 0;
  });
  
  const optimalCharCount = Object.entries(charGroups)
    .map(([range, data]) => ({
      range,
      avgER: data.totalER / data.posts.length,
      uses: data.posts.length,
      estimatedChars: range === 'short' ? 125 : range === 'medium' ? 175 : range === 'long' ? 225 : 275
    }))
    .filter(c => c.uses >= 2)
    .sort((a, b) => b.avgER - a.avgER)[0]?.estimatedChars ?? null;
  
  // 🆕 Calculate content structure patterns
  const contentStructurePatterns = Object.entries(structureGroups)
    .map(([type, data]) => ({
      pattern: type,
      description: getStructureDescription(type),
      avgER: data.totalER / data.posts.length,
      count: data.posts.length,
      examples: data.examples
    }))
    .filter(s => s.count >= 2)
    .sort((a, b) => b.avgER - a.avgER)
    .slice(0, 5); // Top 5 structure patterns
  
  // 🆕 Calculate style elements
  const styleElements = Object.entries(styleGroups)
    .map(([element, data]) => ({
      element,
      avgER: data.totalER / data.posts.length,
      count: data.posts.length,
      examples: data.examples
    }))
    .filter(s => s.count >= 2)
    .sort((a, b) => b.avgER - a.avgER)
    .slice(0, 5); // Top 5 style elements
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (posts.length >= 20 && topFormats.length >= 3) {
    confidence = 'high';
  } else if (posts.length >= 10 && topFormats.length >= 2) {
    confidence = 'medium';
  }
  
  return {
    generator,
    optimalLineBreaks,
    optimalEmojiCount,
    optimalCharCount,
    optimalHookType: null, // Would need hook_type field in content_metadata
    topFormats,
    spacingPatterns: spacingPatterns.map(s => ({
      pattern: s.pattern,
      avgER: s.avgER,
      count: s.count
    })),
    contentStructurePatterns,
    styleElements,
    sampleCount: posts.length,
    confidence
  };
}

/**
 * 🆕 Detect content structure patterns
 */
function detectContentStructure(content: string): { type: string } | null {
  const lower = content.toLowerCase();
  const first50 = content.substring(0, 50).toLowerCase();
  
  // News-style patterns
  if (first50.match(/^(new study|breaking|just published|recent research|latest findings|new research)/i)) {
    return { type: 'news_headline' };
  }
  if (first50.match(/^(study shows|research finds|data reveals|evidence suggests)/i)) {
    return { type: 'news_data_lead' };
  }
  
  // Quote patterns
  if (content.match(/^["'"]/)) {
    return { type: 'quote_opener' };
  }
  if (lower.match(/^(as|according to|as the saying goes|as.*once said)/)) {
    return { type: 'quote_reference' };
  }
  
  // Historical context patterns
  if (lower.match(/^(we used to think|historically|in the past|traditionally|for centuries)/)) {
    return { type: 'historical_context' };
  }
  if (lower.match(/^(evolution|how.*changed|shift from|transition)/)) {
    return { type: 'evolution_narrative' };
  }
  
  // Coach/action patterns
  if (content.match(/^\d+\./)) {
    return { type: 'numbered_steps' };
  }
  if (lower.match(/^(do this|try this|here's how|step 1|first,|then,)/)) {
    return { type: 'action_instructions' };
  }
  if (lower.match(/^(daily practice|routine|protocol|system)/)) {
    return { type: 'practice_protocol' };
  }
  
  // Story patterns
  if (lower.match(/^(i remember|once|when i|story|narrative)/)) {
    return { type: 'story_narrative' };
  }
  if (lower.match(/^(imagine|picture this|think about)/)) {
    return { type: 'story_scene' };
  }
  
  // Myth-busting patterns
  if (lower.match(/^(myth:|the myth|common myth|popular belief)/)) {
    return { type: 'myth_bust' };
  }
  if (lower.match(/^(truth:|reality:|actually|in truth)/)) {
    return { type: 'truth_statement' };
  }
  
  // Data/stat patterns
  if (content.match(/^\d+%/) || first50.match(/^\d+ (out of|in|per)/)) {
    return { type: 'stat_opener' };
  }
  if (lower.match(/^(according to|data shows|statistics|research indicates)/)) {
    return { type: 'data_citation' };
  }
  
  return null;
}

/**
 * 🆕 Detect style elements
 */
function detectStyleElements(content: string): string[] {
  const elements: string[] = [];
  const lower = content.toLowerCase();
  
  // News language
  if (lower.match(/(breaking|just published|new study|latest|recent findings)/)) {
    elements.push('news_language');
  }
  
  // Historical language
  if (lower.match(/(historically|traditionally|ancient|centuries ago|we used to)/)) {
    elements.push('historical_language');
  }
  
  // Quote marks or references
  if (content.match(/["'"]/) || lower.match(/(as.*said|quote|according to)/)) {
    elements.push('quote_style');
  }
  
  // Action/command language
  if (lower.match(/(do this|try this|start|stop|avoid|focus on)/)) {
    elements.push('action_language');
  }
  
  // Story language
  if (lower.match(/(imagine|picture|story|narrative|once upon)/)) {
    elements.push('story_language');
  }
  
  // Scientific language
  if (lower.match(/(study|research|data|evidence|findings|published)/)) {
    elements.push('scientific_language');
  }
  
  // Personal language
  if (lower.match(/(i|my|me|personally|in my experience)/)) {
    elements.push('personal_language');
  }
  
  return elements;
}

/**
 * 🆕 Get structure description
 */
function getStructureDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'news_headline': 'News headline style: "NEW STUDY:", "BREAKING:", "JUST PUBLISHED:"',
    'news_data_lead': 'News data lead: "Study shows", "Research finds", "Data reveals"',
    'quote_opener': 'Quote at the top: Opens with quoted text',
    'quote_reference': 'Quote reference: "As X once said", "According to..."',
    'historical_context': 'Historical context: "We used to think", "Historically", "In the past"',
    'evolution_narrative': 'Evolution narrative: "How X changed", "Shift from...to"',
    'numbered_steps': 'Numbered steps: "1.", "2.", "3." format',
    'action_instructions': 'Action instructions: "Do this", "Try this", "Here\'s how"',
    'practice_protocol': 'Practice protocol: "Daily practice", "Routine", "System"',
    'story_narrative': 'Story narrative: "I remember", "Once", "When I"',
    'story_scene': 'Story scene: "Imagine", "Picture this", "Think about"',
    'myth_bust': 'Myth-busting: "Myth:", "The myth", "Common myth"',
    'truth_statement': 'Truth statement: "Truth:", "Reality:", "Actually"',
    'stat_opener': 'Stat opener: Opens with percentage or number',
    'data_citation': 'Data citation: "According to", "Data shows", "Research indicates"'
  };
  
  return descriptions[type] || type;
}

/**
 * Get generator-specific visual formatting recommendations
 * Returns formatted string for use in prompts
 */
export async function getGeneratorVisualRecommendations(
  generator: string
): Promise<string> {
  const patterns = await getGeneratorVisualPatterns(generator);
  
  if (!patterns) {
    return ''; // No data available
  }
  
  const recommendations: string[] = [];
  
  if (patterns.optimalLineBreaks !== null) {
    recommendations.push(
      `SPACING: This generator performs best with ${patterns.optimalLineBreaks} line breaks. ` +
      `Posts with this spacing have ${(patterns.spacingPatterns[0]?.avgER || 0).toFixed(3)} avg engagement rate.`
    );
  }
  
  if (patterns.optimalEmojiCount !== null) {
    recommendations.push(
      `EMOJIS: This generator performs best with ${patterns.optimalEmojiCount} emoji. ` +
      `Keep emoji usage minimal and purposeful.`
    );
  }
  
  if (patterns.optimalCharCount !== null) {
    recommendations.push(
      `LENGTH: This generator performs best around ${patterns.optimalCharCount} characters. ` +
      `This length balances completeness with scannability.`
    );
  }
  
  if (patterns.topFormats.length > 0) {
    const topFormat = patterns.topFormats[0];
    recommendations.push(
      `FORMAT: Top-performing format for this generator: "${topFormat.format.substring(0, 60)}..." ` +
      `(${(topFormat.avgER * 100).toFixed(1)}% avg ER, ${topFormat.count} uses)`
    );
  }
  
  // 🆕 Add content structure recommendations (LEARNED, NOT HARDCODED)
  if (patterns.contentStructurePatterns.length > 0) {
    const topStructure = patterns.contentStructurePatterns[0];
    recommendations.push(
      `LEARNED STRUCTURE PATTERN: Based on ${topStructure.count} successful posts, this generator's content performs best when structured as: ${topStructure.description} ` +
      `(${(topStructure.avgER * 100).toFixed(1)}% avg ER). This is what Twitter's algorithm has rewarded for this generator.`
    );
    
    // Add example if available
    if (topStructure.examples.length > 0) {
      recommendations.push(
        `  Real example from your posts: "${topStructure.examples[0]}"`
      );
    }
  }
  
  // 🆕 Add style element recommendations (LEARNED, NOT HARDCODED)
  if (patterns.styleElements.length > 0) {
    const topStyle = patterns.styleElements[0];
    recommendations.push(
      `LEARNED STYLE PATTERN: Based on ${topStyle.count} successful posts, this generator performs best when using ${topStyle.element.replace('_', ' ')} ` +
      `(${(topStyle.avgER * 100).toFixed(1)}% avg ER). This is what Twitter's audience responds to for this generator.`
    );
    
    // Add example if available
    if (topStyle.examples.length > 0) {
      recommendations.push(
        `  Real example from your posts: "${topStyle.examples[0]}"`
      );
    }
  }
  
  if (recommendations.length === 0) {
    return ''; // No specific recommendations
  }
  
  return `
🎯 GENERATOR-SPECIFIC VISUAL INTELLIGENCE (${patterns.confidence} confidence, ${patterns.sampleCount} samples):
${recommendations.map(r => `• ${r}`).join('\n')}

🧠 INTELLIGENT FORMATTING GUIDANCE:
These are LEARNED patterns from your actual posted tweets, not hardcoded rules.
The system analyzed what Twitter's algorithm and audience rewarded for THIS generator.
Use these as intelligent guidance - understand WHY they work, then apply that understanding creatively.
Don't copy patterns blindly - understand the Twitter platform context and apply intelligently.
`;
}

