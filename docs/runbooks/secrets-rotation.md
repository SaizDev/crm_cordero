# Secrets rotation

Human-only procedure. Agents may prepare the checklist but never handle secret values.

| Secret | Where it is used | How to rotate |
|---|---|---|
| Supabase secret key | Vercel env `SUPABASE_SECRET_KEY` (server) | Supabase dashboard > Project Settings > API keys: create a new secret key, update Vercel (Production, Preview), redeploy, then revoke the old key |
| Supabase publishable key | Vercel env `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same flow; public but rotate after abuse |
| Database password | GitHub environment secret `SUPABASE_DB_PASSWORD` | Supabase dashboard > Database settings > reset password; update the GitHub secret |
| Supabase access token (CI) | GitHub environment secret `SUPABASE_ACCESS_TOKEN` | Supabase account > Access tokens: create new, update GitHub, delete old |
| Third-party API keys | Vercel env | Provider dashboard; update Vercel; redeploy; revoke old |

After rotation: redeploy, run the smoke test, and record the rotation date here.

| Date | Secret | Reason | By |
|---|---|---|---|
