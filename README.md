# Kopi Boy Management App V2

Private management application for the Kopi Boy internal test build.

## What this build does
- Google-only management sign-in.
- Pending cook and rider applications appear automatically.
- Management can VIEW, APPROVE, or REJECT each application.
- Approval creates an approved cook in `merchants` or an approved rider in `riders`.
- The application is linked back to the created partner using the existing `merchant_id` / `rider_id` fields.
- Approved partners appear in the Partners tab and can be enabled/disabled.
- Recent orders and live order status are visible in the Orders tab.
- Supabase realtime refreshes applications, orders, cooks, and riders.
- Approval creates a partner notification when `supabase_schema_v10.sql` has been installed and the application contains `user_id` and/or `email`.

## Important setup
1. Keep `index.html`, `app.js`, `styles.css`, `supabase-config.js`, and `kopi-boy-logo.jpg` together in the GitHub Pages repository.
2. `index.html` loads `app.js`. The older `Kopi_Boy_Management_FIXED_APP_JS.txt` is kept only as a readable backup.
3. Run `supabase_schema_v9.sql` if V9 has not been applied yet.
4. Then run `supabase_schema_v10.sql` in Supabase.
5. Configure Google OAuth in Supabase and add the GitHub Pages URL as an allowed redirect URL.
6. Do not put a service-role key in GitHub.

## Approval workflow
Application -> Management review -> Approve -> create approved partner -> mark application approved -> create approval notification -> partner can receive the welcome message.

For the notification to be associated with the exact Google account, the Partner app should submit the authenticated user's `user_id` and email with the application.

## Security note
This is an internal staging build. Final public launch should enforce a management allow-list/RBAC in Supabase RLS rather than relying only on the UI.
