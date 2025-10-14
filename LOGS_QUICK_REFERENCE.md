# 📋 Logs Quick Reference

## Most Common Commands

```bash
npm run logs              # Live Railway logs (Ctrl+C to stop)
npm run logs:errors       # Show errors only
npm run logs:search POST # Search for "POST"
```

## All Log Commands

| Command | What It Does |
|---------|--------------|
| `npm run logs` | Stream live Railway deployment logs |
| `npm run logs:errors` | Show only error logs |
| `npm run logs:search <term>` | Search logs for specific term |
| `npm run logs:monitor` | Use system monitor (alternative) |
| `railway logs` | Direct Railway CLI |

## Search Examples

```bash
npm run logs:search POST_SUCCESS  # Find successful posts
npm run logs:search ERROR          # Find errors
npm run logs:search PLAYWRIGHT     # Browser automation logs
npm run logs:search DB_WRITE       # Database operations
```

## What You'll See

- ✅ Real-time deployment logs
- ✅ Application startup
- ✅ POST requests/responses  
- ✅ Database queries
- ✅ Errors and warnings
- ✅ console.log() output

## Troubleshooting

**No logs showing?**
```bash
npm run railway:diagnostic  # Check connection
railway status             # Verify deployment
```

**Too many logs?**
```bash
npm run logs:errors        # Filter errors only
```

**Need specific info?**
```bash
npm run logs:search <term> # Search for term
```

## Pro Tips

1. Keep logs running in separate terminal
2. Use `--errors` to debug issues quickly
3. Search for feature-specific prefixes (POST_, DB_, etc.)
4. Check `LOG_VIEWING_GUIDE.md` for detailed help

---

**Quick Start**: `npm run logs` (Press Ctrl+C to stop)
