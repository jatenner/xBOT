import { supabaseClient } from './supabaseClient';

/**
 * Check if the bot is disabled via the global kill switch
 */
export async function isBotDisabled(): Promise<boolean> {
  try {
    const result = await supabaseClient.getBotConfig('DISABLE_BOT');
    return result === 'true';
  } catch (error: any) {
    // If the config doesn't exist, create it with default value
    if (error.code === 'PGRST116') {
      try {
        await supabaseClient.setBotConfig('DISABLE_BOT', 'false');
        console.log('✅ Initialized DISABLE_BOT config with default value: false');
        return false;
      } catch (initError) {
        console.error('Failed to initialize DISABLE_BOT config:', initError);
        return false; // Default to enabled if we can't check
      }
    }
    // Silently handle other errors to reduce spam
    return false; // Default to enabled if we can't check
  }
}

/**
 * Set the bot disabled state
 */
export async function setBotDisabled(disabled: boolean): Promise<void> {
  try {
    await supabaseClient.setBotConfig('DISABLE_BOT', disabled.toString());
    console.log(`🔧 Bot ${disabled ? 'DISABLED' : 'ENABLED'} via kill switch`);
  } catch (error) {
    console.error('Failed to set bot disabled status:', error);
    throw error;
  }
} 