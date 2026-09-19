# Study Portal — business model and selling plan

**Status:** draft for the owner, 19 September 2026. Prices here match `lib/access.ts`; change them there and this
document must follow. Nothing in this file is legal or financial advice: the commission structure in section 5
needs an Egyptian lawyer's opinion before a single riyal or pound is promised to anyone.

---

## 1. What is actually being sold

Not "an AI tutor". Egyptian parents already have those and mostly stop using them. What this sells is **a parent's
peace of mind about the week**, delivered as four things a competitor cannot easily copy together:

1. **A teacher that performs.** A named character who talks in Egyptian Arabic or English, draws the diagram on the
   board as they speak, stops to ask questions, and answers when the child raises a hand.
2. **Proof, not promises.** Snaps, prayers, class logs and the allowance meter mean the parent sees what happened,
   not a claim that it did.
3. **A fairness machine.** The allowance is scored on the same rules every week, so the weekly argument about money
   stops being a negotiation with the father and becomes arithmetic the child can check.
4. **Character, not just marks.** Prayers, manners, chores, honesty when a prayer was missed. No other study app in
   the market is doing this, and it is the part a religious family actually pays for.

**The moat is the cached curriculum.** A lesson is written once per topic, character and language, illustrated once,
and then replayed for every family that ever asks for it. The hundredth customer on grade-10 chemistry costs almost
nothing to serve. That single fact is what makes the economics work and what makes the second year much better than
the first.

---

## 2. Unit economics

These are estimates, marked as such. They must be replaced with real numbers from the admin Credits tab and the
Anthropic and D-ID invoices after the first month of paying customers.

**Revenue per customer, per month**

| Plan | Price | Notes |
|---|---|---|
| One child | 450 EGP | The anchor. |
| Whole family | 1,200 EGP | Cheaper than three children; most houses here have three or more. |
| Family, a term | 4,200 EGP | 1,050 a month. Cash up front, which matters more than the discount. |

**Cost per customer, per month (estimated)**

| Item | Estimate | Why |
|---|---|---|
| Lesson writing and illustration | near zero at scale | Written once per topic, then cached for everyone. The cost is a one-off per curriculum, not per family. |
| Presenter video clips | 30–90 EGP | The real variable cost. Roughly US$1–3 per lesson script on D-ID, shared by every child who takes that lesson. Capped per month in Admin. |
| Speech (Azure neural) | 5–15 EGP | Cached per line in the `tts` bucket, so replays are free. |
| Questions, feedback, coach chat | 10–25 EGP | Haiku on the saver tier for the small passes. |
| Hosting, database, storage | 5–10 EGP | Vercel and Supabase, shared across all families. |
| **Total** | **50–140 EGP** | |

**Gross margin: roughly 70–85%** on a single-child subscription, better on a family plan because the fixed part is
shared. That is a software margin, and it is what makes a referral programme affordable.

**The number to watch is not margin, it is retention.** At 450 EGP a month, a family that stays six months is worth
2,700 EGP; one that leaves after one month is worth less than the cost of persuading them. Everything in section 5
is built around paying for retention, not for signatures.

---

## 3. The curriculum is an asset, so build it deliberately

Each grade and subject written and illustrated is a permanent asset that every future customer uses free. The order
matters:

1. **Grades 8–12, the national curriculum, maths and the sciences first.** These are where families already pay
   private tutors 500–2,000 EGP a month, so the comparison flatters us.
2. **Arabic and religious studies next.** Nobody serves these well, and they are what makes a family trust the
   product with the rest of their children.
3. **Languages and the rest**, driven by what customers actually open.

Track cost per topic written and lessons served per topic. When a topic has been served fifty times, its cost is
noise; when a topic has been served twice in a year, it should not have been written yet.

---

## 4. Who to sell to, in order

**First circle — families you know (0–3 months).** Twenty families, hand-held, free or half price, in exchange for
honest weekly feedback and permission to quote them. The goal is not revenue; it is proof and three video
testimonials from mothers.

**Second circle — the mosque and the school gate (3–9 months).** The character side of the product sells itself in
places where nothing else does. A talk after Friday prayers, a WhatsApp message from a father another father
respects, a stand at a school event. This is where the referral engine earns its keep.

**Third circle — private schools and study centres (9–18 months).** Sell the family plan at a discount as a benefit
the school gives parents, or licence the teacher for a centre's own curriculum. One school is a hundred families in
one conversation.

**Not yet: paid advertising.** Facebook and Instagram in Egypt will cost more per acquired paying family than a
referral, until there is a landing page proven to convert and a retention figure worth spending against.

---

## 5. The selling network — and an honest word about network marketing

You said you want it to be like network marketing. The part of that which works is real and worth copying: **people
trust a neighbour more than an advertisement, and a product that pays them to tell the truth about it spreads
faster than one that does not.** The mechanism is already in the app: two invitations per family, a code with no
lookalike letters, credits paid to the inviter when the invited family starts using it.

The part that does not work, and which I would advise against, is **paying people for recruiting rather than for
selling, and paying them on their recruits' recruits.** Three reasons, plainly:

1. **Legal.** In Egypt, a compensation plan whose income depends on recruitment rather than on product sold is what
   consumer-protection law treats as a pyramid. Schemes of that shape have been shut down and their operators
   prosecuted. A family education app is exactly the kind of respectable-looking business that attracts that
   scrutiny.
2. **Arithmetic.** At 450 EGP a month you cannot pay two or three levels of commission and still fund the video,
   the models and the hosting. To make multi-level payouts work, the price would have to rise to a level the market
   will not bear, which is precisely why MLM products are usually overpriced.
3. **Reputation.** The customer here is a religious family choosing who to trust with their children. A recruitment
   structure that makes their neighbour's income depend on signing them up destroys the trust the product is
   selling.

**What I recommend instead — an ambassador programme, single level, paid on real subscriptions.** It gives you the
spread of network marketing without the structure that makes it a pyramid:

| Tier | Reached by | What they get |
|---|---|---|
| **Parent** | Everyone | Two invitations. A family that joins and pays gives them 500 credits today; I would raise this to **one free month once the invited family pays its second month**. |
| **Ambassador** | 5 families who paid at least twice | **20% recurring** of what those families pay, every month they stay, in credits or cash. |
| **Partner** | 20 retained families, or a school | **25% recurring**, a named landing page, and their own price to offer. |

Four rules that keep it clean and keep it legal:

1. **Nobody pays to join.** No kit, no starter pack, no fee to become an ambassador, ever. This single rule is the
   clearest line between an affiliate programme and a pyramid.
2. **Commission is on money actually received**, never on a signature, a trial or a recruit.
3. **One level only.** You earn on the families you brought, not on the families they brought. If you ever want a
   second level, get written legal advice first; I would not.
4. **It stops when they stop.** Commission follows the subscription; if the family leaves, the commission ends.

**Why the double-sided referral beats a bigger commission.** Give the new family 25% off their first month and the
inviter a free month once the newcomer pays twice. The inviter is paid for a customer who stayed, not one who
signed. Cost of acquisition is then about 450 EGP, paid only on a retained customer, against a lifetime value of
2,700 EGP at six months. That is a ratio worth spending every pound on.

---

## 6. Milestones, and what each one proves

| Milestone | Target | What it proves |
|---|---|---|
| 20 families using it free | month 1–3 | The product works in houses that are not yours. |
| 10 families paying full price | month 4 | Somebody will part with 450 EGP for this. |
| 60% still paying in month 3 | month 6 | Retention, the only number that matters. |
| Half of new families arriving by invitation | month 9 | The referral engine works and ads are not needed. |
| First school or centre | month 12 | The business is not capped by how many parents you personally know. |
| 300 paying children | month 18 | It supports a small team and the curriculum builds itself. |

At 300 children on the single-child price, that is 135,000 EGP a month, with costs of perhaps 25,000. That is the
first point at which this is a business rather than a project.

---

## 7. What to measure, weekly

Five numbers on one page. If a number is not on this list, it is not worth arguing about yet.

1. **Paying children**, and the change since last week.
2. **Retention by cohort**, the share of each month's joiners still paying.
3. **Lessons opened per child per week.** Under two, they will leave; the product has stopped being used before it
   stopped being paid for.
4. **Cost per active child**, from the real invoices, not the estimates above.
5. **Share of new families arriving by invitation.**

---

## 8. Risks, and what to do about each

| Risk | What to do |
|---|---|
| Video cost rises faster than revenue | The cap in Admin already exists. Set the mode to hook-and-recap rather than every line when margin tightens; the cartoon teacher costs nothing. |
| A competitor copies the teacher | They cannot cheaply copy the cached curriculum, the character side, or the parent's trust. Keep writing topics. |
| A commission plan attracts regulatory attention | Single level, no joining fee, paid on revenue. Get it in writing from a lawyer before you promise it publicly. |
| Families share one account | Price per child, watch device reports, and make the family plan cheap enough that sharing is not worth the trouble. |
| Support eats the founder's week | Every question answered twice becomes a page in the guide. |

---

## 9. The next three things

1. **Raise the referral reward** from 500 credits to a free month on the invited family's second payment, and add
   25% off the newcomer's first month. Both are small changes in `lib/access.ts` and the invite action.
2. **Build the ambassador dashboard**: who they brought, who is still paying, what they are owed, and a payout
   record. Without it, the programme cannot be run honestly.
3. **A landing page that sells the teacher**, with the demo lesson at `/demo/teacher` as the proof, and one
   testimonial from a mother. Nothing else converts in this market.
