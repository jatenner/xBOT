

// EMERGENCY: Disable all AI response caching
export class CompletionCache {
  private cache = new Map(); // Empty map
  
  generateKey(): string { return ''; }
  get(): null { return null; } // Never return cached results
  set(): void { } // Never cache results
  clear(): void { this.cache.clear(); }
  size(): number { return 0; }
  getStats() { return { size: 0, hitRate: 0, savings: 0 }; }
}

// Export for immediate use
export const completionCache = new CompletionCache();
