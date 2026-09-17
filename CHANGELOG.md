# Changelog

All later changes are tuning on top of the V1.0 baseline and carry 1.x numbers. The `v2` tree is the beta of version 2.

## 2.0.0-beta.1 — Virtual teachers, phase 2.0 (17 September 2026, `v2` branch)

- Four original teacher characters; the child picks one for all subjects (Teacher tab, changeable any time).
- Lesson scripts written once per topic or school file and character, cached and reused; a flag rewrites a script on the best model.
- The stage: the character speaks each beat with the phone's voice, captions, one visual per beat (text, steps, formula, table, SVG), checks with a hint and a second try, "raise hand" questions answered in character, resume after a reload.
- Finishing a lesson pays 10 points, records understood / shaky / lost, and opens a 3-question quiz that feeds mastery and review.
- Additive migration only (`20260917000000_v2_lessons.sql`): three new tables and one nullable column. Not applied to the live database; meant for the beta project.

## 1.0.0 — V1.0 baseline (16 September 2026)

**Daily rhythm.** Evening check-in with a second chance later in the week; class log for every timetable lesson with a homework yes/no that becomes a task; prayer log with honest late entries (on time at school, late, missed); points, streaks, levels; snap tasks (bed, desk, dish, homework page, handwriting) with AI screening and parent approval.

**Learning.** Curriculum topics by grade; AI practice sets flavoured by interests; daily recall quiz; spaced review; SAT and ACT tracks; Arabic Ministry subjects; Quran memorisation; school files (PDF and photo) read once, turned into tasks and into the teacher's own worksheet as an on-system practice; a prepared week of quizzes per child; timed one-attempt checkpoints (weekly and spot) that position each subject and flag "claimed, not learned".

**Coach and wellbeing.** Weekly pulse, WHO-5, mindset and habits checks; confidential coach chat with safety escalation and helplines; weekly coach report with foundations and priorities; learner profile; clinician-facing summaries; early-warning signals; Straight talk honesty check shared with parents.

**Fairness and discipline.** Weekly allowance earned through basics (parent taps, app-counted KPIs, class log, checkpoint, snaps) with graded bands and eligibility hints; consequences as practices with a way back; automatic practice when the class log is left unfinished; integrity signals phrased as questions for the parent.

**Family.** Two parents with their own logins, Telegram and WhatsApp; invite links; custody days; daily report to every parent; browser notifications and kid reminders; access log with device and location; consent-based last-seen; home and school places; school website checks; school days off; hero pictures and three Today layouts.

**Platform.** Next.js 15 on Vercel, Supabase with row-level security, Claude models with a cost tier (saver by default), nightly and evening crons, deploy-aware reload.
