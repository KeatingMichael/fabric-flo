# Optional: complete auth user deletion

`fabric_flo_delete_my_account` removes production data and memberships. The Supabase **auth.users** row may remain until deleted with the **service role**.

For full App Store compliance automation:

1. Deploy an Edge Function that verifies the caller’s JWT, runs `fabric_flo_delete_my_account`, then `auth.admin.deleteUser(userId)`.
2. Call it from the app after the user types `DELETE`, or process `account_deletion_requests` on a schedule.

Do **not** expose the service role key in the mobile app.
