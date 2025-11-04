/**
 * 📊 GENERATOR PERFORMANCE TRACKER
 * Tracks which generators succeed/fail and their quality
 */

import { getSupabaseClient } from '../db/index';

interface GeneratorStats {
  attempts: number;
  successes: number;
  failures: number;
  total_quality: number;
  avg_quality: number;
  success_rate: number;
  last_used: Date;
}

class GeneratorPerformanceTracker {
  private static instance: GeneratorPerformanceTracker;
  private stats: Map<string, GeneratorStats> = new Map();
  
  private constructor() {
    // Load stats from database on init
    this.loadStats().catch(err => {
      console.warn('[GEN_TRACKER] ⚠️ Could not load stats:', err.message);
    });
  }
  
  static getInstance(): GeneratorPerformanceTracker {
    if (!GeneratorPerformanceTracker.instance) {
      GeneratorPerformanceTracker.instance = new GeneratorPerformanceTracker();
    }
    return GeneratorPerformanceTracker.instance;
  }
  
  /**
   * Load stats from database
   */
  private async loadStats(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      const { data: generatorData } = await supabase
        .from('content_metadata')
        .select('generator_name, quality_score, status')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .not('generator_name', 'is', null);
      
      if (!generatorData) return;
      
      // Aggregate stats
      const statsMap = new Map<string, GeneratorStats>();
      
      generatorData.forEach((row: any) => {
        const name = row.generator_name;
        if (!name) return;
        
        if (!statsMap.has(name)) {
          statsMap.set(name, {
            attempts: 0,
            successes: 0,
            failures: 0,
            total_quality: 0,
            avg_quality: 0,
            success_rate: 0,
            last_used: new Date()
          });
        }
        
        const stats = statsMap.get(name)!;
        stats.attempts++;
        
        if (row.status === 'posted') {
          stats.successes++;
          if (row.quality_score) {
            stats.total_quality += row.quality_score;
          }
        } else if (row.status === 'failed') {
          stats.failures++;
        }
      });
      
      // Calculate averages
      statsMap.forEach((stats, name) => {
        stats.avg_quality = stats.successes > 0 ? stats.total_quality / stats.successes : 0;
        stats.success_rate = stats.attempts > 0 ? stats.successes / stats.attempts : 0;
      });
      
      this.stats = statsMap;
      console.log(`[GEN_TRACKER] ✅ Loaded stats for ${this.stats.size} generators`);
      
    } catch (error: any) {
      console.error('[GEN_TRACKER] ❌ Failed to load stats:', error.message);
    }
  }
  
  /**
   * Record generator attempt
   */
  async recordAttempt(generator: string, success: boolean, quality?: number): Promise<void> {
    if (!this.stats.has(generator)) {
      this.stats.set(generator, {
        attempts: 0,
        successes: 0,
        failures: 0,
        total_quality: 0,
        avg_quality: 0,
        success_rate: 0,
        last_used: new Date()
      });
    }
    
    const stats = this.stats.get(generator)!;
    stats.attempts++;
    stats.last_used = new Date();
    
    if (success) {
      stats.successes++;
      if (quality) {
        stats.total_quality += quality;
        stats.avg_quality = stats.total_quality / stats.successes;
      }
    } else {
      stats.failures++;
    }
    
    stats.success_rate = stats.successes / stats.attempts;
    
    // Store to database for persistence
    try {
      const supabase = getSupabaseClient();
      await supabase.from('generator_performance').upsert({
        generator_name: generator,
        attempts: stats.attempts,
        successes: stats.successes,
        failures: stats.failures,
        avg_quality: stats.avg_quality,
        success_rate: stats.success_rate,
        last_used: stats.last_used.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'generator_name' });
    } catch (dbError: any) {
      // Non-critical - continue even if DB write fails
      console.warn('[GEN_TRACKER] ⚠️ Could not persist stats:', dbError.message);
    }
  }
  
  /**
   * Get stats for a specific generator
   */
  getStats(generator: string): GeneratorStats | null {
    return this.stats.get(generator) || null;
  }
  
  /**
   * Get all stats
   */
  getAllStats(): Map<string, GeneratorStats> {
    return new Map(this.stats);
  }
  
  /**
   * Get ranked generators by success rate
   */
  getRankedGenerators(): Array<{name: string; stats: GeneratorStats}> {
    const ranked = Array.from(this.stats.entries())
      .map(([name, stats]) => ({ name, stats }))
      .sort((a, b) => b.stats.success_rate - a.stats.success_rate);
    
    return ranked;
  }
  
  /**
   * Get best performing generators
   */
  getBestGenerators(minAttempts: number = 5): string[] {
    return this.getRankedGenerators()
      .filter(g => g.stats.attempts >= minAttempts)
      .slice(0, 5)
      .map(g => g.name);
  }
  
  /**
   * Get worst performing generators
   */
  getWorstGenerators(minAttempts: number = 5): string[] {
    return this.getRankedGenerators()
      .filter(g => g.stats.attempts >= minAttempts)
      .reverse()
      .slice(0, 5)
      .map(g => g.name);
  }
  
  /**
   * Print stats to console
   */
  printStats(): void {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 GENERATOR PERFORMANCE REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const ranked = this.getRankedGenerators();
    
    if (ranked.length === 0) {
      console.log('No generator data available yet');
      return;
    }
    
    ranked.forEach((g, i) => {
      const successRate = (g.stats.success_rate * 100).toFixed(1);
      const avgQuality = (g.stats.avg_quality * 100).toFixed(1);
      const status = g.stats.success_rate >= 0.8 ? '✅' :
                     g.stats.success_rate >= 0.5 ? '⚠️' : '❌';
      
      console.log(`${i + 1}. ${status} ${g.name}`);
      console.log(`   Success: ${successRate}% (${g.stats.successes}/${g.stats.attempts})`);
      console.log(`   Quality: ${avgQuality}/100`);
      console.log(`   Last used: ${g.stats.last_used.toLocaleString()}`);
      console.log('');
    });
    
    console.log('═══════════════════════════════════════════════════════════\n');
  }
}

export const generatorPerformanceTracker = GeneratorPerformanceTracker.getInstance();

// Auto-report stats every hour
setInterval(() => {
  generatorPerformanceTracker.printStats();
}, 60 * 60 * 1000);

