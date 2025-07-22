export class MinimalSupabaseClient {
  public supabase: any = null;

  constructor() {
    try {
      const { createClient } = require('@supabase/supabase-js');
      
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Minimal Supabase client initialized');
      } else {
        console.warn('⚠️ Supabase credentials missing');
      }
    } catch (error) {
      console.warn('⚠️ Supabase initialization failed:', error);
    }
  }
}

export const minimalSupabaseClient = new MinimalSupabaseClient(); 