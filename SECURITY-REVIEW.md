# Security Review Summary

**Status: incomplete / partial source review**
**Reviewed source ref:** `9962676f4c3710f3d7aed8d896cef43658fe6454`
**Scope:** `app/`, `lib/`, and directly related components/configuration.

No confirmed vulnerabilities were established from the available evidence. The four items below are `needs_validation` leads, not confirmed findings; no severity is assigned.

| Fingerprint | Area | Source evidence | What remains unknown |
|---|---|---|---|
| `scan-receipt:unauthenticated-gemini-usage` | Receipt scan / Gemini quota | `app/api/scan-receipt/route.ts:3-24` calls Gemini using the server-side `GEMINI_API_KEY` after only a truthy `imageBase64` check; `components/ReceiptScannerModal.tsx:32,54` does not send an explicit auth header and checks the session in a separate save flow. | Whether deployment ingress requires authentication or limits requests, whether a usable key is configured, and whether requests consume billable/quota-limited resources. |
| `supabase:row-isolation-policy-unverified` | User data isolation | Some transaction and dream-goal reads lack client-side owner predicates; several mutations target row IDs, for example `app/(dashboard)/dashboard/page.tsx:73`, `app/(dashboard)/transactions/page.tsx:45,74,81`, and `app/(dashboard)/dream-planner/page.tsx:33,41,68,77`. | Effective Supabase RLS/schema policies are not in the reviewed source. These query shapes do not by themselves prove an RLS bypass or cross-user access. |
| `Couple-member-row-scope` | Couple invitation status | `app/(dashboard)/couple/page.tsx:66,208,213,287-288` fetches invitations for the signed-in user and accepts/rejects by invitation row ID. | Whether database-side authorization restricts these mutations to the intended invitee. |
| `supabase:rpc:get_user_id_by_email` | Couple invite RPC | `app/(dashboard)/couple/page.tsx:199-201` sends an email to the RPC, distinguishes a falsy result, and inserts a truthy result as `user_id`. | The RPC body, return behavior, security mode, and effective `EXECUTE` privileges are absent from the reviewed source. |

## Key and input checks

- No hard-coded API-key literal was found in the tracked source reviewed at the specified commit.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is used as a public browser key; it is not a substitute for RLS.
- `GEMINI_API_KEY` is read by the server route in the reviewed source. `.env.local`, deployment secrets, and Git history were not inspected, so this is not a guarantee that secrets are unexposed elsewhere.
- The source-only form review did not establish a confirmed exploitable input-validation issue. Full validation of database constraints and all form paths was not completed.

## Audit limitations

The audit was not completed. The host could not provide the required isolated OS sandbox; no application, test, build, live endpoint, Supabase project, or external provider was run or contacted. The official findings and coverage validators both stopped before reading their inputs with `OS no-follow and nonblocking input protection is unavailable`. Additional coverage for storage, auth/profile, forms, and shared-membership lifecycle, as well as a final-clean coverage critic, remains incomplete. Do not treat this summary as evidence that the project is vulnerability-free.

Any owner validation should use isolated staging, disposable accounts, and dummy data only; do not probe production records or expose secret values.
