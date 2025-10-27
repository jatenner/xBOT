# 🚂 Railway Container Resource Limits Guide

## How to Check Your Container's Resource Limits

### Method 1: Railway Dashboard (Most Accurate)

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Select your project**: "XBOT"
3. **Select your service**: "xBOT"
4. **Click "Settings" tab**
5. **Scroll to "Deploy" section** → **"Resource Limits"**

You'll see sliders showing:
- **vCPU Limit** (e.g., 2 vCPU, 4 vCPU, 8 vCPU)
- **Memory Limit** (e.g., 2 GB, 4 GB, 8 GB, 16 GB)

### Method 2: Railway CLI

```bash
# Get service info
railway status

# Check environment variables (might show limits)
railway variables | grep -i "memory\|cpu"
```

### Method 3: From Within Running Container

We've added a new API endpoint that will show real-time resource usage:

```bash
# Once deployed, check:
curl https://xbot-production-844b.up.railway.app/api/resources
```

This will return:
```json
{
  "success": true,
  "metrics": {
    "memory": {
      "total_gb": 8.0,
      "used_gb": 3.2,
      "free_gb": 4.8,
      "usage_percent": 40.0
    },
    "cpu": {
      "cores": 4,
      "load_avg": {
        "1min": 1.5,
        "5min": 1.2,
        "15min": 0.9
      }
    }
  },
  "health_status": "healthy",
  "recommendations": []
}
```

---

## Railway's Default Resource Limits (2024)

### Starter Plan ($5/month)
- **vCPU**: 2 shared cores
- **Memory**: 1 GB
- **Disk**: 1 GB ephemeral
- **Network**: Unlimited

### Pro Plan ($20/month base + usage)
- **vCPU**: Configurable (1-32 cores)
- **Memory**: Configurable (0.5 GB - 32 GB)
- **Disk**: Up to 50 GB persistent
- **Network**: Unlimited

### Resource Usage Pricing (Pro)
- **CPU**: $0.000463/vCPU minute
- **Memory**: $0.000231/GB minute

---

## How Railway Limits Work

1. **Soft Limits**: Your service can use UP TO the configured limit
2. **Container Restart**: If you exceed memory limit, container is killed (OOM)
3. **CPU Throttling**: If you exceed CPU, processes slow down (not killed)
4. **Automatic Scaling**: Railway doesn't auto-scale; you set fixed limits

---

## Recommended Limits for xBOT

Based on typical Playwright usage:

### Minimal Setup (Testing)
- **vCPU**: 2 cores
- **Memory**: 2 GB
- **Max Browsers**: 1 context

### Production Setup (Current)
- **vCPU**: 4 cores
- **Memory**: 4 GB
- **Max Browsers**: 2 concurrent contexts

### Heavy Load Setup
- **vCPU**: 8 cores
- **Memory**: 8 GB
- **Max Browsers**: 3-4 concurrent contexts

**Note**: Each Chromium instance uses ~200-500 MB RAM + 0.5-1 vCPU

---

## How to Adjust Limits

1. Go to Railway Dashboard
2. Service → Settings → Resource Limits
3. Adjust sliders:
   - Move **vCPU slider** to desired cores
   - Move **Memory slider** to desired GB
4. Click **Save**
5. Service will restart automatically

---

## Monitoring Your Usage

### Real-time Monitoring

```bash
# Watch resource endpoint every 5 seconds
watch -n 5 'curl -s https://xbot-production-844b.up.railway.app/api/resources | jq ".metrics"'
```

### Railway Metrics

Railway dashboard shows:
- **CPU usage** (%)
- **Memory usage** (MB/GB)
- **Network traffic** (inbound/outbound)
- **Build times**

Access at: Project → Service → **Metrics tab**

---

## Cost Estimation Tool

### Calculate Monthly Cost

**Formula**:
```
Monthly Cost = (vCPU × $0.000463 + Memory_GB × $0.000231) × 60 × 24 × 30
```

**Example** (4 vCPU, 4 GB, running 24/7):
```
= (4 × $0.000463 + 4 × $0.000231) × 60 × 24 × 30
= ($0.001852 + $0.000924) × 43,200
= $0.002776 × 43,200
= ~$120/month
```

---

## Troubleshooting

### "Target page, context or browser has been closed"
**Cause**: Browser contexts exceeding memory limit
**Fix**: Reduce `MAX_CONTEXTS` or upgrade memory limit

### "EAGAIN: Resource temporarily unavailable"
**Cause**: Process limit reached
**Fix**: Reduce concurrent operations or upgrade CPU limit

### Container keeps restarting
**Cause**: Memory limit exceeded (OOM kill)
**Fix**: Check logs for memory spike, upgrade memory limit

---

## Quick Checks

### Is your service hitting limits?

```bash
# Check recent errors
railway logs --lines 200 | grep -i "oom\|killed\|memory\|resource"

# Check container restarts
railway logs --lines 500 | grep -i "starting\|boot"
```

If you see frequent restarts within minutes, you're likely hitting limits.

---

## Next Steps

1. ✅ Check current limits in Railway dashboard
2. ✅ Deploy resource metrics endpoint (already added to code)
3. ✅ Monitor for 24 hours to see peak usage
4. ✅ Adjust limits based on actual usage patterns
5. ✅ Implement browser pool consolidation (UnifiedBrowserPool)


