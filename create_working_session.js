#!/usr/bin/env node

/**
 * 🚨 EMERGENCY SESSION CREATOR
 * Creates a properly formatted Twitter session for Railway deployment
 */

console.log('🚨 EMERGENCY: Creating properly formatted Twitter session...');
console.log('===============================================');

// 🍪 Your cookies from earlier (you provided these):
const cookies = [
  {
    name: "auth_token",
    value: "e5738f434fc09376ae0bb0c5048b71d2fdb0daaa",
    domain: ".x.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "None",
    expires: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  },
  {
    name: "ct0", 
    value: "5b32d6d820f15b4f7942f29e7197dc31ad67f4860e04710bdfa19307aab847dc4acca4ac0b2d28432456e8e0a864d392f1a13f393a3077a4d775d041f12f381d5e6f87f4189d0faf7a6b7b3187ba9149",
    domain: ".x.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  },
  {
    name: "twid",
    value: "u=1932615318519808000",
    domain: ".x.com", 
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  },
  {
    name: "personalization_id",
    value: "v1_" + Math.random().toString(36).substring(2),
    domain: ".x.com",
    path: "/", 
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  }
];

// 🔧 Create base64 encoded session
const sessionB64 = Buffer.from(JSON.stringify(cookies)).toString('base64');

console.log('✅ PROPERLY FORMATTED SESSION CREATED');
console.log('=====================================');
console.log('');
console.log('🍪 Cookies included:');
cookies.forEach(cookie => {
  console.log(`   ✅ ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
});

console.log('');
console.log('📏 Session length:', sessionB64.length, 'characters');
console.log('');
console.log('🚀 DEPLOY THIS SESSION TO RAILWAY:');
console.log('==================================');
console.log('');
console.log('railway variables --set "TWITTER_SESSION_B64=' + sessionB64 + '"');
console.log('');
console.log('✅ This session has PROPER cookie format with name/value pairs!');
console.log('✅ Should fix the "cookies[0].name: expected string, got undefined" error!');
