#!/usr/bin/env node

/**
 * Pexels API Fix Tool
 * Comprehensive troubleshooting for 401 Unauthorized errors
 */

require('dotenv').config();

async function testPexelsAPIFormats() {
  const pexelsKey = process.env.PEXELS_API_KEY;
  
  if (!pexelsKey) {
    console.log('❌ PEXELS_API_KEY not found in environment');
    return false;
  }
  
  console.log('🔍 Pexels API Key Analysis:');
  console.log('Key present:', !!pexelsKey);
  console.log('Key length:', pexelsKey.length);
  console.log('Key prefix:', pexelsKey.substring(0, 15) + '...');
  console.log('Key format check:', /^[a-zA-Z0-9]{50,60}$/.test(pexelsKey) ? '✅ Valid format' : '⚠️ Unusual format');
  
  // Test different authorization header formats
  const testFormats = [
    { name: 'Standard Format', header: pexelsKey },
    { name: 'Bearer Format', header: `Bearer ${pexelsKey}` },
    { name: 'API Key Format', header: `API-Key ${pexelsKey}` }
  ];
  
  console.log('\n🧪 Testing Different Authorization Formats:\n');
  
  for (const format of testFormats) {
    console.log(`Testing ${format.name}...`);
    
    try {
      const response = await fetch(
        'https://api.pexels.com/v1/search?query=test&per_page=1',
        {
          method: 'GET',
          headers: {
            'Authorization': format.header,
            'User-Agent': 'xBOT/1.0 (Healthcare AI Bot)',
            'Accept': 'application/json'
          }
        }
      );
      
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ SUCCESS! ${format.name} works!`);
        console.log(`  Photos available: ${data.total_results}`);
        return { success: true, format: format.name, header: format.header };
      } else {
        const errorText = await response.text();
        console.log(`  ❌ Failed: ${errorText}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Network error: ${error.message}`);
    }
    
    // Wait between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { success: false };
}

async function testPexelsEndpoints() {
  const pexelsKey = process.env.PEXELS_API_KEY;
  
  console.log('\n🔗 Testing Different Pexels Endpoints:\n');
  
  const endpoints = [
    { name: 'Search API', url: 'https://api.pexels.com/v1/search?query=nature&per_page=1' },
    { name: 'Curated API', url: 'https://api.pexels.com/v1/curated?per_page=1' },
    { name: 'Popular API', url: 'https://api.pexels.com/v1/popular?per_page=1' }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint.name}...`);
    
    try {
      const response = await fetch(endpoint.url, {
        headers: {
          'Authorization': pexelsKey,
          'User-Agent': 'xBOT/1.0'
        }
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ ${endpoint.name} works! Photos: ${data.photos?.length || 0}`);
      } else {
        const error = await response.text();
        console.log(`  ❌ Failed: ${error}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function checkPexelsAccountStatus() {
  console.log('\n📋 Pexels Account Status Check:\n');
  
  const pexelsKey = process.env.PEXELS_API_KEY;
  
  // Try to get account info (this might not be available in free tier)
  try {
    const response = await fetch('https://api.pexels.com/v1/curated?per_page=1', {
      headers: {
        'Authorization': pexelsKey,
        'User-Agent': 'xBOT/1.0'
      }
    });
    
    const headers = Object.fromEntries(response.headers);
    
    console.log('Response Headers Analysis:');
    console.log('Rate Limit Info:');
    console.log('  X-RateLimit-Limit:', headers['x-ratelimit-limit'] || 'Not provided');
    console.log('  X-RateLimit-Remaining:', headers['x-ratelimit-remaining'] || 'Not provided');
    console.log('  X-RateLimit-Reset:', headers['x-ratelimit-reset'] || 'Not provided');
    
    if (response.status === 401) {
      console.log('\n🚨 Common 401 Fixes:');
      console.log('1. ✅ Visit https://www.pexels.com/api/');
      console.log('2. ✅ Click "Get Started" or "Generate API Key"');
      console.log('3. ✅ Check if you need to accept Terms of Service');
      console.log('4. ✅ Verify email address is confirmed');
      console.log('5. ✅ Check if API key is activated (not just generated)');
      console.log('\n📱 Try these steps:');
      console.log('   • Log into Pexels account');
      console.log('   • Go to API dashboard');
      console.log('   • Look for "Activate" or "Enable" button');
      console.log('   • Accept any pending terms or agreements');
    }
    
  } catch (error) {
    console.log('Error checking account status:', error.message);
  }
}

async function generateFixedChooseImageCode() {
  console.log('\n🔧 Generating Fixed chooseImage.ts Code:\n');
  
  const fixedCode = `
// Fixed Pexels API integration for chooseImage.ts
// Add this to your chooseImage.ts file

async function fetchPexelsImage(query: string): Promise<any> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  
  if (!pexelsKey) {
    console.log('⚠️ Pexels API key not found, using fallback');
    return null;
  }
  
  try {
    const response = await fetch(
      \`https://api.pexels.com/v1/search?query=\${encodeURIComponent(query)}&per_page=10&orientation=landscape\`,
      {
        method: 'GET',
        headers: {
          'Authorization': pexelsKey, // Standard format that works
          'User-Agent': 'xBOT/1.0 (Healthcare AI Bot)',
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.log(\`⚠️ Pexels API error: \${response.status}\`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.photos && data.photos.length > 0) {
      // Return random photo from results
      const randomPhoto = data.photos[Math.floor(Math.random() * data.photos.length)];
      return {
        url: randomPhoto.src.large,
        id: randomPhoto.id,
        photographer: randomPhoto.photographer,
        source: 'Pexels'
      };
    }
    
    return null;
  } catch (error) {
    console.log('⚠️ Pexels fetch error:', error.message);
    return null;
  }
}
`;
  
  console.log('Copy this code to integrate fixed Pexels API:');
  console.log('=' * 50);
  console.log(fixedCode);
  console.log('=' * 50);
}

async function testRealWorldScenario() {
  console.log('\n🌍 Testing Real-World Healthcare Scenario:\n');
  
  const pexelsKey = process.env.PEXELS_API_KEY;
  const testQueries = [
    'artificial intelligence healthcare',
    'medical technology',
    'healthcare innovation',
    'digital health'
  ];
  
  for (const query of testQueries) {
    console.log(`Testing query: "${query}"`);
    
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
        {
          headers: {
            'Authorization': pexelsKey,
            'User-Agent': 'xBOT/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Found ${data.photos?.length || 0} images`);
        if (data.photos?.[0]) {
          console.log(`  📸 Sample: ${data.photos[0].alt || 'Healthcare image'}`);
        }
      } else {
        console.log(`  ❌ Failed with status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function main() {
  console.log('🔧 Pexels API Comprehensive Fix Tool\n');
  console.log('This tool will diagnose and fix common Pexels API issues.\n');
  
  // Step 1: Test different authorization formats
  const formatResult = await testPexelsAPIFormats();
  
  if (formatResult.success) {
    console.log(`\n🎉 SUCCESS! Found working format: ${formatResult.format}`);
    console.log(`Working header: ${formatResult.header}`);
    
    // Test real scenarios
    await testRealWorldScenario();
    
    console.log('\n✅ PEXELS API IS WORKING!');
    console.log('Your bot can now use diverse, high-quality images from Pexels!');
    
  } else {
    console.log('\n❌ All formats failed. Checking account status...');
    
    // Step 2: Check account status and provide fixes
    await checkPexelsAccountStatus();
    
    // Step 3: Test different endpoints
    await testPexelsEndpoints();
    
    // Step 4: Generate fixed code
    await generateFixedChooseImageCode();
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Visit https://www.pexels.com/api/');
    console.log('2. Log into your account');
    console.log('3. Look for API activation or terms acceptance');
    console.log('4. Generate a new API key if needed');
    console.log('5. Re-run this script to test');
  }
}

if (require.main === module) {
  main().catch(console.error);
} 