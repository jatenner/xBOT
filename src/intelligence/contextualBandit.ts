/**
 * 🎯 CONTEXTUAL BANDIT (LinUCB)
 * Replaces random exploration with intelligent contextual learning
 * Integrates with existing AdaptiveThreadStyler and IntelligentGrowthMaster
 */

import { supabaseClient } from '../utils/supabaseClient';

export interface BanditContext {
  hour: number;
  dayOfWeek: number;
  contentLength: number;
  emojiCount: number;
  hasHook: boolean;
  topicCluster: string;
  recentEngagementRate: number;
  followerCount: number;
}

export interface BanditAction {
  id: string;
  name: string;
  type: 'thread_style' | 'posting_time' | 'cta_type' | 'content_format';
  parameters: Record<string, any>;
}

export interface BanditReward {
  followerGain: number;
  engagementRate: number;
  impressions: number;
  timeToEffect: number; // minutes
  confidence: number;
}

export interface LinUCBState {
  A: number[][]; // Covariance matrix
  b: number[]; // Reward vector
  alpha: number; // Exploration parameter
  dimension: number;
  lastUpdate: Date;
}

export class ContextualBandit {
  private static instance: ContextualBandit;
  private alpha: number = 1.0; // Exploration parameter
  private contextDimension: number = 8; // Number of context features
  private bandits: Map<string, LinUCBState> = new Map();

  private constructor() {
    this.initializeBandits();
  }

  static getInstance(): ContextualBandit {
    if (!ContextualBandit.instance) {
      ContextualBandit.instance = new ContextualBandit();
    }
    return ContextualBandit.instance;
  }

  /**
   * 🎯 Select optimal action using LinUCB
   */
  async selectAction(context: BanditContext, actions: BanditAction[]): Promise<BanditAction> {
    try {
      const contextVector = this.contextToVector(context);
      let bestAction = actions[0];
      let bestScore = -Infinity;

      console.log(`🎯 Evaluating ${actions.length} actions with LinUCB...`);

      for (const action of actions) {
        const banditState = this.getBanditState(action.id);
        const score = this.calculateUCBScore(contextVector, banditState);
        
        console.log(`   • ${action.name}: UCB score ${score.toFixed(3)}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
      }

      console.log(`🏆 Selected action: ${bestAction.name} (score: ${bestScore.toFixed(3)})`);
      
      // Log selection for analysis
      await this.logActionSelection(context, bestAction, bestScore);
      
      return bestAction;
      
    } catch (error) {
      console.error('❌ Error in action selection, falling back to random:', error);
      return actions[Math.floor(Math.random() * actions.length)];
    }
  }

  /**
   * 📚 Update bandit with reward feedback
   */
  async updateReward(actionId: string, context: BanditContext, reward: BanditReward): Promise<void> {
    try {
      const contextVector = this.contextToVector(context);
      const banditState = this.getBanditState(actionId);
      
      // Calculate composite reward (weighted follower gain + engagement)
      const compositeReward = (reward.followerGain * 0.7) + (reward.engagementRate * 0.3);
      
      // Update LinUCB matrices
      this.updateLinUCB(banditState, contextVector, compositeReward * reward.confidence);
      
      // Store updated state
      this.bandits.set(actionId, banditState);
      
      console.log(`📈 Updated bandit for action ${actionId}: reward ${compositeReward.toFixed(3)}`);
      
      // Persist to database
      await this.persistBanditState(actionId, banditState);
      
    } catch (error) {
      console.error('❌ Error updating bandit reward:', error);
    }
  }

  /**
   * 🧮 Calculate Upper Confidence Bound score
   */
  private calculateUCBScore(context: number[], banditState: LinUCBState): number {
    try {
      // Calculate theta = A^(-1) * b
      const AInv = this.invertMatrix(banditState.A);
      const theta = this.matrixVectorMultiply(AInv, banditState.b);
      
      // Calculate confidence interval
      const contextTA = this.vectorMatrixMultiply(context, AInv);
      const confidenceWidth = Math.sqrt(this.vectorDotProduct(contextTA, context));
      
      // UCB score = expected reward + confidence interval
      const expectedReward = this.vectorDotProduct(theta, context);
      const ucbScore = expectedReward + (banditState.alpha * confidenceWidth);
      
      return ucbScore;
      
    } catch (error) {
      console.error('❌ Error calculating UCB score:', error);
      return Math.random(); // Fallback to random
    }
  }

  /**
   * 📊 Update LinUCB state with new observation
   */
  private updateLinUCB(state: LinUCBState, context: number[], reward: number): void {
    // Update A = A + x * x^T
    for (let i = 0; i < this.contextDimension; i++) {
      for (let j = 0; j < this.contextDimension; j++) {
        state.A[i][j] += context[i] * context[j];
      }
    }
    
    // Update b = b + reward * x
    for (let i = 0; i < this.contextDimension; i++) {
      state.b[i] += reward * context[i];
    }
    
    state.lastUpdate = new Date();
  }

  /**
   * 🔄 Convert context object to feature vector
   */
  private contextToVector(context: BanditContext): number[] {
    return [
      context.hour / 24.0,                           // Normalized hour [0,1]
      context.dayOfWeek / 7.0,                       // Normalized day [0,1]
      Math.min(context.contentLength / 280.0, 1.0), // Normalized length [0,1]
      Math.min(context.emojiCount / 5.0, 1.0),      // Normalized emoji count [0,1]
      context.hasHook ? 1.0 : 0.0,                  // Binary hook indicator
      this.hashTopicToFloat(context.topicCluster),   // Topic hash [0,1]
      context.recentEngagementRate,                  // Already normalized [0,1]
      Math.min(context.followerCount / 10000.0, 1.0) // Normalized follower count [0,1]
    ];
  }

  /**
   * 🎲 Hash topic string to consistent float
   */
  private hashTopicToFloat(topic: string): number {
    let hash = 0;
    for (let i = 0; i < topic.length; i++) {
      const char = topic.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647.0; // Normalize to [0,1]
  }

  /**
   * 🔧 Get or initialize bandit state
   */
  private getBanditState(actionId: string): LinUCBState {
    if (!this.bandits.has(actionId)) {
      const state: LinUCBState = {
        A: this.createIdentityMatrix(this.contextDimension),
        b: new Array(this.contextDimension).fill(0),
        alpha: this.alpha,
        dimension: this.contextDimension,
        lastUpdate: new Date()
      };
      this.bandits.set(actionId, state);
    }
    return this.bandits.get(actionId)!;
  }

  /**
   * 🔧 Initialize bandits from database
   */
  private async initializeBandits(): Promise<void> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('bandit_states')
        .select('*');
      
      if (error) {
        console.warn('⚠️ Could not load bandit states from database:', error);
        return;
      }
      
      for (const row of data || []) {
        const state: LinUCBState = {
          A: JSON.parse(row.matrix_a),
          b: JSON.parse(row.vector_b),
          alpha: row.alpha,
          dimension: row.dimension,
          lastUpdate: new Date(row.last_update)
        };
        this.bandits.set(row.action_id, state);
      }
      
      console.log(`🎯 Loaded ${this.bandits.size} bandit states from database`);
      
    } catch (error) {
      console.error('❌ Error initializing bandits:', error);
    }
  }

  /**
   * 💾 Persist bandit state to database
   */
  private async persistBanditState(actionId: string, state: LinUCBState): Promise<void> {
    try {
      await supabaseClient.supabase.from('bandit_states').upsert({
        action_id: actionId,
        matrix_a: JSON.stringify(state.A),
        vector_b: JSON.stringify(state.b),
        alpha: state.alpha,
        dimension: state.dimension,
        last_update: state.lastUpdate.toISOString()
      });
    } catch (error) {
      console.error('❌ Error persisting bandit state:', error);
    }
  }

  /**
   * 📝 Log action selection for analysis
   */
  private async logActionSelection(context: BanditContext, action: BanditAction, score: number): Promise<void> {
    try {
      await supabaseClient.supabase.from('bandit_selections').insert({
        action_id: action.id,
        action_name: action.name,
        action_type: action.type,
        context: JSON.stringify(context),
        ucb_score: score,
        selected_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error logging action selection:', error);
    }
  }

  // ============ Matrix Utilities ============

  private createIdentityMatrix(size: number): number[][] {
    const matrix = Array(size).fill(0).map(() => Array(size).fill(0));
    for (let i = 0; i < size; i++) {
      matrix[i][i] = 1.0;
    }
    return matrix;
  }

  private invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]);
    
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Make diagonal element 1
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    return augmented.map(row => row.slice(n));
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => this.vectorDotProduct(row, vector));
  }

  private vectorMatrixMultiply(vector: number[], matrix: number[][]): number[] {
    const result = new Array(matrix[0].length).fill(0);
    for (let j = 0; j < matrix[0].length; j++) {
      for (let i = 0; i < vector.length; i++) {
        result[j] += vector[i] * matrix[i][j];
      }
    }
    return result;
  }

  private vectorDotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }
}