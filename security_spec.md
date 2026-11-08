# Security Specification for Firestore Rules

## 1. Data Invariants
- Admin email `emquan292011@gmail.com` is granted administrative access.
- Role checks for Admin operations are verified on the server via `isAdmin()`:
  - Caller must be signed in.
  - Caller's email must be `emquan292011@gmail.com` OR document `/admins/$(request.auth.uid)` exists.
- `/admin_configs/{configId}` can ONLY be created, updated, or deleted by verified admins. Regular users have zero write access.
- Regular users can read and write ONLY their own `/users/{userId}` where `request.auth.uid == userId`.
- Regular users CANNOT self-escalate their `role` field to "admin" in `/users/{userId}` unless their email matches `emquan292011@gmail.com` or they are already verified in `/admins/$(request.auth.uid)`.
- Global safety net: default deny for all unmatched paths.

## 2. The Dirty Dozen Payloads (All MUST return PERMISSION_DENIED)
1. Unauthenticated read to `/users/{userId}` -> DENIED
2. Unauthenticated write to `/users/{userId}` -> DENIED
3. User A writing to User B's `/users/userB` -> DENIED
4. User A reading User B's `/users/userB` -> DENIED
5. Regular user attempting to write to `/admin_configs/global` -> DENIED
6. Regular user attempting to create an entry in `/admins/attackerUid` -> DENIED
7. Regular user attempting to set `role: "admin"` on their own `/users/attackerUid` -> DENIED
8. Unauthenticated read to `/admin_configs/global` -> DENIED (or restricted)
9. Malicious user injecting 1MB payload into `displayName` or `id` -> DENIED
10. Malformed ID containing path traversal characters into `/users/{userId}` -> DENIED
11. Update changing `id` field in `/users/{userId}` (immutable field) -> DENIED
12. Random unmatched collection write e.g. `/secrets/passwords` -> DENIED
