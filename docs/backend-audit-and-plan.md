# Backend audit and implementation plan

## Actual project architecture

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4.
- Routing: React Router in `src/routes.tsx`.
- Backend: no separate application server or API routes. Privileged operations use Supabase Edge Functions; ordinary authenticated operations use the Supabase JavaScript client and RLS.
- Auth and client: one persistent client in `src/lib/supabase.ts`; student and admin login use Supabase Auth. Student profile sync and registration have Edge Functions.
- Database and storage: versioned SQL under `supabase/`; private buckets and RLS cover registration documents, exam data, competition submissions, and oral exam videos.

## Feature inventory from source inspection

| Feature | Current persistence/integration | Remaining work or operator setup |
| --- | --- | --- |
| Student email OTP / Google login, session, logout | Supabase Auth client | Configure providers, URLs, and email template in Supabase |
| Student registration and document upload | Supabase Edge Function, PostgreSQL, private Storage | Deploy functions and apply SQL; verify against a test project |
| Student profile and dashboard | Some profile values still come from browser storage/demo ERP | Move profile and dashboard reads/updates to the existing registration/profile tables |
| GJM category choice, quiz attempts, file uploads, judging | Supabase SQL/RPC, RLS, private Storage | Apply migrations; verify event schedule and policies with role accounts |
| General exam organizer/question bank/results | Mixed: question screen uses Supabase; organizer, results, and several student views still use demo/local records | Map screens to the installed exam schema before replacing demo data |
| Oral exam video upload | Supabase Storage and `oral_exam_submissions`; associated student record still has local/demo dependencies | Connect evaluation and student context to database records |
| Admin and teacher authentication | Supabase Auth at login and route checks query `profiles.role` | Provision trusted role rows; remove residual local demo staff/password behavior |
| Teacher/staff directory | Browser localStorage, including plaintext demo passwords | Replace with a protected database-backed staff directory and trusted server-side account invitations/role assignment |
| Notices, homepage counters and statistics | Static arrays/demo values | No persistent notices/support schema identified; needs schema and screen integration |
| Local session UI flags | sessionStorage for registration popup state only | Non-sensitive presentation state; not an authorization source |

## Implementation plan

1. Preserve the current design and route structure. Keep the single Supabase client and avoid adding a second backend.
2. Remove leftover demo credentials and localStorage-based staff identity/role behavior. Keep Supabase Auth as the identity source.
3. Add a trusted Edge Function for admin-managed teacher invitations and role changes, with server-side admin verification; create no default admin account.
4. Add database-backed teacher profile/approval and audit records with RLS, then connect the existing staff screen without storing passwords.
5. Document exact migration order, private buckets, secrets, OAuth/OTP setup, and remaining demo-backed areas.
6. Integrate remaining demo-backed pages in separate, schema-informed changes; do not replace existing schemas blindly or run data-changing migrations against a live project without review.
7. Validate access by account class in a Supabase test project and finish assignment-scoped teacher access for legacy review screens before production use.
8. Run build/type checks and report which live Supabase checks need project credentials or a test project.

## Data safety

No live database is connected in this workspace. No database migration has been executed here. SQL files are proposals for review and application to a Supabase test project first. Existing user data and storage objects must be backed up before applying ownership-link migrations. The new staff workflow gates the teacher role on approval, but legacy teacher policies and navigation are not yet uniformly assignment-scoped; access module labels in the staff screen are informational until those policies are migrated.
