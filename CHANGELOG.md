# Changelog

All later changes are tuning on top of the V1.0 baseline and carry 1.x numbers.

## 1.1.0 — Live view and kid profiles (17 September 2026)

- **Live panel** on the parent home: who is online now and what he is doing (quiz, check-in, lesson…), plus the last 24 hours of activity, refreshed every 30 seconds while the page is open. Presence comes from a two-minute heartbeat.
- **Instant pings**: a browser notification to each parent when a kid checks in or finishes a quiz or checkpoint (switch on the parent's card under More).
- **Kids page redesigned**: a colourful side menu with one tab per child (picture, stage, age), and inside it Profile, Subjects, Timetable, Pictures and Home style tabs instead of one long page.
- **Child profile**: date of birth (age shown), stage of life (school, university, postgraduate, adult learner), gender, school, phone, notes for the coach, password reset. Grade is only for school.
- **Birthdays**: a banner on the child's Today page with a one-time 50-point gift, a badge on the parent home for the week before, and a line in the daily report.
- **Stage-aware coach**: the coach report and chat adapt their tone to university, postgraduate and adult learners and read the parent's notes.

## 1.0.0 — V1.0 baseline (16 September 2026)

**Daily rhythm.** Evening check-in with a second chance later in the week; class log for every timetable lesson with a homework yes/no that becomes a task; prayer log with honest late entries (on time at school, late, missed); points, streaks, levels; snap tasks (bed, desk, dish, homework page, handwriting) with AI screening and parent approval.

**Learning.** Curriculum topics by grade; AI practice sets flavoured by interests; daily recall quiz; spaced review; SAT and ACT tracks; Arabic Ministry subjects; Quran memorisation; school files (PDF and photo) read once, turned into tasks and into the teacher's own worksheet as an on-system practice; a prepared week of quizzes per child; timed one-attempt checkpoints (weekly and spot) that position each subject and flag "claimed, not learned".

**Coach and wellbeing.** Weekly pulse, WHO-5, mindset and habits checks; confidential coach chat with safety escalation and helplines; weekly coach report with foundations and priorities; learner profile; clinician-facing summaries; early-warning signals; Straight talk honesty check shared with parents.

**Fairness and discipline.** Weekly allowance earned through basics (parent taps, app-counted KPIs, class log, checkpoint, snaps) with graded bands and eligibility hints; consequences as practices with a way back; automatic practice when the class log is left unfinished; integrity signals phrased as questions for the parent.

**Family.** Two parents with their own logins, Telegram and WhatsApp; invite links; custody days; daily report to every parent; browser notifications and kid reminders; access log with device and location; consent-based last-seen; home and school places; school website checks; school days off; hero pictures and three Today layouts.

**Platform.** Next.js 15 on Vercel, Supabase with row-level security, Claude models with a cost tier (saver by default), nightly and evening crons, deploy-aware reload.
