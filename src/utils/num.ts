/**
 * Parse social media numbers like "1.2K", "3M", "456" to actual numbers
 */
export function parseNum(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  const cleaned = text.trim().replace(/,/g, '');
  
  // Handle simple numbers first
  const simpleNum = parseFloat(cleaned);
  if (!isNaN(simpleNum) && !cleaned.match(/[KMB]$/i)) {
    return Math.floor(simpleNum);
  }
  
  // Handle K, M, B suffixes
  const match = cleaned.match(/^([\d,.]+)([KMB])$/i);
  if (!match) return 0;
  
  const [, numStr, suffix] = match;
  const baseNum = parseFloat(numStr.replace(/,/g, ''));
  
  if (isNaN(baseNum)) return 0;
  
  switch (suffix.toUpperCase()) {
    case 'K': return Math.floor(baseNum * 1000);
    case 'M': return Math.floor(baseNum * 1000000);
    case 'B': return Math.floor(baseNum * 1000000000);
    default: return Math.floor(baseNum);
  }
}

/**
 * Extract first number from text that might contain multiple metrics
 */
export function extractFirstNum(text: string): number {
  if (!text) return 0;
  
  // Look for patterns like "1.2K views", "456 likes", etc.
  const patterns = [
    /(\d+(?:\.\d+)?[KMB]?)\s*(?:views?|likes?|replies?|bookmarks?|retweets?)/i,
    /(\d+(?:\.\d+)?[KMB]?)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseNum(match[1]);
    }
  }
  
  return 0;
}