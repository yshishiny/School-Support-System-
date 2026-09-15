# Study Portal

A family study portal for Youssef (grade 10) and Omar (grade 8). Each boy logs in daily, sees what is due, checks in honestly, and earns points toward rewards. The parent sees everything and gets a WhatsApp summary every evening.

## What is in phase 2 (learning)

- **Curriculum map** for grade 8 and grade 10, American curriculum, matched to the KIS American Division subjects (grade 10: Biology and Physics, English, Math, History, Arabic).
- **Lessons on demand**: any topic can be explained in plain English with worked examples and a self-check. Cached after the first request.
- **Practice sets**: 8 fresh multiple-choice questions per set, instant feedback with an explanation after every answer. New sets weight the skills the student got wrong before and never repeat a prompt.
- **Review queue**: missed questions come back on a spaced schedule (1 day, then 3, then longer).
- **Daily recall**: the check-in lists today's classes from the timetable and asks what each covered. Those notes earn points, go into the evening report, and power a "recall quiz" on exactly that material.
- **ACT and SAT tracks**: mixed timed sets per section with real pacing (enhanced ACT and Digital SAT), plus skill-by-skill practice. The parent sets the target exam and date per child.
- **Integrity signals**: answering far faster than plausible with a high score, or leaving the tab repeatedly, flags the attempt, pays no points, and shows on the parent's Progress page and in the evening report.
- **Photo import**: homework, announcements and supply lists shared as photos are read by the AI (English and Arabic). A timetable photo can be read straight into a child's timetable. The real 2026/2027 KIS timetables for grade 8 and grade 10 are built in and loaded automatically when a child account is created.

## What is in phase 1

- **Accounts**: one parent account, child accounts created by the parent (username + password, no email needed).
- **Subjects and timetable** per child.
- **Tasks**: homework, quizzes, exams, projects, events. Added by the parent, by the child, or imported from the school's WhatsApp group.
- **WhatsApp import**: upload the group's exported `.txt`; Claude extracts dated items; the parent approves before anything is added.
- **Daily check-in**: mark each due task done / partly / not yet, mood, minutes studied, "what I learned" in their own words, "what I did not understand".
- **Points**: check-in +10, homework on time +5, all done +15, streak bonuses. Ledger is server-side and idempotent.
- **Rewards**: a catalog the parent defines (cash in EGP, privileges, items). Kids request, parent approves, points are deducted on approval.
- **Daily report**: generated every evening, stored in the dashboard, and sent to the parent's WhatsApp.

## Stack

Next.js 15 (App Router, server actions), Supabase (Postgres, Auth, RLS), Claude API (`@anthropic-ai/sdk`), Tailwind 4. Deploys to Vercel with a daily cron.

## Setup

1. **Supabase**: the project `kids-study-portal` already exists and the schema in `supabase/migrations/` is applied. In the dashboard:
   - Authentication → Providers → Email: turn **off** "Confirm email" (or keep it on and confirm the parent's email once).
   - Project Settings → API: copy the anon key and the service role key.
2. **Environment**: copy `.env.example` to `.env.local` and fill in the values.
3. **Run locally**:
   ```bash
   npm install --legacy-peer-deps
   npm run dev
   ```
4. **Deploy**: import the repo in Vercel, add the same environment variables, and set `CRON_SECRET` to a long random string. `vercel.json` schedules the report at 18:00 UTC (20:00/21:00 Cairo).

## WhatsApp delivery

Set `WHATSAPP_PROVIDER` to one of:

- `callmebot`: free, personal use. Follow https://www.callmebot.com/blog/free-api-whatsapp-messages/ once from the parent's phone to get `CALLMEBOT_API_KEY`.
- `meta`: WhatsApp Cloud API. Needs a Meta business app; free-form text only works within 24 hours of the parent messaging the business number.
- empty: the report is still generated and shown under Parent → Reports with a "Share" button that opens WhatsApp with the text.

## Daily use

- **Kids**: open the site on their phone (add to home screen), tap Today, do the check-in after homework. The Planner shows what is coming. Rewards shows their points and what they can redeem.
- **Parent**: once or twice a week export each class group (group name → Export chat → Without media) and upload it under WhatsApp. Approve reward requests from the home screen. Read the evening report.

## Tests

```bash
npm test          # points rules, WhatsApp export parser, report formatting
npm run typecheck
npm run build
```

## Next phases

3. Full-length timed mock ACT / SAT sections with scaled scores, and a weekly summary to the parent.
4. Worksheet and chapter photo upload → explanation and quiz on that exact material.
5. Links by topic to Khan Academy and the Egyptian Knowledge Bank; Arabic interface option.
