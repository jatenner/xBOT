/**
 * 📈 STATISTICAL ANALYSIS
 * 
 * Statistical functions for A/B testing.
 * Simplified implementations of common statistical tests.
 */

export class StatisticalAnalysis {
  /**
   * Calculate basic statistics for a dataset
   */
  calculateStats(data: number[]): { mean: number; stddev: number; count: number } {
    if (data.length === 0) {
      return { mean: 0, stddev: 0, count: 0 };
    }

    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stddev = Math.sqrt(variance);

    return { mean, stddev, count: data.length };
  }

  /**
   * Perform independent samples t-test
   * Returns p-value and confidence level
   */
  tTest(dataA: number[], dataB: number[]): { pValue: number; confidence: number; tStatistic: number } {
    if (dataA.length < 2 || dataB.length < 2) {
      return { pValue: 1, confidence: 0, tStatistic: 0 };
    }

    const statsA = this.calculateStats(dataA);
    const statsB = this.calculateStats(dataB);

    // Calculate pooled standard deviation
    const pooledVariance = 
      ((statsA.count - 1) * Math.pow(statsA.stddev, 2) + 
       (statsB.count - 1) * Math.pow(statsB.stddev, 2)) /
      (statsA.count + statsB.count - 2);

    const pooledStddev = Math.sqrt(pooledVariance);

    // Calculate t-statistic
    const tStatistic = Math.abs(
      (statsA.mean - statsB.mean) /
      (pooledStddev * Math.sqrt(1 / statsA.count + 1 / statsB.count))
    );

    // Degrees of freedom
    const df = statsA.count + statsB.count - 2;

    // Approximate p-value using t-distribution approximation
    const pValue = this.tDistributionPValue(tStatistic, df);
    
    // Confidence = 1 - p-value
    const confidence = Math.max(0, 1 - pValue);

    return { pValue, confidence, tStatistic };
  }

  /**
   * Approximate p-value from t-distribution
   * Uses simplified approximation for common cases
   */
  private tDistributionPValue(t: number, df: number): number {
    // For large df (>30), t-distribution ≈ normal distribution
    if (df > 30) {
      return this.normalPValue(t);
    }

    // Simplified approximation for smaller df
    // This is a rough approximation - for production use a proper statistical library
    const x = df / (df + t * t);
    let p = 1;

    // Very rough beta function approximation
    if (t > 0) {
      p = Math.pow(x, df / 2) * (1 + 0.5 * (1 - x) / df);
    }

    return Math.min(1, Math.max(0, p));
  }

  /**
   * Approximate p-value from standard normal distribution
   */
  private normalPValue(z: number): number {
    z = Math.abs(z);
    
    // Approximation of cumulative normal distribution
    const t = 1 / (1 + 0.2316419 * z);
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    
    return 2 * p; // Two-tailed test
  }

  /**
   * Calculate effect size (Cohen's d)
   */
  cohenD(dataA: number[], dataB: number[]): number {
    const statsA = this.calculateStats(dataA);
    const statsB = this.calculateStats(dataB);

    if (statsA.stddev === 0 && statsB.stddev === 0) {
      return 0;
    }

    const pooledStddev = Math.sqrt(
      (Math.pow(statsA.stddev, 2) + Math.pow(statsB.stddev, 2)) / 2
    );

    return (statsA.mean - statsB.mean) / pooledStddev;
  }

  /**
   * Calculate confidence interval
   */
  confidenceInterval(data: number[], confidenceLevel: number = 0.95): { lower: number; upper: number } {
    const stats = this.calculateStats(data);
    
    if (data.length < 2) {
      return { lower: stats.mean, upper: stats.mean };
    }

    // Z-score for confidence level (approximation)
    const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;
    
    const marginOfError = zScore * (stats.stddev / Math.sqrt(data.length));

    return {
      lower: stats.mean - marginOfError,
      upper: stats.mean + marginOfError
    };
  }
}

