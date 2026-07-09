# ChamaFlow

**Banks digitize money. We digitize the meeting and the trust.**

WhatsApp-native group trust software for informal African savings groups (chamas / ROSCAs / ASCAs). Soft ledger first — bank optional.

## Features

- Soft ledger: members, contributions, payouts, fines (local-first)
- **Public cycle board** + optional **live cloud board** (`#/live/CODE`)
- **WhatsApp reminders** + payment claims (Nililipa)
- **Merry-go-round** order, skip, cycle calendar
- **Cloud multi-device** (Supabase) — treasurer + secretary share code
- **Table banking loans** — issue, guarantors, repayments, pot math
- **M-Pesa STK / partners** — Till/Paybill labels + Daraja STK API (demo without secrets)
- Treasurer landing, Free/Pro pricing, EN + Swahili CTA
- PDF group statement

## Run

```bash
npm install
npm run dev
```

## Cloud setup (optional)

1. Create a free [Supabase](https://supabase.com) project  
2. Run `supabase/schema.sql` in the SQL editor  
3. Copy `.env.example` → `.env.local`:

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

4. Redeploy. Dashboard → **Enable cloud sync** → share the 8-char code with the secretary.

## M-Pesa STK (optional)

Set on **Vercel** (server-only — never `VITE_*`):

| Env | Purpose |
|-----|---------|
| `MPESA_CONSUMER_KEY` | Daraja consumer key |
| `MPESA_CONSUMER_SECRET` | Daraja secret |
| `MPESA_SHORTCODE` | Paybill / till shortcode |
| `MPESA_PASSKEY` | STK passkey |
| `MPESA_ENV` | `sandbox` or `production` |
| `MPESA_CALLBACK_URL` | Optional HTTPS callback |

Without these, STK runs in **demo mode** (no real charge). Soft-ledger confirm still required.

## Deploy

```bash
npm run build
vercel --prod
```

## Monetization

- **Free:** soft ledger, public board, small groups  
- **Pro (~KSh 299–499/group/mo):** multi-admin cloud, loans, STK, bulk tools  
- **Setup:** treasurer training fee  

## Stack

React + TypeScript + Vite · Supabase (optional) · lucide-react · jsPDF · Vercel serverless (`/api/mpesa/*`)
