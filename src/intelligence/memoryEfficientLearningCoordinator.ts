/**
 * 🧠 MEMORY-EFFICIENT LEARNING COORDINATOR
 * 
 * Lightweight version of master learning that works within Railway's 512MB limit.
 * Uses streaming, lazy loading, and database-backed storage instead of memory.
 */

interface LightweightMemory {
  last_pattern_id?: string;
  accuracy_score: number;
  total_patterns: number;
  last_updated: string;
}

export class MemoryEfficientLearningCoordinator {
  private static instance: MemoryEfficientLearningCoordinator;
  private memory: LightweightMemory = {
    accuracy_score: 0.75,
    total_patterns: 0,
    last_updated: new Date().toISOString()
  };
  
  // Memory limit: 10MB maximum for this component
  private readonly MEMORY_LIMIT = 10 * 1024 * 1024; // 10MB
  
  static getInstance(): MemoryEfficientLearningCoordinator {
    if (!this.instance) {
      this.instance = new MemoryEfficientLearningCoordinator();
    }
    return this.instance;
  }

  /**
   * 📊 Learn from post with minimal memory usage
   */
  async learnFromPost(content: string, engagement: any): Promise<void> {
    try {
      // Use database storage instead of memory
      const pattern = {
        content_hash: this.hashContent(content),
        engagement_score: engagement.likes || 0,
        content_length: content.length,
        has_hashtags: content.includes('#'),
        created_at: new Date().toISOString()
      };

      // Store directly to database (not memory)
      const { supabaseClient } = await import('../utils/supabaseClient');
      await supabaseClient.supabase
        .from('learning_patterns')
        .insert(pattern);

      // Update lightweight memory
      this.memory.total_patterns++;
      this.memory.last_updated = new Date().toISOString();
      
      // Memory cleanup
      this.cleanup();
      
    } catch (error: any) {
      console.error('Memory-efficient learning error:', error.message);
    }
  }

  /**
   * 🎯 Generate content with database-backed learning
   */
  async generateOptimizedContent(topic: string): Promise<string> {
    try {
      // Query database for patterns (not memory)
      const { supabaseClient } = await import('../utils/supabaseClient');
      const { data: patterns } = await supabaseClient.supabase
        .from('learning_patterns')
        .select('*')
        .order('engagement_score', { ascending: false })
        .limit(5); // Only load 5 best patterns

      if (!patterns || patterns.length === 0) {
        return this.generateBasicContent(topic);
      }

      // Use patterns to improve content
      const avgLength = patterns.reduce((sum, p) => sum + p.content_length, 0) / patterns.length;
      const useHashtags = patterns.some(p => p.has_hashtags);

      return this.generateBasicContent(topic, avgLength, useHashtags);
      
    } catch (error: any) {
      console.error('Content generation error:', error.message);
      return this.generateBasicContent(topic);
    }
  }

  /**
   * 🔧 Memory management and cleanup
   */
  private cleanup(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Check memory usage
    const usage = process.memoryUsage();
    if (usage.heapUsed > this.MEMORY_LIMIT) {
      console.warn(`⚠️ Learning coordinator memory high: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
      // Clear any temporary data
      this.memory.last_pattern_id = undefined;
    }
  }

  /**
   * 🏷️ Generate content hash for deduplication
   */
  private hashContent(content: string): string {
    // Simple hash for lightweight memory usage
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * 📝 Generate basic content without heavy AI
   */
  private generateBasicContent(topic: string, targetLength?: number, useHashtags?: boolean): string {
    const templates = [
      `${topic} is crucial for optimal health. Start incorporating it into your daily routine today.`,
      `New research on ${topic} shows promising benefits. What's your experience with this?`,
      `${topic} simplified: Small changes can lead to big health improvements over time.`,
      `The science behind ${topic} might surprise you. Here's what you need to know.`
    ];
    
    const template = templates[Math.floor(Math.random() * templates.length)];
    let content = template;
    
    // Adjust length if specified
    if (targetLength && content.length < targetLength * 0.8) {
      content += ' Share your thoughts in the comments below!';
    }
    
    // Add hashtags if learned pattern suggests it
    if (useHashtags) {
      content += ' #Health #Wellness';
    }
    
    return content;
  }

  /**
   * 📊 Get learning stats (lightweight)
   */
  getStats(): LightweightMemory {
    return { ...this.memory };
  }

  /**
   * 🧹 Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Minimal cleanup
    this.memory = {
      accuracy_score: 0.75,
      total_patterns: 0,
      last_updated: new Date().toISOString()
    };
    
    if (global.gc) {
      global.gc();
    }
  }
}

// Export both the class and an instance
export const memoryEfficientLearning = MemoryEfficientLearningCoordinator.getInstance();