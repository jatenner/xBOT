/**
 * ⏰ UCB TIMING BANDIT
 * Upper Confidence Bound algorithm for optimal posting time selection
 */

export interface TimingArm {
  slot: number; // Hour 0-23
  totalReward: number;
  totalPlays: number;
  avgReward: number;
  confidence: number;
  lastUsed?: Date;
}

export interface TimingSelection {
  slot: number;
  confidence: number;
  reasoning: string;
  ucbScore: number;
  neighbors: number[];
}

export class UCBTimingBandit {
  private arms: Map<number, TimingArm> = new Map();
  private totalPlays: number = 0;
  private explorationParam: number = 1.4; // UCB exploration parameter

  constructor() {
    this.initializeArms();
  }

  /**
   * Initialize 24 hourly timing arms with reasonable priors
   */
  private initializeArms(): void {
    // Prime time hours (6-10 PM) get higher priors
    const priors = [
      0.1, 0.05, 0.05, 0.05, 0.05, 0.1,  // 0-5: Low activity
      0.15, 0.2, 0.25, 0.2, 0.15, 0.15,  // 6-11: Morning activity  
      0.2, 0.25, 0.2, 0.15, 0.2, 0.25,   // 12-17: Afternoon
      0.35, 0.4, 0.35, 0.3, 0.25, 0.15   // 18-23: Prime time
    ];

    for (let hour = 0; hour < 24; hour++) {
      this.arms.set(hour, {
        slot: hour,
        totalReward: priors[hour] * 5, // Initialize with some prior knowledge
        totalPlays: 5, // Prevent division by zero
        avgReward: priors[hour],
        confidence: 0.0,
        lastUsed: undefined
      });
    }

    this.totalPlays = 24 * 5; // Total across all arms
    console.log('[UCB_TIMING] 🔄 Initialized 24 hourly timing arms with priors');
  }

  /**
   * Select optimal timing slot using UCB1 algorithm
   */
  public async selectTimingWithUCB(): Promise<TimingSelection> {
    console.log('[UCB_TIMING] 🎯 Selecting optimal timing slot...');
    
    let bestArm: TimingArm | null = null;
    let bestUCBScore = -1;

    // Calculate UCB scores for all arms
    for (const arm of this.arms.values()) {
      const ucbScore = this.calculateUCBScore(arm);
      
      if (ucbScore > bestUCBScore) {
        bestUCBScore = ucbScore;
        bestArm = arm;
      }
    }

    if (!bestArm) {
      // Fallback to current hour if something goes wrong
      const currentHour = new Date().getHours();
      bestArm = this.arms.get(currentHour) || this.arms.get(0)!;
      bestUCBScore = bestArm.avgReward;
    }

    // Calculate confidence based on exploration vs exploitation
    const explorationFactor = Math.sqrt(2 * Math.log(this.totalPlays) / bestArm.totalPlays);
    const confidence = Math.min(0.95, Math.max(0.1, 1 - explorationFactor));

    // Get neighboring slots for potential exploration
    const neighbors = this.testNearbySlots(bestArm.slot);

    const selection: TimingSelection = {
      slot: bestArm.slot,
      confidence,
      reasoning: `UCB selected hour ${bestArm.slot} (avg: ${bestArm.avgReward.toFixed(3)}, plays: ${bestArm.totalPlays})`,
      ucbScore: bestUCBScore,
      neighbors: await this.testNearbySlots(bestArm.slot)
    };

    console.log(`[UCB_TIMING] ✅ Selected slot ${selection.slot} with confidence ${(confidence * 100).toFixed(1)}% (UCB: ${bestUCBScore.toFixed(3)})`);
    return selection;
  }

  /**
   * Calculate UCB1 score for an arm
   */
  private calculateUCBScore(arm: TimingArm): number {
    if (arm.totalPlays === 0) {
      return Number.MAX_VALUE; // Force exploration of unplayed arms
    }

    const explorationBonus = this.explorationParam * Math.sqrt(
      Math.log(this.totalPlays) / arm.totalPlays
    );

    return arm.avgReward + explorationBonus;
  }

  /**
   * Get neighboring time slots for exploration (±1 hour)
   */
  public async testNearbySlots(bestSlot: number): Promise<number[]> {
    const neighbors = [
      (bestSlot - 1 + 24) % 24, // Previous hour (with wraparound)
      bestSlot,                 // Best slot
      (bestSlot + 1) % 24       // Next hour (with wraparound)
    ];

    console.log(`[UCB_TIMING] 🔍 Nearby slots for ${bestSlot}: [${neighbors.join(', ')}]`);
    return neighbors;
  }

  /**
   * Update arm with reward after posting
   */
  public async updateArmReward(slot: number, reward: number): Promise<void> {
    const arm = this.arms.get(slot);
    if (!arm) {
      console.error(`[UCB_TIMING] ❌ Unknown slot: ${slot}`);
      return;
    }

    // Update arm statistics
    arm.totalReward += reward;
    arm.totalPlays += 1;
    arm.avgReward = arm.totalReward / arm.totalPlays;
    arm.lastUsed = new Date();

    this.totalPlays += 1;

    console.log(`[UCB_TIMING] 📈 Updated slot ${slot}: reward=${reward.toFixed(3)}, avg=${arm.avgReward.toFixed(3)}, plays=${arm.totalPlays}`);
  }

  /**
   * Get current arm statistics for observability
   */
  public getArmStats(): TimingArm[] {
    return Array.from(this.arms.values()).sort((a, b) => b.avgReward - a.avgReward);
  }

  /**
   * Get timing heatmap for /learn/status endpoint
   */
  public getTimingHeatmap(): { hour: number; avgReward: number; plays: number; confidence: number }[] {
    return Array.from(this.arms.values()).map(arm => ({
      hour: arm.slot,
      avgReward: arm.avgReward,
      plays: arm.totalPlays,
      confidence: arm.totalPlays > 0 ? Math.min(1, arm.totalPlays / 10) : 0
    }));
  }
}

// Singleton instance
let ucbInstance: UCBTimingBandit | null = null;

export function getUCBTimingBandit(): UCBTimingBandit {
  if (!ucbInstance) {
    ucbInstance = new UCBTimingBandit();
  }
  return ucbInstance;
}
