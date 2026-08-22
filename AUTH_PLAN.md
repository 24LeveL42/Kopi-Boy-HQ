# Kopi Boy Management App — Authentication V2

Current management login: Google OAuth only.

The dashboard is opened only after a real authenticated Google session is returned from the OAuth callback.

Before public launch:
- Add a management allow-list/RBAC in Supabase RLS.
- Keep provider secrets in Supabase, never GitHub.
- Enable phone OTP only if/when the SMS provider is configured.
- Ensure partner applications carry the authenticated partner `user_id` and email so approval notifications can be delivered to the correct account.
