#!/usr/bin/env node

/**
 * 🔧 FIX RUNTIME CONFIG ENFORCEMENT
 * ==================================
 * 
 * Properly add human voice enforcement to runtime config
 */

const { createClient } = require('@supabase/supabase-js');

async function fixRuntimeConfigEnforcement() {
  console.log('🔧 FIX RUNTIME CONFIG ENFORCEMENT');
  console.log('==================================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔍 1. READING CURRENT RUNTIME CONFIG...');
    
    const { data: currentConfig, error } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    if (error || !currentConfig) {
      console.error('❌ Could not read runtime config:', error);
      return;
    }

    console.log('✅ Current config found, updating with enforcement...');

    const updatedConfig = {
      ...currentConfig.value,
      quality: {
        ...currentConfig.value.quality,
        readabilityMin: 45,
        credibilityMin: 0.75,
        prohibitHashtags: true,
        hashtagRejection: 'IMMEDIATE',
        humanVoiceMode: 'ENFORCED',
        naturalLanguageOnly: true,
        conversationalTone: true,
        expertiseLevel: 'PhD_PRACTITIONER'
      },
      content: {
        ...currentConfig.value.content,
        maxHashtags: 0,
        hashtagTolerance: 0,
        useNaturalLanguage: true,
        soundLikeHuman: true,
        expertPersonality: true,
        conversationalStyle: true
      },
      images: {
        ...currentConfig.value.images,
        usePercentage: 25,
        onlyWhenValuable: true,
        requireMedicalContext: true,
        blockGenericImages: true,
        qualityThreshold: 'HIGH'
      },
      intelligence: {
        ...currentConfig.value.intelligence,
        realTimeLearning: true,
        viralPatternAnalysis: true,
        competitorMonitoring: true,
        trendIdentification: true,
        engagementOptimization: true
      },
      updated: new Date().toISOString()
    };

    console.log('📝 2. UPDATING RUNTIME CONFIG...');

    const { error: updateError } = await supabase
      .from('bot_config')
      .update({ value: updatedConfig })
      .eq('key', 'runtime_config');

    if (updateError) {
      console.error('❌ Failed to update runtime config:', updateError);
      return;
    }

    console.log('✅ Runtime config updated successfully!');

    console.log('🔍 3. VERIFYING UPDATE...');

    const { data: verifyConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    if (verifyConfig?.value) {
      const config = verifyConfig.value;
      console.log('✅ VERIFIED SETTINGS:');
      console.log('   📊 Quality Settings:');
      console.log(`      • Readability min: ${config.quality?.readabilityMin}`);
      console.log(`      • Credibility min: ${config.quality?.credibilityMin}`);
      console.log(`      • Prohibit hashtags: ${config.quality?.prohibitHashtags}`);
      console.log(`      • Hashtag rejection: ${config.quality?.hashtagRejection}`);
      console.log(`      • Human voice mode: ${config.quality?.humanVoiceMode}`);
      
      console.log('   🖼️ Image Settings:');
      console.log(`      • Use percentage: ${config.images?.usePercentage}%`);
      console.log(`      • Only when valuable: ${config.images?.onlyWhenValuable}`);
      console.log(`      • Require medical context: ${config.images?.requireMedicalContext}`);
      console.log(`      • Block generic images: ${config.images?.blockGenericImages}`);
      
      console.log('   🧠 Intelligence Settings:');
      console.log(`      • Real-time learning: ${config.intelligence?.realTimeLearning}`);
      console.log(`      • Viral pattern analysis: ${config.intelligence?.viralPatternAnalysis}`);
      console.log(`      • Competitor monitoring: ${config.intelligence?.competitorMonitoring}`);
      console.log(`      • Engagement optimization: ${config.intelligence?.engagementOptimization}`);
    }

    console.log('');
    console.log('🎯 RUNTIME CONFIG ENFORCEMENT COMPLETE!');
    console.log('=======================================');
    console.log('');
    console.log('✅ ALL SYSTEMS ENFORCED:');
    console.log('   🚫 Nuclear hashtag elimination');
    console.log('   🖼️ Intelligent image strategy (25% usage)');
    console.log('   🧠 Enhanced human intelligence');
    console.log('   💬 Natural conversation patterns');
    console.log('   🔍 Real-time intelligence gathering');
    console.log('   📈 Viral growth optimization');
    console.log('');
    console.log('🎪 Bot ready for deployment with complete human voice enforcement!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixRuntimeConfigEnforcement();
}

module.exports = { fixRuntimeConfigEnforcement }; 