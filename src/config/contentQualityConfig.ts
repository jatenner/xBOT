/**
 * 🎯 CONTENT QUALITY CONFIGURATION
 * ================================
 * High-quality content generation settings
 */

export const CONTENT_QUALITY_CONFIG = {
    // Minimum quality thresholds
    MIN_ENGAGEMENT_PREDICTION: 15, // 15% minimum predicted engagement
    MIN_CONFIDENCE_SCORE: 70,      // 70% minimum confidence
    MIN_LEARNING_INSIGHTS: 3,      // Use at least 3 learning insights
    
    // Content diversity requirements
    TOPIC_ROTATION_HOURS: 4,       // Switch topics every 4 hours
    FORMAT_VARIETY_TARGET: 0.6,    // 60% format variety
    
    // Quality enhancement features
    ENABLE_VIRAL_LEARNING: true,
    ENABLE_ENGAGEMENT_PREDICTION: true,
    ENABLE_REAL_TIME_OPTIMIZATION: true,
    
    // Fallback prevention
    DISABLE_MOCK_CONTENT: true,
    REQUIRE_AI_GENERATION: true,
    
    // Performance targets
    TARGET_ENGAGEMENT_RATE: 25,    // 25% target engagement
    TARGET_GROWTH_RATE: 10,        // 10 new followers per day
    
    // Content categories (health focus)
    PRIORITY_TOPICS: [
        'longevity_breakthroughs',
        'nutrition_optimization', 
        'mental_performance',
        'biohacking_science',
        'health_myth_busting'
    ]
};

export const VIRAL_CONTENT_PATTERNS = {
    // Proven viral formats from our learning system
    hook_patterns: [
        'You\'ve been lied to about {topic}',
        'The {number} things about {topic} that will shock you',
        'Why {controversial_statement} is actually true',
        'Scientists discovered {surprising_fact} about {topic}'
    ],
    
    value_patterns: [
        'Here\'s what the research actually shows:',
        'The truth based on 50+ studies:',
        'What top researchers are saying:',
        'The mechanism behind this is:'
    ],
    
    cta_patterns: [
        'Save this thread for reference 🧵',
        'Share with someone who needs to see this',
        'Which of these surprised you most?',
        'What\'s your experience with this?'
    ]
};