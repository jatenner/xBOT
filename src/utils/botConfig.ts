import { supabaseClient } from './supabaseClient';

interface ConfigCache {
  [key: string]: {
    value: any;
    timestamp: number;
  };
}

const configCache: ConfigCache = {};
const CACHE_DURATION = 60000; // 60 seconds

export async function getConfig(key: string, defaultVal: any): Promise<any> {
  // Check cache first
  const cached = configCache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }

  try {
    const { data, error } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) {
      console.log(`[bot_config] missing ${key} – using default "${defaultVal}"`);
      
      // Cache the default value
      configCache[key] = {
        value: defaultVal,
        timestamp: Date.now()
      };
      
      return defaultVal;
    }

    // Cache the retrieved value
    configCache[key] = {
      value: data.value,
      timestamp: Date.now()
    };

    return data.value;
  } catch (error) {
    console.log(`[bot_config] error fetching ${key} – using default "${defaultVal}"`);
    
    // Cache the default value on error
    configCache[key] = {
      value: defaultVal,
      timestamp: Date.now()
    };
    
    return defaultVal;
  }
}
