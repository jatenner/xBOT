/**
 * 🔧 AI JSON PARSER
 * 
 * Handles JSON responses from AI that might be wrapped in markdown code blocks
 * Fixes: "Unexpected token '`', "```json { "... is not valid JSON"
 */

/**
 * Extract and parse JSON from AI response
 * Handles:
 * - Plain JSON
 * - JSON wrapped in ```json ... ```
 * - JSON wrapped in ``` ... ```
 * - Markdown formatting
 */
export function parseAIJson<T = any>(response: string): T {
  try {
    // Try direct parse first (fastest path)
    return JSON.parse(response);
  } catch (error) {
    // Clean up markdown code blocks and try again
    try {
      const cleaned = cleanJsonResponse(response);
      return JSON.parse(cleaned);
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse AI JSON response. ` +
        `Original: "${response.substring(0, 100)}..." ` +
        `Error: ${parseError.message}`
      );
    }
  }
}

/**
 * Clean JSON response by removing markdown code blocks
 */
function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();
  
  // Remove ```json\n at start
  cleaned = cleaned.replace(/^```json\s*/i, '');
  
  // Remove ```\n at start
  cleaned = cleaned.replace(/^```\s*/, '');
  
  // Remove ``` at end
  cleaned = cleaned.replace(/\s*```$/, '');
  
  // Remove any remaining backticks
  cleaned = cleaned.replace(/^`+|`+$/g, '');
  
  return cleaned.trim();
}

/**
 * Safe JSON parse with fallback
 */
export function parseAIJsonSafe<T = any>(
  response: string,
  fallback: T
): T {
  try {
    return parseAIJson<T>(response);
  } catch (error) {
    console.warn('[AI_JSON] ⚠️ Parse failed, using fallback:', error);
    return fallback;
  }
}

/**
 * Extract JSON from AI response that might have text before/after
 */
export function extractJsonFromText(text: string): any {
  // Try to find JSON object in text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return parseAIJson(jsonMatch[0]);
  }
  
  // Try to find JSON array in text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return parseAIJson(arrayMatch[0]);
  }
  
  throw new Error('No JSON found in text');
}

