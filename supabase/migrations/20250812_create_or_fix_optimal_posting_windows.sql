-- Create optimal_posting_windows table with proper schema (idempotent)
CREATE TABLE IF NOT EXISTS public.optimal_posting_windows (
  id bigserial PRIMARY KEY,
  weekday smallint NOT NULL,
  window_start smallint NOT NULL, 
  window_end smallint NOT NULL,
  effectiveness_score numeric(4,2) NOT NULL DEFAULT 0,
  confidence numeric(4,2) NOT NULL DEFAULT 0,
  posts_in_window int NOT NULL DEFAULT 0,
  avg_engagement numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed data only if table is empty
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.optimal_posting_windows) = 0 THEN
    INSERT INTO public.optimal_posting_windows (weekday, window_start, window_end, effectiveness_score, confidence, posts_in_window, avg_engagement)
    VALUES 
      (1, 9, 10, 0.85, 0.75, 10, 12.50),   -- Monday 9-10am
      (1, 18, 19, 0.78, 0.68, 8, 11.20),   -- Monday 6-7pm  
      (3, 12, 13, 0.82, 0.72, 12, 13.10);  -- Wednesday 12-1pm
  END IF;
END $$;