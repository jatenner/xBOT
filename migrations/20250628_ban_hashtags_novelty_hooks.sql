-- ban hashtags, require novelty, ban percent-only hooks
--------------------------------------------------------------

update bot_config
set value = value
         || jsonb_build_object(
              'maxHashtags',           0,
              'rejectHashtags',        true,
              'minNovelTokens',        10,
              'banPercentOnlyHooks',   true
            )
where key = 'runtime_config';

--------------------------------------------------------------
-- down-migration is a no-op (leave existing settings intact)
-------------------------------------------------------------- 