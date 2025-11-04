-- Add created_at column to learning_posts table (idempotent)
ALTER TABLE IF EXISTS public.learning_posts 
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();