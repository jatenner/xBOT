/**
 * JSON CLEANER UTILITY
 * Cleans OpenAI responses that sometimes include markdown code blocks
 */

export function cleanJsonResponse(response: string): string {
  if (!response) return '{}';
  
  let cleaned = response.trim();
  
  // Remove markdown code blocks
  if (cleaned.includes('```json')) {
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
  }
  
  // Remove any remaining code block markers
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```[a-z]*\s*/g, '').replace(/```\s*$/g, '');
  }
  
  // Remove leading/trailing whitespace again after cleaning
  cleaned = cleaned.trim();
  
  // Ensure we have valid JSON structure
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/(\{.*\}|\[.*\])/s);
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    } else {
      throw new Error('No valid JSON found in response');
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
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
