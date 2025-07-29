/**
 * 🎯 X.COM 2025 INTERFACE SELECTORS
 * =================================
 * Updated selectors for current X.com interface
 */

export const XCOM_2025_SELECTORS = {
    compose: {
        primary: '[data-testid="SideNav_NewTweet_Button"]',
        fallbacks: [
            'a[href="/compose/post"]',
            'a[href="/compose/tweet"]',
            '[aria-label="Post"]',
            'div[aria-label="Post"][role="button"]'
        ]
    },
    
    textarea: {
        primary: 'div[data-testid="tweetTextarea_0"]',
        fallbacks: [
            'div[aria-label="Post text"]',
            'div[contenteditable="true"][aria-label*="What is happening"]',
            'div[contenteditable="true"][data-testid*="tweet"]',
            'div[role="textbox"]'
        ]
    },
    
    postButton: {
        primary: '[data-testid="tweetButton"]',
        fallbacks: [
            '[data-testid="tweetButtonInline"]',
            'button[data-testid="tweetButton"]',
            'div[data-testid="tweetButton"]',
            'button[role="button"]:has-text("Post")',
            '[aria-label="Post tweet"]'
        ],
        // Extended timeout for slow loading
        timeout: 30000,
        retries: 5
    },
    
    confirmation: {
        primary: '[data-testid="toast"]',
        fallbacks: [
            'div[role="alert"]',
            'div[aria-live="polite"]',
            'div[data-testid="notification"]'
        ]
    }
};

// Helper function to try selectors in sequence
export async function findElementWithFallbacks(page: any, selectorGroup: any): Promise<any> {
    // Try primary selector first
    try {
        return await page.waitForSelector(selectorGroup.primary, { 
            timeout: 10000,
            state: 'visible'
        });
    } catch (error) {
        console.log(`⚠️  Primary selector failed: ${selectorGroup.primary}`);
    }
    
    // Try fallback selectors
    for (let i = 0; i < selectorGroup.fallbacks.length; i++) {
        try {
            const element = await page.waitForSelector(selectorGroup.fallbacks[i], { 
                timeout: 8000,
                state: 'visible'
            });
            console.log(`✅ Found element with fallback ${i + 1}: ${selectorGroup.fallbacks[i]}`);
            return element;
        } catch (error) {
            console.log(`⚠️  Fallback ${i + 1} failed: ${selectorGroup.fallbacks[i]}`);
        }
    }
    
    throw new Error('All selectors failed for element group');
}