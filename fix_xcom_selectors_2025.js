#!/usr/bin/env node

/**
 * 🔧 X.COM SELECTORS UPDATE - 2025 INTERFACE
 * ==========================================
 * Updates Playwright selectors for current X.com interface
 */

const fs = require('fs');
const path = require('path');

// Updated selectors based on current X.com interface (July 2025)
const UPDATED_SELECTORS = {
    // Compose button - updated for 2025
    compose_button: [
        '[data-testid="SideNav_NewTweet_Button"]',
        'a[href="/compose/post"]',
        'a[href="/compose/tweet"]', 
        '[aria-label="Post"]',
        'div[aria-label="Post"][role="button"]',
        'button[data-testid="tweetButton"]'
    ],
    
    // Tweet text area - updated selectors
    tweet_textarea: [
        'div[data-testid="tweetTextarea_0"]',
        'div[aria-label="Post text"]',
        'div[contenteditable="true"][aria-label*="What is happening"]',
        'div[contenteditable="true"][data-testid*="tweet"]',
        'div[role="textbox"][data-testid*="tweet"]',
        '.public-DraftEditor-content'
    ],
    
    // Post button - most critical update needed
    post_button: [
        '[data-testid="tweetButton"]',           // Primary 2025 selector
        '[data-testid="tweetButtonInline"]',     // Inline version
        'button[data-testid="tweetButton"]',     // Explicit button
        'div[data-testid="tweetButton"]',        // Div version
        'button[role="button"]:has-text("Post")', // Text-based fallback
        '[aria-label="Post tweet"]',             // Accessibility
        'button:has-text("Post")',               // Simple text match
        '.css-175oi2r[role="button"]:has-text("Post")' // CSS class fallback
    ]
};

function updateBrowserTweetPoster() {
    const files = [
        'src/utils/browserTweetPoster.ts',
        'src/utils/enhancedBrowserTweetPoster.ts',
        'src/utils/roboticBrowserTweetPoster.ts'
    ];
    
    for (const file of files) {
        const filePath = path.join(process.cwd(), file);
        
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Update post button selectors with 2025 versions
            const oldPostSelectors = [
                'button[aria-label="Post"]',
                'button[aria-label*="Post"]',
                'div[role="button"]:has-text("Post")'
            ];
            
            const newPostSelector = '[data-testid="tweetButton"]';
            
            for (const oldSelector of oldPostSelectors) {
                content = content.replace(new RegExp(oldSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPostSelector);
            }
            
            // Add timeout adjustments for slower X.com loading
            content = content.replace(/timeout:\s*\d+/g, 'timeout: 30000');
            content = content.replace(/waitForTimeout\(\d+\)/g, 'waitForTimeout(5000)');
            
            fs.writeFileSync(filePath, content);
            console.log(`✅ Updated selectors in: ${file}`);
        }
    }
}

function createEnhancedSelectorStrategy() {
    const selectorFile = path.join(process.cwd(), 'src/utils/xcom2025Selectors.ts');
    
    const selectorContent = `/**
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
        console.log(\`⚠️  Primary selector failed: \${selectorGroup.primary}\`);
    }
    
    // Try fallback selectors
    for (let i = 0; i < selectorGroup.fallbacks.length; i++) {
        try {
            const element = await page.waitForSelector(selectorGroup.fallbacks[i], { 
                timeout: 8000,
                state: 'visible'
            });
            console.log(\`✅ Found element with fallback \${i + 1}: \${selectorGroup.fallbacks[i]}\`);
            return element;
        } catch (error) {
            console.log(\`⚠️  Fallback \${i + 1} failed: \${selectorGroup.fallbacks[i]}\`);
        }
    }
    
    throw new Error('All selectors failed for element group');
}`;

    fs.writeFileSync(selectorFile, selectorContent);
    console.log('✅ Created enhanced selector strategy file');
}

function main() {
    console.log('🔧 Updating X.com selectors for 2025 interface...');
    
    updateBrowserTweetPoster();
    createEnhancedSelectorStrategy();
    
    console.log('🎉 X.com selector update completed!');
    console.log('📋 Next steps:');
    console.log('   1. Commit and push changes');
    console.log('   2. Railway will auto-deploy');
    console.log('   3. Bot should post successfully');
}

if (require.main === module) {
    main();
}

module.exports = { updateBrowserTweetPoster, createEnhancedSelectorStrategy };