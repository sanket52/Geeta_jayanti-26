# Supabase setup

This app uses Supabase Auth for student email OTP, Google sign-in, admin sign-in, and persistent sessions. Supabase Postgres and private Storage hold application data. See [the setup guide](../docs/supabase-auth.md) for dashboard configuration, SQL order, and Edge Function deployment.

For the Geeta Jayanti public contact details and editable support email, apply `geeta_jayanti_contact_settings.sql` after `geeta_jayanti_competitions_setup.sql` and `geeta_jayanti_chatbot_faqs.sql`. The email remains hidden until an administrator enters it and confirms it as verified in **Admin → Contact Settings**. WhatsApp links remain hidden until each number is confirmed there.

Never put a Supabase service-role key or bank encryption key in the Vite environment.

## Student chatbot email support

The Contact Us form and chatbot Contact Support action call `functions/student-support-request`. This function sends one support notification to both configured recipient addresses and a separate confirmation to the student through Resend. It requires a Resend account with a verified sender domain and these server-side function secrets:

```sh
supabase secrets set RESEND_API_KEY=re_... RESEND_FROM_EMAIL="Geeta Jayanti Support <support@your-verified-domain.example>"
```

Use an address on a domain verified in Resend; the example sender above is not an actual configured address. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Never add these values to `VITE_*` variables or browser code.

Before deployment, run `student_support_email_setup.sql` in the Supabase SQL Editor (the project's existing setup scripts are maintained at the `supabase/` root rather than in the migrations directory), then deploy the function:

```sh
supabase functions deploy student-support-request
```

The database table stores request hashes, provider IDs, and delivery status only. It applies per-email throttling, duplicate detection, and permits retry after a recorded provider failure using the same request ID. The form also uses a honeypot and minimum completion time. The UI reports success only after Resend accepts the notification to both recipients; confirmation-email failure is reported separately.

## Existing oral exam video storage

The oral-exam video setup is described in `oral_exam_setup.sql`. It uses private storage and short-lived signed links. Apply `supabase_only_auth.sql` after the existing schema setup scripts to move access policies to Supabase Auth while retaining existing records and files, then apply `supabase_staff_security.sql` for pending teacher approval and the admin audit log. Deploy `functions/admin-manage-teacher` for staff invitations and approvals.

Review [the backend audit and implementation plan](../docs/backend-audit-and-plan.md) for the current feature inventory. Several legacy ERP screens still use demonstration data and are not yet production-backed; do not treat their displayed sample values as live records.

## Exam portal reliability update

After the base candidate exam, GJM competitions, mock-test, oral-exam, and `supabase_only_auth.sql` setup scripts are applied, run `exam_portal_reliability.sql` in the Supabase SQL Editor. This backfills profile registration numbers only from existing `user_id` relationships, repairs the verified account-link function, makes oral submissions resolve the student's identity from the database, and installs persistent mock attempts with server-side evaluation. The browser code now calls these RPCs; mock attempts and results remain separate from official attempts. Existing official results and submissions are retained.
