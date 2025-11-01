/**
 * VISUAL FORMAT APPLIER
 * 
 * Transforms raw content based on visual_format instructions
 * Applies Twitter-compatible formatting (bullets, spacing, emojis, emphasis)
 * 
 * NOTE: Formatting happens at POSTING time, not storage time
 * Database stores raw content + visual_format separately
 */

export interface FormattingResult {
  formatted: string;
  transformations: string[];
  original: string;
}

/**
 * Main function: Apply visual format to content
 */
export function applyVisualFormat(
  content: string,
  visualFormat: string | null | undefined
): FormattingResult {
  
  const transformations: string[] = [];
  let formatted = content;
  
  // If no visual format or standard format, return as-is
  if (!visualFormat || 
      visualFormat === 'standard' || 
      visualFormat === 'plain' ||
      visualFormat === 'paragraph' ||
      visualFormat.trim().length === 0) {
    return {
      formatted: content,
      transformations: ['none - plain text'],
      original: content
    };
  }
  
  const format = visualFormat.toLowerCase();
  
  // ═══════════════════════════════════════════════════════════
  // TRANSFORMATION 1: BULLET POINTS
  // ═══════════════════════════════════════════════════════════
  if (format.includes('bullet')) {
    // Convert numbered lists to bullets: "1)" → "•"
    const bulletRegex = /(\d+)\)\s*/g;
    if (bulletRegex.test(formatted)) {
      formatted = formatted.replace(bulletRegex, '• ');
      transformations.push('bullets');
      console.log('[VISUAL_FORMAT] ✅ Applied bullet points');
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // TRANSFORMATION 2: LINE BREAKS (spacing, readability)
  // ═══════════════════════════════════════════════════════════
  if (format.includes('line break') || 
      format.includes('spacing') || 
      format.includes('separate') ||
      format.includes('paragraph')) {
    
    // Add line breaks between sentences for readability
    // "Sentence one. Sentence two." → "Sentence one.\n\nSentence two."
    const hasMultipleSentences = (formatted.match(/[.!?]\s+[A-Z]/g) || []).length >= 1;
    
    if (hasMultipleSentences && !formatted.includes('\n')) {
      formatted = formatted.replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');
      transformations.push('line_breaks');
      console.log('[VISUAL_FORMAT] ✅ Applied line breaks');
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // TRANSFORMATION 3: EMOJI (strategic placement)
  // ═══════════════════════════════════════════════════════════
  if (format.includes('emoji')) {
    // Only add if content doesn't already have emoji
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    
    if (!emojiRegex.test(formatted)) {
      const emoji = extractEmojiFromFormat(visualFormat) || selectRelevantEmoji(formatted);
      
      if (emoji) {
        formatted = `${emoji} ${formatted}`;
        transformations.push(`emoji:${emoji}`);
        console.log(`[VISUAL_FORMAT] ✅ Added emoji: ${emoji}`);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // TRANSFORMATION 4: EMPHASIS (CAPS for key terms)
  // ═══════════════════════════════════════════════════════════
  if (format.includes('bold') || 
      format.includes('emphasis') || 
      format.includes('highlight')) {
    
    // Twitter doesn't support bold, use CAPS for first key term
    const keyTerm = extractKeyTermFromFormat(visualFormat) || extractFirstKeyTerm(formatted);
    
    if (keyTerm && keyTerm.length >= 4) {
      // Capitalize first occurrence only (don't overdo it)
      const regex = new RegExp(`\\b${keyTerm}\\b`, 'i');
      formatted = formatted.replace(regex, keyTerm.toUpperCase());
      transformations.push(`emphasis:${keyTerm}`);
      console.log(`[VISUAL_FORMAT] ✅ Emphasized: ${keyTerm}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // TRANSFORMATION 5: MYTH/TRUTH SPLIT
  // ═══════════════════════════════════════════════════════════
  if (format.includes('myth') && format.includes('truth')) {
    // Add emoji markers for myth vs truth
    formatted = formatted.replace(/Myth:/gi, '🚫 Myth:');
    formatted = formatted.replace(/Truth:/gi, '✅ Truth:');
    transformations.push('myth_truth_split');
    console.log('[VISUAL_FORMAT] ✅ Applied myth/truth markers');
  }
  
  console.log(`[VISUAL_FORMAT] 📊 Transformations applied: ${transformations.join(', ')}`);
  
  return {
    formatted,
    transformations,
    original: content
  };
}

/**
 * Extract emoji from visual format string
 * Example: "emoji:🔥" or "add 🔥 emoji"
 */
function extractEmojiFromFormat(visualFormat: string): string | null {
  // Check for emoji:X pattern
  const emojiPattern = /emoji:(\S+)/i;
  const match = visualFormat.match(emojiPattern);
  if (match) return match[1];
  
  // Check for actual emoji in the format string
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const emojiMatch = visualFormat.match(emojiRegex);
  if (emojiMatch) return emojiMatch[0];
  
  return null;
}

/**
 * Select relevant emoji based on content
 */
function selectRelevantEmoji(content: string): string | null {
  const lower = content.toLowerCase();
  
  // Health/wellness emojis (contextual)
  if (lower.includes('energy') || lower.includes('boost')) return '⚡';
  if (lower.includes('brain') || lower.includes('mental')) return '🧠';
  if (lower.includes('heart') || lower.includes('cardiovascular')) return '❤️';
  if (lower.includes('muscle') || lower.includes('strength')) return '💪';
  if (lower.includes('stress') || lower.includes('anxiety')) return '🧘';
  if (lower.includes('sleep') || lower.includes('rest')) return '😴';
  if (lower.includes('nutrition') || lower.includes('diet')) return '🥗';
  if (lower.includes('study') || lower.includes('research')) return '📊';
  if (lower.includes('myth') || lower.includes('debunk')) return '🚫';
  if (lower.includes('truth') || lower.includes('fact')) return '✅';
  if (lower.includes('warning') || lower.includes('danger')) return '⚠️';
  if (lower.includes('success') || lower.includes('win')) return '🎯';
  
  // Default: No emoji (plain text is fine!)
  return null;
}

/**
 * Extract key term to emphasize from visual format
 * Example: "bold:STRESS" or "emphasize mitochondria"
 */
function extractKeyTermFromFormat(visualFormat: string): string | null {
  // Check for bold:TERM pattern
  const boldPattern = /bold:(\w+)/i;
  const match = visualFormat.match(boldPattern);
  if (match) return match[1];
  
  // Check for "emphasize TERM" pattern
  const emphasisPattern = /emphasize[s]?\s+(\w+)/i;
  const emphMatch = visualFormat.match(emphasisPattern);
  if (emphMatch) return emphMatch[1];
  
  return null;
}

/**
 * Extract first key term from content (fallback)
 */
function extractFirstKeyTerm(content: string): string | null {
  // Health-related key terms worth emphasizing
  const keyTerms = [
    'mitochondrial', 'sirtuin', 'peptide', 'cortisol', 'dopamine',
    'fascia', 'microbiome', 'inflammation', 'autophagy', 'telomere',
    'metabolism', 'hormonal', 'circadian', 'epigenetic', 'resilience'
  ];
  
  const lower = content.toLowerCase();
  
  for (const term of keyTerms) {
    if (lower.includes(term)) {
      return term;
    }
  }
  
  return null;
}

/**
 * Quick preview of what formatting will do (for testing)
 */
export function previewFormatting(content: string, visualFormat: string): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎨 VISUAL FORMAT PREVIEW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📝 Original: "${content.substring(0, 100)}..."`);
  console.log(`🎨 Format: "${visualFormat}"`);
  
  const result = applyVisualFormat(content, visualFormat);
  
  console.log(`✨ Formatted: "${result.formatted.substring(0, 100)}..."`);
  console.log(`🔧 Applied: ${result.transformations.join(', ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

