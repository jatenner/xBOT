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
        'action for user',
        '@' // @ mentions suggest replies unless clearly original
    ];
    
    const contentLower = content.toLowerCase();
    return !replyIndicators.some(indicator => contentLower.includes(indicator));
}

export function isCleanStandaloneContent(content: string): boolean {
    // Must be standalone valuable content
    const hasValue = content.length > 50 && 
                    content.includes('.') && 
                    !content.startsWith('Reply to');
                    
    const isNotReply = validateContentIsNotReply(content);
    
    return hasValue && isNotReply;
}