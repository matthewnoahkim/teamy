# Test plan: GET /api/dev/users (and DELETE /api/dev/users/[userId])

## Acceptance criteria

1. **No auth** → 404 (production) or 403 (non-production). No user data returned.
2. **Logged-in non-admin (not on dev whitelist)** → 404/403. No user data.
3. **Admin (session with whitelisted email)** → 200 with expected JSON.
4. **Valid internal API key** (`x-internal-api-key` header) → 200 with expected JSON.

## Curl examples

Base URL: `http://localhost:3000` (local) or your deployed origin.

### 1. No auth → expect 404 (prod) or 403 (dev)

```bash
curl -i -X GET "http://localhost:3000/api/dev/users"
```

Expected: `404 Not Found` (production) or `403 Forbidden` with `{"error":"Forbidden"}` (non-production). Response body must not contain user emails or PII.

### 2. Normal logged-in user (non-admin) → expect 404/403

Use a browser session cookie, or omit cookies to simulate non-whitelisted user:

```bash
# No cookie or cookie of a user NOT on DEV_PANEL_DEFAULT_EMAILS / dev_panel_email_whitelist
curl -i -X GET "http://localhost:3000/api/dev/users" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

Expected: 404 (prod) or 403 (dev). No user list in body.

### 3. Admin / whitelisted session → expect 200

In browser: log in with an email that is in `DEV_PANEL_DEFAULT_EMAILS` or in the site setting `dev_panel_email_whitelist`, then open Dev Tools → Application → Cookies, copy `next-auth.session-token` (or `__Secure-next-auth.session-token` in production). Then:

```bash
curl -i -X GET "http://localhost:3000/api/dev/users" \
  -H "Cookie: next-auth.session-token=PASTE_TOKEN_HERE"
```

Expected: `200 OK` with JSON like `{ "totalUsers": N, "matchingUsers": M, "users": [ ... ] }`.

### 4. Internal API key → expect 200

Set `INTERNAL_API_KEY` in `.env.local` (e.g. `INTERNAL_API_KEY=your-secret-key`). Then:

```bash
curl -i -X GET "http://localhost:3000/api/dev/users" \
  -H "x-internal-api-key: your-secret-key"
```

Expected: `200 OK` with same JSON shape as above. Do not use the API key in browser/client code.

### 5. DELETE /api/dev/users/[userId]

- No auth or invalid key → 404/403.
- Valid session (whitelisted) or valid `x-internal-api-key` → 200 and user deleted (use only in dev/test).

```bash
# Denied (no auth)
curl -i -X DELETE "http://localhost:3000/api/dev/users/some-user-id"

# Allowed (internal key)
curl -i -X DELETE "http://localhost:3000/api/dev/users/some-user-id" \
  -H "x-internal-api-key: your-secret-key"
```

## Production checklist

- [ ] `INTERNAL_API_KEY` set and strong (if using server-to-server calls).
- [ ] Dev panel whitelist configured (`DEV_PANEL_DEFAULT_EMAILS` or `dev_panel_email_whitelist` in DB).
- [ ] Verify unauthenticated request to `/api/dev/users` returns 404 (no body leak).
- [ ] Verify admin UI (dev panel) still loads user list when logged in as whitelisted user.
- [ ] If using internal tooling, ensure it sends `x-internal-api-key` server-side only.
