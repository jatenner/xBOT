/**
 * 🎯 MODERN TWITTER SELECTORS (2025)
 * Updated for current Twitter/X interface based on actual DOM inspection
 */

export class ModernTwitterSelectors {
  /**
   * Find and click post button using intelligent DOM inspection
   */
  static async findAndClickPostButton(page: any): Promise<boolean> {
    try {
      console.log('🔍 Starting intelligent post button detection...');
      
      // Method 1: Traditional data-testid selectors
      const traditionalSelectors = [
        '[data-testid="tweetButton"]',
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton-default"]'
      ];
      
      for (const selector of traditionalSelectors) {
        try {
          console.log(`🎯 Trying traditional selector: ${selector}`);
          await page.click(selector);
          console.log(`✅ Success with traditional selector: ${selector}`);
          return true;
        } catch (error) {
          console.log(`❌ Traditional selector failed: ${selector}`);
        }
      }
      
      // Method 2: Look for buttons containing "Post" or "Tweet" text
      try {
        console.log('🔍 Looking for buttons with Post/Tweet text...');
        
        // Check for visible, enabled buttons with specific text patterns
        const postButtonFound = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
          
          for (const button of buttons) {
            const text = button.textContent?.toLowerCase() || '';
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            
            // Look for Post/Tweet related content
            if (text.includes('post') || text.includes('tweet') || 
                ariaLabel.includes('post') || ariaLabel.includes('tweet')) {
              
              // Check if button is visible and enabled
              const rect = button.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0;
              const isEnabled = !button.hasAttribute('disabled');
              
              if (isVisible && isEnabled) {
                console.log('Found post button via text search:', text, ariaLabel);
                (button as HTMLElement).click();
                return true;
              }
            }
          }
          return false;
        });
        
        if (postButtonFound) {
          console.log('✅ Success with text-based button detection');
          return true;
        }
      } catch (error) {
        console.log('❌ Text-based button detection failed:', error);
      }
      
      // Method 3: Look for any button that might be a submit button
      try {
        console.log('🔍 Looking for submit-style buttons...');
        
        const submitButtonFound = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button[type="submit"], button:not([disabled])'));
          
          // Find buttons that look like submit buttons (not close/cancel)
          for (const button of buttons) {
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            const className = button.className.toLowerCase();
            
            // Skip obvious non-submit buttons
            if (ariaLabel.includes('close') || ariaLabel.includes('cancel') || 
                ariaLabel.includes('back') || ariaLabel.includes('previous')) {
              continue;
            }
            
            // Look for submit-like characteristics
            if (button.type === 'submit' || className.includes('submit') || 
                className.includes('primary') || className.includes('tweet')) {
              
              const rect = button.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                console.log('Found submit-style button:', button.outerHTML.substring(0, 100));
                (button as HTMLElement).click();
                return true;
              }
            }
          }
          return false;
        });
        
        if (submitButtonFound) {
          console.log('✅ Success with submit-style button detection');
          return true;
        }
      } catch (error) {
        console.log('❌ Submit-style button detection failed:', error);
      }
      
      // Method 4: Try keyboard shortcut as last resort
      try {
        console.log('🔍 Trying keyboard shortcut (Ctrl+Enter)...');
        await page.keyboard.press('Control+Enter');
        
        // Wait a moment to see if it worked
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ Used keyboard shortcut for posting');
        return true;
      } catch (error) {
        console.log('❌ Keyboard shortcut failed:', error);
      }
      
      console.log('❌ All post button detection methods failed');
      return false;
      
    } catch (error) {
      console.log('❌ Post button detection error:', error);
      return false;
    }
  }
  
  /**
   * Enhanced textarea finding with modern Twitter selectors
   */
  static async findAndFillTextarea(page: any, content: string): Promise<boolean> {
    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      'div[aria-label="Post text"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      '.public-DraftEditor-content'
    ];
    
    for (const selector of selectors) {
      try {
        console.log(`🎯 Trying textarea selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.fill(selector, content);
        console.log(`✅ Success with textarea selector: ${selector}`);
        return true;
      } catch (error) {
        console.log(`❌ Textarea selector failed: ${selector}`);
      }
    }
    
    return false;
  }
}