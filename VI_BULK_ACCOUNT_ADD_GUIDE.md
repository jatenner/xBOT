# 📋 Bulk Account Addition Guide

**Date:** November 17, 2025  
**Purpose:** Add 100+ accounts to VI system with automatic categorization

---

## 🎯 **HOW IT WORKS**

### **1. You Provide:**
- List of 100 accounts (usernames)
- Optional: Follower counts, bios

### **2. System Analyzes:**
- **AI Analysis:** Reads bios, categorizes by niche, matches to generators
- **Auto-Tiering:** Based on follower count
  - < 1K → viral_unknown (weight: 3.0)
  - 1K-10K → micro (weight: 2.0)
  - 10K-100K → growth (weight: 1.0)
  - > 100K → established (weight: 0.5)
- **Generator Matching:** Top 3 generators per account
- **Niche Detection:** sleep, exercise, nutrition, longevity, etc.

### **3. System Stores:**
- Account in `vi_scrape_targets`
- Generator categorization in `metadata` JSONB field
- Ready for scraping immediately

---

## 📝 **HOW TO USE**

### **Option 1: Edit Script File** (Recommended)

1. Open `scripts/bulk-add-vi-accounts.ts`
2. Add your accounts to the `ACCOUNTS` array:

```typescript
const ACCOUNTS = [
  { username: 'account1', followers: 50000 },
  { username: 'account2', followers: 5000, bio: 'Health researcher' },
  { username: 'account3', followers: 150000 },
  // ... 100 more
];
```

3. Run:
```bash
tsx scripts/bulk-add-vi-accounts.ts
```

### **Option 2: Provide List Here**

Just paste your 100 accounts here and I'll:
1. Analyze each one
2. Categorize by tier and generator
3. Create the script with all accounts ready
4. Show you the breakdown before adding

---

## 📊 **WHAT YOU'LL GET**

### **Summary Report:**
```
✅ BULK ADD COMPLETE:
   Added: 98
   Skipped: 2 (already existed)
   Errors: 0

📊 BY TIER:
   viral_unknown: 15
   micro: 25
   growth: 40
   established: 18

🎭 BY GENERATOR:
   dataNerd: 35
   newsReporter: 20
   historian: 15
   storyteller: 12
   ...
```

### **Each Account Gets:**
- Auto-tiered by follower count
- Matched to top 3 generators
- Categorized by niche
- Ready for immediate scraping

---

## 🎯 **ACCOUNT FORMAT**

### **Minimal (just username):**
```typescript
{ username: 'accountname' }
```
System will use defaults (follower count = 0, tier = viral_unknown)

### **With Follower Count:**
```typescript
{ username: 'accountname', followers: 50000 }
```
System will auto-tier correctly

### **With Bio (best results):**
```typescript
{ username: 'accountname', followers: 50000, bio: 'Health researcher focused on longevity' }
```
AI can better match to generators with bio

---

## 🚀 **READY TO ADD?**

**Just paste your 100 accounts here in any format:**
- List of usernames (one per line)
- Username + follower count
- Username + bio
- Any format - I'll parse it!

**Example formats I can handle:**
```
account1
account2
account3
```

Or:
```
account1 50000
account2 5000
account3 150000
```

Or:
```
@account1 - Health researcher (50K followers)
@account2 - Sleep expert (5K followers)
```

**I'll analyze, categorize, and add them all!** 🎯

