/**
 * JSON CLEANER UTILITY
 * Cleans OpenAI responses that sometimes include markdown code blocks
 */

export function cleanJsonResponse(response: string): string {
  if (!response) return '{}';
  
  let cleaned = response.trim();
  
  // Pattern 1: ```json ... ``` (most common)
  if (cleaned.includes('```json')) {
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '');
  }
  
  // Pattern 2: ``` ... ``` (any language or no language)
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```[a-z]*\s*/gi, '').replace(/```\s*$/gm, '');
  }
  
  // Pattern 3: Handle multiple consecutive backticks
  cleaned = cleaned.replace(/`{3,}/g, '');
  
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
    console.log('🧹 JSON_CLEANER: Original length:', response.length, 'Cleaned length:', cleaned.length);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ JSON_PARSE_FAILED: Original response:', response.substring(0, 300) + '...');
    console.error('❌ JSON_PARSE_FAILED: Cleaned response:', cleanJsonResponse(response).substring(0, 300) + '...');
    console.error('❌ JSON_PARSE_ERROR:', error);
    
    // Try one more aggressive cleaning attempt
    const aggressiveCleaned = response
      .replace(/```[\s\S]*?```/g, '') // Remove entire code blocks
      .replace(/`{1,}/g, '') // Remove all backticks
      .trim();
    
    try {
      console.log('🔄 JSON_RETRY: Attempting aggressive cleaning...');
      return JSON.parse(aggressiveCleaned);
    } catch (retryError) {
      console.error('❌ JSON_RETRY_FAILED:', retryError);
      console.warn('⚠️ Using fallback empty object due to JSON parse failure');
      return {};
    }
  }
}
