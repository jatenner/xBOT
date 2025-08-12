import { createClient } from '@supabase/supabase-js';

async function auditTwitterCookies() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  
  try {
    // Fetch twitter cookies row
    const { data, error } = await supabase
      .from('browser_cookies')
      .select('data')
      .eq('id', 'twitter')
      .single();

    if (error) {
      console.error('❌ Failed to fetch cookies:', error.message);
      process.exit(1);
    }

    if (!data?.data || !Array.isArray(data.data)) {
      console.error('❌ No valid cookie data found');
      process.exit(1);
    }

    const cookies = data.data;
    console.log(`📊 Total cookies: ${cookies.length}`);

    // Required cookies to check
    const requiredCookies = [
      'auth_token', 'ct0', 'twid', 'kdt', 
      'personalization_id', 'guest_id', 'guest_id_ads', 
      'guest_id_marketing', 'lang', 'att'
    ];

    // Check presence
    const presentCookies = [];
    const missingCookies = [];
    const cookieMap = new Map();

    cookies.forEach(cookie => {
      cookieMap.set(cookie.name, cookie);
    });

    requiredCookies.forEach(name => {
      if (cookieMap.has(name)) {
        presentCookies.push(name);
      } else {
        missingCookies.push(name);
      }
    });

    console.log(`✅ Present cookies: ${presentCookies.join(', ')}`);
    if (missingCookies.length > 0) {
      console.log(`⚠️ Missing cookies: ${missingCookies.join(', ')}`);
    }

    // Check critical cookies have correct domains
    let normalizedCount = 0;
    const criticalCookies = ['auth_token', 'ct0'];
    
    criticalCookies.forEach(name => {
      const cookie = cookieMap.get(name);
      if (cookie) {
        const correctDomain = cookie.domain === '.x.com' || cookie.domain === '.twitter.com';
        const hasRequiredFields = cookie.path === '/' && cookie.httpOnly === true && cookie.secure === true;
        
        if (!correctDomain) {
          console.log(`🔧 ${name}: domain needs normalization (${cookie.domain})`);
          normalizedCount++;
        }
        if (!hasRequiredFields) {
          console.log(`🔧 ${name}: security flags need normalization`);
          normalizedCount++;
        }
      }
    });

    // Normalize if needed
    if (normalizedCount > 0) {
      console.log(`🔧 Normalizing ${normalizedCount} cookie attributes...`);
      
      const normalizedCookies = cookies.map(cookie => {
        const normalized = { ...cookie };
        
        // Ensure critical cookies have proper domain
        if (criticalCookies.includes(cookie.name)) {
          if (cookie.domain.includes('twitter.com')) {
            normalized.domain = '.x.com';
          }
          normalized.path = '/';
          normalized.httpOnly = true;
          normalized.secure = true;
        }
        
        return normalized;
      });

      // Update in Supabase
      const { error: updateError } = await supabase
        .from('browser_cookies')
        .upsert({
          id: 'twitter',
          data: normalizedCookies,
          updated_at: new Date().toISOString()
        });

      if (updateError) {
        console.error('❌ Failed to update normalized cookies:', updateError.message);
        process.exit(1);
      }

      console.log('✅ Cookie normalization complete');
    } else {
      console.log('✅ All cookies properly formatted');
    }

    // Final summary
    const hasAuthToken = cookieMap.has('auth_token') && 
      (cookieMap.get('auth_token').domain.includes('x.com') || 
       cookieMap.get('auth_token').domain.includes('twitter.com'));
    const hasCT0 = cookieMap.has('ct0');
    
    console.log('📋 AUDIT SUMMARY:');
    console.log(`   Auth token: ${hasAuthToken ? '✅' : '❌'}`);
    console.log(`   CSRF token (ct0): ${hasCT0 ? '✅' : '❌'}`);
    console.log(`   Present keys: ${presentCookies.length}/${requiredCookies.length}`);
    console.log(`   Normalized: ${normalizedCount > 0 ? 'Yes' : 'No'}`);
    console.log(`   Final count: ${cookies.length} cookies`);

  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    process.exit(1);
  }
}

auditTwitterCookies();