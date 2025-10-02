# 🎯 xBOT Posting Strategy - High-Frequency Mode

## Recommended Configuration for Frequent, Strategic Posting

### Goal: Post 4-8 times per day at optimal times

### Configuration:

```bash
# Content Generation (how often to create new content)
JOBS_PLAN_INTERVAL_MIN=10          # Generate content every 10 minutes
                                    # Creates 3 pieces each time → 18 pieces/hour in queue

# Posting Queue (how often to check for ready posts)
JOBS_POSTING_INTERVAL_MIN=3        # Check queue every 3 minutes
GRACE_MINUTES=5                     # Post items within 5 min of scheduled time

# Rate Limiting (minimum time between posts)
MIN_POST_INTERVAL_MINUTES=120      # Post every 2 hours (12 posts/day max)
                                    # OR use 180 (3 hours) for 8 posts/day
                                    # OR use 240 (4 hours) for 6 posts/day

# Reply Generation
JOBS_REPLY_INTERVAL_MIN=20         # Generate replies every 20 minutes

# Learning
JOBS_LEARN_INTERVAL_MIN=60         # Learn from outcomes every hour
```

## How It Works:

### 1. Content Generation (Every 10 min)
- Generates 3 high-quality pieces using LLM
- Uses UCB bandit to select optimal content types
- Schedules based on predicted engagement

### 2. Strategic Scheduling
- **Same-day preference**: Posts today if possible
- **Cold start**: First post within 30 seconds of boot
- **UCB timing**: Learns best hours to post (morning, lunch, evening)
- **Grace window**: Posts within 5 minutes of scheduled time

### 3. Posting Queue (Every 3 min)
- Finds items ready to post (within grace window)
- Respects rate limits (MIN_POST_INTERVAL_MINUTES)
- Posts immediately when item is ready

### 4. Result
- **Queue never empty** (generating 18 items/hour)
- **Strategic timing** (UCB learns best posting hours)
- **Consistent cadence** (every 2-4 hours depending on rate limit)
- **Quality maintained** (LLM generates varied, engaging content)

---

## Posting Schedule Examples:

### Conservative (6 posts/day):
`MIN_POST_INTERVAL_MINUTES=240` (4 hours)
```
8:00 AM  → Morning post (workout tips)
12:00 PM → Lunch post (nutrition)
4:00 PM  → Afternoon post (stress management)
8:00 PM  → Evening post (sleep tips)
12:00 AM → Late night post (recovery)
4:00 AM  → Early morning post (preparation)
```

### Moderate (8 posts/day):
`MIN_POST_INTERVAL_MINUTES=180` (3 hours)
```
6:00 AM  → Early morning
9:00 AM  → Morning commute
12:00 PM → Lunch
3:00 PM  → Afternoon slump
6:00 PM  → After work
9:00 PM  → Evening
12:00 AM → Night owls
3:00 AM  → Late night / early risers
```

### Aggressive (12 posts/day):
`MIN_POST_INTERVAL_MINUTES=120` (2 hours)
```
Every 2 hours around the clock
High visibility, but risk of audience fatigue
```

---

## Recommended: Start Moderate

**Best practice for growth:**
- Start: `MIN_POST_INTERVAL_MINUTES=180` (8 posts/day)
- Monitor engagement for 2 weeks
- Adjust based on audience response
- Let UCB timing learn optimal hours

---

## Current vs Recommended:

| Setting | Current | Recommended | Impact |
|---------|---------|-------------|--------|
| Plan Interval | 15 min | **10 min** | More content variety |
| Post Check | 5 min | **3 min** | Faster posting |
| Post Frequency | 30 min | **180 min** | Strategic cadence (8/day) |
| Grace Window | 5 min | **5 min** | ✅ Already optimal |

---

## Apply This Configuration:

Run this script to update Railway:
```bash
./update_posting_frequency.sh
```

Or manually set in Railway dashboard:
- JOBS_PLAN_INTERVAL_MIN=10
- JOBS_POSTING_INTERVAL_MIN=3
- MIN_POST_INTERVAL_MINUTES=180
- GRACE_MINUTES=5

