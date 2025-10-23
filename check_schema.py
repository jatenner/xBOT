#!/usr/bin/env python3
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    exit(1)

print("🔍 Checking post_attribution table schema...")

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check what columns exist
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'post_attribution'
        ORDER BY ordinal_position;
    """)
    
    columns = cur.fetchall()
    
    if not columns:
        print("❌ post_attribution table doesn't exist!")
        exit(1)
    
    print(f"�� Found {len(columns)} columns in post_attribution table:")
    for col in columns:
        print(f"  - {col['column_name']}: {col['data_type']} ({'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'})")
    
    # Check if essential columns are missing
    essential_columns = ['engagement_rate', 'impressions', 'followers_gained', 'hook_pattern', 'topic', 'generator_used']
    existing_columns = [col['column_name'] for col in columns]
    
    missing_columns = [col for col in essential_columns if col not in existing_columns]
    
    if missing_columns:
        print(f"\n❌ MISSING ESSENTIAL COLUMNS: {missing_columns}")
        print("🔧 These columns are required for learning loops to work!")
    else:
        print("\n✅ All essential columns exist!")
    
    # Check if table has any data
    cur.execute("SELECT COUNT(*) as count FROM post_attribution;")
    count = cur.fetchone()['count']
    print(f"\n📈 Total posts in post_attribution: {count}")
    
    if count > 0:
        # Check recent data
        cur.execute("""
            SELECT 
                COUNT(*) as total_posts,
                AVG(COALESCE(engagement_rate, 0)) as avg_engagement,
                AVG(COALESCE(impressions, 0)) as avg_views,
                AVG(COALESCE(followers_gained, 0)) as avg_followers,
                MAX(posted_at) as most_recent_post
            FROM post_attribution
            WHERE posted_at > NOW() - INTERVAL '7 days';
        """)
        
        stats = cur.fetchone()
        print(f"📊 Last 7 days stats:")
        print(f"  - Posts: {stats['total_posts']}")
        print(f"  - Avg Engagement: {float(stats['avg_engagement'] or 0)*100:.2f}%")
        print(f"  - Avg Views: {float(stats['avg_views'] or 0):.0f}")
        print(f"  - Avg Followers: {float(stats['avg_followers'] or 0):.1f}")
        print(f"  - Most Recent: {stats['most_recent_post']}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Database error: {e}")
    exit(1)
