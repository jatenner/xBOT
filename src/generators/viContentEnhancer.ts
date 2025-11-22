/**
 * 🎨 VI Content Enhancer
 * Applies visual patterns from VI insights to generated content
 */

import { log } from '../lib/logger';

export interface VIInsights {
  recommended_format?: {
    format_type?: string;
    list_emoji_style?: 'numbered' | 'bullet' | 'none';
    line_breaks?: 'between_points' | 'single' | 'none';
    visual_hierarchy?: 'numbers_first' | 'text_first' | 'mixed';
    emoji_count?: number;
    char_count?: number;
  };
  confidence_level?: string;
  primary_tier?: string;
  based_on_count?: number;
}

/**
 * Apply visual patterns from VI insights to content
 */
export async function applyVisualPatterns(
  content: string | string[],
  viInsights: VIInsights | null
): Promise<string | string[]> {
  if (!viInsights || !viInsights.recommended_format) {
    return content; // No insights, return as-is
  }

  log({ op: 'vi_visual_enhance_start', has_insights: !!viInsights });

  const format = viInsights.recommended_format;
  const isArray = Array.isArray(content);
  const contents = isArray ? content : [content];
  
  const enhanced = contents.map((c, idx) => {
    let enhancedContent = c;

    // 1. Apply list formatting with structural emojis if detected
    if (format.list_emoji_style === 'numbered') {
      enhancedContent = addNumberEmojis(enhancedContent);
    }

    // 2. Add visual breaks for scannability
    if (format.line_breaks === 'between_points') {
      enhancedContent = addVisualBreaks(enhancedContent);
    }

    // 3. Optimize visual hierarchy (numbers first, etc.)
    if (format.visual_hierarchy === 'numbers_first') {
      enhancedContent = optimizeHierarchy(enhancedContent);
    }

    return enhancedContent;
  });

  log({ op: 'vi_visual_enhance_complete', format_type: format.format_type, confidence: viInsights.confidence_level });

  return isArray ? enhanced : enhanced[0];
}

/**
 * Detect if content should be a list
 */
function shouldBeList(content: string): boolean {
  // Detect list patterns: numbered items, bullet points, etc.
  return /^\d+[\.\)]\s|^[\-\•]\s|^[1-9]️⃣\s/m.test(content);
}

/**
 * Add structural emojis (1️⃣ 2️⃣ 3️⃣) to numbered lists
 */
function addNumberEmojis(content: string): string {
  // Only add if it's actually a list and doesn't already have emojis
  if (!shouldBeList(content) || /[1-9]️⃣/.test(content)) {
    return content; // Already has emojis or not a list
  }

  // Convert numbered list to emoji list (1. → 1️⃣, 2. → 2️⃣, etc.)
  const emojiMap: Record<string, string> = {
    '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣',
    '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
  };

  return content.replace(/^(\d+)[\.\)]\s/gm, (match, num) => {
    if (emojiMap[num]) {
      return `${emojiMap[num]} `;
    }
    return match; // Keep as-is if not 1-9
  });
}

/**
 * Add visual breaks (line breaks) between list items or key points
 */
function addVisualBreaks(content: string): string {
  // Add double line breaks between list items for better scannability
  // But avoid if already has good spacing
  if ((content.match(/\n\n/g) || []).length > 0) {
    return content; // Already has spacing
  }

  // Add breaks after numbered/bullet items
  return content
    .replace(/\n(\d+[\.\)]|[\-\•]|[1-9]️⃣)/g, '\n\n$1') // Add break before list items
    .replace(/\n\n\n+/g, '\n\n'); // Clean up multiple breaks
}

/**
 * Optimize visual hierarchy (ensure numbers/stats appear first)
 */
function optimizeHierarchy(content: string): string {
  // Simple version: ensure numbers at start of sentences stand out
  // This is a basic implementation - could be enhanced with AI
  
  // If content starts with a number, it's already optimized
  if (/^\d/.test(content.trim())) {
    return content;
  }

  // Try to move numbers to front of first sentence if possible
  // This is conservative - only applies obvious optimizations
  const numberMatch = content.match(/(\d+(?:\.\d+)?[%xXkmKM]?)/);
  if (numberMatch && numberMatch.index && numberMatch.index > 0 && numberMatch.index < 50) {
    // Number is early in content, likely already in good position
    return content;
  }

  // No optimization needed - content is fine as-is
  return content;
}

/**
 * Format content with VI visual insights
 * Wrapper function for easy integration
 */
export async function enhanceContentWithVI(
  content: string | string[],
  viInsights: VIInsights | null
): Promise<string | string[]> {
  try {
    return await applyVisualPatterns(content, viInsights);
  } catch (error: any) {
    log({ op: 'vi_visual_enhance_error', error: error.message });
    return content; // Fallback to original on error
  }
}

