/**
 * Resilient OpenAI Client with Circuit Breaker and Retry Logic
 * Handles rate limits, quota exhaustion, and service degradation gracefully
 */

import OpenAI from 'openai';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { openCircuit, isCircuitOpen, getCircuitRemaining } from '../utils/circuitBreaker';
import { sleep } from '../utils/time';

export interface OpenAIClientOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  requestType?: string;
  priority?: 'high' | 'medium' | 'low';
  response_format?: any;
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuit: string,
    public readonly remainingMs: number
  ) {
    super(`Circuit breaker '${circuit}' is open (${Math.ceil(remainingMs / 1000 / 60)} minutes remaining)`);
    this.name = 'CircuitOpenError';
  }
}

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

class ResilientOpenAIClient {
  private static instance: ResilientOpenAIClient;
  private openai: OpenAI;
  private readonly MAX_RETRIES = 4;
  private readonly BASE_DELAY = 1000; // 1 second

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      organization: FEATURE_FLAGS.OPENAI_ORG,
      project: FEATURE_FLAGS.OPENAI_PROJECT,
    });
  }

  static getInstance(): ResilientOpenAIClient {
    if (!ResilientOpenAIClient.instance) {
      ResilientOpenAIClient.instance = new ResilientOpenAIClient();
    }
    return ResilientOpenAIClient.instance;
  }

  /**
   * Safe chat completion with circuit breaker and retry logic
   */
  async safeChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: OpenAIClientOptions = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      max_tokens = 2000,
      requestType = 'general',
      response_format
    } = options;

    // Check manual circuit override
    if (FEATURE_FLAGS.AI_QUOTA_CIRCUIT_OPEN) {
      throw new CircuitOpenError('manual_override', 0);
    }

    // Check circuit breaker
    const circuitOpen = await isCircuitOpen('openai_quota');
    if (circuitOpen) {
      const remaining = await getCircuitRemaining('openai_quota');
      throw new CircuitOpenError('openai_quota', remaining);
    }

    return this.executeWithRetry(async () => {
      const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model,
        messages,
        temperature,
        max_tokens,
        ...(response_format && { response_format })
      };

      console.log(`🤖 OPENAI_REQUEST: ${requestType} (${model}, ${messages.length} messages)`);
      
      const response = await this.openai.chat.completions.create(params);
      
      // Log successful request
      const usage = response.usage;
      const requestId = response.id;
      
      console.log(`✅ OPENAI_SUCCESS: ${requestType} completed (request_id: ${requestId})`);
      if (usage) {
        console.log(`📊 USAGE: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total tokens`);
      }
      
      return response;
    }, requestType);
  }

  /**
   * Safe response generation (alias for chat completion)
   */
  async safeResponse(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: OpenAIClientOptions = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.safeChatCompletion(messages, options);
  }

  /**
   * Execute request with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    requestType: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const isLastAttempt = attempt === this.MAX_RETRIES;

        // Handle specific error types
        if (this.isQuotaError(error)) {
          await this.handleQuotaError(requestType, isLastAttempt);
          if (isLastAttempt) {
            throw new QuotaExhaustedError(`OpenAI quota exhausted: ${error.message}`);
          }
          continue;
        }

        if (this.isRateLimit(error)) {
          const delayMs = await this.handleRateLimit(error, attempt, requestType, isLastAttempt);
          if (isLastAttempt) {
            throw error;
          }
          await sleep(delayMs);
          continue;
        }

        if (this.is5xxError(error)) {
          if (isLastAttempt) {
            throw error;
          }
          const backoffDelay = this.calculateBackoffDelay(attempt);
          console.log(`🔄 OPENAI_5XX_RETRY: Attempt ${attempt}/${this.MAX_RETRIES} in ${backoffDelay}ms (${requestType})`);
          await sleep(backoffDelay);
          continue;
        }

        // For all other errors, fail immediately
        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error is quota/billing related
   */
  private isQuotaError(error: any): boolean {
    if (error?.code === 'insufficient_quota') return true;
    if (error?.status === 429 && error?.message?.toLowerCase().includes('quota')) return true;
    if (error?.message?.toLowerCase().includes('billing')) return true;
    return false;
  }

  /**
   * Check if error is rate limiting (non-quota)
   */
  private isRateLimit(error: any): boolean {
    return error?.status === 429 && !this.isQuotaError(error);
  }

  /**
   * Check if error is 5xx server error
   */
  private is5xxError(error: any): boolean {
    return error?.status >= 500 && error?.status < 600;
  }

  /**
   * Handle quota exhaustion
   */
  private async handleQuotaError(requestType: string, isLastAttempt: boolean): Promise<void> {
    if (isLastAttempt) {
      console.error(`💸 OPENAI_QUOTA_EXHAUSTED: Opening circuit breaker for ${FEATURE_FLAGS.AI_COOLDOWN_MINUTES} minutes`);
      await openCircuit('openai_quota', FEATURE_FLAGS.AI_COOLDOWN_MINUTES);
    } else {
      console.warn(`💸 OPENAI_QUOTA_ERROR: ${requestType} (will retry)`);
    }
  }

  /**
   * Handle rate limiting with Retry-After respect
   */
  private async handleRateLimit(
    error: any, 
    attempt: number, 
    requestType: string, 
    isLastAttempt: boolean
  ): Promise<number> {
    let delayMs = this.calculateBackoffDelay(attempt);

    // Respect Retry-After header if present
    const retryAfter = error?.headers?.['retry-after'];
    if (retryAfter) {
      const retryAfterMs = parseInt(retryAfter) * 1000;
      if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
        delayMs = Math.min(retryAfterMs, 30000); // Cap at 30 seconds
        console.log(`⏱️  OPENAI_RETRY_AFTER: Respecting ${retryAfter}s delay (${requestType})`);
      }
    }

    if (isLastAttempt) {
      console.error(`🚨 OPENAI_RATE_LIMIT_EXHAUSTED: Opening circuit breaker for ${FEATURE_FLAGS.AI_COOLDOWN_MINUTES} minutes`);
      await openCircuit('openai_quota', FEATURE_FLAGS.AI_COOLDOWN_MINUTES);
    } else {
      console.warn(`🔄 OPENAI_RATE_LIMIT: Attempt ${attempt}/${this.MAX_RETRIES} backing off ${delayMs}ms (${requestType})`);
    }

    return delayMs;
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.BASE_DELAY * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 400; // 0-400ms jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Get client health status
   */
  async getHealthStatus(): Promise<{
    circuit_open: boolean;
    circuit_remaining_ms: number;
    quota_override: boolean;
  }> {
    const circuit_open = await isCircuitOpen('openai_quota');
    const circuit_remaining_ms = circuit_open ? await getCircuitRemaining('openai_quota') : 0;
    
    return {
      circuit_open,
      circuit_remaining_ms,
      quota_override: FEATURE_FLAGS.AI_QUOTA_CIRCUIT_OPEN
    };
  }
}

// Export singleton instance
const resilientOpenAI = ResilientOpenAIClient.getInstance();

/**
 * Safe chat completion function
 */
export async function safeChatCompletion(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: OpenAIClientOptions = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return resilientOpenAI.safeChatCompletion(messages, options);
}

/**
 * Safe response function (alias)
 */
export async function safeResponse(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: OpenAIClientOptions = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return resilientOpenAI.safeResponse(messages, options);
}

/**
 * Get OpenAI client health status
 */
export async function getOpenAIHealth(): Promise<{
  circuit_open: boolean;
  circuit_remaining_ms: number;
  quota_override: boolean;
}> {
  return resilientOpenAI.getHealthStatus();
}

// Error classes already exported above
