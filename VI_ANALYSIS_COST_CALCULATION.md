# 💰 VI ANALYSIS COST CALCULATION

## **MODEL & PRICING:**

**Model:** `gpt-4o-mini` (cheapest GPT-4 model)

**Pricing (per 1K tokens):**
- **Input:** $0.00015 (15 cents per 1M tokens)
- **Output:** $0.0006 (60 cents per 1M tokens)

**Source:** `src/budget/budgetGate.ts:47`

---

## **COST PER TWEET:**

### **Input Tokens:**
- **Prompt length:** ~1,200 characters (includes all classification options)
- **Tweet content:** ~500 characters (truncated to 500)
- **Total input:** ~1,700 characters ≈ **425 tokens** (rough estimate: 4 chars/token)

### **Output Tokens:**
- **Max tokens:** 150 (JSON response with classification)
- **Actual output:** ~100-150 tokens (JSON with topic, angle, tone, etc.)

### **Cost Calculation:**
```
Input cost:  (425 / 1000) × $0.00015 = $0.00006375
Output cost: (150 / 1000) × $0.0006  = $0.00009
─────────────────────────────────────────────────
Total per tweet: $0.00015375 ≈ $0.00015
```

**Rounded:** **~$0.00015 per tweet** (0.015 cents)

---

## **COST FOR 25,000 TWEETS:**

### **Total Cost:**
```
25,000 tweets × $0.00015 = $3.75
```

**That's it!** Just **$3.75** to analyze 25,000 tweets ✅

---

## **DAILY/MONTHLY COSTS:**

### **Current Settings (100 tweets/run, every 6 hours):**
- **Per run:** 100 tweets × $0.00015 = **$0.015**
- **Per day:** 4 runs × $0.015 = **$0.06/day**
- **Per month:** $0.06 × 30 = **$1.80/month**

### **Optimized Settings (500 tweets/run, every 2 hours):**
- **Per run:** 500 tweets × $0.00015 = **$0.075**
- **Per day:** 12 runs × $0.075 = **$0.90/day**
- **Per month:** $0.90 × 30 = **$27/month**

---

## **COMPARISON:**

### **VI Analysis vs Other Operations:**

| Operation | Cost Per Unit | Monthly (if daily) |
|-----------|---------------|-------------------|
| **VI Classification** | $0.00015/tweet | $1.80-$27 |
| **Content Generation** | ~$0.01-0.05/post | $30-150 |
| **Reply Generation** | ~$0.005-0.02/reply | $15-60 |
| **Thread Generation** | ~$0.05-0.15/thread | $150-450 |

**VI Analysis is CHEAPEST operation!** ✅

---

## **BUDGET IMPACT:**

### **Your Current Budget:**
- **Daily limit:** $10/day (from `openaiBudgetedClient.ts`)
- **Monthly limit:** $200/month

### **VI Analysis Cost:**
- **Current settings:** $0.06/day = **0.6% of daily budget** ✅
- **Optimized settings:** $0.90/day = **9% of daily budget** ✅

**Both are well within budget!**

---

## **COST-BENEFIT ANALYSIS:**

### **Cost:**
- **25k tweets analyzed:** $3.75
- **Monthly (optimized):** $27

### **Benefit:**
- **Learn from 25k successful tweets**
- **Identify viral patterns**
- **Improve content generation**
- **Increase engagement rates**

**ROI:** Extremely high! $3.75 for insights from 25k tweets is a steal.

---

## **OPTIMIZATION IMPACT:**

### **Current Settings:**
- **Cost:** $0.06/day
- **Throughput:** 400 tweets/day
- **Time to 25k:** 62.5 days
- **Total cost:** $3.75

### **Optimized Settings:**
- **Cost:** $0.90/day
- **Throughput:** 6,000 tweets/day
- **Time to 25k:** 4.2 days
- **Total cost:** $3.78 (same!)

**Same cost, 15x faster!** ✅

---

## **BOTTOM LINE:**

### **Cost for 25k Tweets:**
- **Total:** **$3.75** ✅
- **Daily (optimized):** **$0.90/day** ✅
- **Monthly (optimized):** **$27/month** ✅

### **Budget Impact:**
- **0.6-9% of daily budget** (well within limits)
- **Cheapest operation in your system**
- **Extremely high ROI**

### **Recommendation:**
✅ **Optimize it!** Same cost, 15x faster analysis.

**It's basically free!** 🚀

