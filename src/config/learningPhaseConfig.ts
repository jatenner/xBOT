/**
 * 🧠 LEARNING PHASE CONFIGURATION
 * More permissive settings during initial learning period
 */

export const LEARNING_PHASE_CONFIG = {
  // Reduced thresholds for learning phase
  MIN_VIRAL_SCORE: 35,
  MIN_QUALITY_SCORE: 55,
  MIN_CONTENT_LENGTH: 40,
  
  // Learning phase duration (7 days)
  LEARNING_PHASE_DURATION: 7 * 24 * 60 * 60 * 1000,
  
  // More permissive validation
  ALLOW_INCOMPLETE_HOOKS: true,
  ALLOW_EXPERIMENTAL_CONTENT: true,
  REDUCED_NUCLEAR_VALIDATION: true,
  
  isLearningPhase(): boolean {
    // Check if we're still in the initial learning phase
    const startDate = new Date('2025-01-30'); // Deployment date
    const now = new Date();
    const timeDiff = now.getTime() - startDate.getTime();
    
    return timeDiff < this.LEARNING_PHASE_DURATION;
  },
  
  getThresholds() {
    if (this.isLearningPhase()) {
      return {
        viralScore: this.MIN_VIRAL_SCORE,
        qualityScore: this.MIN_QUALITY_SCORE,
        contentLength: this.MIN_CONTENT_LENGTH
      };
    }
    
    // Production thresholds
    return {
      viralScore: 50,
      qualityScore: 70,
      contentLength: 80
    };
  }
};