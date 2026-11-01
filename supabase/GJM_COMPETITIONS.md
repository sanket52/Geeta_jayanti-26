# Geeta Jayanti Mahotsav competition setup

## Apply the database setup

1. Configure Supabase Auth with email OTP and deploy the current app with its existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values.
2. In the Supabase SQL Editor, run `geeta_jayanti_exam_setup.sql` if the candidate registration tables and `profiles` table are not already installed.
3. Run `geeta_jayanti_competitions_setup.sql` once. It extends the current candidate registration schema; it does not replace it. It creates the four competition categories, date and age settings, participant category selections, private submission storage metadata, judging and rubric tables, quiz attempts/questions, and audit records.
4. Run `geeta_jayanti_strict_exam_mode.sql` after the competition migration. It adds configurable focus/fullscreen policies, idempotent exam submission reasons, an event timeline, and resilient attempt resume behavior.
5. Create the private `gjm-competition-submissions` bucket and its storage policies via the competition migration. The bucket rejects files over 500 MiB and limits media MIME types. Per-category limits are enforced again by the database.
6. Provision administrator and teacher profiles using a trusted process. Only Supabase profile roles are trusted here; the browser demo admin/local ERP data does not grant database access.
7. Sign in as a Supabase admin and open **Admin → Mahotsav Judging**. Review the schedule, age rules, and exam policy. The default 1 December closing time is marked unconfirmed, so registration and quiz start remain blocked until an authorized admin confirms it.

The migration seeds 51 general Gita questions for each age group and rotates answer positions. Every attempt receives exactly 50 questions, exactly one attempt is permitted per participant registration, and scoring happens in database functions. Edit the question bank through the Supabase SQL editor for now; the existing `/admin/questions` screen manages a separate demo question bank.

## App locations

- Public event categories and schedule: `/competitions`
- Existing signup and category selection: `/register`
- Existing registered participant category selection, quiz, and uploads: `/student/competitions`
- Authorized submission review, judge assignment, marks, schedule, age rules, and exports: `/admin/mahotsav-judging`

Use the existing participant email OTP sign-in. The current app does not provide mobile OTP, so the mobile number is collected but not independently verified. Existing accounts can select Mahotsav categories in the participant portal without creating a second candidate registration.

## Operational limits to understand

- No event rulebook was found in the project. The brief leaves ages 18 and 30 unresolved; those ages have no default category. Admins can configure non-overlapping age ranges after confirming the official rules.
- The exact 1 December registration/quiz closing time is also unresolved. The database leaves the event window unconfirmed by default; an admin must confirm it before registration/quiz entry opens.
- The quiz timer and one-attempt rule are enforced by the database. Answers are saved as the participant works. If a browser closes, the attempt remains reserved and resumes from the server-saved answers; after expiry, the next visit submits those saved answers. A browser cannot reliably notify the server at the moment it closes.
- The quiz records tab visibility changes as review signals. It cannot reliably detect screenshots or prevent every kind of cheating.
- Strict quiz mode asks the participant to enter fullscreen and begin after acknowledging the configured rules. The default policy submits on hidden-tab and fullscreen-exit events; browser focus loss is logged but does not submit unless an admin enables that rule. Supported events, detected timestamps, submission reason, elapsed time, and network interruption signals are visible in admin review.
- Auto-submission is best-effort while offline: the browser saves a pending payload locally and retries on reconnect; the server remains the authority for the deadline and score. If a browser closes before a pending request can be sent, it is retried when the same participant resumes the existing one-attempt quiz. No browser can guarantee delivery while disconnected.
- Video duration is checked in the participant's browser and checked against the stored duration during server submission. Browser-supplied duration metadata is not proof of the media's true duration; production-grade verification needs a trusted media-inspection worker/Edge Function. No such worker or paid provider was added.
- Uploads show browser transfer progress and retryable errors. Private objects are readable only by the owner, an admin, or a judge assigned to that submission. Judges receive short-lived signed links through the authorized review screen.
- The current admin panel can edit the schedule, age boundaries, category availability, upload limits, rubric labels, and review/publish results. The seeded question bank itself is managed in Supabase SQL until a dedicated question editor is added.

## Validation performed

`git diff --check` passes. `npx tsc --noEmit` still reports existing type errors in `src/pages/admin/Statistics.tsx`, `src/pages/exam/ExamPortal.tsx`, and `src/pages/student/OralExam.tsx`; it reports no errors in the new competition screens or registration changes. The project build also remains blocked by the installed Tailwind native module failing to load and a Windows Vite `spawn EPERM` error. This environment has no PostgreSQL/Supabase local instance, so the migration has not been executed against a live schema. Apply it first in a Supabase test project and verify Auth profiles, storage policies, RLS, and question counts before enabling the event publicly.

## Strict exam mode test checklist

Run these checks in a Supabase test project after both migrations are applied, using an approved participant with the quiz category and an administrator account:

1. Start the quiz, confirm the browser requests fullscreen, then refresh. The same questions and server deadline should return; no second attempt should be created.
2. Submit manually and retry the same RPC request. The score and submission timestamp should remain unchanged, and the attempt should stay submitted.
3. With the default policy enabled, switch tabs/minimize and exit fullscreen in separate fresh test attempts. Each attempt should auto-submit once with the matching reason; the admin timeline should list the event and counts.
4. In a fresh attempt, turn on browser DevTools Offline, answer questions, and wait for the deadline or trigger a policy event. Reconnect and confirm the queued submission retries; the server deadline should not move.
5. In a disposable test attempt only, move `expires_at` to the current database time in SQL, resume the attempt, and confirm it finalizes as `TIME_EXPIRED` using server-saved answers.
6. Turn each admin focus policy off in turn. Its event should still be logged, but should not auto-submit; restore the intended policy after the check.

Browser automation and live Supabase credentials are not available in the implementation environment, so these are operator-run end-to-end checks rather than tests claimed as executed here.
