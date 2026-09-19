# Changelog

All later changes are tuning on top of the V1.0 baseline and carry 1.x numbers.

## 1.15.0 — Prayers you can claim on a phone, and a chore the brothers share (19 September 2026)

- **The prayer panel was being cut off.** It opened as a dropdown anchored inside the home header, and that header clips whatever overflows it, so on a phone most of the list — the later prayers, their buttons and the whole "yesterday" section — was drawn outside the card and never reached the screen. It is now a full-width sheet that rises from the bottom above everything else, scrolls on its own, and closes on the backdrop, the Escape key or a button.
- **Buttons big enough for a thumb.** Each prayer is its own row: a full-width "I prayed it ✓" while the window is open, three equal buttons (On time · Late · Missed) once it has closed, all at least forty-four pixels tall. The same three on the allowance page were a wrapping row of tiny chips and are now an even grid.
- **The window opens by itself.** Whether a prayer could be claimed was decided when the page was rendered and never revisited, so a phone left open since the morning kept showing a countdown long after the prayer had come in. Each row now works it out from the current time.
- **The tap saves first.** Claiming waited on the phone's location, and a late claim waited on the make-up reading being built, so the button sat dead for seconds. The prayer is saved and answered first; the rest follows in the background.
- **A chore two children share.** Cleaning the cat litter is a photo task that belongs to one brother at a time — Omar this week, Youssef the next. Whose turn it is comes from the day the rota started, so it never drifts. It pays into the allowance like any other KPI, and only on the days that were actually his turn. Any chore can be shared: under Snaps → Tasks, tick the children and choose every week or every day.

## 1.14.0 — Morning routine, wake-up call, screen time (17 September 2026)

- **Morning routine** on the kids' Today, on school days before the first lesson: Fajr, bed made (snap), sandwich ready (snap, the night before or in the morning), bag packed (snap; the AI reads the book labels against the next day's timetable), then "I'm ready, leaving on time" (+3). All done before the first lesson = **Morning champion +10** and a ping to the parents. In the evening the card shows "tonight, for tomorrow": sandwich and bag.
- **Wake-up call** at 6 (per child, Me → Reminders) on school days: first lesson, what is left of the routine, and what it pays.
- **Hourly reminders without an external service**: a database job (pg_cron) calls the app every hour once the administrator switches it on under Admin → Jobs. Wake-up, morning plan, evening round and last call then arrive on time.
- **Screen time**: a new snap task "Screen time screenshot" every evening (Digital Wellbeing or Screen Time summary); the AI reads the total and the top apps. Parents set a daily limit under Snaps → Tasks; over the limit becomes an integrity signal with three follow-up questions to the child, never an automatic penalty. Reading the phone's usage directly still needs the native shell (docs/ANDROID.md).
- New snap tasks: sandwich, bag, screen time. Migration 20260917220559.

## 1.13.1 — More page fixed, server errors captured in full (17 September 2026)

- **More page crashed on the server** since 1.12.0: the sections grid imported the menu list from a client-only file, which the server sees as a reference, not a list. The list now lives in a plain module shared by the menu, the bottom bar and More.
- **Server-side failures are logged with their real message** (the browser only ever sees a digest in production): render and action errors go to the error log with path, route and digest, matched to the client's report.

## 1.13.0 — Ready to become an Android app (17 September 2026)

- **Installable app**: full web-app manifest (name, PNG and maskable icons, standalone, portrait, home-screen shortcuts to Today, Snaps and Parent home), service worker registered on every page with an offline note, iPhone home-screen icon.
- **Install the app** card on the kids' Me page and the parents' More page: one tap on Android Chrome, instructions on iPhone and laptops, a tick once it runs from the icon.
- **Device dimension**: each session reports platform, app-or-browser, screen, battery and charging, network type, language and timezone; parents see it on Kids → Profile. First launch from the icon is recorded.
- **APK path**: `/.well-known/assetlinks.json` served from `ANDROID_PACKAGE` and `ANDROID_SHA256`; `docs/ANDROID.md` walks through packaging with PWABuilder (Trusted Web Activity) in ten minutes, and the later native step for screen time.
- Migration 20260917212836 (profiles.device, app_installed_at).

## 1.12.0 — A phone layout of its own for parents (17 September 2026)

- **Root cause of the wide page found and fixed**: the scrolling menu strip sat in a grid column and forced that column to the strip's full width (about 930 px), so every card below stretched past the screen. Scrolling strips (menu, kid tabs, page tabs) can no longer size their column.
- **Phones get a bottom bar** like the kids' app: Home, Inbox (with the unread badge), Kids, Allowance, More. The desktop side menu is hidden on phones; More shows a grid of every section.
- Verified at 412 px: nothing wider than the screen, tiles two by two, live feed wraps, kid tabs scroll sideways.

## 1.11.2 — Fits the phone (17 September 2026)

- The parent area (and the kids' area) can no longer grow wider than the screen: the page clips at the edge, long words and links wrap, badges and chips may break onto two lines, code blocks wrap, and the phone menu strip stays inside the padded column.

## 1.11.1 — Weekly syllabus with a date check (17 September 2026)

- **Upload asks "weekly syllabus / week summary? this week or last week"**. The reader extracts the dates printed in the file (D/M/YYYY) and one entry per subject; the app checks the dates against your choice, or against this and last week, and flags a typo instead of trusting it. The card shows the week it covers, what the file says, and a selector to correct it.
- **Syllabus versus class log**: every subject the syllabus lists is compared with his log for that week (no class, nothing logged, notes that do not match). One signal names the subjects; three follow-up rounds send him through it subject by subject and then to fix the log.
- At check-in, each class shows the syllabus line for that subject and week beside any subject file.
- The syllabus photo from 17 September (dates typed as March at school) is set to this week.
- Migration 20260917160311 (materials week-summary columns).

## 1.11.0 — Manners with the child first, and the school-file study loop (17 September 2026)

- **Manners**: the child rates his own manners at check-in (1 to 5, with a note). New parent page Manners (Fairness group): his rating and note beside your ✓/✗, hints on what to look for (tone, greetings, helping, phone at the table, siblings, helpers and elders, honesty, repair), the week in one row, and the days you disagreed. When he says 4 or 5 and you mark ✗, it becomes an integrity signal and a three-round follow-up to him.
- **What happens to every school file**: three practice sets on a spaced schedule (within 3 days, by day 7, by day 14), shown as chips on his Learn → Files and yours, pushed onto his Today, and counted as a new allowance basic "School files practised on time" (weight 5).
- **Monthly revision** from the 25th: per subject with files that month, one revision sheet (must-know list, worked examples, traps, self-test) and one 12-question quiz built only from the month's files. Kids open them from Learn → Files and Today; parents see them under School files → Revision, with a "build now" button.
- **Vercel Speed Insights and Analytics** added.
- Migration 20260917155153 (checkins.manners_self/manners_note, revision_sheets).

## 1.10.0 — Admin page and error log (17 September 2026)

- **Every caught failure is recorded** (file reading, snap check, lessons and diagrams, compensation, message delivery, grades reading, nightly jobs, browser crashes) with area, message, stack and who was affected. The administrator gets one inbox note per area per hour.
- **More → Admin** (administrator only): Health (configuration keys, database latency and row counts, storage buckets), Errors (open and resolved, one tap to resolve), Jobs (every cron run with its results and age), Services (Vercel deployments, Supabase project status, GitHub commits, Google/YouTube key check, Anthropic). Optional tokens VERCEL_TOKEN, GITHUB_TOKEN and SUPABASE_ACCESS_TOKEN light up the service lists.
- Migration 20260917154427 (profiles.is_admin, app_errors, cron_runs).

## 1.9.0 — The school's file versus the class log (17 September 2026)

- **New integrity signal "log vs school"**: when a school file for a subject is uploaded this week (by a parent or the child) and his class log for that subject says "no class", has nothing, or never mentions any of the file's topics, the parent sees it under "Worth asking tonight" with the file's topics and the dates he marked "no class".
- **The child is asked, three times, differently**: what was taken in that subject (round 1), which of the file's topics he actually took and on which day, after opening the file (round 2), then to correct the class log and say what he changed (round 3).
- **At check-in**, each class shows what the school shared for that subject this week. Tapping "No class" on such a subject shows a warning that the file and his log are seen side by side and will be double-checked.

## 1.8.2 — Reading no longer fails on a long topic list (17 September 2026)

- The file reader asked the model for at most 12 topics and threw the whole reading away when it listed more (a literature guide did). Now any number is accepted and the first 12 kept; unknown values for kind, language or task type fall back instead of failing; a broken task is dropped, the rest kept.
- The same cap removed from the snap check (strengths, focus) and the diagram drawer.

## 1.8.1 — More file types (17 September 2026)

- **School files accepts Word (.docx), PowerPoint (.pptx), Excel (.xlsx, .xls), CSV and plain text**, next to PDF and photos, from both the parent page and the kids' Learn → Files. The text is extracted on the server and read by the AI the same way; worksheets in Word can be turned into practice too.
- A file extension decides the type, so a CSV that Windows labels as Excel still uploads. Old binary .doc is not accepted: save it as .docx or PDF.
- Migration 20260917152314 (materials bucket types).

## 1.8.0 — Late entries, balanced (17 September 2026)

- **Prayers not logged on earlier days** can be filled in from the Allowance page for the whole allowance week (not only yesterday): on time, late, or missed, said honestly.
- **Every late entry is balanced**: a past prayer or a check-in filled in later opens a small task: read two ayahs (from the child's own memorisation list, otherwise from a rotation of short surahs) and answer one question on what he just read (complete the ayah, or which surah). Only then does the entry count for the allowance. Right answer earns 1 point; a wrong one means read again and try once more.
- The Allowance page now sends him straight to each thing that is left: prayers to fill in, missed check-ins by day, entries to balance, and the rest of the plan with a button per line. Today shows "late entries to balance" in the queue.
- Migration 20260917151733 (late_compensations).

## 1.7.1 — Quieter menu, readable kids (17 September 2026)

- **Parent menu redesigned**: one calm panel with grouped rows, a small coloured icon disc per item, and a colour bar plus soft fill on the current page. The phone strip is smaller pills.
- **Command centre layout**: the two squeezed kid cards are replaced by one child at a time in full-width tabs, each with a short summary strip on top of the full card. The tab bar sits below the phone menu strip.

## 1.7.0 — Straight answers (17 September 2026)

- **Follow-up questions to the child** on every integrity signal ("prayers marked on time after the fact", "the same Arabic note twice", "no class marked 10 times"…): asked up to three times on different days, each round phrased differently and asking for more detail; round three quotes his earlier answer and asks him to tell it again. Short or padded answers are refused; a real one earns 2 points.
- On the kid side: a "questions from your coach" item on Today and a Straight answers page (Coach → follow-up) with this week's answers.
- On the parent side: the answers appear under "Worth asking tonight" on the kid card, round by round, so a story that drifts is visible.
- Migration 20260917145743 (integrity_followups).

## 1.6.0 — Allowance on its own, three parent homes (17 September 2026)

- **Kids → Allowance tab** (💵, separate from Rewards): this week's amount and band, "why this amount right now" in plain words, "how to get the full allowance" as a to-do sorted by points at stake with a button to the right place for each, what can only be protected (a parent's ✗), what is lost, "if you stop now / if you do all of it", and "can I do extra?" (catch-ups until pay day, earn-back on consequences, extra-effort rewards and the full-week streak). Past weeks and claims moved here.
- **Kids → Rewards** is short again: Shop, My requests and Points tabs, with the target and an allowance link on top.
- **Three parent home layouts**, chosen under More → You: A command centre (to-do, kid cards, live feed and inbox in three columns), B kid-first (four numbers, then the coloured kid tabs), C the day as a timeline (Fajr to check-in, both boys side by side). The header's row of shortcut icons is replaced by the inbox bell.

## 1.5.0 — Parent inbox (17 September 2026)

- **Inbox** in the parent menu (🔔, with an unread badge) and a "N new" strip on Home: a copy of every daily report, safety alert, allowance week, school-news note and live ping, with New / All / per-kind tabs, "Read" per item and "Mark all read".
- The inbox fills even when Telegram or browser notifications are not connected, so nothing is lost.
- Migration 20260917144403 (parent_notifications).

## 1.4.0 — Snaps front and centre, this week's lessons ready before you open them (17 September 2026)

- **Snaps is its own tab** in the kids' bottom bar, with a week meter (done/due per task), "N to snap now", and a bright banner at the top of Today whenever a snap window is open. A saved picture or screenshot can be sent as well as a fresh camera shot.
- **Who checks the pictures**: a parent switch (Snaps → Tasks) turns the AI first look off; every snap then goes straight to a person, and the points come with the tick. Anything the AI is unsure about already waits for a person.
- **Rater siblings check snaps**: an older sibling marked as a rater sees the pending pictures on his Me page and approves or sends back like a parent.
- **Learn → This week**: the topics the child logged in class this week and the ones planned next, each with a written lesson, two or three diagrams drawn for it, and the same idea explained by different teachers on video (Khan Academy, CrashCourse, TED-Ed, Professor Dave, The Organic Chemistry Tutor; نفهم, مدرستنا, ذاكرلي عربي for Arabic subjects).
- **No waiting**: the nightly job prepares this week's topics in advance; "Get this week ready" fills the gaps three topics at a time, and a lesson's text and diagrams are written side by side. With a YouTube API key the videos play inside the app; without it each channel is a one-tap search.
- Migrations 20260917143529 (topic_resources) and 20260917143650 (families.snap_ai_check).

## 1.3.0 — One parent design (17 September 2026)

- **Colourful side menu for the whole parent area**: Home, Kids, Tasks, Quiz plan, Progress, School files, Import, Allowance, Snaps, Rewards, Reports, Guide and More, grouped, always on the left (a strip on phones). The old bottom bar is gone.
- **Tabs on every parent page**, in the same style as the Kids page: one colourful tab per child on Home, Progress, Tasks, Quiz plan and School files, and content tabs on Allowance (This week, History, Consequences, Settings), Snaps (To review, Handwriting, Recent, Tasks), Rewards (Requests, Catalog, Ideas, Balances), Reports (Reports, Entries), Import (WhatsApp, Timetable photo, School website, Recent), School files (Upload, To review, All files) and More (You, Parents, Family & places, About).
- **Same colour per child everywhere**, so Youssef and Omar keep their colour on every page; each child's tab shows online/checked-in status on Home.
- **Guide** is one step per tab instead of a long scroll.
- The chosen tab is remembered per page for the session and can be opened directly with `?tab=`.

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
