const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/agents/postTweet.ts', 'utf8');

// Find the error handling section and replace it
const oldErrorHandling = `    } catch (error: any) {
      console.error('❌ Twitter posting error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }`;

const newErrorHandling = `    } catch (error: any) {
      console.error('❌ Twitter posting error:', error);
      
      // If rate limited (429), queue the draft instead of failing
      if (error.code === 429 || error.status === 429 || (error.message && error.message.includes('429'))) {
        console.log('📤 Rate limit hit, queuing draft for later posting...');
        try {
          const { queueDraft } = await import('../utils/drafts.js');
          const tweetStyle = this.determineTweetStyle(content);
          await queueDraft({
            content,
            source: \`AI-\${tweetStyle}\`,
            priority: 'medium',
            image_url: imageUrl
          });
          console.log('✅ Draft queued successfully for later posting');
          return { 
            success: false, 
            error: 'Rate limited - tweet queued for later posting'
          };
        } catch (queueError) {
          console.error('❌ Failed to queue draft:', queueError);
        }
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }`;

// Replace the error handling
content = content.replace(oldErrorHandling, newErrorHandling);

// Write back to file
fs.writeFileSync('src/agents/postTweet.ts', content);
console.log('✅ Added draft queue functionality to postTweet.ts');
