# Lango MarketPulse Frontend/Backend Missing Implementation Scan

Date: 2026-07-07

Scope: 
- `multi-e-commerce-app/src`
- `backend/src`
- Root implementation notes

Verification run:
- Frontend build: `npm.cmd run build` passed.
- Frontend lint: `npm.cmd run lint` passed.
- Backend import smoke check: `node -e "require('./src/app')"` loaded routes successfully. Redis was disabled and email initialized. The process stayed alive due background infrastructure and was stopped manually.
- Backend has no test/lint script in `backend/package.json`.

## Overall Status

The project is not empty. Core marketplace, auth, products, cart, orders, admin, logistics, subscriptions, payments, wallet, escrow, RFQ, reviews, support, and notification modules exist.

The biggest missing work is integration and contract completion:
- Some frontend pages call APIs that are not mounted in the backend.
- Some pages exist but are placeholders, local-storage fallbacks, or commented-out code.
- Important business workflows exist in pieces, but not as complete production journeys.
- Status/state names are inconsistent across orders, logistics, escrow, and payments.

## Highest Priority Missing Items

1. AI sourcing page is not implemented.
   - Frontend route exists: `/ai-sourcing`.
   - `multi-e-commerce-app/src/pages/AISourcingHub.jsx` is fully commented out and exports no default component.
   - Result: the app builds, but visiting `/ai-sourcing` can fail at runtime.

2. Public contact form backend is missing.
   - Frontend calls `/v1/contact`, then `/contact`.
   - Backend does not mount contact routes.
   - Support routes exist under `/api/v1/support`, but the public contact form is not wired to them.
   - Admin contact queue depends on contact-style workflows, so this should be connected to `SupportMessage` or a new `ContactMessage` model.

3. Premium seller verification backend is missing.
   - Frontend calls `/seller/premium-verification`.
   - Backend has no matching route.
   - The frontend catches the error and saves the verification data to local storage through `premiumSellerProfile`.
   - Missing backend: verification model, document upload, admin approval/rejection, status API, and paid-plan gating based on backend approval.

4. Forgot-password/email-check API contract is broken.
   - Frontend calls `/v1/auth/check-email`, `/v1/auth/email-exists`, and `GET /v1/auth/check-email`.
   - Backend auth routes do not expose these endpoints.
   - Frontend reset sends `{ token, password }`.
   - Backend reset route validates `{ code, newPassword }`.
   - Frontend also has `verifyEmail(token)` and `resendVerification(email)` service calls, but backend `/verify-email` is an OTP email route, not a token-link verification route.

5. Business/supplier/AI marketplace endpoints are missing.
   - Frontend service calls `/v1/businesses`, `/businesses`, `/v1/suppliers`, `/suppliers`, `/ai/predict/suppliers`, `/business-hub/*`, `/platform/header-config`, `/marketplace/header`, `/ai/search/image`, and `/products/search-by-image`.
   - Backend does not mount these API groups.
   - Current business directory pages mostly fall back to products/categories rather than a true business/supplier directory.

6. Profile/address service endpoints are stale.
   - `userService.js` includes `/profile/avatar`, `/profile/addresses`, and `/orders` legacy paths.
   - Backend supports `/v1/auth/me/profile-image` and `/v1/auth/me`, but not `/profile/*`.
   - Address book CRUD is not implemented in backend as a first-class API.

7. Africa's Talking webhooks are not mounted.
   - `backend/src/routes/webhooks/africastalking.webhook.js` exists.
   - `backend/src/app.js` mounts M-Pesa webhooks only.
   - Missing: `/webhooks/africastalking` or equivalent route mount for SMS delivery reports and inbound messages.

## Frontend Missing Or Partial

- AI sourcing hub: route present, implementation commented out.
- Subscription payment page: `SubscriptionPayment.jsx` exists, but current routing uses seller premium payment pages instead. Remove, route, or consolidate it.
- Premium verification: local storage fallback is used instead of backend persistence.
- Contact form: queues messages locally when the backend endpoint fails; there is no sync/retry service.
- Business directory/sourcing pages: many requested supplier and AI endpoints are speculative fallbacks, not real backend contracts.
- Hard-coded API URL usage exists in `Categories.jsx` and `CategoryFilter.jsx` via `http://localhost:5000/api/categories`, bypassing `VITE_API_URL`.
- Duplicate frontend folders exist:
  - `src/context` and `src/contexts`
  - `src/layout` and `src/layouts`
- `src/utils/contants.js` appears misspelled and builds as a 0 KB chunk.
- Some admin pages use `alert()` instead of the existing toast/error UI.
- Payment recovery exists for subscriptions, but order payment retry/expired M-Pesa UX is still incomplete.
- No frontend health/readiness screen for API, DB, Redis, email, M-Pesa, Cloudinary, and SMS status.

## Backend Missing Or Partial

- No public contact route/controller despite frontend contact pages.
- No backend premium seller verification workflow.
- No business/supplier directory APIs.
- No AI supplier prediction or image-search APIs.
- No profile address-book CRUD.
- No email-check endpoint used by forgot password.
- Password reset contract does not match frontend token/password flow.
- Africa's Talking webhook router exists but is not mounted.
- Duplicate/odd backend files:
  - `src/services/notification/notification.service.js`
  - `src/services/notification/notification.service .js`
- Odd legacy route mounts exist in `app.js`:
  - `/api/lv1/ogistics`
  - `/api/lv1/logistics`
- No automated backend test script.
- No admin operational monitor for failed M-Pesa callbacks, payout callbacks, queues, Redis, email, SMS, or background jobs.

## Domain Workflow Gaps

### Orders, Escrow, And Payments

Implemented:
- Order CRUD/list/status/cancel/confirm/dispute routes exist.
- M-Pesa STK push and webhook routes exist.
- Escrow routes and services exist.
- Seller order page now includes logistics, QR, escrow, payout, and timeline UI.

Missing or partial:
- Order, escrow, logistics, and payment status names are not normalized into one deterministic state machine.
- Admin payout/callback monitor is missing.
- User-facing payment receipt/history page is missing.
- Failed/expired order payment retry screen is missing.
- Full escrow audit timeline visible to buyer/seller/admin is missing.

### Logistics And Mizigo

Implemented:
- Logistics application, verified provider lookup, shipment creation, nearby drivers, GPS updates, QR tokens, group trips, sinking fund, and admin logistics routes exist.
- Frontend has logistics application, logistics dashboard/status, operations tools, QR scanner, admin logistics, and seller order logistics panels.

Missing or partial:
- First-mile driver workflow is not fully modeled.
- Long-haul driver workflow is not fully modeled.
- Hub/cross-dock operator workflow is not fully modeled.
- Cross-dock entity and operational board are missing.
- Automatic pooling and 80% truck-capacity enforcement are missing.
- Driver task board separating first-mile vs long-haul work is missing.
- QR supports pickup/delivery, but full farm-gate, hub-arrival, cross-dock, and final-receiver scan chain is not complete.

### Products, Inventory, RFQ

Implemented:
- Product CRUD, SKU, inventory history, low-stock threshold, wholesale fields, RFQ model/routes, and seller RFQ frontend exist.

Missing or partial:
- Quote-to-order conversion is missing.
- Tier pricing enforcement at checkout is missing.
- True per-unit physical SKU tracking is missing; current SKU is product-level.
- Inventory movement ledger for warehouse transfers is incomplete.
- Warehouse states are basic; no full Farm Gate -> Cross-Dock -> Hub -> Delivered model.
- Seller stock alert resolve/dismiss UI is missing.
- Product-level alert notification preferences are missing.

### Reviews And Trust

Implemented:
- Product reviews exist.

Missing:
- Logistics trip reviews.
- Buyer-to-driver, driver-to-seller, seller-to-driver ratings.
- Rating-based prioritization for drivers/sellers.
- Bad actor detection/moderation queue.

### Reports

Implemented:
- Admin summary PDF endpoint exists.
- Subscription report endpoint exists.

Missing:
- Monthly verified trip PDF generation.
- Seller downloadable business statements.
- Bank financing statement workflow.
- Subscription invoices/receipts.
- Admin report export center beyond the current summary.

## Recommended Build Order

1. Restore/implement `AISourcingHub.jsx` or remove the route until it is ready.
2. Add backend public contact API and connect it to admin contact/support queue.
3. Fix auth API contracts: email check, reset password payload, token email verification, resend verification.
4. Add backend premium seller verification with admin approval and remove local-storage-only verification.
5. Implement or remove speculative business/supplier/AI endpoints from `manufacturerService.js`.
6. Replace stale `/profile/*` frontend service calls with real `/v1/auth/me` APIs or add address-book backend routes.
7. Mount Africa's Talking webhooks.
8. Normalize order/payment/escrow/logistics statuses across models, controllers, and frontend UI.
9. Add admin finance operations: failed callbacks, payout callbacks, queue health, reconciliation.
10. Complete Mizigo logistics: cross-dock entity, first-mile/long-haul legs, hub operator board, automatic pooling.
11. Add quote-to-order and tier-pricing enforcement.
12. Add end-to-end tests for auth reset, checkout/payment, seller fulfillment, QR delivery, escrow release, and subscription payment.

## Final Diagnosis

The website has a strong foundation, but it is not production-complete. The frontend is ahead of the backend in several places: it shows pages and fallback flows for AI sourcing, contact, premium verification, business directories, and profile/address features that do not yet have real backend contracts.

The next best work is to close API mismatches first, then complete the logistics/payment workflows. Without that, users can reach polished screens that cannot reliably save, verify, pay, or recover data.
