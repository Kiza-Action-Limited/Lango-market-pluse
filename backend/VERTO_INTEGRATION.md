# Verto Integration

Lango Market Plus now has a guarded Verto provider integration under `/api/v1/payments/verto`.

## Runtime Flags

Set these in Render for the backend only. Do not expose them through Vite or any `VITE_` variable.

```env
VERTO_ENABLED=true
VERTO_ENV=sandbox
VERTO_CLIENT_ID=
VERTO_API_KEY=
VERTO_COMPANY_API_BASE_URL=https://api-company-sandbox.vertofx.com
VERTO_PAYMENT_API_BASE_URL=https://api-payment-sandbox.vertofx.com
VERTO_WALLET_API_BASE_URL=https://api-wallet-sandbox.vertofx.com
VERTO_PUBLIC_CERTIFICATE=
VERTO_WEBHOOK_VERIFICATION_SECRET=
VERTO_WEBHOOK_URL=https://lango-market-pluse-4fje.onrender.com/api/v1/payments/verto/webhook
VERTO_REQUEST_TIMEOUT_MS=15000
```

Optional capability flags stay off until Verto confirms they are enabled for the account:

```env
VERTO_PAYOUTS_ENABLED=false
VERTO_REFUNDS_ENABLED=false
VERTO_ESCROW_ENABLED=false
VERTO_SPLIT_PAYOUTS_ENABLED=false
VERTO_PRODUCTION_APPROVED=false
```

Production must use `VERTO_ENV=production`, production hosts, production credentials, and `VERTO_PRODUCTION_APPROVED=true`. Startup validation rejects sandbox hosts in production and production hosts in sandbox.

## Implemented Backend Routes

- `GET /api/v1/payments/verto/config`
- `POST /api/v1/payments/verto/create`
- `GET /api/v1/payments/verto/status/:reference`
- `GET /api/v1/payments/verto/transactions`
- `GET /api/v1/payments/verto/payouts`
- `POST /api/v1/payments/verto/payouts`
- `GET /api/v1/payments/verto/wallets`
- `POST /api/v1/payments/verto/webhook`

## Safety Notes

- Verto payment and payout records are stored on the existing `Payment` and `Payout` models.
- Webhooks are signature-checked when a webhook secret or public certificate is configured, persisted through `CallbackEvent`, and processed idempotently.
- Escrow/conditional release is not represented as available unless `VERTO_ESCROW_ENABLED=true`.
- Payouts remain disabled unless `VERTO_PAYOUTS_ENABLED=true`.
- The frontend only shows Verto as selectable when the backend reports it is configured and enabled.
