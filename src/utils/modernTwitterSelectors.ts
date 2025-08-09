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
      
      // Method 2: Look for buttons containing "Post" or "Tweet" text WITH VALIDATION
      try {
        console.log('🔍 Looking for buttons with Post/Tweet text...');
        
        // First check if textarea has content before attempting to post
        const hasContent = await page.evaluate(() => {
          const textareas = Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"], [role="textbox"]'));
          for (const textarea of textareas) {
            if (textarea.textContent && textarea.textContent.trim().length > 0) {
              return true;
            }
          }
          return false;
        });
        
        if (!hasContent) {
          console.log('❌ No content detected in textarea - posting would fail');
          return false;
        }
        
        // Check for visible, enabled buttons with specific text patterns
        const postButtonFound = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
          console.log(`🔍 Scanning ${buttons.length} buttons for post functionality...`);
          
          for (const button of buttons) {
            const text = button.textContent?.toLowerCase() || '';
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            const dataTestId = button.getAttribute('data-testid') || '';
            
            // Expanded search patterns for modern Twitter/X
            const isPostButton = 
              text.includes('post') || text.includes('tweet') || text === 'post' || 
              ariaLabel.includes('post') || ariaLabel.includes('tweet') ||
              dataTestId.includes('tweet') || dataTestId.includes('post') ||
              // Check for buttons that might just be icons or have minimal text
              (button.closest('[data-testid*="tweet"]') !== null) ||
              // Look for submit-type buttons in compose areas
              (button.type === 'submit' && button.closest('[data-testid*="compose"]'));
            
            if (isPostButton) {
              // Check if button is visible and enabled
              const rect = button.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0;
              const isEnabled = !button.hasAttribute('disabled') && 
                               !button.classList.contains('disabled') &&
                               !button.hasAttribute('aria-disabled');
              
              // Additional validation - check if button looks like it can actually post
              const styles = window.getComputedStyle(button);
              const hasValidColor = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                                  styles.backgroundColor !== 'transparent';
              
              console.log(`🔍 Checking button: text="${text}" aria="${ariaLabel}" testid="${dataTestId}" visible=${isVisible} enabled=${isEnabled} colored=${hasValidColor}`);
              
              if (isVisible && isEnabled && hasValidColor) {
                console.log(`✅ Found validated post button: text="${text}" aria="${ariaLabel}" testid="${dataTestId}"`);
                (button as HTMLElement).click();
                return true;
              }
            }
          }
          
          // Fallback: Look for any prominently positioned button that might be the post button
          console.log('🔍 Fallback: Looking for prominent buttons...');
          for (const button of buttons) {
            const rect = button.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isEnabled = !button.hasAttribute('disabled') && !button.classList.contains('disabled');
            const styles = window.getComputedStyle(button);
            
            // Look for buttons with Twitter's blue color (likely post buttons)
            const bgColor = styles.backgroundColor;
            const isBlueish = bgColor.includes('rgb(29, 155, 240)') || // Twitter blue
                            bgColor.includes('rgb(26, 140, 216)') || // Darker blue
                            styles.color.includes('rgb(255, 255, 255)'); // White text (common on post buttons)
            
            if (isVisible && isEnabled && isBlueish && rect.width > 50 && rect.height > 30) {
              console.log(`✅ Found prominent button by color/size: bg="${bgColor}" size=${rect.width}x${rect.height}`);
              (button as HTMLElement).click();
              return true;
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
            const buttonElement = button as HTMLButtonElement | HTMLInputElement;
            if (buttonElement.type === 'submit' || className.includes('submit') || 
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