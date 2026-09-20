# Applying Meridian Order to Study Portal

What the plates argue for, stated as changes to this codebase. Each item names what is there now,
measured rather than remembered, and what should replace it.

---

## 1. The bottom bar is over capacity

`app/(student)/layout.tsx` hands `BottomNav` **ten items, eleven for a rater**. `components/Nav.tsx`
answers by setting `dense` above six and dropping the label to `text-[10px]`.

On a 390 pt phone eleven equal columns are **35 pt wide**. The platform minimum for a touch target is
44 pt, so every tap on that bar is a near miss, and the labels are set two points below the size at
which a nine-year-old reads comfortably.

**Five in the hand, the rest in orbit** — Plate II. Five primary destinations stay on the bar at
78 pt each, comfortably over the minimum, with the label back at `text-[11px]`:

| | |
|---|---|
| Today | the day, streak, what is owed |
| Learn | lessons, quiz, review, teacher |
| Prayer | the five, and the mosque claim |
| Allowance | earning, wallet, rewards |
| Me | profile, snaps, planner, settings |

The other six to eleven are not deleted, they are *seated*: each becomes a card at the top of its
parent tab, where a full-width row can carry a real label instead of a 10 pt one. Nothing becomes
harder to reach; the count on the bar stops growing every time a feature ships.

## 2. Sixteen hues is not a colour system

`lib/parent-sections.ts` carries **sixteen distinct hex values** across sixteen sections — pink,
magenta, violet, two cyans, two teals, three oranges, two yellows, two reds, a blue and a grey.
None of them is derived from another. Nothing in the app tells a parent what magenta *means*, so
the colour is decoration paying rent as information.

Spend colour where it is earned — Plate I. **One accent**, and the ground and greys carry the rest:

- the accent marks *the one thing that needs you now* — an unread approval, today's cell, a
  prayer still open — and nothing else;
- section identity moves to the icon and the position in the group, which are already there and
  already unique;
- a second, cold hue is available for *state* (a band divider, an inactive range) and never
  competes with the accent.

The current accent `#7c5cff` is serviceable. If it stays, it must become scarce; a violet on
every one of sixteen tiles says nothing when a seventeenth tile is genuinely urgent.

## 3. Emoji are not an icon set

Every `NavItem` carries an `emoji`, and the parent sections do the same. Emoji render differently
on every device the family owns, cannot inherit the accent, cannot indicate state, and shift
weight between iOS and Android so the bar is never quite aligned twice.

A single stroked icon set at one weight, inheriting `currentColor`, fixes all four at once and is
the one change most visible at arm's length. The playfulness the emoji were carrying belongs in
the illustration and the copy, where it is not also load-bearing.

## 4. Type has no middle, and should not pretend otherwise

Plate III sets four sizes and nothing between them. The app should do the same: a display size for
the one number that matters on a screen, a title, a body, and a label. Anything that wants a fifth
size is asking for a different position, not a different size.

## 5. The ledger, not the list

The wallet balance sheet already learnt this. Anything with dates and amounts — allowance, credits,
access — reads better as aligned columns on a shared grid than as stacked cards: the eye compares
down a column for free, and a single warm cell marks today without a badge, a border or a hue.

---

*Position is meaning. Colour is expensive.*
