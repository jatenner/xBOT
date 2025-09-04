/**
 * Text sanitization utilities for removing Markdown and normalizing content
 */

export function stripFormatting(input: string): string {
  return input
    .replace(/^#{1,6}\s+/gm, '')           // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/\*(.+?)\*/g, '$1')           // italics
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // code
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')  // links
    .replace(/[""]/g, '"')                 // smart quotes
    .replace(/['']/g, "'")                 // smart apostrophes
    .replace(/\u2026/g, '...')             // single char ellipsis → 3 dots for checks
    .replace(/\n{3,}/g, '\n\n')            // multiple newlines
    .replace(/\s+/g, ' ')                  // normalize whitespace
    .trim();
}

export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function validateTweetText(text: string): { valid: boolean; reason?: string } {
  const stripped = stripFormatting(text);
  
  if (stripped.length < 50) {
    return { valid: false, reason: `Too short: ${stripped.length} chars (min 50)` };
  }
  
  if (stripped.length > 240) {
    return { valid: false, reason: `Too long: ${stripped.length} chars (max 240)` };
  }
  
  if (stripped.includes('...')) {
    return { valid: false, reason: 'Contains ellipsis (incomplete)' };
  }
  
  if (/#{1,6}|\*{1,2}|```|__/.test(stripped)) {
    return { valid: false, reason: 'Contains Markdown formatting' };
  }
  
  if (/^(let's dive|more details|coming soon|stay tuned)/i.test(stripped)) {
    return { valid: false, reason: 'Contains teaser language' };
  }
  
  return { valid: true };
}
