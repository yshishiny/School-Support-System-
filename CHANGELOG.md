# Changelog

## 2.0.0-beta.25 — The last three long pages (20 September 2026, `v2` branch)

- **Snaps** stacked eight blocks down a phone, so the handwriting corner sat below everything and was never reached. The meter — what is open now, and the week so far — stays on screen; *Today* and *Handwriting* are tabs.
- **Snaps → check their snaps** put the finished pile underneath the work, pushing what a sister actually has to look at off the screen. Three tabs now: *To check*, *With Dad*, *Decided*, each with its count.
- **Parent → Progress** already had one tab per child, but each child's panel was eleven blocks in a single card. Inside each child: *How he is* (wellbeing light, early signals), *School* (grades sheet, checkpoints, exam readiness, the topic grid, flagged attempts), *Coach* (the analysis and straight talk), *Setup* (professional guidance, target exam).
- With these, every page in the beta that ran long now opens on its summary and keeps the rest a tap away. A sweep of all 52 pages found the rest were already tabbed, already short, or a single form. Parents keep the side menu (a strip on phones) and children the bottom bar; neither changed.

## 2.0.0-beta.24 — The overnight lesson writing actually runs (20 September 2026, `v2` branch)

- **Fixed: the lesson warming shipped in beta.22 never ran anywhere.** It lives on the beta, and the beta's nightly jobs are switched off so the two sites do not both do the shared work and pay for it twice — but the live site does not have the virtual teacher at all, so nobody was preparing lessons. The teacher's overnight work now runs on the beta even with the rest of the nightly job off: its lessons live in tables the live site never touches, so there is nothing to collide with. Tonight it has eight of Omar's topics to write.
- The in-lesson speed-up from beta.22 was never affected: tapping a topic still opens the words at once and draws the pictures behind them.

## 2.0.0-beta.23 — Every failure says where it happened (20 September 2026, `v2` branch)

- **A child can now report a fault.** Anything that genuinely breaks hands back a plain sentence and a six-character reference: *“That is already saved. (ref k3f9a2)”*. The same reference is on the log row, next to the exact function it happened in, so “it said k3f9a2” finds one row instead of a haystack. The characters avoid everything that is misread aloud — no 0, O, 1, l or i.
- **No child is shown a database error again.** Thirty-eight places handed a Postgres message straight to the screen — `duplicate key value violates unique constraint "kpi_ticks_pkey"` — and logged nothing at all. Each now reads as a sentence: *that is already saved*, *something required was left empty*, *you are not allowed to do that*. The raw text, the code and the constraint go to the log where they are useful. Every code in that table was checked by provoking the failure on the real database, not written from memory.
- **A refusal is no longer treated as a fault.** “Pick a plan”, “title is required” — the app working correctly. These stay exactly as they were: no reference, no log, no noise. Only things that actually broke are recorded.
- **Failures that used to vanish now leave a trace.** A referral bonus that never paid, a mosque bonus that never landed, a lesson that was never illustrated, a video search against an expired key — all were `catch {}`, which meant nobody ever found out. Each one still refuses to take the child's tap down with it, and each one now says so in the log. The handful still deliberately silent — the logger's own fallbacks, and the edge middleware, which has no route to the log — say in a comment that they were a decision.
- **Every failure knows who hit it.** The signed-in child is remembered for the length of the request, so a log row names them without a single id being passed down through the code. Most failures used to be recorded against nobody.
- **The Admin error log is built around the question it gets asked.** A box at the top takes the reference somebody quoted. Below it, the failures group by function, so "which part is breaking" is answered before reading a single row, and each row shows the database code and what the database actually said.
- Fixed: a Wikimedia timeout used to be cached as “no photograph exists for this phrase”, permanently. A search that ran and found nothing is still remembered; a search that failed is not.

## 2.0.0-beta.22 — The lesson opens at once, and no page needs scrolling (19 September 2026, `v2` branch)

- **Tapping a topic no longer costs a minute of waiting.** The teacher used to write the lesson *and* draw every scene before the child saw anything. Now the words are saved and the lesson opens the moment they exist; the drawings and photographs arrive behind it, and the stage says "pictures coming" rather than showing a spinner. A drawing that fails leaves the lesson whole and is retried the next time it is opened.
- **Lessons are written overnight.** Every night the topics the class actually covered in the last fortnight are written and illustrated in advance, for each child's own teacher, skipping anything already cached. By morning the common ones open instantly. Only topics really logged in class are prepared, so nothing is spent on lessons nobody opens.
- **A lesson left half-drawn is handed back.** Background work dies with the machine it runs on. Anything claimed more than twenty minutes ago is released each night so it is drawn on the next attempt instead of being stuck for ever.
- **Four long pages became four short ones.** Allowance, Me, Wallet and Teacher access each used to be a dozen cards down a phone. They now open on what matters — the money, the child, the balance, the credits — with the rest behind tabs that remember where you were: Allowance has *Get it all · Catch up · Extra · Weeks*; Me has *Me · Progress · Family · More*; Wallet has *Spent · This month · Every line*. Links that used to point at a section deep in Allowance now open the right tab.
- **A page that outlived a deployment can prove it.** Every build is stamped with its commit, and `/api/version` — the endpoint open tabs already use to notice a new deployment — now reports it. When a page hits an error it compares the two: different means the page is stale, so it reloads itself and nobody is shown a fault; the same means the error is real, and it is reported with both stamps, so the next report says plainly whether the code is wrong. The beta also ships source maps, so a fault names the function instead of saying "u is not a function".
- Fixed a circular import between the planner page and its day strip.

## 2.0.0-beta.21 — The ambassador programme (19 September 2026, `v2` branch)

- **The referral is double-sided now.** A family that arrives on an invitation gets a quarter off its first purchase, shown struck through on the price list. The inviter is paid a whole free month — 450 EGP of credits — but only once the newcomer has paid a *second* time. Paying on the second purchase means paying for a family that stayed, not for a signature.
- **An ambassador ladder, one level deep.** Five families that have paid makes you an Ambassador on a fifth of what they spend; twenty makes you a Partner on a quarter. Commission is calculated on money actually received and lands as credits each time one of your families buys. Nobody earns from anybody's recruits but their own.
- **A dashboard that can be read out loud.** Your tier, how many families paid, what they have paid in pounds, what you have earned, a bar to the next tier, and every family you brought with the date they joined, how many times they have paid, whether they are still using it, and whether your free month came through.
- **Invitations grow with success.** Two to begin with, two more for every family that joins and pays, to a ceiling of fifty. A dormant inviter cannot flood anybody.
- Redeeming a code no longer pays anything immediately; it records who invited whom and unlocks the welcome price. A reward that fails to write never costs the buyer their access.

## 2.0.0-beta.20 — The virtual teacher can be sold (19 September 2026, `v2` branch)

- **Credits are the unit.** Everything — a gift, a purchase, a thank-you for an invitation — is the same currency, at fifty credits to the pound. The two anchors you set fix the rest: 1,500 credits buys one child two days, and a month for one child is 450 EGP.
- **The price list.** One child for two days (30 EGP), a week (105), or a month (450). The whole house for a month is 1,200, which is less than three children bought separately, and a term for everyone is 4,200, cheaper again by the month. Buying while access is still running queues behind it, so paying early never throws away days.
- **Two invitations per family.** Each one is a six-character code with no lookalike letters and a link to send. When an invited family starts using the app, 500 credits land in the inviter's balance, about 10 EGP off their next month. Nobody can redeem their own code, use two, or be paid twice.
- **For the owner**, a Credits tab in Admin: hand any family credits with a reason on the record, and see every family's balance and how many children have access right now.
- **For a parent**, Teacher access under Learning: the balance, who can use it and until when, the plans, and the invites.
- **For a child**, one card on the teacher page that stays quiet while access is comfortable and speaks up in the last three days.

## 2.0.0-beta.19 — Prayer in congregation counts for more (19 September 2026, `v2` branch)

- **The log now knows where he prayed.** Claiming a prayer inside its window offers two buttons: at the mosque, or at home. The mosque is the first and larger of the two, because it is the one worth extra. A prayer already late cannot be claimed as congregation; he had to be there for it.
- **Twenty points for a full day at the mosque.** All five in congregation on one day pays a bonus of 20 on top of the three each and the ten for five on time.
- **Twenty-five for a week of Fajr there.** Seven days running with Fajr at the mosque pays 25, and again at fourteen days, twenty-one and so on — once per completed week, not every day after the first seven.
- Both bonuses are keyed to the prayer that earned them, so no reload or double tap can pay them twice, and a bonus that fails to write never costs him the prayer itself.

## 2.0.0-beta.18 — Claim it back, and a planner you can filter (19 September 2026, `v2` branch)

- **Money spent on the family or on school can be claimed back.** Next to anything he wrote down, a child can ask to be repaid — but only by saying which it was, why he spent it, and whether he asked permission first. Personal spending cannot be claimed at all, and the form says so. The request sits in your Wallets tab with his reason, whether he asked first marked in green or amber, and one tap to pay it back or turn it down with a word he reads. Approving credits his wallet once, keyed to that line.
- **A sister's tick now waits for you.** Her approval is recorded as a recommendation with her name and note; the snap stays pending and no points move until you confirm. Your queue puts the ones she has seen first. The child is told "your sister says it is done, waiting for Dad".
- **The planner's three counts are buttons.** Tap Classes, Quizzes or Things due and the whole two weeks narrows to that one thing; tap again for the full day.
- **Headings are readable again.** The new skin drew page titles as clipped-gradient text, which over a photo banner left them washed out. They are solid white with a soft shadow now, and the raised surfaces are deeper: a brighter top lip, a darker bottom lip, and numbers on tiles struck in the metal accent.

## 2.0.0-beta.17 — The sisters can approve their brothers' snaps (19 September 2026, `v2` branch)

- **A rater finally has somewhere to rate.** A parent could already mark a grown child as a rater, and the permission to approve a picture was already written and enforced, but there was no screen showing her anything — so the setting did nothing for photographs. There is now a "Check" page: her brothers' pending snaps, each with the picture, what the task asked for, what the coach thought, and one tap to approve or send back with a reason.
- **Never her own.** Her own pictures are filtered out on the way in and refused on the way through, so a rater cannot tick herself. Every decision is attributed to her and a parent can change it.
- It appears in the bottom bar and on her Snaps page with the number waiting, and only for a child the parent marked as a rater.

## 2.0.0-beta.16 — A university student is not a school pupil (19 September 2026, `v2` branch)

- **The allowance stopped marking grown-ups down for school things.** Every learner was scored against the same list, so a postgraduate lost points for not attempting a weekly checkpoint on the family curriculum, not uploading a school grades sheet, and not logging classes against a school timetable. Those five measures now switch themselves off for anyone past school; prayers, check-ins, manners, the chores and the coach check-in still count, because those apply to everyone in the house.
- **The teacher no longer shows an empty shelf.** With no school grade there is no curriculum to list, so the page offered an empty tab strip. It now says plainly that lessons come from the material you upload, with a button to add one, and calls them "your files" rather than "school files".
- Families where nobody's stage is set are unaffected: no stage means school, exactly as before.

## 2.0.0-beta.15 — A planner that knows the school day (19 September 2026, `v2` branch)

- **The planner was empty because it only ever showed typed-in homework.** The app already knew the timetable, the quizzes booked for each date and the days off, and showed none of it. The planner is now the next two weeks as a strip of days you tap: each day carries its classes with times and rooms, the quizzes already booked, and anything due.
- **One screen, not a scroll.** Three counts at the top (classes this week, quizzes booked, things due), late work in a red box that cannot be missed, the chosen day below, and everything undated or further out folded away behind one line.
- A day with no school says so, rather than looking broken.

## 2.0.0-beta.14 — Money owed shows up as money owed (19 September 2026, `v2` branch)

- **A week that closes with money in it credits the wallet at once**, instead of waiting to be marked paid. What a child has earned and not been given is now visible to both of you the moment the week ends.
- **Marking a week paid records the hand-over**, so the held balance drops by exactly that amount and his pocket rises by it. Tapping paid twice cannot take the money twice.
- **The health panel no longer calls the beta broken.** Its nightly jobs are switched off on purpose, because the live site runs them against the same database; a missing cron secret here is the intended state and now reads that way.

## 2.0.0-beta.13 — A wallet for each child (19 September 2026, `v2` branch)

- **Two balances, not one.** Money a child earns — a paid allowance week, a reward that pays cash — goes into his wallet and is *kept for him*. When you hand the notes over you say so, and that amount moves out of what you hold and becomes *money in his pocket*. What he then spends comes off the pocket. The two always add up to what he owns, which is a balance sheet he can see rather than a lesson he is told.
- **He writes down what he spent.** Amount, what it was, which kind of thing and the day, in four taps. The month then shows what came in, what went out, and where it went, ranked, with the biggest single thing named.
- **A first budget.** Whatever is in his pocket is split on screen into sixty to spend, thirty to put away and ten to give, with what the saved part becomes if he keeps it.
- **For the parent**, a Wallets tab under Allowance: what each child is held, what he has in his pocket, what he has spent, and one line to record a hand-over or to add money for Eid or a job.
- Nothing is credited twice: a week or a reward keyed to its own record can be marked paid again with no effect on the balance.

## 2.0.0-beta.12 — A new look for V2, and the cats fed as well as cleaned (19 September 2026, `v2` branch)

- **The beta is redrawn.** A near-black ground with a warm glow instead of flat navy; surfaces that sit above it on real layered shadows with a hairline of light along the top edge rather than a heavy outline; one champagne-gold accent with an ice-blue second; and controls with a physical edge — a lit top, a dark lip underneath, and a press that moves. Headings are tighter with a metal rule under the page title, inputs are sunken, the bottom bar reads as one machined strip.
- **Only the beta changes.** Every rule is scoped to the beta site, so the stable one the family uses each day is untouched.
- **Fixed on the way:** a button label could break mid-word on a narrow card and render as a disc; labels no longer wrap inside a button.
- **Feeding the cats, not just cleaning up after them.** Two more chores on the same weekly rota as the litter tray: fed in the morning (six until ten) and fed again in the late afternoon (four until nine), each a picture of the filled bowl and fresh water. One brother owns all the cat care for the week, then it passes over.

## 2.0.0-beta.11 — The lesson laid out for a phone (19 September 2026, `v2` branch)

- **The board is the lesson.** On a phone held upright the stage used to give the board 42% of the screen and the rest to a teacher two centimetres tall, leaving a third of the display empty. The board now fills the screen and the teacher stands in front of it, which is what the ⛶ button already did; a tablet or a laptop keeps the two-panel stage.
- **An empty board now teaches.** Beats with no diagram showed a green rectangle and the word "Listen…" while the words scrolled in a card at the bottom. The board carries the spoken line itself, large and lighting up word by word, and the card below shrinks away, so the screen says one thing instead of two.
- **Controls you can hit.** The seven buttons were bare icons on a thin strip; they are now forty-eight pixels tall with a word under each (Play, Next, Ask, Notes, Board, Voice), and the cryptic "0%" is a progress bar across the bottom.

## 2.0.0-beta.10 — The beta looks like the beta (19 September 2026, `v2` branch)

- **Its own icon.** The beta draws its app icon instead of loading a stored one: an orange tile with a test tube, against the live site's purple tile with books. On a phone's home screen the two are told apart at a glance, and the beta installs as its own app ("Portal Beta") rather than replacing the real one.
- **Its own colour.** Orange accents, a warm background, an orange line along the top of every screen, and the browser's own bar tinted to match. The version badge is now a chip that says BETA in the beta's colours, on every page rather than only the home page.
- Everything the two sites store is still one database: the beta is a different face on the same family data, which is exactly why it now says so everywhere.

## 2.0.0-beta.9 — The cats' tray, taken in turns (19 September 2026, `v2` branch)

- **A chore two children share.** Cleaning the cat litter is now a photo task like the bed or the desk, and it belongs to one brother at a time: Omar this week, Youssef the next, and so on. Whose turn it is is worked out from the day the rota started, so it never drifts and every part of the app agrees. The child on duty sees "your turn until Friday, then Youssef"; the other sees when it comes back to him.
- **It pays into the allowance like everything else.** The chore is a KPI, and it only counts on the days it is actually his turn — a brother is never marked down for a week that was not his.
- **Proof by picture.** A photo of the cleaned tray and the tied bag, screened by the AI and ticked by a parent, exactly like the other snaps. Evenings, four until ten.
- **Any chore can be shared.** Under Snaps → Tasks, tick the children who take turns and choose every week or every day. The turn is also written onto the task itself, so the stable site reads the same owner.
- Fixed: claiming a late prayer felt dead. The answer now comes straight back and the make-up reading is built afterwards, instead of the child waiting on it; the button says so while it saves, and a failure is shown rather than swallowed.

## 2.0.0-beta.8 — Prayers you can actually claim on a phone (19 September 2026, `v2` branch)

- **The prayer panel was being cut off.** It opened as a small anchored dropdown inside the home header, and that header clips whatever overflows it. On a phone the header ends about a hundred pixels down, so most of the list — the later prayers, their buttons and the whole "yesterday" section — was drawn outside the card and never reached the screen. The panel is now a full-width sheet that rises from the bottom of the screen above everything else, scrolls on its own, and is closed by the backdrop, the Escape key or a Close button.
- **Buttons big enough for a thumb.** Each prayer is its own row: a full-width "I prayed it ✓" while the window is open, and three equal buttons (On time · Late · Missed) once it has closed, all at least forty-four pixels tall. The same three buttons on the allowance page were a wrapping row of tiny chips; they are now an even grid.
- **The window now opens by itself.** Whether a prayer could be claimed was decided when the page was rendered and never revisited, so a phone left open since the morning kept showing a countdown long after the prayer had come in, with no button to tap. Each row now works this out from the current time, every twenty seconds.
- **The tap saves first.** Claiming asked the phone for its location before saving, so a permission prompt or a weak signal left the button doing nothing for up to five seconds. The prayer is saved immediately and the location follows in the background.

## 2.0.0-beta.7 — Exact geometry, a laser pointer, a presenter who keeps talking (19 September 2026, `v2` branch)

- **Geometry is drawn by maths, not by hand.** Constructions (points, lines, rays, segments, angles, transversals, triangles, polygons, circles) and coordinate graphs are no longer drawn by the model as raw SVG. The illustrator now describes the figure — "a line through P parallel to l₁", "the angle at X from B to T", "where these two lines cross" — and the app computes it: parallels are truly parallel, right angles are square, lines meet exactly at their intersection, and every angle arc sits on its two real rays. Graphs get their axes, arrowheads, ticks, units, grid, series and marked points from the data, with labels kept inside the plot.
- **A laser pointer instead of the emoji hand.** The part the teacher is explaining is framed by a pulsing ring with a presenter's red laser dot and ripple on it, moving smoothly from step to step.
- **The presenter no longer freezes.** The answers to every check (the praise, the hint, the reveal) are rendered as clips along with the script, so the human presenter keeps speaking through the whole lesson. When a line is still audio-only, the frame breathes and moves with a soft glow instead of showing a frozen photo.
- Pictures version 5: lessons drawn before this are redrawn in the background on their next open, the words and the presenter clips untouched.

## 2.0.0-beta.6 — Professional illustrations, real photographs, a steady presenter (19 September 2026, `v2` branch)

- **An illustrator redraws every scene.** The lesson writer now hands each scene to a dedicated illustrator pass on the strongest model, with a textbook style guide: layered objects with depth, a fixed palette, thick outlines, arrowheads and angle arcs, dark labels with a white halo, and spacing rules (no label on top of another, later steps in free space). Drawn once per topic and kept with the script.
- **Real photographs behind the board.** Beats about a real object or place carry a search phrase; a free-licensed photograph is found on Wikimedia Commons (credited in the corner), shown behind the board with a slow documentary drift. Cached per phrase.
- **Readability guard on the board.** Any light or white label is forced to dark ink with a halo at render time, and overlapping labels are nudged apart. Steps arrive with a small motion instead of a plain fade.
- **The presenter stays on screen.** With video on, the human presenter no longer flips to the cartoon for audio-only lines (check feedback, hints, answers): the photo shows before the first clip, the last frame between clips, with a speaking indicator. The cartoon appears only when video is switched off.
- **Board-focus layout** (⛶): the board takes the whole screen and the teacher becomes a small picture-in-picture window; the phone's own picture-in-picture triggers it too. Remembered per device.
- **Voices read correctly.** Symbols and notation become spoken words in both languages before any voice hears a line; scripts write numbers and maths as words; Arabic lines are fully vowelled (new scripts by the writer, older lines by a cached tashkeel pass), and neural voices keep their natural pitch.
- **Presenter photos from a phone.** Photos are shrunk to a 1200 px JPEG in the browser before upload (phone photos of 5–10 MB or HEIC used to be refused). Each presenter has a voice gender switch.
- **Errors from both sites.** Every logged error carries the site (live or beta) and version; the Errors tab shows counts per site and a badge per error.
- Script version 4: lessons written before this are rewritten on their next start.

## 2.0.0-beta.5 — Illustrated lessons (19 September 2026, `v2` branch)

- **Scenes: the lesson drawn in front of the child.** Explain and example beats now carry a large labelled diagram of the very thing being taught (the parallel lines and the transversal with the angle arcs, the cell and its membrane, the graph with its axes), built up in 3–6 steps. Each step appears exactly when the teacher says its phrase, the newest element glows and a pointer sits over it, so the child looks where the teacher is talking. Arabic scenes carry Arabic labels. No per-play cost: scenes are part of the script.
- Scripts are versioned: lessons written before scenes existed are rewritten on the next start (script version 2). Older cached scripts still play as they were.
- **Presenter voice gender** under Admin → Teachers: a woman's face speaks with a woman's voice (phone voice, premium voice and video clips alike), whatever the character's default.
- Fixed: the board's drawn diagrams could lose their animation state on re-render (innerHTML was re-applied on every spoken word).

## 2.0.0-beta.4 — Teachers on video (18 September 2026, `v2` branch)

- **A human presenter, like a TV lesson.** With `DID_API_KEY` set, every scripted line is rendered by D-ID as a short clip of a realistic presenter speaking with the premium voice (Egyptian for Arabic), lip-synced. The clip plays in the teacher's place; the board, camera, checks, confetti, scratchpad and raise-your-hand stay exactly as they are. Lines that are not scripted (greeting, check feedback, answers to questions) keep the animated teacher and the voice.
- **Rendered once, kept.** Clips are cached per line, presenter and voice in the private `lesson-videos` bucket; starting a lesson renders its script in the background from the first line, and the stage asks two lines ahead, so most clips are ready when the child reaches them. While a clip is still rendering the animated teacher speaks the line, and the clip is there next time.
- **Admin → Teachers.** The presenter photo per character (public `presenters` bucket; the service's sample face until one is chosen), the count of clips this month and a monthly cap (default 500 ≈ 50 lessons). Migration `20260918160000`.
- Cost: about US$1–3 per lesson script once on D-ID's API plans, shared by both children; nothing for replays.

## 2.0.0-beta.3 — The animated classroom, phase 2.2 (18 September 2026, `v2` branch)

- **Full-body animated teachers.** Each of the four characters is now a rigged cartoon body (head, arms with elbows, legs, outfit, prop) that breathes, blinks, sways, walks in, and performs gestures: wave, explain with open hands, point at the board, write on the board, think with a hand on the chin, celebrate with arms up, listen with a hand to the ear, shrug, bow. Six moods on the face; the mouth follows the voice with real mouth shapes driven by the browser's word timing.
- **A classroom stage, full screen.** A room per character (space deck, football pitch, lab, old Cairo), a chalkboard that fills as the teacher speaks (steps appear one by one, formulas chalk in, tables fill row by row, diagrams draw themselves stroke by stroke), a camera that eases between wide, board and teacher framings, karaoke captions that highlight the word being said, a timeline of the lesson's beats, and a control bar (back, play/pause, next, raise hand, scratchpad, auto/manual).
- **Lesson flow.** The teacher walks in, greets in character and announces the lesson; beats play on their own (or manually); checks stop the flow, answers fly onto the board, a right answer brings confetti and a celebration, a wrong one a hint and a second try; the recap ends with a "lesson complete" card, the score of the checks, and the 3-question quiz.
- **Tools for the child.** A scratchpad to draw over the board with a finger, and "raise your hand" with the microphone (where the browser has speech recognition) or typing; the teacher listens, answers in character, and returns to the lesson.
- **Voice robustness.** Word boundaries where the browser reports them, time estimates where it does not; a browser with no voice, or no Arabic voice, still runs the lesson with captions at reading pace instead of skipping ahead; Chrome's 15-second cut-off is worked around.
- **Scripts know the stage.** New lesson scripts carry a gesture and a mood per beat; older cached scripts get sensible defaults from the beat kind.
- **Voices.** The lesson starts from a tap (browsers refuse speech the page starts by itself). The 🔊 button lists every voice for the lesson's language: **premium cloud voices** first when `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` are set (Microsoft neural voices, with real Egyptian Arabic: Salma and Shakir; English: Guy, Davis, Jenny, Aria, Ryan, Sonia), then the phone's own voices, Egyptian ones first. Each can be tried; the choice is kept on the device. Premium audio is fetched a line ahead and cached as MP3 in the private `tts` bucket (migration `20260918140000`), so each script is synthesised once; if the service fails, the phone's voice takes the line. Free tier: 500,000 characters a month, about 50 lessons.
- **Public demo.** `/demo/teacher` lets anyone meet the four teachers and watch a sample lesson (English or Arabic) without signing in; `/demo/teacher/rig` shows every pose for tuning.
- Fixed: signed-out pages (login, join, demo) were bounced to /login by the device report in the app shell.

## 2.0.0-beta.2 — Beta rebased on 1.14.0 (18 September 2026)

- The virtual-teachers beta now carries everything from the 1.x line up to 1.14.0 (parent inbox and layouts, allowance page, snaps, follow-up questions, school files loop, admin page, installable app, morning routine, screen time).
- Beta deployments keep `CRON_DISABLED=1` so the nightly and hourly jobs run only on production; the two sites share the live database.

All later changes are tuning on top of the V1.0 baseline and carry 1.x numbers. The `v2` tree is the beta of version 2.

## 2.0.0-beta.1 — Virtual teachers, phase 2.0 (17 September 2026, `v2` branch)

- Four original teacher characters; the child picks one for all subjects (Teacher tab, changeable any time).
- Lesson scripts written once per topic or school file and character, cached and reused; a flag rewrites a script on the best model.
- The stage: the character speaks each beat with the phone's voice, captions, one visual per beat (text, steps, formula, table, SVG), checks with a hint and a second try, "raise hand" questions answered in character, resume after a reload.
- Finishing a lesson pays 10 points, records understood / shaky / lost, and opens a 3-question quiz that feeds mastery and review.
- Additive migration only (`20260917000000_v2_lessons.sql`): three new tables and one nullable column. Not applied to the live database; meant for the beta project.

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
