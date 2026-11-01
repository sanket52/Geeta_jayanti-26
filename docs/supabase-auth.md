# Supabase Auth and data setup

This project uses one Supabase project for student and staff authentication, application data, and private file storage. The browser uses only the project's URL and publishable (or legacy anon) key. Supabase Auth owns login sessions and refreshes them automatically.

## 1. Set local environment values

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Restart the Vite server after changing environment values. These are public browser values; never use a service-role key in a `VITE_` variable.

## 2. Configure Supabase Auth

In **Authentication → URL Configuration**, set the Site URL to the deployed website URL. Add these Redirect URLs (plus the production URLs you use):

- `http://localhost:8443/**`
- `https://YOUR_DOMAIN/**`

In **Authentication → Providers → Email**, enable email sign-in. Set the email template to include the OTP token using `{{ .Token }}`; the app asks users to enter that code.

To enable Google login, enable **Google** under **Authentication → Providers**, enter the Google OAuth client ID and secret from Google Cloud Console, and save. In Google Cloud, add the Supabase callback URL shown by the provider configuration as an authorized redirect URI. The app returns users to `/student` after login and `/register` during registration; both must match the Supabase redirect allowlist.

## 3. Apply database setup scripts

Use the Supabase SQL Editor or your normal migration workflow. Apply the schema scripts required by the project first, including `oral_exam_setup.sql`, `geeta_jayanti_exam_setup.sql`, `geeta_jayanti_competitions_setup.sql`, and `student_registration_upgrade.sql`. Apply `supabase_only_auth.sql`, followed by `supabase_staff_security.sql`. The auth migration replaces legacy identity-only access policies with Supabase Auth policies and links existing registrations to the new Supabase Auth UUID when the user proves control of the same verified email. Existing registration and submission rows and private storage object paths are retained. The staff migration adds pending teacher approvals and an admin-readable audit log.

Review any local schema scripts you have already applied before running them again. SQL setup scripts are designed to be rerunnable where practical, but existing project-specific customizations should be preserved.

## 4. Deploy Edge Functions

Deploy both functions used by the student flow:

- `sync-supabase-profile` checks the signed-in, email-verified Supabase user and creates or reconciles the student profile.
- `complete-student-registration` securely saves registration data and private document uploads.

Also deploy `admin-manage-teacher` for administrator-only teacher invitations and approval/suspension. Set its `APP_SITE_URL` Edge Function secret to the website's public origin so invitation links return to the app. The function verifies an admin's Supabase session before using the service role; pending teachers are denied the `teacher` database role by `current_user_role()` until approved.

Supabase provides the project URL and service-role credentials to Edge Functions. Configure `BANK_DATA_ENCRYPTION_KEY` as an Edge Function secret if bank details are collected. Do not put service-role credentials or this encryption key in `.env.local`.

## 5. Manage staff access

Admin and teacher accounts sign in through Supabase Auth. Provision the corresponding `profiles` rows with the appropriate `admin` or `teacher` role through a trusted server or the Supabase dashboard. Never let a public signup form assign privileged roles.

For the first administrator, first create the account through Supabase Auth, then run a reviewed one-time statement in the Supabase SQL Editor using that account's actual email:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('ADMIN_ACCOUNT_EMAIL');
```

Replace the placeholder with the intended existing account email. Confirm exactly one profile row changed. Never expose SQL editor or service-role access to ordinary users.

## 6. Verify the setup

Register with an email OTP, confirm that the profile and registration rows appear in Supabase, sign out, and sign in again to confirm session persistence. Test Google login after provider configuration. Then verify admin access, competition submissions, and private oral-exam video access with the appropriate accounts.
