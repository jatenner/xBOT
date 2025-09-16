# Fill these with PRODUCTION values and keep this file OUT of git.
export PROD_PROJECT_REF='qtgjmaelglghnlahqpbl'
export PROD_DB_PASSWORD='Christophernolanfan123!!'
export SUPABASE_URL='https://qtgjmaelglghnlahqpbl.supabase.co'
export SUPABASE_ACCESS_TOKEN='sbp_d6fed4a8ceff1795b6a3c27bcb8bca75ee7e7fe7'
export SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDY1MTAsImV4cCI6MjA2NTE4MjUxMH0.wGEnhyYJeLcn5itzuxmn8PQ1V5-Q_SBeO9CFXV6iZ3I'
export SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYwNjUxMCwiZXhwIjoyMDY1MTgyNTEwfQ.Gze-MRjDg592T02LpyTlyXt14QkiIgRFgvnMeUchUfU'

# Redis for PROD (non-TLS if provider TLS is incompatible with redis-cli)
export REDIS_URL='redis://default:uYu9N5O1MH1aiHIH7DMS9z0v1zsyIipU@redis-17514.c92.us-east-1-3.ec2.redns.redis-cloud.com:17514'
export REDIS_PREFIX='prod:'

export APP_ENV='production'
export LIVE_POSTS='true'   # we'll flip to true at the end

export DATABASE_URL='postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:5432/postgres'

# Learning system configuration
export POSTING_DISABLED="true"
export ENABLE_BANDIT_LEARNING="true"
export ENABLE_REPLIES="true"
export BANDIT_SCOPE_CONTENT_PRIOR="0.02"
export BANDIT_SCOPE_REPLY_PRIOR="0.02"
export BANDIT_SCOPE_TIMING_PRIOR="0.50"
export REPLY_MAX_PER_DAY="20"
export REPLY_MINUTES_BETWEEN="10"
export TARGET_DISCOVERY_INTERVAL_MIN="10"
export LEARNING_LOOKBACK_DAYS="45"
export EXPERIMENT_MIN_SAMPLE="20"
export EMBED_MODEL="text-embedding-3-small"

