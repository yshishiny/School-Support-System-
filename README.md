# Study Portal

A family study portal for Youssef (grade 10) and Omar (grade 8). Each boy logs in daily, sees what is due, checks in honestly, and earns points toward rewards. The parent sees everything and gets a WhatsApp summary every evening.

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

1. **Supabase**: the project `kids-study-portal` already exists and the schema in `supabase/migrations/0001_init.sql` is applied. In the dashboard:
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

2. Learning: upload worksheets or chapter photos → explanations, worked examples, quizzes with instant feedback, spaced repetition of missed questions.
3. Integrity signals: answer-time patterns, pasted-answer detection, weekly summary.
4. Exam prep: mock exams, weakness maps, links to Khan Academy and the Egyptian Knowledge Bank by topic.
