# SUPABASE_SETUP.md — Deploying the `redeem-angpao` Edge Function

This document explains, **step by step**, how to deploy the
`redeem-angpao` Edge Function that powers TrueWallet voucher
(ซองอั่งเปา) top-ups. The function runs the same flow as
[tw-angpao](https://github.com/pichxyaponn/tw-angpao) on the server,
because Firebase Spark cannot make outbound HTTP calls.

---

## 1. Sign up for Supabase & create a project

1. Go to <https://supabase.com> and sign up (GitHub login is fine).
2. Click **New project**.
3. Pick an organization, a project name, a strong DB password
   (you only need it for `psql`; the function does not use it),
   and the **region closest to your users** (Singapore for Thailand).
4. Wait ~2 minutes for the project to finish provisioning.
5. From **Project Settings → API**, copy and keep two values:
   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **anon public key** — a long JWT starting with `eyJ…`

---

## 2. Install the Supabase CLI and log in

```bash
# macOS
brew install supabase/tap/supabase

# Windows (scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux / anywhere with npm
npm install -g supabase
```

Then:

```bash
supabase login            # opens browser, paste the token back
supabase link --project-ref <YOUR_PROJECT_REF>
```

`<YOUR_PROJECT_REF>` is the subdomain part of your Project URL
(e.g. for `https://abcd1234.supabase.co` the ref is `abcd1234`).

---

## 3. Configure the required Edge Function secrets

The function reads everything from environment variables — **never**
hardcode secrets in code.

| Secret name                | Required | What it is                                                                                       |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `FIREBASE_PROJECT_ID`      | ✅       | The Firebase project ID that owns your Firestore (e.g. `my-app-prod`).                            |
| `FIREBASE_SERVICE_ACCOUNT` | ✅       | The **full JSON** of a Firebase service-account key, _or_ that JSON base64-encoded on one line. |

### How to get a Firebase service account

1. Open the Firebase Console → ⚙️ **Project settings** →
   **Service accounts** tab.
2. Click **Generate new private key** → confirm.
3. A `xxxxx-firebase-adminsdk-xxxxx.json` file downloads.
4. Open it in a text editor — you will paste its contents in step 4.

> The service account only needs the default **Firebase Admin SDK
> Administrator** role that the generator gives it. That role already
> includes read/write on Firestore.

### Push the secrets to Supabase

```bash
# Option A — paste the raw JSON (recommended)
supabase secrets set FIREBASE_PROJECT_ID="my-app-prod"
supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat /path/to/firebase-sa.json)"

# Option B — base64 (useful if your shell mangles newlines)
base64 -w0 /path/to/firebase-sa.json > sa.b64
supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat sa.b64)"
```

You can verify with:

```bash
supabase secrets list
```

---

## 4. Deploy the function

From the repository root (the folder that contains `supabase/`):

```bash
supabase functions deploy redeem-angpao --no-verify-jwt
```

`--no-verify-jwt` is required because the request is authenticated by
the Firebase UID we pass in the body, not by a Supabase auth JWT.

The CLI prints the function URL when it finishes:

```
Deployed Function redeem-angpao
URL: https://<project-ref>.supabase.co/functions/v1/redeem-angpao
```

---

## 5. Wire the frontend to call it

The frontend already uses `supabase.functions.invoke('redeem-angpao', …)`,
so it just needs the project URL + anon key in `.env`
(at the project root, next to `package.json`):

```env
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your anon public key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
```

Restart `npm run dev` after changing `.env`.

> ⚠️ **Never** put `SUPABASE_SERVICE_ROLE_KEY` or
> `FIREBASE_SERVICE_ACCOUNT` in `.env` — those belong only in
> `supabase secrets`.

---

## 6. How the function writes to Firestore

`redeem-angpao` uses the **service account** above to call the
Firestore REST API directly. Inside a single Firestore transaction it:

1. Reads `wallets/{uid}` (the running balance) and
   `processedSlips/{voucherCode}` (the duplicate guard).
2. If the guard already exists → returns `DUPLICATE` and refunds nothing.
3. Otherwise commits **three writes atomically**:
   - `wallets/{uid}.balance` += amount  *(plus `lastTopUp`, `updatedAt`)*
   - `processedSlips/{voucherCode}`  *(precondition: must not exist)*
   - `walletLedger/{auto-id}` audit entry
4. Writes a best-effort log doc to `topup_logs/` for failure tracing.

This matches the existing project schema, so the dashboards, history
pages, and anti-replay protection keep working unchanged.

---

## 7. Test with a real voucher

Get a real `https://gift.truemoney.com/campaign/?v=…` link (any small
amount) and a registered TrueWallet number, then either:

### From the UI

1. Log in to the app.
2. Open **เติมเงิน → ซองอั่งเปา**.
3. Paste the link and press **รับซองและเติมเงิน**.

### With curl (one-shot test)

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/redeem-angpao" \
  -H "Content-Type: application/json" \
  -H "apikey: <anon key>" \
  -d '{
    "voucherCode": "0123456789abcdef0123456789abcdef0123",
    "mobile": "0812345678",
    "uid": "<a real firebase uid>"
  }'
```

Expected on success:

```json
{ "success": true, "amount": 10, "ownerName": "JOHN D.", "balanceAfter": 110, "message": "เติมเงิน ฿10 สำเร็จ" }
```

Expected error codes you may see in the JSON `code` field:
`VOUCHER_OUT_OF_STOCK`, `VOUCHER_NOT_FOUND`, `VOUCHER_EXPIRED`,
`TARGET_USER_NOT_FOUND`, `DUPLICATE`, `CREDIT_FAILED`.

---

## 8. View logs

```bash
# Live tail
supabase functions logs redeem-angpao --tail

# Last 100 lines
supabase functions logs redeem-angpao --limit 100
```

You can also open the Supabase dashboard:
**Edge Functions → redeem-angpao → Logs**.

Common things to look for:

- `beginTransaction failed` / `commit failed` → Firestore credentials
  wrong or the service account is missing permissions.
- `network: …` → outbound call to `gift.truemoney.com` blocked.
- `ALREADY_EXISTS` in the commit error → another request claimed the
  same voucher first; the user gets `DUPLICATE`. This is the safety
  guard working as intended.

---

## 9. Rate limits & quotas

- The function is rate-limited to **5 requests / minute / IP** in code.
- Supabase Free tier gives **500k Edge Function invocations / month**,
  which is more than enough for a top-up endpoint.
- Firestore writes per redemption: **3** (wallet + guard + ledger) plus
  one best-effort `topup_logs` write.
