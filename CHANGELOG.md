# Changelog

All later changes are tuning on top of the V1.0 baseline and carry 1.x numbers.

## 1.2.0 — The allowance loop, closed (17 September 2026)

- **Two more basics**: homework done by its due date (weight 10) and the monthly grades sheet (weight 5, counted from the 21st).
- **Grades sheet**: a photo or PDF of the school's sheet each month (Me → Grades, or Progress for the parent); the AI transcribes it, compares with last month and writes an appraisal; the parent gets a ping.
- **Claims**: when a week closes, the child claims it on Rewards; the parent gets a ping and marks it paid. Claimed and paid badges on both sides.
- **Target reward**: the child marks the reward he is working toward; a progress bar shows points and the full-week streak it needs.
- **Extra-effort rewards**: "Weekend with a friend (+250 EGP)" needs three full-allowance weeks in a row; "Friend over" needs one. Redemption is refused until the streak is there.
- **Sibling raters**: a parent can mark an older sibling as a rater; he taps manners and dish for the others from his Me page, and every tap records who made it.
- **"We haven't taken this yet"** on any planned quiz: the topic leaves the plan until the class log says it was taught, today's set on it is retired, and the lesson opens and starts writing itself. The Explain button no longer stalls silently: it shows progress and a retry.
- **Priority in the evening reminder**: the most valuable missing basic is named ("Allowance priority: …").

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
