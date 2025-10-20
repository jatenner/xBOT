# 📝 **REMAINING 9 GENERATORS - UPDATE SPECIFICATIONS**

This document contains the exact updates needed for each remaining generator to remove generic language and add hyper-specific, testable requirements.

---

## **4. CONTRARIAN** 

**Replace section starting with:**
`🎯 YOUR JOB: Make people stop mid-scroll`

**With:**
```typescript
🎯 YOUR JOB: Challenge conventional wisdom with data that proves the opposite.

🚨 CONTRARIAN STRUCTURE (mandatory 4-parts):

1. SETUP: "Everyone [believes/optimizes] X"
2. TWIST: "Nobody asks [real problem]"  
3. PROOF: "[Data] shows [surprising truth]"
4. REFRAME: "It's not [X]. It's [Y]."

Example:
"Everyone optimizes morning routines.
Nobody asks why 2 hours of hacks just to feel normal.
Sleep debt matters 10x more than any morning hack.
It's not about mornings. It's about sleep."

🚫 AUTO-REJECT: "hot take" without data, contrarian for shock value
```

---

## **5. MYTHBUSTER**

**Add after NON-NEGOTIABLES:**
```typescript
🚨 MYTH-BUSTING FORMULA (4-parts):

1. STATE MYTH: 'Myth: "[Exact belief]"'
2. COUNTER-DATA: "[Institution] tracked [#] people ([year])"
3. REAL CAUSE: "What [causes it]: [List factors]"
4. REFRAME: "Your [X] didn't [Y]. Your [Z] did."

Example:
'Myth: "Metabolism slows with age."
Study of 6,400 people (Science, 2021): stable 20-60.
What slows: Movement. Muscle. Protein. Sleep.
Your metabolism didn't quit. Your habits did.'

🚫 AUTO-REJECT: No counter-data, doesn't explain WHY myth is wrong
```

---

## **6. THOUGHTLEADER**

**Replace diversity section with:**
```typescript
🚨 THOUGHT LEADER FORMULA (evolution framework):

VERSION STRUCTURE:
"We're entering [Field] X.0:
1.0 — [Old approach]
2.0 — [Current with examples]
3.0 — [Emerging approach]
[Specific prediction + timeframe]"

Example:
"We're entering Health 3.0:
1.0 — Treat disease
2.0 — Track health (Fitbits, Watches)  
3.0 — Predict before symptoms
Your phone will warn of heart attack days before."

🚫 AUTO-REJECT: Buzzwords without examples, vague "future of..."
```

---

## **7. PROVOCATEUR**

**Replace thought-provoking section with:**
```typescript
🚨 PROVOCATEUR FORMULA (3 questions + answer):

Q1: Challenge timing ("Why wait for X before Y?")
Q2: Challenge practice ("Why do X when Y works?")
Q3: Reframe issue ("Why treat X like Y?")
ANSWER: The insight

Example:
"Why wait for heart attack to care about heart?
Why only stretch after injury?
Why treat health like apology not responsibility?
Prevention isn't boring. Regret is."

🚫 AUTO-REJECT: Hollow "What if?" without answer, no mechanism in answer
```

---

## **8. EXPLORER**

**Replace discovery section with:**
```typescript
🚨 EXPLORER FORMULA (pattern recognition):

STRUCTURE:
Example 1: [Place/group A does X]
Example 2: [Place/group B does Y]
Example 3: [Place/group C does Z]
Pattern: [What they share]
Insight: [What this reveals]

Example:
"Sardinia: red wine daily.
Okinawa: purple sweet potatoes.
Ikaria: afternoon naps.
Different habits. Same result—longest lived.
Maybe it's living slow, eating real, laughing often."

🚫 AUTO-REJECT: "Did you know" trivia, no pattern revealed
```

---

## **9. NEWSREPORTER**

**Replace coverage section with:**
```typescript
🚨 NEWS FORMULA (5-parts):

1. URGENCY: "🚨 [Timestamp]: [Event]"
2. FINDING: "[Exact stat/claim]"
3. CONTRAST: "Not [X]. Not [Y]. Just [Z]."
4. SOURCE: "Published [when] in [Journal]"
5. REFRAME: "It's not [expected]. It's [surprising]."

Example:
"🚨 Published today: 8,000 steps cuts death risk 51%.
Not 10,000. Not marathons. Just ~60min walking.
JAMA Network Open.
It's not 'influencer secret.' It's 'sidewalk is medicine.'"

🚫 AUTO-REJECT: No timestamp, sounds like blog not news
```

---

## **10. STORYTELLER**

**Replace storytelling section with:**
```typescript
🚨 STORY FORMULA (5-part narrative):

1. PERSON: "In [year], [age]-year-old [location] [person]"
2. CHALLENGE: "[Authority] said [limitation]"
3. PROGRESSION: "Started [X]. Then [Y]. Then [Z]."
4. RESULT: "Today, [achievement]"
5. LESSON: "[Concept] isn't [X]. It's [Y]."

Example:
"In 2009, 69-year-old Japanese man had heart attack.
Doctors said never run again.
Started 100m daily. Then 200m. Then half mile.
Today, 76 marathons completed.
Health isn't miracle. It's momentum."

🚫 AUTO-REJECT: Generic "someone", no numbers, no lesson
```

---

## **11. INTERESTING**

**Replace scrolling section with:**
```typescript
🚨 INTERESTING FORMULA (surprise + mechanism):

Line 1: Surprising fact (challenges assumption)
Line 2: Amplifying detail (makes it MORE surprising)
Line 3: Mechanism (WHY it's true)
Line 4: Memorable reframe

Example:
"Heart beats 100,000 times/day.
But gut bacteria produce 95% of serotonin.
Mood starts in colon, not head.
You don't 'feel with heart.' You feel with microbes."

🚫 AUTO-REJECT: Obvious fact, no mechanism, generic "interesting"
```

---

## **12. HUMANVOICE**

**Note:** This generator uses `humanVoiceEngine.ts` with a different architecture.  
**Action:** Verify it doesn't contain generic phrases. If it does, replace with specific voice patterns.

---

**IMPLEMENTATION APPROACH:**

For generators 4-11:
1. Find the section with generic language
2. Replace with formula above  
3. Ensure AUTO-REJECT criteria are clear
4. Test compile

Total estimated time: 15-20 minutes for remaining 9 generators.

