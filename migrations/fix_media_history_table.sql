-- Fix missing media_history table for Render deployment
-- This resolves the error: relation "public.media_history" does not exist

CREATE TABLE IF NOT EXISTS public.media_history (
    id SERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    similarity_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_history_last_used ON public.media_history(last_used_at);
CREATE INDEX IF NOT EXISTS idx_media_history_source ON public.media_history(source);
CREATE INDEX IF NOT EXISTS idx_media_history_url ON public.media_history(image_url);

-- Grant permissions
GRANT ALL PRIVILEGES ON public.media_history TO authenticated;
GRANT ALL PRIVILEGES ON public.media_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.media_history_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.media_history_id_seq TO service_role; 