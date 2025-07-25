-- Fix the verification function to avoid tweet_ids issue
CREATE OR REPLACE FUNCTION verify_bot_permissions()
RETURNS TABLE (
  test_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Test tweet insert (minimal columns only)
  BEGIN
    INSERT INTO tweets (tweet_id, content, tweet_type) 
    VALUES ('test_123456789', 'Test tweet for verification', 'test');
    
    RETURN QUERY SELECT 'Tweet Insert'::TEXT, 'SUCCESS'::TEXT, 'Bot can insert tweets'::TEXT;
    
    -- Clean up
    DELETE FROM tweets WHERE tweet_id = 'test_123456789';
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Tweet Insert'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test content_uniqueness insert  
  BEGIN
    INSERT INTO content_uniqueness (content_hash, original_content) 
    VALUES ('test_hash_123', 'Test content');
    
    RETURN QUERY SELECT 'Content Uniqueness Insert'::TEXT, 'SUCCESS'::TEXT, 'Bot can insert uniqueness records'::TEXT;
    
    -- Clean up
    DELETE FROM content_uniqueness WHERE content_hash = 'test_hash_123';
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Content Uniqueness Insert'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test read access
  BEGIN
    PERFORM COUNT(*) FROM tweets;
    RETURN QUERY SELECT 'Tweet Read'::TEXT, 'SUCCESS'::TEXT, 'Bot can read tweets'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Tweet Read'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
