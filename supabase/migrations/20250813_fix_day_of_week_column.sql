-- Fix optimal_posting_windows table column name from weekday to day_of_week
-- This resolves error 42703: column optimal_posting_windows.day_of_week does not exist

-- Add day_of_week column if it doesn't exist
ALTER TABLE IF EXISTS public.optimal_posting_windows 
ADD COLUMN IF NOT EXISTS day_of_week smallint;

-- Copy data from weekday to day_of_week if weekday column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='optimal_posting_windows' AND column_name='weekday') THEN
    UPDATE public.optimal_posting_windows 
    SET day_of_week = weekday 
    WHERE day_of_week IS NULL;
    
    -- Drop the old weekday column
    ALTER TABLE public.optimal_posting_windows DROP COLUMN weekday;
  END IF;
END $$;

-- Ensure the day_of_week column has proper constraints
ALTER TABLE public.optimal_posting_windows 
ALTER COLUMN day_of_week SET NOT NULL;