-- Create the missing exec_sql function that all migrations depend on
-- Run this FIRST in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS text AS $$
BEGIN
    EXECUTE sql;
    RETURN 'OK';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error executing SQL: %', SQLERRM;
        RETURN 'ERROR: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Test the function works
SELECT public.exec_sql('SELECT 1 as test') as test_result;