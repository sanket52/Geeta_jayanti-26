# Deploy this site to Vercel

## Import the project

1. Push the project to the GitHub repository connected to this workspace.
2. In Vercel, choose **Add New → Project** and import `sanket52/Geeta_jayanti`.
3. Keep the project root at the repository root. `vercel.json` configures the Vite build, `dist` output, and client-side route fallback.
4. Add these environment variables in the Vercel project for **Production**, **Preview**, and **Development**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (or the Supabase publishable key)

Use the same public values as the local `.env.local`. Never add a Supabase service-role key to Vercel `VITE_*` variables or commit `.env.local`.

## Configure Supabase login redirects

After the first deployment, copy its Vercel URL (for example, `https://your-project.vercel.app`) and add it in Supabase **Authentication → URL Configuration** as the Site URL and an allowed redirect URL. Include the production URL and any preview URL patterns you plan to use. The Google OAuth provider must also allow the existing Supabase Auth callback URL configured for the project.

For branch previews, add the Vercel preview URL pattern to Supabase's allowed redirect URLs. If preview domains change, update the allowlist accordingly. OTP and Google sign-in depend on this allowlist.

## Verify the live login

1. Confirm Vercel shows a successful production deployment and that `/`, `/login`, `/admin/login`, and `/student` load directly, including after refresh.
2. Sign in with a registered student using email OTP, then test Google login if Google OAuth is enabled for the Supabase project.
3. Test admin login with a Supabase account whose database role is `admin` or `teacher`.
4. If testing the mock and oral exam flows, first apply `supabase/exam_portal_reliability.sql` after its prerequisite setup SQL in the Supabase SQL Editor.

The Vercel deployment itself does not create Supabase accounts, assign staff roles, deploy Edge Functions, or apply SQL migrations. Configure those in the connected Supabase project.
