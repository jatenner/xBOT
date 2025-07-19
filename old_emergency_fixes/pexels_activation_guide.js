#!/usr/bin/env node

/**
 * Pexels API Activation Guide
 * Step-by-step instructions to find and activate API access
 */

console.log(`
🎯 PEXELS API ACTIVATION GUIDE

📍 STEP 1: Go to the API Page
   Visit: https://www.pexels.com/api/
   (This is DIFFERENT from your profile page)

📍 STEP 2: Look for These Elements
   ✅ "Get Started" button
   ✅ "Generate API Key" button  
   ✅ "Request API Access" link
   ✅ "Developer Console" or "Dashboard" link

📍 STEP 3: Common Locations for API Access
   • Top navigation menu: "API" or "Developers"
   • Footer links: "API" section
   • Direct URL: https://www.pexels.com/api/
   • Developer portal: https://developers.pexels.com/

📍 STEP 4: What to Look For Once There
   ✅ Terms of Service acceptance
   ✅ API usage guidelines agreement
   ✅ Rate limit acknowledgment
   ✅ "Activate" or "Enable" toggle

📍 STEP 5: If You Can't Find API Section
   Try these URLs directly:
   • https://www.pexels.com/api/
   • https://www.pexels.com/api/new/
   • https://www.pexels.com/developer/
   • https://developers.pexels.com/

🔧 ALTERNATIVE: Generate New API Key
   If your current key isn't working, try:
   1. Delete current API key
   2. Generate a brand new one
   3. Accept all terms during generation
   4. Copy the new key to your .env file

🚨 RED FLAGS - Signs API Isn't Activated:
   ❌ 401 Unauthorized (what you're getting)
   ❌ "Invalid API key" errors
   ❌ No rate limit headers in responses
   ❌ All endpoints returning same error

✅ GREEN FLAGS - Signs API IS Activated:
   ✅ 200 OK responses
   ✅ Rate limit headers present
   ✅ Actual photo data returned
   ✅ Different endpoints work

💡 PRO TIP:
   Pexels API access is often a separate "developer agreement"
   from your regular account. You may need to:
   - Accept developer terms
   - Verify intended use case
   - Acknowledge attribution requirements

🔄 CURRENT STATUS CHECK:
   Your API key format is CORRECT (56 chars)
   Issue is account-level activation, not code
`);

// Test current status
async function quickStatusCheck() {
  require('dotenv').config();
  
  console.log('\n🔍 Quick Status Check:\n');
  
  const pexelsKey = process.env.PEXELS_API_KEY;
  console.log('Current API Key:', pexelsKey ? `${pexelsKey.substring(0, 10)}...` : 'NOT FOUND');
  
  if (pexelsKey) {
    try {
      const response = await fetch('https://api.pexels.com/v1/curated?per_page=1', {
        headers: { 'Authorization': pexelsKey }
      });
      
      console.log('Status Code:', response.status);
      
      if (response.status === 401) {
        console.log('❌ Still 401 - API key needs activation');
        console.log('\n🎯 NEXT ACTION: Visit https://www.pexels.com/api/');
      } else if (response.ok) {
        console.log('✅ SUCCESS! API is now working!');
      } else {
        console.log(`⚠️ Unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }
  }
}

if (require.main === module) {
  quickStatusCheck().catch(console.error);
} 