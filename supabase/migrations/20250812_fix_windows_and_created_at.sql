-- Add column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='learning_posts' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.learning_posts
    ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END;
$$;

-- Create table if missing
CREATE TABLE IF NOT EXISTS public.optimal_posting_windows (
  id bigserial PRIMARY KEY,
  day_of_week smallint NOT NULL,  -- 1=Mon .. 7=Sun
  window_start smallint NOT NULL, -- hour 0-23
  window_end smallint NOT NULL,   -- hour 0-23
  effectiveness_score numeric DEFAULT 0.5,
  confidence numeric DEFAULT 0.8,
  posts_in_window integer DEFAULT 0,
  avg_engagement numeric DEFAULT 0
);

-- Seed only if empty
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.optimal_posting_windows) = 0 THEN
    INSERT INTO public.optimal_posting_windows (day_of_week, window_start, window_end, effectiveness_score, confidence)
    VALUES
      (1, 9, 10, 0.75, 0.85),
      (2, 9, 10, 0.75, 0.85),
      (3, 9, 10, 0.75, 0.85),
      (4, 9, 10, 0.75, 0.85),
      (5, 9, 10, 0.75, 0.85),
      (6, 12, 13, 0.70, 0.80),
      (7, 12, 13, 0.70, 0.80);
  END IF;
END;
$$;