

## QuickBooks Integration Plan

### Overview
We'll build a full OAuth 2.0 flow for QuickBooks Online so your app can pull bank balances, invoices/receivables, and expenses directly from QuickBooks.

### What you need to do first (in QuickBooks Developer Portal)
1. Go to your app's **Keys & OAuth** section
2. Copy your **Client ID** and **Client Secret** (use Development/Sandbox keys for now)
3. Add this as a **Redirect URI**: `https://id-preview--fce6eb88-c599-4baa-bb68-0ac6f6322a4e.lovable.app/quickbooks/callback`
4. Make sure the **Accounting** scope (`com.intuit.quickbooks.accounting`) is selected

### What I'll build

**1. Database table: `quickbooks_tokens`**
- Stores `access_token`, `refresh_token`, `realm_id`, `expires_at` per user
- RLS scoped to user's own tokens

**2. Edge function: `quickbooks-auth`**
- Handles two actions:
  - `authorize` — generates the QuickBooks OAuth URL and returns it to the frontend
  - `callback` — exchanges the authorization code for tokens and stores them in the database

**3. Edge function: `quickbooks-api`**
- Proxies authenticated requests to QuickBooks API
- Auto-refreshes expired access tokens using the stored refresh token
- Endpoints: `company-info`, `bank-balance`, `invoices`, `expenses`, `profit-and-loss`

**4. Frontend: QuickBooks connection flow**
- "Connect to QuickBooks" button (in Money tab or a Settings/Integrations area)
- `/quickbooks/callback` route to handle the OAuth redirect
- Once connected, Money tab pulls live data from QuickBooks

**5. Secrets needed**
- `QUICKBOOKS_CLIENT_ID` — your app's Client ID
- `QUICKBOOKS_CLIENT_SECRET` — your app's Client Secret

### Technical details

```text
┌──────────────┐    1. Click "Connect"     ┌─────────────────┐
│   Frontend   │ ────────────────────────>  │ quickbooks-auth  │
│              │ <── returns auth URL ────  │ (edge function)  │
│              │                            └─────────────────┘
│              │    2. Redirect to Intuit
│              │ ──────────────────────>     ┌─────────────────┐
│              │                            │ Intuit OAuth     │
│              │ <── redirect w/ code ────  │ Server           │
│              │                            └─────────────────┘
│              │    3. Send code to callback
│              │ ────────────────────────>   ┌─────────────────┐
│              │                            │ quickbooks-auth  │
│              │ <── tokens stored, done ── │ (callback)       │
└──────────────┘                            └─────────────────┘

Subsequent API calls:
Frontend → quickbooks-api (edge fn) → QuickBooks API
                │
                └── auto-refreshes tokens if expired
```

- Access tokens expire every 60 minutes; refresh tokens last ~100 days
- The edge function handles token refresh transparently
- QuickBooks API base: `https://quickbooks.api.intuit.com/v3/company/{realmId}/`

### Implementation order
1. Store secrets (Client ID + Client Secret)
2. Create `quickbooks_tokens` migration
3. Build `quickbooks-auth` edge function
4. Build `quickbooks-api` edge function
5. Add callback route + connect button to frontend
6. Wire Money tab to pull live QB data

