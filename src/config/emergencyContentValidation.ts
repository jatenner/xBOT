// 🚨 EMERGENCY CONTENT VALIDATION
// Prevent all incomplete hooks and fake content

export function isEmergencyBlockedContent(content: string): boolean {
    // Block incomplete hooks
    const incompleteHooks = [
        /here's how to .+(?:in \d+ minutes?)?:?\s*$/i,
        /here are \d+ ways to .+:?\s*$/i,
        /the secret to .+ is:?\s*$/i,
        /\d+ tips for .+:?\s*$/i,
        /here's what .+ found:?\s*$/i
    ];

    // Block fake replies
    const fakeReplies = [
        /reply to tweet mock_tweet/i,
        /reply to tweet \d+/i,
        /action for user/i,
        /mock_tweet_\d+/i
    ];

    // Check all patterns
    const allPatterns = [...incompleteHooks, ...fakeReplies];
    
    for (const pattern of allPatterns) {
        if (pattern.test(content.trim())) {
            console.log(`🚨 EMERGENCY BLOCKED: ${pattern.source}`);
            return true;
        }
    }

    return false;
}

export const EMERGENCY_CONTENT_VALIDATION = {
    isBlocked: isEmergencyBlockedContent,
    reason: 'Emergency content validation - preventing fake and incomplete content'
};