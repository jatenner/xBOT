/**
 * 🚀 ENHANCED VIRAL CONTENT TEMPLATES
 * High-engagement templates that consistently drive viral responses
 */

export const ENHANCED_VIRAL_TEMPLATES = {
  // Data-driven insights that spark curiosity
  DATA_INSIGHT: [
    "🧠 New study: {statistic} of people who {action} see {benefit}. The mechanism? {explanation}",
    "📊 Researchers found {surprising_finding}. Here's what this means for your {health_area}:",
    "⚡ Breaking: {authority} just released data showing {insight}. This changes everything about {topic}",
    "🔬 Scientists discovered {finding}. If you {common_behavior}, you need to know this:",
    "📈 {percentage}% improvement in {metric} just from {simple_action}. Here's the science:"
  ],
  
  // Contrarian takes that challenge conventional wisdom
  CONTRARIAN: [
    "🔥 Unpopular opinion: {controversial_statement}. Here's why everyone gets {topic} wrong:",
    "❌ Stop doing {common_practice}. New research shows it actually {negative_effect}",
    "🚨 The {popular_advice} myth is destroying your {health_aspect}. Do this instead:",
    "⚠️ Everyone recommends {popular_method}, but {percentage}% of people get worse results. The real solution:",
    "💥 {Authority} was wrong about {topic}. Here's what actually works:"
  ],
  
  // Story-driven content that creates emotional connection
  STORY_DRIVEN: [
    "🎯 My {health_metric} was terrible. Then I tried {method} for {timeframe}. The results shocked me:",
    "😤 I was skeptical about {practice} until {event}. Now I understand why {authority} swears by it:",
    "💡 Random conversation with {person_type} changed my entire approach to {health_area}:",
    "🔄 After {timeframe} of {struggle}, this {simple_change} fixed everything:",
    "⚡ {Specific_moment} made me realize {insight}. Here's what I learned:"
  ],
  
  // Question hooks that drive engagement
  ENGAGEMENT_HOOKS: [
    "❓ What if {common_belief} is actually backwards? New research suggests {alternative}",
    "🤔 Why do {group} have {positive_trait} while {other_group} struggle with {problem}?",
    "💭 Quick question: Do you {behavior}? This might explain {consequence}",
    "🎯 Would you rather {option_a} or {option_b}? Your choice reveals {insight}",
    "⚡ Can you {challenge} in {timeframe}? Here's why it matters:"
  ],
  
  // Actionable how-to content with immediate value
  ACTIONABLE_VALUE: [
    "🎯 3-step method to {achieve_goal}: \n1) {step_one}\n2) {step_two}\n3) {step_three}\nResults in {timeframe}",
    "⚡ {Time_period} protocol that {specific_benefit}: {detailed_instructions}",
    "🔧 Fix {problem} in {timeframe} with this {method}: {step_by_step}",
    "📋 Daily checklist for {goal}: {actionable_items}",
    "🎪 Simple {timeframe} routine that {benefit}: {specific_actions}"
  ]
};

export const VIRAL_TRIGGERS = {
  // Elements that make content more shareable
  CURIOSITY_GAPS: [
    "Here's what shocked me:",
    "The results were unexpected:",
    "This changes everything:",
    "You won't believe what happened:",
    "The twist? "
  ],
  
  AUTHORITY_SIGNALS: [
    "New research shows",
    "Scientists discovered",
    "Studies reveal",
    "Data indicates",
    "Research confirms"
  ],
  
  URGENCY_CREATORS: [
    "This is time-sensitive:",
    "Don't wait on this:",
    "The window is closing:",
    "Act now because:",
    "Limited time insight:"
  ],
  
  SOCIAL_PROOF: [
    "Thousands are doing this:",
    "The smartest people I know:",
    "Top performers use:",
    "Elite athletes swear by:",
    "Industry leaders recommend:"
  ]
};

export function generateViralContent(category: string, topic: string): string {
  const templates = ENHANCED_VIRAL_TEMPLATES[category] || ENHANCED_VIRAL_TEMPLATES.DATA_INSIGHT;
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Add viral triggers for enhanced engagement
  const trigger = VIRAL_TRIGGERS.CURIOSITY_GAPS[Math.floor(Math.random() * VIRAL_TRIGGERS.CURIOSITY_GAPS.length)];
  
  return template + " " + trigger;
}

export const ENGAGEMENT_OPTIMIZATION = {
  // Optimal length ranges for different platforms
  TWITTER_OPTIMAL_LENGTH: { min: 120, max: 240 },
  
  // Engagement multipliers
  QUESTION_MULTIPLIER: 1.3,
  NUMBERS_MULTIPLIER: 1.2,
  CONTROVERSY_MULTIPLIER: 1.4,
  STORY_MULTIPLIER: 1.1,
  
  // Call-to-action templates
  CTA_TEMPLATES: [
    "What's your experience with this?",
    "Have you tried this approach?",
    "Which method works best for you?",
    "What would you add to this list?",
    "Share your thoughts below 👇"
  ]
};