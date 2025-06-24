import { openaiClient } from './openaiClient';

interface BatchRequest {
  id: string;
  prompt: string;
  type: 'content' | 'analysis' | 'optimization';
  priority: number;
  callback: (result: string) => void;
}

interface BatchResult {
  id: string;
  result: string;
  error?: string;
}

export class SmartBatcher {
  private pendingRequests: BatchRequest[] = [];
  private batchSize = 5; // Process 5 requests at once
  private batchTimeout = 10000; // 10 seconds max wait
  private isProcessing = false;
  private batchTimer: NodeJS.Timeout | null = null;

  async addRequest(
    prompt: string,
    type: 'content' | 'analysis' | 'optimization',
    priority: number = 1
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        type,
        priority,
        callback: (result: string) => {
          if (result.startsWith('ERROR:')) {
            reject(new Error(result));
          } else {
            resolve(result);
          }
        }
      };

      this.pendingRequests.push(request);
      this.scheduleProcessing();
    });
  }

  private scheduleProcessing(): void {
    if (this.isProcessing) return;

    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Process immediately if we have enough requests
    if (this.pendingRequests.length >= this.batchSize) {
      this.processBatch();
      return;
    }

    // Otherwise, wait for timeout
    this.batchTimer = setTimeout(() => {
      if (this.pendingRequests.length > 0) {
        this.processBatch();
      }
    }, this.batchTimeout);
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingRequests.length === 0) return;

    this.isProcessing = true;
    
    // Sort by priority and take batch
    const batch = this.pendingRequests
      .sort((a, b) => b.priority - a.priority)
      .splice(0, this.batchSize);

    console.log(`🔄 Processing batch of ${batch.length} requests`);

    try {
      // Group similar requests
      const contentRequests = batch.filter(r => r.type === 'content');
      const analysisRequests = batch.filter(r => r.type === 'analysis');
      const optimizationRequests = batch.filter(r => r.type === 'optimization');

      // Process each group
      if (contentRequests.length > 0) {
        await this.processBatchGroup(contentRequests, 'content');
      }
      if (analysisRequests.length > 0) {
        await this.processBatchGroup(analysisRequests, 'analysis');
      }
      if (optimizationRequests.length > 0) {
        await this.processBatchGroup(optimizationRequests, 'optimization');
      }

    } catch (error) {
      console.error('Batch processing failed:', error);
      // Send error to all callbacks
      batch.forEach(req => req.callback(`ERROR: ${error}`));
    }

    this.isProcessing = false;

    // Process next batch if pending
    if (this.pendingRequests.length > 0) {
      this.scheduleProcessing();
    }
  }

  private async processBatchGroup(requests: BatchRequest[], type: string): Promise<void> {
    if (requests.length === 1) {
      // Single request - process normally
      const request = requests[0];
      try {
        const result = await this.processSingleRequest(request);
        request.callback(result);
      } catch (error) {
        request.callback(`ERROR: ${error}`);
      }
      return;
    }

    // Multiple requests - combine into one API call
    const combinedPrompt = this.createCombinedPrompt(requests, type);
    
    try {
      const response = await openaiClient.generateCompletion(combinedPrompt, {
        maxTokens: Math.min(800, 200 * requests.length), // Scale tokens with request count
        temperature: 0.6,
        model: 'gpt-4o-mini'
      });

      // Parse and distribute results
      const results = this.parseMultipleResults(response, requests.length);
      
      requests.forEach((request, index) => {
        const result = results[index] || "Error: Could not parse result";
        request.callback(result);
      });

      console.log(`✅ Batch processed ${requests.length} ${type} requests in 1 API call`);
      
    } catch (error) {
      console.error(`Batch ${type} processing failed:`, error);
      requests.forEach(req => req.callback(`ERROR: ${error}`));
    }
  }

  private createCombinedPrompt(requests: BatchRequest[], type: string): string {
    const systemPrompts = {
      content: "Generate viral health tech tweets for each request below. Number each response clearly.",
      analysis: "Analyze each piece of content below. Number each response clearly.",
      optimization: "Optimize each strategy below. Number each response clearly."
    };

    let prompt = `${systemPrompts[type as keyof typeof systemPrompts]}\n\n`;
    
    requests.forEach((request, index) => {
      prompt += `Request ${index + 1}:\n${request.prompt}\n\n`;
    });

    prompt += "Provide numbered responses (1, 2, 3, etc.) for each request above.";
    
    return prompt;
  }

  private parseMultipleResults(response: string, expectedCount: number): string[] {
    const results: string[] = [];
    
    // Try to split by numbered responses
    const numbered = response.split(/(?:\n|^)(\d+)\.?\s*/);
    
    if (numbered.length >= expectedCount * 2) {
      // Successfully parsed numbered responses
      for (let i = 1; i < numbered.length; i += 2) {
        const content = numbered[i + 1]?.trim();
        if (content) {
          results.push(content);
        }
      }
    } else {
      // Fallback: split by common delimiters
      const sections = response.split(/\n\n+|\n---+\n/);
      sections.forEach(section => {
        const trimmed = section.trim();
        if (trimmed && trimmed.length > 10) {
          results.push(trimmed);
        }
      });
    }

    // Ensure we have the right number of results
    while (results.length < expectedCount) {
      results.push("Default response due to parsing error");
    }

    return results.slice(0, expectedCount);
  }

  private async processSingleRequest(request: BatchRequest): Promise<string> {
    return await openaiClient.generateCompletion(request.prompt, {
      maxTokens: 200,
      temperature: 0.6,
      model: 'gpt-4o-mini'
    });
  }

  // Get current batch status
  getStatus(): {
    pendingRequests: number;
    isProcessing: boolean;
    nextBatchIn?: number;
  } {
    const nextBatchIn = this.batchTimer ? 
      Math.max(0, this.batchTimeout - (Date.now() % this.batchTimeout)) : 
      undefined;

    return {
      pendingRequests: this.pendingRequests.length,
      isProcessing: this.isProcessing,
      nextBatchIn
    };
  }

  // Emergency flush - process all pending immediately
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    while (this.pendingRequests.length > 0 && !this.isProcessing) {
      await this.processBatch();
    }
  }
}

export const smartBatcher = new SmartBatcher(); 