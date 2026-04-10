/**
 * 🎯 CONSENT WALL COOLDOWN (FAIL-CLOSED)
 *
 * Prevents thrashing browser pool when consent walls persist.
 * First consent wall blocks → trigger 30–60min cooldown. No repeated clear attempts.
 */

class ConsentWallCooldown {
  private recentWalls: number[] = []; // Timestamps of recent consent walls
  private cooldownUntil: number | null = null; // Timestamp when cooldown expires

  private readonly WALL_THRESHOLD = 3; // Trigger after 3 walls (not 2 — reduce false triggers)
  private readonly WINDOW_MS = 5 * 60 * 1000; // 5 minutes (was 10 — tighter window)
  private readonly COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes (was 10 — faster recovery, system learns to route around)
  
  /**
   * Record a consent wall occurrence
   */
  recordWall(): void {
    const now = Date.now();
    this.recentWalls.push(now);
    
    // Clean old walls outside window
    this.recentWalls = this.recentWalls.filter(
      timestamp => now - timestamp < this.WINDOW_MS
    );
    
    // Check if threshold exceeded
    if (this.recentWalls.length > this.WALL_THRESHOLD && !this.cooldownUntil) {
      this.cooldownUntil = now + this.COOLDOWN_MS;
      console.warn(`[CONSENT_WALL_COOLDOWN] ⚠️ Triggered: ${this.recentWalls.length} walls in ${this.WINDOW_MS / 1000}s, pausing feeds for ${this.COOLDOWN_MS / 1000}s`);
    }
  }
  
  /**
   * Check if feeds should be paused
   */
  isCooldownActive(): boolean {
    if (!this.cooldownUntil) {
      return false;
    }
    
    const now = Date.now();
    if (now >= this.cooldownUntil) {
      // Cooldown expired
      this.cooldownUntil = null;
      console.log(`[CONSENT_WALL_COOLDOWN] ✅ Cooldown expired, resuming feeds`);
      return false;
    }
    
    const remaining = Math.ceil((this.cooldownUntil - now) / 1000);
    return true;
  }
  
  /**
   * Get cooldown status for logging
   */
  getStatus(): { active: boolean; remainingSeconds?: number; recentWalls: number } {
    if (!this.isCooldownActive()) {
      return { active: false, recentWalls: this.recentWalls.length };
    }
    
    const remaining = Math.ceil((this.cooldownUntil! - Date.now()) / 1000);
    return { active: true, remainingSeconds: remaining, recentWalls: this.recentWalls.length };
  }
}

// Singleton instance
let cooldown: ConsentWallCooldown | null = null;

export function getConsentWallCooldown(): ConsentWallCooldown {
  if (!cooldown) {
    cooldown = new ConsentWallCooldown();
  }
  return cooldown;
}
