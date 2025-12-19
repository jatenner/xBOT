# Truth Gap Audit: Last 24 Hours

**Date:** 2025-12-19T15:12:21.120Z

---

## Audit Status

- **X_FETCH_METHOD:** api
- **AUDIT_VALID:** true

## Summary

- **Tweets on X (last 24h):** 100
- **DB Decisions (last 24h):** 72
- **Posted to X but Missing in DB:** 92 🚨
- **DB Marked Posted but Missing on X:** 41
- **Duplicate Tweet ID Mappings:** 0

## Tweets Posted to X but Missing in DB 🚨

Found 92 tweets on X that are not recorded in DB:

| tweet_id | created_at | url | text_snippet |
|----------|------------|-----|--------------|
| 200180863795036... | 2025-12-19T00:15:45 | https://x.com/SignalAndSynapse/status/2001808637950361674 | ⚡ 3/5 Add healthy fats: Pairing cooked veggies with a little... |
| 200180832747982... | 2025-12-19T00:14:31 | https://x.com/SignalAndSynapse/status/2001808327479824614 | 2/5 Use the right cooking method: STEAMING or sautéing is be... |
| 200180801570853... | 2025-12-19T00:13:17 | https://x.com/SignalAndSynapse/status/2001808015708537157 | 1/5 Choose your veggies: Spinach, tomatoes, carrots, and bro... |
| 200180773096590... | 2025-12-19T00:12:09 | https://x.com/SignalAndSynapse/status/2001807730965909752 | Want to double your nutrient intake?  Start using this simpl... |
| 200179994104451... | 2025-12-18T23:41:12 | https://x.com/SignalAndSynapse/status/2001799941044518963 | 🧘 Lastly, instead of a late-night snack of cookies, try a c... |
| 200179958987640... | 2025-12-18T23:39:48 | https://x.com/SignalAndSynapse/status/2001799589876408516 | 🧠 Trade that bland salad for a colorful mixed bowl.  Adding... |
| 200179921100888... | 2025-12-18T23:38:18 | https://x.com/SignalAndSynapse/status/2001799211008884771 | 🧠 Instead of ice cream, go for Greek yogurt with honey and ... |
| 200179890107917... | 2025-12-18T23:37:04 | https://x.com/SignalAndSynapse/status/2001798901079175665 | Feeling sluggish?  Ditch the bagel for a bowl of oatmeal top... |
| 200179851126072... | 2025-12-18T23:35:31 | https://x.com/SignalAndSynapse/status/2001798511260729380 | Bored of your regular sandwich?  Trade it for AVOCADO TOAST!... |
| 200179821909787... | 2025-12-18T23:34:21 | https://x.com/SignalAndSynapse/status/2001798219097870392 | 🧘 Swap out that sugary soda for sparkling water with a spla... |
| 200179793815945... | 2025-12-18T23:33:14 | https://x.com/SignalAndSynapse/status/2001797938159456322 | Feeling a bit down?  Try this unexpected food swap: Instead ... |
| 200178637440016... | 2025-12-18T22:47:17 | https://x.com/SignalAndSynapse/status/2001786374400164173 | But there’s more! Research shows that BEETROOT JUICE can red... |
| 200178611153053... | 2025-12-18T22:46:15 | https://x.com/SignalAndSynapse/status/2001786111530537130 | Did you know that beets can significantly enhance your worko... |
| 200178387762330... | 2025-12-18T22:37:22 | https://x.com/SignalAndSynapse/status/2001783877623308332 | 🧘 Walking stimulates the release of ENDORPHINS, the body's ... |
| 200178360563554... | 2025-12-18T22:36:17 | https://x.com/SignalAndSynapse/status/2001783605635543091 | 📊 In the 1970s, a breakthrough study showed that just 10 mi... |
| 200178280209908... | 2025-12-18T22:33:06 | https://x.com/SignalAndSynapse/status/2001782802099089849 | So, next time you feel that slump creeping in, reach for nut... |
| 200178250694991... | 2025-12-18T22:31:55 | https://x.com/SignalAndSynapse/status/2001782506949910804 | 🧠 This isn't just personal: a study found that balanced sna... |
| 200178233481589... | 2025-12-18T22:31:14 | https://x.com/SignalAndSynapse/status/2001782334815899892 | ⚡ Incorporating fermented foods daily—1 cup of yogurt or a f... |
| 200178218231073... | 2025-12-18T22:30:38 | https://x.com/SignalAndSynapse/status/2001782182310736206 | I tried swapping my usual sugary snacks for nut butter on wh... |
| 200178203433992... | 2025-12-18T22:30:02 | https://x.com/SignalAndSynapse/status/2001782034339926500 | 🧠 Gut-brain connection is powerful.  When the gut's healthy... |
| 200178180081365... | 2025-12-18T22:29:07 | https://x.com/SignalAndSynapse/status/2001781800813658297 | ⚡ Why does this matter?  Unlike sugar-laden snacks that lead... |
| 200178176364817... | 2025-12-18T22:28:58 | https://x.com/SignalAndSynapse/status/2001781763648176297 | Why do people cling to chocolate?  It's easy, comforting, an... |
| 200178152085667... | 2025-12-18T22:28:00 | https://x.com/SignalAndSynapse/status/2001781520856670667 | ⚡ Nut butter packs a powerful punch! 🥜 It's rich in healthy... |
| 200178149239394... | 2025-12-18T22:27:53 | https://x.com/SignalAndSynapse/status/2001781492393943080 | Fermented foods like yogurt and kimchi can elevate mood by i... |
| 200178124388167... | 2025-12-18T22:26:54 | https://x.com/SignalAndSynapse/status/2001781243881673181 | 📊 Feeling sluggish at 3pm?  You're not alone; research show... |

## DB Marked Posted but Missing on X

Found 41 DB decisions marked 'posted' but not found on X:

| decision_id | decision_type | tweet_id | thread_tweet_ids | posted_at |
|-------------|---------------|----------|------------------|-----------|
| 4b2d6db4... | reply | 200167999852503... | N/A | 2025-12-18T15:44:56 |
| f559a000... | reply | 200168037546318... | N/A | 2025-12-18T15:46:26 |
| 868d6486... | reply | 200168539157370... | N/A | 2025-12-18T16:06:17 |
| d1af4051... | reply | 200170683611916... | N/A | 2025-12-18T17:31:24 |
| 09427a77... | reply | 200171148088272... | N/A | 2025-12-18T17:50:37 |
| 2e82eca7... | reply | 200172943628321... | N/A | 2025-12-18T19:01:13 |
| 9b2b597b... | reply | 200173087154869... | N/A | 2025-12-18T19:07:45 |
| 75e4997b... | reply | 200174027828197... | N/A | 2025-12-18T19:44:17 |
| 8752a141... | reply | 200174334771141... | N/A | 2025-12-18T19:57:22 |
| e9d1ad80... | reply | 200175733152932... | N/A | 2025-12-18T20:52:09 |
| e3e8922c... | reply | 200175765503179... | N/A | 2025-12-18T20:54:26 |
| 1a489eb0... | reply | 200175847975775... | N/A | 2025-12-18T20:56:36 |
| fc472e73... | reply | 200176766057363... | N/A | 2025-12-18T21:33:07 |
| 28efd848... | reply | 200176792417278... | N/A | 2025-12-18T21:34:07 |
| 4abdc77c... | reply | 200177944343025... | N/A | 2025-12-18T22:20:00 |
| 1fab1480... | reply | 200178230244401... | N/A | 2025-12-18T22:32:22 |
| 9de30623... | reply | 200178598876327... | N/A | 2025-12-18T22:45:54 |
| ce4872e0... | reply | 200178877468711... | N/A | 2025-12-18T22:56:58 |
| a258de78... | reply | 200179744074830... | N/A | 2025-12-18T23:32:28 |
| fcaa9b82... | reply | 200179933042073... | N/A | 2025-12-18T23:39:03 |
| 71360582... | reply | 200148334968927... | N/A | 2025-12-18T02:43:28 |
| d10610f4... | reply | 200152010314206... | N/A | 2025-12-18T05:09:45 |
| ad6a76d3... | reply | 200153502851420... | N/A | 2025-12-18T06:08:51 |
| 62e2fe70... | reply | 200155532544746... | N/A | 2025-12-18T07:30:14 |
| e7d07a4e... | reply | 200155976707306... | N/A | 2025-12-18T07:47:06 |

## Duplicate Tweet ID Mappings

✅ No duplicate tweet_id mappings found.

---

**Report Generated:** 2025-12-19T15:12:21.120Z
