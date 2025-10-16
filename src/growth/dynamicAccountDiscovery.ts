/**
 * DYNAMIC ACCOUNT DISCOVERY
 * Automatically discovers and ranks accounts to target for replies
 * Not limited to 7 accounts - UNLIMITED potential targets
 */

export interface DiscoveredAccount {
  username: string;
  followers: number;
  category: string;
  engagement_velocity: 'high' | 'medium' | 'low';
  relevance_score: number; // How relevant to health/wellness
  discovery_source: string;
}

export class DynamicAccountDiscovery {
  private static instance: DynamicAccountDiscovery;
  
  // SEED ACCOUNTS - Starting point, but system learns beyond these
  private readonly SEED_ACCOUNTS: DiscoveredAccount[] = [
    { username: 'hubermanlab', followers: 5000000, category: 'neuroscience', engagement_velocity: 'high', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'PeterAttiaMD', followers: 800000, category: 'longevity', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'foundmyfitness', followers: 400000, category: 'nutrition', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'ScienceDaily', followers: 2000000, category: 'science', engagement_velocity: 'high', relevance_score: 0.8, discovery_source: 'seed' },
    { username: 'NIH', followers: 500000, category: 'medical', engagement_velocity: 'low', relevance_score: 0.9, discovery_source: 'seed' },
    { username: 'DrMarkHyman', followers: 600000, category: 'functional_medicine', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'bengreenfield', followers: 300000, category: 'biohacking', engagement_velocity: 'high', relevance_score: 1.0, discovery_source: 'seed' },
    
    // EXPANDED TARGETS - More diverse accounts
    { username: 'richroll', followers: 700000, category: 'fitness', engagement_velocity: 'high', relevance_score: 0.9, discovery_source: 'seed' },
    { username: 'drchatterjeemd', followers: 400000, category: 'wellness', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'maxlugavere', followers: 300000, category: 'brain_health', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'GundryMD', followers: 500000, category: 'nutrition', engagement_velocity: 'medium', relevance_score: 0.9, discovery_source: 'seed' },
    { username: 'drperlmutter', followers: 400000, category: 'neurology', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'MarkSisson', followers: 350000, category: 'primal_health', engagement_velocity: 'medium', relevance_score: 0.9, discovery_source: 'seed' },
    { username: 'DaveAsprey', followers: 600000, category: 'biohacking', engagement_velocity: 'high', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'drkarafitzgerald', followers: 200000, category: 'epigenetics', engagement_velocity: 'low', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'DrRanganChatterjee', followers: 450000, category: 'lifestyle_medicine', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'drwillcole', followers: 350000, category: 'functional_medicine', engagement_velocity: 'medium', relevance_score: 1.0, discovery_source: 'seed' },
    { username: 'kellystarrett', followers: 400000, category: 'movement', engagement_velocity: 'medium', relevance_score: 0.9, discovery_source: 'seed' },
    { username: 'drjoshaxe', followers: 2500000, category: 'natural_health', engagement_velocity: 'high', relevance_score: 0.8, discovery_source: 'seed' },
    { username: 'bengreenfieldfitness', followers: 250000, category: 'optimization', engagement_velocity: 'high', relevance_score: 1.0, discovery_source: 'seed' }
  ];
  
  private discoveredAccounts: Map<string, DiscoveredAccount> = new Map();
  
  private constructor() {
    // Initialize with seed accounts
    this.SEED_ACCOUNTS.forEach(acc => {
      this.discoveredAccounts.set(acc.username, acc);
    });
  }
  
  public static getInstance(): DynamicAccountDiscovery {
    if (!DynamicAccountDiscovery.instance) {
      DynamicAccountDiscovery.instance = new DynamicAccountDiscovery();
    }
    return DynamicAccountDiscovery.instance;
  }
  
  /**
   * Get all available accounts, sorted by priority
   */
  getAllAccounts(): DiscoveredAccount[] {
    return Array.from(this.discoveredAccounts.values())
      .sort((a, b) => {
        // Score = followers * velocity_multiplier * relevance
        const scoreA = a.followers * this.getVelocityMultiplier(a.engagement_velocity) * a.relevance_score;
        const scoreB = b.followers * this.getVelocityMultiplier(b.engagement_velocity) * b.relevance_score;
        return scoreB - scoreA;
      });
  }
  
  /**
   * Get top N accounts to target
   */
  getTopAccounts(count: number, performanceData?: Map<string, number>): DiscoveredAccount[] {
    let accounts = this.getAllAccounts();
    
    // If we have performance data, adjust priorities
    if (performanceData && performanceData.size > 0) {
      accounts = accounts.map(acc => ({
        ...acc,
        relevance_score: acc.relevance_score * (1 + (performanceData.get(acc.username) || 0) / 10)
      }));
      
      // Re-sort with performance boost
      accounts.sort((a, b) => {
        const scoreA = a.followers * this.getVelocityMultiplier(a.engagement_velocity) * a.relevance_score;
        const scoreB = b.followers * this.getVelocityMultiplier(b.engagement_velocity) * b.relevance_score;
        return scoreB - scoreA;
      });
    }
    
    return accounts.slice(0, count);
  }
  
  /**
   * Add newly discovered account
   */
  addAccount(account: DiscoveredAccount): void {
    if (!this.discoveredAccounts.has(account.username)) {
      this.discoveredAccounts.set(account.username, account);
      console.log(`[ACCOUNT_DISCOVERY] ✅ Added ${account.username} (${account.followers.toLocaleString()} followers)`);
    }
  }
  
  /**
   * Get velocity multiplier
   */
  private getVelocityMultiplier(velocity: string): number {
    switch (velocity) {
      case 'high': return 1.5;
      case 'medium': return 1.0;
      case 'low': return 0.6;
      default: return 1.0;
    }
  }
  
  /**
   * Get total available targets
   */
  getTotalTargets(): number {
    return this.discoveredAccounts.size;
  }
  
  /**
   * Get total potential reach
   */
  getTotalPotentialReach(): number {
    return Array.from(this.discoveredAccounts.values())
      .reduce((sum, acc) => sum + acc.followers, 0);
  }
}

export const dynamicAccountDiscovery = DynamicAccountDiscovery.getInstance();

