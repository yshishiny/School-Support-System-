# Study Portal V2 — Virtual teachers (beta)

Status: planning · Base: V1.0 baseline (tag v1.0.0 / branch release/v1.0.0) · Tree: `v2` (beta) · Owner: Yasser Elshishiny, Betna Group

## 1. Goal

Each child picks a character and that character teaches every subject, lesson by lesson, in a voice and style of the
child's choice, from the school's own curriculum and the files the teachers send, in English or Arabic. The lesson is
interactive: the teacher explains, shows, asks, listens, adapts, and hands the result to the coach and the parent.

## 2. What a "lesson" is

A lesson is a **script**, generated once per topic and reused, then **performed** live by the character.

```
topic (curriculum or school file)
  └─ script (AI, once): hook → explain (3-5 beats) → worked example → check question → recap → 3 quiz items
       └─ performance (live): character speaks each beat (voice + captions + a visual), pauses at checks,
            answers the child's questions in character, adapts the next beat when a check is missed
                 └─ outcome: understood / shaky / lost per beat → mastery, coach, checkpoint, parent
```

- **Script once, perform many.** Scripts are cached per grade + topic + language. Only the live Q&A costs per session.
- **Visuals** are generated as part of the script: formulas, step tables, simple SVG diagrams. No image generation in beta.
- **Sources** in priority order: the teacher's file (School files), the curriculum topic, the child's class-log note.

## 3. Characters

- 4 original characters at launch (no real people, no club or brand likenesses): e.g. a space captain, a football coach,
  a calm scientist, an Arabic-speaking storyteller. Each has a personality prompt, a voice, an avatar, and catch-phrases.
- The child picks one per subject or one for everything, and can switch at any time.
- Avatars are our own 2D SVG/Rive characters with a "talking" state driven by the speech timing. No video avatars in beta.
- Character never gives personal or wellbeing advice; that stays with the coach. Same knowledge, different manner.

## 4. Voice

| Option | Quality | Arabic | Cost | Beta role |
|---|---|---|---|---|
| Browser speech (Web Speech API) | OK on Android, good on iOS | yes (Google TTS on Android) | free | default |
| Cloud TTS (Google Neural2 / OpenAI TTS class) | good | yes | ~US$15–16 per million characters | optional "premium voice" |
| Voice-actor style TTS (ElevenLabs class) | best | partial | ~US$0.30 per 1,000 characters | not for beta |

A 15-minute lesson is about 9,000 characters: free with browser speech, about 14 US cents with cloud TTS.

## 5. Interaction

- "Raise your hand": the child types or speaks a question mid-lesson; the teacher answers in character and returns to the beat.
- Check questions every 3–4 minutes; a miss triggers a re-explanation with a different example, at most twice.
- "Teach me from my file": a lesson built from a School file the teacher sent.
- Every lesson ends with 3 quiz items; results feed mastery, the coach's priorities and the weekly checkpoint.

## 6. What the parent sees

Lessons attended (topic, character, minutes), understood / shaky / lost per lesson, questions the child asked (labels),
and a "teach it again" button. The daily report gets one line. Nothing from the coach chat is mixed in.

## 7. Architecture (delta on V1)

- Tables: `characters`, `lesson_scripts` (grade, topic_id or material_id, language, script JSON, model, version),
  `lesson_sessions` (student, script, character, started/finished, beats done, outcome), `lesson_questions` (Q&A turns).
- AI: script generation on Sonnet 5 (Opus for the first pass of a subject, then Sonnet); live Q&A on Haiku 4.5 with the
  script as cached context; safety classifier reused from the coach.
- Front end: `/teach` (character gallery and subject list), `/teach/[session]` (the stage: avatar, captions, visual, controls).
- Cron: nightly pre-generation of the next week's scripts from the plan, so lessons open instantly.

## 8. Environment and branches

- **Code:** `main` stays 1.x production. `v2` is the beta tree. Features branch from `v2` as `v2/<feature>` and merge back.
  Hotfixes land on `main` and are merged into `v2` weekly.
- **Beta site:** a second Vercel project (free) whose production branch is `v2`, at its own URL (e.g. study-beta.vercel.app).
- **Beta database:** a second Supabase project (free tier) so V2 migrations never touch the family's live data. Seed it with
  a copy of the curriculum, timetables and the boys' accounts. Beta AI key can be the same, with `AI_TIER=saver`.
- **Promotion:** when a feature is stable in beta, it merges to `main` as 1.x, or the whole tree ships as 2.0.

## 9. Cost

**Development (your time with the assistant):** the work is in the assistant's sessions; no contractor needed.

**Running cost per month (two children, one lesson each per school day, saver tier):**

| Item | Estimate |
|---|---|
| Script generation, one-off per topic (≈400 topics × 5 cents on Sonnet) | US$20 once, then a few dollars per term |
| Live Q&A during lessons (Haiku, ~10 exchanges per lesson) | US$8–12 |
| Check questions and end-of-lesson quiz | included in the existing quiz budget |
| Voice: browser speech | US$0 |
| Voice: cloud TTS if enabled (40 lessons × 9k chars) | US$5–8 |
| Vercel beta project + Supabase beta project | US$0 on free tiers |
| **Total beta** | **US$10–20 per month, plus US$20 once** |

If scripts are generated on Opus instead of Sonnet the one-off is about US$50. Video avatars (D-ID / HeyGen class) would add
roughly US$0.20–0.40 per lesson minute and are excluded on purpose.

## 10. Phases

| Phase | Weeks | Deliverable | Beta with the boys |
|---|---|---|---|
| 2.0 | 1–2 | Lesson engine, one character, captions + browser voice, end quiz, parent line | no (smoke test) |
| 2.1 | 3–4 | Four characters, personalities, voice per character, talking avatar, visuals | yes, Math and Science |
| 2.2 | 5–6 | Raise-your-hand Q&A, adaptive re-explanation, teach-from-file | yes, all subjects |
| 2.3 | 7–8 | Arabic subjects and Quran lessons, coach and checkpoint integration, premium voice option | yes |
| 2.4 | 9–10 | Polish, cost review, promotion plan to 2.0 | release candidate |

## 11. Risks and guardrails

- **Wrong facts.** Scripts cite their source (file or curriculum) and a parent can flag a lesson; flagged scripts regenerate on Opus.
- **Distraction.** Characters entertain in the first 30 seconds and the recap only; the middle is teaching.
- **Voice quality in Arabic.** Test browser voices on the boys' phones in week 3 before deciding on cloud TTS.
- **Likeness and IP.** Original characters only. Names and looks are ours; no footballers, no cartoon franchises.
- **Attention.** Lessons are capped at 15 minutes; longer topics split into parts.
- **Data.** Lesson transcripts stay in the family; questions asked are shown to parents as labels only.

## 12. Decisions needed from the owner

1. Approve the character concepts (names, looks) before art is made.
2. Browser voice only for beta, or enable cloud TTS from week 3?
3. One character for all subjects, or per subject?
4. Beta database: separate project (recommended) or shared with live?
