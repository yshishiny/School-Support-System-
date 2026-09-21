# Changelog

## 2.15.0 — Reminders that arrive, and twelve weeks you can see (21 September 2026)

**Why no reminder ever reached a child.** Browser push was configured correctly and the hourly job ran for days reporting success — with nobody to send to. Not one child had ever been subscribed, and no screen in the app said so.

- **`/sw.js` was being served through the login check.** The middleware's exclusion list named the icons and the manifest but not the service worker, so any request without a session answered with a redirect instead of JavaScript. A registration that fails throws, and the code turned every throw into "this browser cannot do notifications" — which hides the offer **without a word**. Both lists now exclude it, and a registration failure is recorded as a fault with the browser's own message instead of being swallowed.
- **A parent can now connect a child's Telegram**, which is the channel that actually survives: browser push can only be *asked for* once per install and a "no" is permanent, while Telegram works on any phone and survives a reinstall. The send path for a child already existed — only the linking was missing. He taps Start in the bot, you press Connect.
- **New on his page: “🔔 Can he be reached?”** — whether push is on, whether Telegram is linked, and **Send a test now**, which proves the channel end to end rather than trusting that it is configured. If nothing can reach him it says so in red, because that is the fact that went unnoticed for a week.

**New: 📈 Over time.** Twelve weeks of **allowance score** (with the line where it starts paying), **points earned**, **quiz accuracy** and **prayers kept** — one shared x-axis, so they read together.

- **A gap is not a zero.** A week with no quiz in it leaves a gap in the line rather than a point at zero; a week that was measured and came to nothing draws a mark on the baseline. The two look different on purpose — it is the same distinction the score and the prayers page now make, and a chart that blurred it would undo both.
- Every value is in a table under each chart, so nothing is reachable only by hovering. The series colour was checked against the card it sits on for contrast and colour-vision separation rather than picked by eye, and the charts were rendered and looked at on a laptop and at phone width before shipping.

## 2.14.0 — A prayers page, and Progress folded away (21 September 2026)

- **New: one child's prayers, over 7, 30 or 90 days.** Which of the five he keeps and which he keeps dropping — each of the five rated as a share of the days, so they are comparable, with the weakest named outright. A grid of every day and every prayer, days fully accounted for in a row, Fajr at the mosque, and the prayers he filled in after the fact rather than at the time.
- **Silence is not a missed prayer, and the page never adds the two together.** A prayer with no row is the app knowing nothing; "missed" is something the child *typed*, an admission the points system pays for on purpose. Conflating them would report thirty missed prayers where the truth is two owned and six days never opened — opposite conversations. The distinction is enforced in `lib/prayers/history.ts` and held by tests.
- **Progress is retired.** Everything it held about a child now lives on his own page: exam readiness and estimates, the topic-by-topic mastery map, checkpoints, the school grades sheet and its uploader, flagged attempts, the coach's full analysis with the button to ask for a fresh one, straight talk, the specialist's guidance, and the target-exam setting.
- **The one thing on it that was not about a child got its own page.** Lessons the reviewer held belong to a topic, not to a boy, so they are at **Learning → 🔍 Lessons to check**, and counted on the home page among the things waiting on you.
- Every link that pointed at Progress now points at the child it was about — including the notifications for a finished checkpoint and a transcribed grades sheet, which land on the right section of the right boy's page.

## 2.13.0 — Every title on a child's page is a door (21 September 2026)

- **Each section heading is now the link**, not a small grey button at the foot of the card, and it opens that subject's own page **already on this child** — Academic → Progress, Practice → the quiz plan, Money → the allowance meter, and so on, each carrying `?tab=<child>` so the side menu lands where you meant. Each heading also carries a line saying what is through the door, so a tap is never a guess.
- **Six sections that were missing are there now**, each with its own door and enough on the card to decide whether to open it: **Tasks and homework** (open, overdue, due this week, the next five), **Practice and revision** (reviews waiting and the week's planned quizzes), **Extra practice from school files**, **Curriculum** (which one he sits in, his stream, the subjects he logged), **Coach** (the headline, and the full read behind a fold), and **Reports**. **Rewards** joins them beside the money.
- **Prayers points at the week table below rather than inventing a page**, because there isn't one — a heading that looks like a link and goes nowhere is the complaint that started all of this.
- **A dead link can no longer ship.** `lib/parent-links.test.ts` walks the app directory for the routes that really exist, pulls every `href` out of the child page, the chooser, the parent home and the parent menu — reducing `${...}` to a matchable segment so dynamic links are checked too — and fails on any that resolves to nothing. It carries its own negative case, so the check is proven to bite.

## 2.12.0 — The version on screen is the version running (21 September 2026)

- **The version was written down twice and the two copies had drifted fifteen releases apart.** `package.json` said `2.11.0`; every screen in the app said `2.1.0`, because `lib/version.ts` carried its own literal that nobody remembered to bump. The beta had drifted the same way: package `2.1.0-beta.18`, app `2.1.0-beta.3`.
- **It is now written in one place — package.json — and read from there at build time.** `next.config.ts` injects it; `lib/version.ts` no longer contains a number at all. A test refuses a version-shaped literal on that line, checks the config reads the package, and keeps the newest changelog heading in step, so the two cannot silently part again.
- **A live-site bug that came straight out of the drift.** The parent home decided which site it was on with `APP_VERSION.startsWith("2.")`. Once the live site reached 2.x that was true there too, so the beta-only treatment was being served to everyone. It asks `isBeta()` now, which reads the deployed branch.
- **The badge says which site you are on, in words, on every screen of both apps.** `LIVE v2.12.0` or `🧪 BETA v2.1.0-beta.19`, bigger, and a link: tapping it opens About, where the build's commit is written out. Children see it too, and their Me page names the app, the version and whether it is the beta.
- **`/api/version` now returns `version` and `site`** alongside the deployment id, so which build each of the two sites is running can be checked from a browser without logging into either.

## 2.11.0 — One boy, every discipline, one page (21 September 2026)

- **New: an evaluation of each child across everything the app can see** — academic, manners, home duties, prayers, how he is in himself, and money. Each line carries a verdict, the one number it rests on, the evidence under it, and opens the detail that proves it. It leads the child's page, before any figure.
- **"Nothing measured" is its own verdict, and it reads like bad news**, because for a parent it is: it means he cannot see. A dimension with no evidence never reads as fine — the rule that the whole of this week turned on, now enforced across all six. Manners says outright *"You have not judged a single day out of 7. Nobody but you can measure this one."*
- **Progress is folded into the child's page.** Weakest and strongest topics, recent quizzes one by one, the school grades sheet and its appraisal, what the coach makes of him, reviews waiting — all under Academic, on the same page as his manners, his chores and his money. A parent does not think of "his learning" and "his money" as two destinations; they are two things about the same boy.
- **His siblings are small faces in the corner**, so switching child never means going back out.
- **The home page is now "what happened".** What is waiting on a decision, your children as faces and nothing else, today's taps, and then the feed of what actually occurred — each entry with its time and a way in. The three older arrangements stay in Settings for anyone who prefers one.
- The counts behind the evaluation are read back out of the very KPI lines the score was built from, rather than recomputed, so the page can never state two different figures for the same fact — pinned by a test against live `scoreWeek` output.

## 2.10.0 — One child, the whole page (21 September 2026)

- **Choosing a child now opens his own page.** Money and proof was one page holding every child at once behind a strip of tabs: tapping "Youssef" left three quarters of the screen showing his brothers and sisters and a column of fifteen other destinations. `/parent/trace` is now a chooser and nothing else — one wide row per child with the amount, whether he was active this week, and anything waiting — and `/parent/trace/<child>` is his account in full.
- **That page drops the side menu.** A page about one child does not need a menu of everywhere else; it carries a single "← All children" instead. Any route can ask for the full width through `lib/parent-focus.ts`.
- **Columns have names again.** With the width to do it, the day-by-day table says Check-in, Prayers, Classes, Quizzes, Snaps, Points rather than six emoji, and the four figures that matter — hand over now, unsettled, points held, this week's score — sit across the top as plain numbers.
- **Tapping a child on the parent home goes there too**, from the face or the name.
- New: every basic and what it paid, listed on the child's page with the `given` marks called out, so the score can be read line by line without opening Allowance.

## 2.9.0 — Silence is not a ✓, and no photo means no pay (21 September 2026)

Two rules on top of the score, both asked for after the evidence showed a week that paid 100 EGP on almost nothing.

- **A basic nobody ever tapped now pays half, not full.** "No ✗ so far" used to pay 20 of 20 on a column nobody had ever looked at. Dish, manners and phone are 50 of the 215 points in a full week, so a child none of whose days were ever judged started from a quarter of the score. Half keeps the original intention — a day nobody marked is not a day he failed — without paying for the parent forgetting. **An explicit ✓ still pays in full, on however few days it was tapped**; only silence is discounted, and a parent can still tick past days and recover the whole mark.
- **A week with no snap at all pays nothing.** The snaps are the only measure a child cannot satisfy by leaving something alone: a bed is made or it is not, and the picture says which. This is a gate, not a weight — it does not touch the score, it decides whether the score is allowed to pay. **One picture on one day lifts it.** While a snap is still due before pay day the child is told it can be lifted; once none is, he is told the week is settled.
- **What this does to the week just gone.** Rebuilt from the stored breakdown, Youssef's 12–18 September scored 51 and paid 100. Under the new rules: the snap gate alone takes it to 0 (0 of 46 snaps due), and even with the gate lifted the half-marks rule brings 51 down to **40** — under the paying line on its own. Tapping the three columns daily *and* taking one photograph puts it back to 52, which pays 100. All four figures are asserted in the tests.
- **Weeks already closed are untouched.** The rules apply from the running week forward; a stored week keeps the score, band and amount it closed with, so nothing anyone was already owed is taken back.
- The meter, the child's allowance page and Money and proof all state the gate in plain words, and the band shown is the one that will actually pay rather than the one the raw score reaches.

## 2.8.0 — A title is not an amount (21 September 2026)

- **"Youssef claims 500 EGP" was a reward called "500 EGP" that pays 100.** It was set up on the 14th, priced at 200 points, with its cash amount left at 100 — the title and the field that actually moves money were never the same number. Youssef had 214 points, saw a card that said 500, and pressed the button. The approval row a parent then reads showed the title and the points and *never the amount*, so both sides read 500 and neither of them was lying.
- **Every place a reward appears now states what it pays.** The request row, the catalog row and the child's own card all carry `pays N EGP` beside the title, and a title whose figure contradicts the amount is flagged in red where it can be fixed.
- **The request row opens.** It was plain text with two buttons and nothing to click; it now has a Details panel — when it was asked, what it costs, what he is left with, what approving actually pays and where the money lands, and that rejecting costs him nothing.
- **A score no longer hides an empty week.** Untouched columns pay in full on purpose, so a child who never opened the app still scored 37. The score is unchanged; what is new is that it is now stated in two parts — *earned* from what he did, and *given* because nothing was set, ticked or due — on the meter and beside every line. A week with nothing in it says so, in red.
- **New: Money and proof** (Fairness → 🧾), one page per child. What to hand over right now and why, weeks left unsettled, requests waiting, the current week day by day — check-in, prayers, classes, quizzes, snaps, points — and every point and every EGP with its date. Each figure on the page can be traced to a line at the bottom of it.

## 2.7.1 — A stopped lesson is not an error (21 September 2026)

- **The gate fired for real overnight**, twice, on مصر في عصر الولاة: the reviewer was not confident every fact in it was true, so the lesson was never stored and no child read it. That is exactly what it is for.
- **And it reported itself as a disaster.** One correct decision produced three red rows on the Admin page — the hold, the week-preparation step that counted it, and the cron run that found the word "error" in its own results — plus a note in the parent's inbox. An error log that shouts about the system working correctly teaches an administrator to ignore red, which is the one thing an error log must never do.
- **Held lessons now live in their own table** and the review queue reads them there. `app_errors` is for faults again. The two already recorded have been carried across and retired, so Admin is clear: **0 open errors, 2 waiting in Lessons to check.**
- **A run that holds a lesson is a successful run.** The nightly preparation reports held topics separately from errors, so it stops marking itself failed for doing its job.
- **A good lesson clears the hold.** When a later attempt on the same topic and depth passes, any hold standing against it is closed.

## 2.7.0 — Show me what you wrote (20 September 2026)

- **The model has never seen a child's own work.** It writes lessons blind and marks multiple choice, which tells you whether he picked the right letter and nothing about where his method breaks. Under a lesson there is now **Check my working**: photograph what you wrote, and be told which line first goes wrong.
- **It stops short of the answer, deliberately.** He gets the first wrong line, what the mistake is, and a nudge at the method — never the corrected line, never the next step, never the result. The attempt belongs to the child; that is the delegation rule from the teaching model, and this is the first screen where it is enforced rather than described.
- **One mistake is reported as one mistake.** Lines that are only wrong because they inherit an earlier error are marked fine. Telling a child six lines are wrong when he made one slip is the fastest way to make him stop trying.
- **It says when it cannot read the photo** — closer, flatter, more light — rather than guessing at the numbers.
- **The photograph is not kept.** What is kept is that he tried, on what, and where he got stuck. Until now the app could tell you he *opened* a lesson and nothing about whether he could do it: the teaching model calls the child the unit of success and had no measure of that unit. `working_checks` is the first one, and the whole family can read it.

## 2.6.0 — The app can listen (20 September 2026)

- **The teacher talked and nothing listened.** Azure reads lessons aloud in Egyptian Arabic, and there was no speech *input* anywhere in the codebase. `memorize_items` has never held a single row, and this is why: the feature asked a child to hide the text and mark himself, which is the one thing a child memorising cannot do — **he cannot hear his own mistake.**
- **Recite it, and the words come back coloured.** Tap once, recite, tap stop. Every word is marked: correct, missed, or something said that is not in the text. Plus a score, and one sentence about it — never a list of everything he got wrong.
- **The marking is aligned, not compared position by position.** A child who drops one word has missed one word; he has not got every word after it wrong. Turning the rest of an ayah red over a single slip is exactly what stops a child practising.
- **A transcriber's spelling never fails a correct reciter.** Both sides are folded to their consonantal skeleton first — vowel marks, the dagger alef of ٱلرَّحْمَٰن, ٱ against ا, ى against ي, ة against ه. He is shown his own مصحف spelling; only the comparison uses the folded form.
- **No new vendor.** The same Azure Speech key that already does the voices does the transcription, via the fast endpoint, because it accepts what a phone actually records.
- **His voice is never stored.** The audio is transcribed, marked, and dropped.

## 2.5.0 — A reminder can finally reach a child (20 September 2026)

- **Not one child has ever received a notification.** There is a single push subscription in the whole database and it belongs to a parent. Omar and Youssef installed the app on 17 September and were never asked. The nudge job has run every hour for days — 16 to 24 times a day, reporting success every time — and sent nothing, because it filters to children who have a device or Telegram and correctly finds none. It was not broken. It had nobody to send to.
- **The switch existed, three taps deep.** Me → the *More* tab → below the fold. A child was never going to find it, and the browser only offers the permission prompt **once per install** — a no is permanent until somebody digs through browser settings — so the one chance was being spent on a screen nobody opened.
- **The ask now sits on Today**, the only page a child opens without being sent there, and it says what it will actually do for him: before a prayer window closes, when a snap is still owed, before the week closes so he does not lose the allowance. One tap, dismissible, and it hides itself when there is nothing to offer.
- **It proves itself.** Granting permission sends a test notification immediately, so the child sees it arrive and the log records that the pipeline works, instead of everyone assuming.
- **iPhone gets the truth rather than a dead button:** Safari cannot send these until the app is on the home screen, so that is what it says.
- **You can see who is reachable.** Kids → a child → Profile opens with *Reminders reach him* or *No reminder can reach him*. A silent child and a child nobody ever asked look identical from the parent's side, and they are not the same thing.

## 2.4.0 — The parent's half of the contract has somewhere to happen (20 September 2026)

- **Parent → Progress opens with *Lessons to check*.** Until now the gate was real but silent: a bad lesson was genuinely stopped, and you had no way to know it. Two things appear there, and they are deliberately worded differently. A **stopped** lesson failed a blocking check and was never stored, so no child saw it — you are being told. A **flagged** lesson passed every blocking check and is being read now, with one thing the checker was unsure about — there you are being asked, and your answer is the only thing that can settle it.
- **The question is shown, not the slug.** "Would a grade 8 child follow it without meeting anything from a later year?" — the same sentence the checker was asked.
- **"This matched the class"** is the one judgement the four dimensions hand to a person rather than a model, and it now has a button. The model has never seen your son's teacher's board; it must never claim to know. Once given, the line the child reads under the lesson changes from *"written by an AI"* to *"written by an AI and checked by one of your parents"* — in Arabic when he is reading Arabic.
- **"It did not"** deletes the lesson rather than flagging it. The cache is the only reason it would ever be served again, so removing it is what actually stops a child reading it — and your reason is kept and **handed to the model the next time that topic is written**, so it does not repeat the mistake.

## 2.3.0 — The curriculum has a door, and no lesson reaches a child unchecked (20 September 2026)

- **A parent chooses the curriculum, and the app follows it.** Kids → a child → Profile now asks which system, which year, and — only for the years that have one — which stream. From then on Learn shows the subjects and the whole year's topics from the curriculum instead of subject names typed into a box. Omar and Youssef are on the American curriculum: 7 subjects and 88 topics for grade 8, 5 subjects and 113 for grade 10.
- The picker refuses what the curriculum refuses: a streamed year with no stream chosen, or a stream that year does not offer. A child studying nothing looks exactly like a broken page, so it is never allowed to happen quietly.
- **Every lesson is now checked before it is stored.** The writer writes the lesson, the discernment pass runs, and it is stored only if it passes. A lesson that fails a blocking check is *not written to the cache at all* — so it is never served, and tomorrow's attempt writes a fresh one rather than serving the bad one forever.
- **The checks split by what can actually settle them.** Language, whether the lesson names its own topic, and whether it contains worked steps are decided mechanically — free and instant. Whether a fact is invented and whether a grade 8 child could follow it go to a second model, told to mark its own side's work strictly and to answer false when unsure.
- **An unreachable judge holds the lesson.** If the review call throws or comes back unparseable, the checks stay unanswered, and an unanswered check already counts as failed. Nothing is released by silence.
- The overnight job no longer counts a held topic as prepared, so it comes back to it tomorrow instead of leaving a gap nobody sees.

## 2.2.0 — Two curricula, and the discipline the teacher works under (20 September 2026)

- **The curriculum knew about two grades.** `topics` held 190 rows covering grade 8 and grade 10 — Omar's and Youssef's — and had no idea a curriculum existed. It now holds **1,438 topics across 85 subject-years**: the American curriculum from grade 6 to 12, and the Egyptian national curriculum through prep and secondary.
- **The Egyptian system has a shape, and the data now has it too.** Prep 1–3, Secondary 1 common to everybody, then Secondary 2 splitting into علمي and أدبي and Secondary 3 into علمي علوم, علمي رياضة and أدبي. Two children in the same grade study different subjects from the second secondary year, so a level is a grade *plus a stream*, and `curriculum_subjects` says what each one studies rather than a parent guessing. Arabic-medium throughout but for the English subject.
- **The four dimensions are now a contract, not advice.** `lib/teaching/fluency.ts` holds Delegation, Description, Discernment and Diligence as typed, tested functions over a real curriculum row: who does what and why, a brief built from the topic's own unit and language, checks that block a lesson from reaching a child, and the provenance the child is shown. `docs/TEACHING-MODEL.md` states the model underneath it. The live site has no virtual teacher, but it writes lessons and quizzes from the same topics, so the same discipline applies.
- The rule that carries the weight: **a check that did not run counts as failed.** The same lesson as the stale-page hunt, written into the teaching path before it can cost a child anything.
- **Every foreign key is indexed.** Postgres does not do it for you, and 68 of them had no covering index — every `topic_id` among them. It never showed while the largest table held 459 rows; with the curriculum seven times larger and six tables pointing at it, it was about to.

## 2.1.4 — `u is not a function` was a stale page, and three reasons nobody could tell (20 September 2026)

- **The error was never a bug in the app.** Seen on the beta, and every one of the defects below was here too. All four reports landed 3 to 8 minutes after a deployment, on a day with sixteen of them: a page left open, a new build underneath it, and the next server action it tried failing against a deployment that no longer existed.
- **The stored stack was of the reporting function itself.** `reportClientErrorAction` built a fresh `new Error(message)` on the server, so every report carried a perfect stack of that call, inside whichever server chunk webpack had placed it in — which is why a failure on `/calendar` pointed at `app/parent/snaps/page.js`. The browser's own stack is now sent and stored, and when the browser sends none the log says so rather than inventing one.
- **The automatic refresh fired once per tab and then never again.** The marker was the error message alone, so the first `u is not a function` disarmed it for the life of the tab — exactly what the three failures in three minutes at 22:30 show, each one reported and none of them refreshed. It is now keyed to the build as well, so a page that healed after one deployment can heal after the next.
- **The staleness check could not work in the case it exists for.** `/api/version` required a session, so a tab left open long enough for its session to lapse — the very tab most likely to be stale — was answered with the sign-in page, `res.json()` threw on the HTML, and the check quietly returned "not stale". The endpoint is public now (it reports a commit and nothing else) and the reply is only parsed when it is actually JSON.
- The decision itself now lives in `lib/ops/stale.ts` with tests, including the case that started this: a differing build stamp means stale whatever the message says, and a matching one means a real fault whatever the message says.

## 2.1.3 — Nothing in the action modules is an endpoint by accident (20 September 2026)

- **Nine functions were public endpoints.** Next gives every export of a `"use server"` module an id and a route, so a helper that merely lived in an action file was reachable by anyone who could post to it — no page, no button, no sign-in.
- `fullWeekStreak`, `retryFailedMaterials` and `schedulerStatus` were the plain cases: any child's allowance history, a free "re-run the AI reader over every failed upload", and the state of the nightly job, all read with the service-role key and no check on who was asking. They are now ordinary helpers in `lib/rewards/streak.ts`, `lib/materials/retry.ts` and `lib/ops/scheduler.ts`, reachable only from code that has already established identity. `ensureAttempt` and `startReviewAttempt` did check the child and only ever touched his own rows, but were never meant to be callable either, and have moved to `lib/learning/attempts.ts`.
- **Two were reachable but dead.** `familyToday` and `snapTemplates` had no caller anywhere; they are gone rather than hidden.
- `normalizeLogin` and `availablePoints` are used only inside their own module, so they are simply no longer exported.
- **A test now holds the line.** Every `"use server"` module in `lib/actions` is checked to export nothing but functions whose names end in `Action`, on every run. A helper that drifts back into an action file fails the build instead of quietly going live.

## 2.1.2 — The wallet actually records the money (20 September 2026)

- **Nothing the app earned had ever reached a wallet.** The index that makes a credit happen once was partial (`where ref_id is not null`), and Postgres will not infer an arbiter from a partial index unless the statement repeats its predicate — which PostgREST's upsert does not. Every write raised 42P10 and the error was thrown away, so a closed allowance week, a cash reward and an approved expense claim all reported success and wrote nothing. Confirmed against the live database, and confirmed fixed there: the same statement is now accepted, a second write of the same thing is still ignored, and hand-entered lines with no reference still never collide.
- **No money was lost.** No week had been marked paid, no cash reward redeemed and no claim approved since the wallet shipped, and the three closed weeks already in the ledger were put there by the migration that created it. The bug cost nothing; it was simply waiting to.
- **A failed write is no longer silent.** It is recorded under its own reference with the child, the amount and what caused it, and a parent approving a repayment that does not land is told so with that reference instead of being told the money went back.
- **Marking a week paid is both halves or neither.** It used to credit the earning and then record the hand-over regardless; if the first failed the second would have shown a child owing money he was in fact owed.
- **Three wallet functions were public endpoints.** `loadWallet`, `creditWallet` and `withdrawFromWallet` were exported from a `"use server"` module, which makes each one callable, and all three took a child and a family from whoever called and wrote with the service-role key. They are ordinary server helpers and now live in `lib/wallet/ledger.ts`, where they are reachable only from code that has already established who is asking.
- **A parent could name any child.** Recording a hand-over or an adjustment trusted the id on the form; both now check the child is one of yours.

## 2.1.1 — Five in the hand, and colour that means something (20 September 2026)

- **The kids' bottom bar carried ten places.** On a 390-point phone that is 39 points a target against the 44 a thumb needs, and the labels had already been shrunk to 10px to make them fit. It is now five — Today, Learn, Snaps, Allowance, Me — at 78 points each, with the label back to a size a nine-year-old reads.
- **Nothing was taken away.** The Coach now sits at the top of Learn, Wallet and Rewards at the top of Allowance, and the Planner on Me — each a full-width row with a real label and a line saying what is through the door, instead of a ten-pixel word. The Snaps page already carried the rater's Check that way. Deep inside any of them, the primary it belongs to still lights up.
- **The parent menu carried fifteen unrelated colours**, one per section — two cyans, three oranges, two teals, a magenta — and nothing anywhere said what any of them meant. Colour that identifies everything identifies nothing, and left the accent with no voice on the day something genuinely needed attention. Identity now rests on the icon and the group; the accent marks the page you are on, and what is waiting.
- **The More tab could never light up.** Its test required the path to start with `/parent`, which every parent page does, so the first four always answered first — Reports, Guide, Progress and nine others showed no tab at all. More is now simply every page the other four do not own.
- The design philosophy behind all of this, and three plates drawing it, are in `design/`.

## 2.1.0 — Every lesson at two depths (20 September 2026)

- **The same topic, taught shallow or deep.** A child who missed the class needs the rule, one worked example, and enough to attempt tonight's homework. A child who already has that needs why the rule is true, where it breaks, and questions that do not come apart in one step. Teaching both to the same page fails one of them, so every topic now has two lessons: **The basics** and **Go deeper**.
- **The basics are free, always, for everybody.** A child who cannot follow his class is never stopped by a price. The deeper version, and the teacher who performs it, are what a family pays for — so on this site the deep tab says honestly what is in it and where it lives, and never nags.
- **Practice follows the same line.** Easy, medium and hard still move within a level; the level decides what kind of question is on the table at all. Basic sets keep one idea per question and tidy numbers. Deep sets combine topics, transfer the idea somewhere unfamiliar, and build the wrong answers out of the specific misunderstanding a student has on that topic.
- Both depths are written and cached separately, so opening one never overwrites the other, and asking for the deep one by hand is refused rather than quietly written.

## 2.0.1 — The mosque can be claimed afterwards (20 September 2026)

- **A prayer at the mosque logged later now counts as congregation.** Nobody stops at the mosque door to open the app: your boys' Fajr is prayed at five and logged at noon, and the mosque buttons only existed inside the prayer's window. So the 20-point day and the 25-point Fajr week were, in practice, unreachable. Filling in a past prayer now offers *🕌 On time, mosque* beside *On time, elsewhere*, with *Late* and *Missed* underneath, both on Today and on the Allowance catch-up list.
- A prayer claimed as late or missed still cannot be congregation, wherever it is claimed from. One rule, written once, and the day bonus and the Fajr streak read the flag rather than the moment the row was written — so a week of Fajr at the mosque pays even when every one of them was filled in at lunchtime.
- The late entry still asks for its balance — two ayahs and one right answer — before it counts for the allowance, exactly as before.

## 2.0.0 — The same app as the beta, without the virtual teacher (20 September 2026)

Everything built on the beta over the past week now runs here. The virtual teacher stays on the beta; so does the credits, invitations and ambassador system, which exists only to sell lessons. The two sites keep their own colour and icon so you can still tell them apart at a glance.

- **Prayer at the mosque.** Claiming a prayer inside its window now offers two buttons — at the mosque, or at home. All five in congregation on one day pays 20 points; seven days running with Fajr there pays 25, and again at fourteen, twenty-one and so on. This is the thing you could not find: it had never been on this site.
- **A wallet for each child**, kept as a balance sheet: what was earned, what a parent added, what was spent, and what is left — with where that money is right now, Dad's side and the pocket, adding back up to the same total. Every line carries its date and the balance after it. Money spent on the family or on school can be claimed back, with the reason and whether permission was asked, for you to approve.
- **A sister's tick is a recommendation.** A grown daughter marked as a rater gets her brothers' pictures to check, with her own page for the queue. Her answer is recorded with her name; nothing is paid until you confirm it.
- **The cats.** Waste cleaning and feeding on a weekly rota between the two boys, with a photograph as proof, counted in the allowance like any other chore.
- **Every failure says where it happened** — carried over in 1.16.0 — and **no page a child has to scroll**, from 1.17.0.
- **The planner reads the timetable**, so a week with no typed-in homework is no longer blank.
- A badge in the corner of every screen says which of the two sites you are on.

## 1.17.0 — No page a child has to scroll (20 September 2026)

- **Me** was nine cards down a phone, so the grades sheet and the reminders were below everything. It opens on who you are and how you learn; *Me* (pictures, theme, layout, interests), *Progress* (the fortnight, grades sheet, how points work), *Family* (rate your siblings, their snaps to check) and *More* (reminders, install, the tour, sign out) are tabs.
- **Allowance** was eight cards. The money, the band you are in and why is all that stays on screen; *Get it all*, *Catch up*, *Extra* and *Weeks* are tabs. Links that used to point at a section buried down the page now open the right tab.
- **Snaps** put the handwriting corner below everything, where it was never reached. What is open to snap now, and the week so far, stay on screen; *Today* and *Handwriting* are tabs.
- **Parent → Progress** already had one tab per child, but each child was eleven blocks in one card. Inside each: *How he is*, *School*, *Coach*, *Setup*.
- **The planner is no longer empty.** It only ever showed homework somebody had typed in, which is why a week with none looked blank. It now reads the timetable and the quizzes already booked: the next two weeks as a strip of days you tap, with the classes, the quizzes and anything due on each. Tapping "classes this week", "quizzes booked" or "things due" narrows the fortnight to that one thing.
- Every tab remembers where you were, so coming back to a page puts you where you left it.

## 1.16.0 — Every failure says where it happened (20 September 2026)

- **A child can now report a fault.** Anything that genuinely breaks hands back a plain sentence and a six-character reference: *“That is already saved. (ref k3f9a2)”*. The same reference sits on the log row beside the exact function it happened in, so “it said k3f9a2” finds one row instead of a haystack. The characters avoid everything misread aloud — no 0, O, 1, l or i.
- **No child is shown a database error again.** Dozens of places handed a Postgres message straight to the screen — `duplicate key value violates unique constraint "kpi_ticks_pkey"` — and logged nothing at all. Each now reads as a sentence: *that is already saved*, *something required was left empty*, *you are not allowed to do that*. The raw text, the code and the constraint go to the log, where they are useful. Every code in that table was checked by provoking the failure on the real database.
- **A refusal is not a fault.** “Pick a reward”, “title is required” — the app working correctly. No reference, no log, no noise. Only things that actually broke are recorded.
- **Failures that used to vanish leave a trace.** Work that must not take a child's tap down with it — a bonus beside a saved prayer, a video search against an expired key — was `catch {}`, so nobody ever found out. It still never fails the tap, and now it says so in the log. The few that stay silent say in a comment why.
- **Every failure knows who hit it.** The signed-in child is remembered for the length of the request, so a log row names them without a single id threaded through the code.
- **The Admin error log answers the question it actually gets.** A box at the top takes the reference somebody quoted; below it the failures group by function, so “which part is breaking” is answered before reading a single row.

## 1.15.1 — A page that outlived a deployment can prove it (19 September 2026)

- Every build now carries the commit it was made from, and `/api/version` — the endpoint open tabs already poll to notice a new deployment — reports it alongside the deployment id. When a page hits an error it compares the two: if they differ, the page was left open across a deployment and reloads itself rather than showing anybody a fault. If they match, the error is real — and is reported with both stamps, so the next report says plainly whether the code is wrong.

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
