#!/usr/bin/env node

/**
 * 🔧 Fix Image Agent for Monthly Cap
 * ==================================
 * 
 * Updates imageAgent.ts to check for monthly cap text-only mode
 * and return null when images are disabled
 */

const fs = require('fs');
const path = require('path');

async function fixImageAgentForMonthlyCap() {
  console.log('🔧 Fixing Image Agent for Monthly Cap...');
  
  const imageAgentPath = path.join('src', 'agents', 'imageAgent.ts');
  
  if (!fs.existsSync(imageAgentPath)) {
    console.log('❌ imageAgent.ts not found');
    return;
  }
  
  let content = fs.readFileSync(imageAgentPath, 'utf8');
  
  // Add monthly cap check at the beginning of chooseImage function
  const monthlyCapCheck = `
  // 🚨 MONTHLY CAP CHECK: Force text-only mode
  try {
    const { data: monthlyCapConfig } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('value')
      .eq('key', 'monthly_cap_workaround')
      .single() || { data: null };

    const { data: textOnlyConfig } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('value')
      .eq('key', 'emergency_text_only_mode')
      .single() || { data: null };

    // Check for monthly cap or text-only mode
    if (monthlyCapConfig?.value?.enabled || 
        monthlyCapConfig?.value?.force_text_only_posts ||
        textOnlyConfig?.value?.enabled ||
        textOnlyConfig?.value?.force_text_only) {
      console.log('🚫 MONTHLY CAP: Text-only mode active - skipping image generation');
      return null;
    }
  } catch (error) {
    console.log('⚠️ Could not check monthly cap status, proceeding with images');
  }
`;

  // Find the chooseImage function and add the check at the beginning
  content = content.replace(
    /(export async function chooseImage.*?\{)/,
    `$1${monthlyCapCheck}`
  );

  // Also update the ImageAgent class method if it exists
  content = content.replace(
    /(async chooseImage.*?\{)/,
    `$1${monthlyCapCheck}`
  );

  fs.writeFileSync(imageAgentPath, content);
  console.log('✅ Image Agent updated for monthly cap mode');
}

fixImageAgentForMonthlyCap().catch(console.error); 