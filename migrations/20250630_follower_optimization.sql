-- Optimize quality gates for follower acquisition
-- Lower thresholds to increase posting frequency while maintaining quality

update bot_config
set value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(value, '{quality_readability_min}', '35'),
      '{quality_credibility_min}', '0.4'
    ),
    '{requireUrl}', 'false'
  ),
  '{requireCitation}', 'false'
)
where key = 'runtime_config';

-- Increase daily posting limit for follower growth
update bot_config  
set value = jsonb_set(value, '{max_daily_tweets}', '12')
where key = 'runtime_config';

-- Enable more aggressive posting schedule
update bot_config
set value = jsonb_set(value, '{posting_strategy}', '"follower_growth"')  
where key = 'runtime_config'; 