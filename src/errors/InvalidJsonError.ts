/**
 * InvalidJsonError - Typed error for LLM JSON parsing failures
 * Used when strict JSON schema enforcement fails
 */

export class InvalidJsonError extends Error {
  constructor(
    public intent: string,
    public rawContent: string,
    public parseError: string,
    public truncatedContent?: string
  ) {
    const safeTruncated = rawContent.substring(0, 120).replace(/[\r\n]/g, ' ');
    super(`Invalid JSON from LLM: ${intent} - ${parseError}`);
    this.name = 'InvalidJsonError';
    this.truncatedContent = safeTruncated;
  }
  
  toLogObject() {
    return {
      error: 'InvalidJsonError',
      intent: this.intent,
      parseError: this.parseError,
      truncatedContent: this.truncatedContent,
      timestamp: new Date().toISOString()
    };
  }
}