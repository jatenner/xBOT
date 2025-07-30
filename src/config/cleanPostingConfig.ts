/**
 * 🎯 CLEAN POSTING CONFIGURATION
 * ==============================
 * Ensures bot only posts original content, no fake replies
 */

export const CLEAN_POSTING_CONFIG = {
    // Content types allowed
    ALLOWED_CONTENT_TYPES: [
        'original_tweet',
        'thread_post', 
        'quote_tweet' // Only if quoting real content
    ],
    
    // Content types FORBIDDEN
    FORBIDDEN_CONTENT_TYPES: [
        'fake_reply',
        'mock_response',
        'placeholder_content',
        'template_reply'
    ],
    
    // Engagement actions (all disabled for clean posting)
    ENGAGEMENT_ACTIONS: {
        likes: false,
        follows: false, 
        replies: false,
        retweets: false // Unless retweeting real content
    },
    
    // Content validation
    CONTENT_VALIDATION: {
        // Reject content that sounds like replies
        reject_reply_like_content: true,
        min_standalone_quality: 80,
        require_original_value: true
    },
    
    // Posting behavior
    POSTING_BEHAVIOR: {
        focus: 'original_content_only',
        strategy: 'viral_standalone_tweets',
        avoid_engagement_simulation: true
    }
};

export function validateContentIsNotReply(content: string): boolean {
    const replyIndicators = [
        'reply to tweet',
        'replying to',
        'in response to',
        'mock_tweet_',
        'action for user'
        // Removed '@' - legitimate templates can use @ mentions
    ];
    
    const contentLower = content.toLowerCase();
    return !replyIndicators.some(indicator => contentLower.includes(indicator));
}

export function isCleanStandaloneContent(content: string): boolean {
    // PHASE 1: Allow template content - be more permissive for data collection
    const hasMinimumLength = content.trim().length > 15;
    const isNotObviousReply = validateContentIsNotReply(content) && !content.startsWith('Reply to');
    
    // Allow templates with various punctuation patterns
    const hasValue = hasMinimumLength && (
        content.includes('.') || 
        content.includes('?') || 
        content.includes('!') ||
        content.includes(':') || // Allow "Health tip:" style content
        content.includes('\n') || // Allow multi-line content
        /[A-Z].*[a-z]/.test(content) // Has at least one proper sentence structure
    );
    
    // Allow common template patterns that are legitimate
    const isLegitimateTemplate = [
        'health tip',
        'reminder:',
        'quick poll',
        'what\'s',
        'which health',
        'stay hydrated',
        'small consistent changes'
    ].some(pattern => content.toLowerCase().includes(pattern));
    
    return (hasValue || isLegitimateTemplate) && isNotObviousReply;
}