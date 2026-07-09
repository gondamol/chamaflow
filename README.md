# ChamaFlow

**Banks digitize money. We digitize the meeting and the trust.**

WhatsApp-native group trust software for informal African savings groups (chamas / ROSCAs / ASCAs). Soft ledger first — bank optional.

## Features (MVP + innovation wedge)

- Create groups, members, contributions, payouts, fines
- **Public cycle board** — share a read-only link (paid / pending / claims / next payout / Till)
- **WhatsApp reminders** — single member + bulk nudge with amount + Till
- **Payment confirm + dispute** — M-Pesa code, “claims paid” queue, treasurer confirm/reject
- **Merry-go-round engine** — order, next highlighted, skip/reorder, **cycle calendar**
- **Treasurer landing** — positioning, Free/Pro pricing, WhatsApp CTA (EN + Swahili)
- PDF group statement for meetings
- localStorage soft ledger (`chamaflow_v1`) — no KYC, no backend required

## Run

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build
vercel --prod
```

## Public board

Treasurers copy a share link from the dashboard. Members open it on any phone — no login. The board is a snapshot encoded in the URL (local-first; refresh the link after updates).

## Monetization (direction)

- **Free:** small group, soft ledger, public board  
- **Pro (~KSh 299–499/group/mo):** multi-admin, loans, bulk WA tools, long history  
- **Setup:** treasurer training fee  

## Stack

React + TypeScript + Vite · lucide-react · jsPDF · Vercel
