/**
 * 📄 INVALID JSON ERROR
 * Typed error for JSON parse failures - no repair attempts
 */

export class InvalidJsonError extends Error {
  public readonly intent: string;
  public readonly rawContent: string;
  public readonly parseError: string;

  constructor(intent: string, rawContent: string, parseError: string) {
    super(`INVALID_JSON: ${intent} - ${parseError}`);
    this.name = 'InvalidJsonError';
    this.intent = intent;
    this.rawContent = rawContent.substring(0, 120); // Safe truncation
    this.parseError = parseError;
  }
}
