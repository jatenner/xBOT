/**
 * 🎯 ENGAGEMENT TRIGGER FIXES
 * Ensures all content has proper engagement hooks and viral elements
 */

export class EngagementTriggerFixer {
  static addEngagementTriggers(content: string): string {
    // Ensure content has a strong hook
    if (!this.hasStrongHook(content)) {
      content = this.addHook(content);
    }
    
    // Add curiosity gap if missing
    if (!this.hasCuriosityGap(content)) {
      content = this.addCuriosityGap(content);
    }
    
    // Ensure proper ending for engagement
    if (!this.hasEngagementEnding(content)) {
      content = this.addEngagementEnding(content);
    }
    
    return content;
  }
  
  private static hasStrongHook(content: string): boolean {
    const hooks = ['🧠', '📊', '⚡', '🔬', '🔥', '❌', '🚨', '💥', '🎯', '😤', '💡'];
    return hooks.some(hook => content.includes(hook));
  }
  
  private static addHook(content: string): string {
    const hooks = ['🧠 New insight:', '📊 Data reveals:', '⚡ Breaking:', '🔥 Truth:'];
    const hook = hooks[Math.floor(Math.random() * hooks.length)];
    return hook + ' ' + content;
  }
  
  private static hasCuriosityGap(content: string): boolean {
    const gaps = ['Here\'s why:', 'The reason?', 'This changes', 'Here\'s what', 'The twist?'];
    return gaps.some(gap => content.toLowerCase().includes(gap.toLowerCase()));
  }
  
  private static addCuriosityGap(content: string): string {
    if (content.length < 200) {
      return content + " Here's why this matters:";
    }
    return content;
  }
  
  private static hasEngagementEnding(content: string): boolean {
    const endings = ['?', 'thoughts?', 'experience?', 'you?', '👇'];
    return endings.some(ending => content.toLowerCase().includes(ending));
  }
  
  private static addEngagementEnding(content: string): string {
    const endings = [
      'What\'s your experience?',
      'Have you tried this?',
      'Thoughts? 👇',
      'What would you add?'
    ];
    const ending = endings[Math.floor(Math.random() * endings.length)];
    return content + ' ' + ending;
  }
  
  static calculateViralScore(content: string): number {
    let score = 50; // Base score
    
    // Hook bonus
    if (this.hasStrongHook(content)) score += 15;
    
    // Length optimization
    if (content.length >= 120 && content.length <= 240) score += 10;
    
    // Curiosity gap bonus
    if (this.hasCuriosityGap(content)) score += 10;
    
    // Engagement ending bonus
    if (this.hasEngagementEnding(content)) score += 10;
    
    // Authority signal bonus
    if (content.includes('research') || content.includes('study') || content.includes('data')) score += 5;
    
    return Math.min(100, score);
  }
}