# 🚀 Deploy Your Autonomous Bot

## How It Currently Works
Your bot runs **locally** on your Mac. When you close your computer = bot stops! 😴

## ☁️ Make It Truly Autonomous (24/7)

### Option 1: Railway (Recommended - Free)
1. **Sign up**: https://railway.app
2. **Connect GitHub**: Link your repository
3. **Add Environment Variables**:
   ```
   TWITTER_API_KEY=your_key
   TWITTER_API_SECRET=your_secret
   TWITTER_ACCESS_TOKEN=your_token
   TWITTER_ACCESS_TOKEN_SECRET=your_token_secret
   OPENAI_API_KEY=your_openai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_key
   ```
4. **Deploy**: Railway auto-detects Dockerfile
5. **Done**: Bot runs 24/7 even when your computer is off!

### Option 2: DigitalOcean App Platform
1. Create account at digitalocean.com
2. Use App Platform (free tier available)
3. Connect GitHub repo
4. Add environment variables
5. Deploy

### Option 3: Heroku
1. Install Heroku CLI
2. `heroku create your-bot-name`
3. `git push heroku main`
4. `heroku config:set TWITTER_API_KEY=your_key` (repeat for all env vars)

### Option 4: AWS/Google Cloud
More complex but most powerful.

## 🔧 Local Development
Keep using: `npm run dev`

## 🌍 Production Deployment
Bot will run on: `npm start` (builds TypeScript first)

## 📊 Monitoring
- Railway: Built-in logs and metrics
- Bot posts every 15 minutes when engagement is good
- Sleeps during low-engagement windows
- Auto-restarts if it crashes

## 💰 Costs
- **Railway**: Free tier (500 hours/month)
- **DigitalOcean**: $5/month
- **Heroku**: Free tier discontinued, $7/month
- **Your laptop**: $0 but not autonomous

## 🎯 Result
Bot posts intelligently 24/7, even when you're asleep! 🌙✨ 