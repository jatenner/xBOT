/**
 * JSON CLEANER UTILITY
 * Cleans OpenAI responses that sometimes include markdown code blocks
 */

export function cleanJsonResponse(response: string): string {
  if (!response) return '{}';
  
  let cleaned = response.trim();
  
  // Remove all markdown code block patterns
  // Pattern 1: ```json ... ```
  if (cleaned.includes('```json')) {
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
  }
  
  // Pattern 2: ``` ... ``` (any language)
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```[a-z]*\s*/gi, '').replace(/```\s*$/g, '');
  }
  
  // Pattern 3: `...` (single backticks)
  if (cleaned.startsWith('`') && cleaned.endsWith('`')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Pattern 4: Remove any remaining backticks at start/end
  cleaned = cleaned.replace(/^`+|`+$/g, '');
  
  // Pattern 5: Handle nested backticks in JSON values
  if (cleaned.includes('`')) {
    cleaned = cleaned.replace(/"`([^"]*)`"/g, '"$1"');
  }

  // Remove leading/trailing whitespace again after cleaning
  cleaned = cleaned.trim();

  // Handle common malformed patterns
  // Remove "json" prefix if present
  if (cleaned.toLowerCase().startsWith('json')) {
    cleaned = cleaned.slice(4).trim();
  }

  // Ensure we have valid JSON structure
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    // Try to extract JSON from the response with more patterns
    const jsonPatterns = [
      /(\{[^}]*\})/s,       // {...} 
      /(\[[^\]]*\])/s,      // [...]
      /(\{[\s\S]*\})/,      // {...} multiline
      /(\[[\s\S]*\])/       // [...] multiline
    ];
    
    let found = false;
    for (const pattern of jsonPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        cleaned = match[1];
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Don't throw, return empty object as fallback
      console.warn('⚠️ JSON_CLEANER: No valid JSON structure found, returning empty object.');
      console.warn('⚠️ Original response:', response.substring(0, 200) + '...');
      return '{}';
    }
  }
  
  return cleaned;
}

export function safeJsonParse(response: string): any {
  try {
    const cleaned = cleanJsonResponse(response);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ JSON parsing failed for response:', response.substring(0, 200) + '...');
    console.error('❌ Parse error:', error);
    
    // Return fallback object instead of throwing
    console.warn('⚠️ Using fallback empty object due to JSON parse failure');
    return {};
  }
}
