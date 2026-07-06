# Lango MarketPulse Project Implementation Checklist

Date: 2026-07-01

Scan coverage:
- Root project files
- `backend`
- `backend/src`
- `multi-e-commerce-app`
- `multi-e-commerce-app/src`

This checklist is for the Lango MarketPulse website and system. It lists what is not implemented, what is partially implemented, and what should be modified to make the project feel complete and production-ready.

## Legend

- `[ ] Missing`: not implemented or no complete workflow found.
- `[~] Modify`: implemented partly, but needs fixing, connecting, or improving.
- `[x] Present`: exists in the project.

## 1. Website Structure

- `[x] Present` Buyer website pages exist: home, products, product detail, cart, checkout, orders, tracking, wishlist, profile.
- `[x] Present` Seller panel exists: dashboard, add product, products, orders, scarcity board, subscription, profile.
- `[x] Present` Admin panel exists: dashboard, users, products, orders, logistics, subscriptions, analytics.
- `[x] Present` Logistics pages exist: application, status/dashboard, operations tools, Mizigo engine.
- `[~] Modify` Some folders are duplicated: `src/context` and `src/contexts`.
- `[~] Modify` Some layout folders are duplicated: `src/layout` and `src/layouts`.
- `[~] Modify` Utility names need cleanup: `contants.js` should probably be `constants.js`.
- `[~] Modify` Backend has duplicate/odd notification file: `notification.service.js` and `notification.service .js`.
- `[ ] Missing` No single project health/readiness dashboard that tells what APIs are connected, failing, mocked, or unavailable.

## 2. Authentication And Registration

- `[x] Present` Backend auth routes/controllers/services exist.
- `[x] Present` OTP service exists.
- `[x] Present` Frontend register/login/forgot password pages exist.
- `[~] Modify` Registration can fail when payload is too large, especially with image uploads.
- `[~] Modify` OTP email delivery depends on email config and should show clearer frontend status.
- `[~] Modify` MongoDB fallback mode can make database-backed auth routes unreliable.
- `[ ] Missing` A clear frontend message explaining email/OTP delivery failure reason.
- `[ ] Missing` Admin screen to inspect OTP/email failures.
- `[ ] Missing` Production-ready resend OTP flow with cooldown and delivery state.

## 3. Products

- `[x] Present` Product CRUD exists in backend.
- `[x] Present` Product listing/detail exists in frontend.
- `[x] Present` Seller add product page exists.
- `[x] Present` Seller products page exists.
- `[x] Present` Admin products page exists.
- `[x] Present` SKU generation exists in backend.
- `[x] Present` Inventory history/graph exists in backend model.
- `[~] Modify` Product image size handling needs better frontend compression before upload.
- `[~] Modify` Product SKU is product-level, not true physical unit-level tracking.
- `[~] Modify` Product detail page should show SKU, stock graph, location, and inventory health more clearly.
- `[x] Present` Per-product stock alert threshold field in backend model.
- `[x] Present` Per-product stock alert threshold input in add/edit product form.
- `[ ] Missing` Product-level warehouse state: Farm Gate, Cross-Dock, Hub, Delivered.
- `[ ] Missing` Product-level GPS/location tracking for inventory movement.
- `[ ] Missing` Product movement ledger for stock changes and physical transfers.
- `[ ] Missing` Full B2B product fields: MOQ, tier pricing, RFQ enabled, wholesale terms.

## 4. Inventory And Stock Alerts

- `[x] Present` Backend low-stock endpoint exists.
- `[x] Present` Scarcity scheduler exists.
- `[x] Present` Threshold service exists.
- `[x] Present` Seller products page shows low-stock alerts.
- `[x] Present` Seller dashboard shows inventory alert area.
- `[x] Present` Regional scarcity board exists.
- `[x] Present` Frontend `minThreshold` is now persisted by the backend.
- `[x] Present` Backend low-stock logic now uses seller/product-specific thresholds.
- `[~] Modify` Seller dashboard inventory health still needs better per-SKU graph display.
- `[x] Present` UI to create/edit product stock threshold.
- `[ ] Missing` UI to resolve or dismiss stock alerts.
- `[ ] Missing` Alert notification preferences per product.
- `[ ] Missing` Restock prediction connected to actual sales velocity.
- `[ ] Missing` Admin product alert threshold management.

## 5. B2B Wholesaling And RFQ

- `[x] Present` Some MOQ helper logic exists on frontend.
- `[x] Present` Product card/cart/checkout can apply MOQ helper behavior.
- `[~] Modify` MOQ is not fully backend-backed.
- `[~] Modify` Mizigo engine displays MOQ/RFQ only if API fields happen to exist.
- `[x] Present` RFQ backend model.
- `[x] Present` RFQ backend routes.
- `[x] Present` RFQ request form for buyers.
- `[x] Present` RFQ inbox for sellers/farmers.
- `[x] Present` Quote response workflow.
- `[x] Present` Quote negotiation history.
- `[ ] Missing` Quote-to-order conversion.
- `[ ] Missing` Tier pricing enforcement at checkout.
- `[ ] Missing` Bulk buyer dashboard for RFQs and negotiated orders.

## 6. Orders

- `[x] Present` Backend order create/list/detail/status/cancel/confirm/dispute exists.
- `[x] Present` Buyer orders page exists.
- `[x] Present` Seller orders page exists.
- `[x] Present` Admin orders page exists.
- `[x] Present` Order tracking page exists.
- `[x] Present` Seller order UI normalizes older/newer status labels and only offers valid next transitions.
- `[x] Present` Seller orders page now includes operational fulfillment panels.
- `[x] Present` Seller order page has logistics, escrow, QR, payout, and proof visibility comparable to buyer tracking.
- `[x] Present` Seller order timeline.
- `[x] Present` Seller order escrow panel.
- `[x] Present` Seller order logistics panel.
- `[x] Present` Seller order driver assignment.
- `[x] Present` Seller order QR generation/scanning has a dedicated UI.
- `[x] Present` Seller order payout status.
- `[x] Present` Seller order dispute freeze timer.
- `[x] Present` Seller order proof-of-delivery display.
- `[x] Present` Automatic logistics record creation after payment.

## 7. Checkout And Payments

- `[x] Present` Checkout page exists.
- `[x] Present` M-Pesa STK push backend exists.
- `[x] Present` M-Pesa status routes exist.
- `[x] Present` M-Pesa webhook route exists.
- `[x] Present` Payment model/service/controller exists.
- `[~] Modify` Local development can fail when M-Pesa callbacks are not publicly reachable.
- `[~] Modify` Payment status UX should explain pending callback vs failed payment.
- `[~] Modify` Subscription payment and order payment flows should have consistent frontend recovery screens.
- `[ ] Missing` Payment retry screen for failed or expired M-Pesa checkout.
- `[ ] Missing` Admin failed callback monitor.
- `[ ] Missing` Admin payout callback monitor.
- `[ ] Missing` User-facing payment receipt/history page.

## 8. Escrow

- `[x] Present` Escrow model exists.
- `[x] Present` Escrow routes exist.
- `[x] Present` Escrow service exists.
- `[x] Present` Escrow hold/release/partial/cancel logic exists.
- `[x] Present` 72-hour auto-release delay exists.
- `[x] Present` Buyer order tracking shows escrow flow.
- `[~] Modify` Escrow status naming is not fully aligned to one deterministic state machine.
- `[~] Modify` Seller does not see escrow status clearly in seller orders.
- `[~] Modify` Admin logistics tools expose escrow actions but feel like raw developer tools.
- `[ ] Missing` Clear UI for `PENDING -> HELD -> PARTIAL_RELEASE -> DISBURSED`.
- `[ ] Missing` Seller payout breakdown UI.
- `[ ] Missing` Driver fare payout status UI.
- `[ ] Missing` Platform commission and sinking fund split UI.
- `[x] Present` Seller dispute freeze countdown UI.
- `[ ] Missing` Escrow audit timeline visible to admin/seller/buyer.

## 9. Logistics

- `[x] Present` Logistics backend routes exist.
- `[x] Present` Logistics controller exists.
- `[x] Present` Logistics model exists.
- `[x] Present` GPS tracking service exists.
- `[x] Present` Route optimizer service exists.
- `[x] Present` QR token logistics service exists.
- `[x] Present` Sinking fund logistics service exists.
- `[x] Present` Logistics application frontend exists.
- `[x] Present` Logistics status/dashboard frontend exists.
- `[x] Present` Logistics operations frontend exists.
- `[x] Present` Admin logistics frontend exists.
- `[~] Modify` Logistics tools are exposed, but not integrated into normal seller order workflow.
- `[x] Present` Verified logistics provider lookup is registered in backend routes.
- `[~] Modify` Driver application/review exists, but provider marketplace is incomplete.
- `[x] Present` Seller dashboard logistics summary.
- `[~] Modify` Seller order logistics assignment now starts with shipment creation; direct driver assignment still needs UI/backend policy.
- `[x] Present` Seller order route tracking summary.
- `[ ] Missing` First-mile driver workflow.
- `[ ] Missing` Long-haul driver workflow.
- `[ ] Misw.sing` Hub/cross-dock operator workflow.
- `[ ] Missing` Final delivery scan workflo
- `[x] Present` Real logistics provider selection is persisted in backend seller add-on settings.
- `[ ] Missing` Complete logistics marketplace for sellers to choose verified drivers/providers.

## 10. Plan 4 Mizigo

- `[x] Present` Mizigo engine page exists.
- `[x] Present` Group trip backend routes exist.
- `[x] Present` Group trip create/join frontend tools exist.
- `[x] Present` Sinking fund backend exists.
- `[x] Present` Sinking fund frontend access exists.
- `[~] Modify` Mizigo page uses live API data, but many required fields are not returned by backend yet.
- `[~] Modify` Pooling is mostly visual/grouped by destination, not a complete backend optimization engine.
- `[~] Modify` Truck capacity is shown only if capacity fields exist.
- `[ ] Missing` Backend cross-dock entity.
- `[ ] Missing` Backend first-mile leg entity.
- `[ ] Missing` Backend long-haul leg entity.
- `[ ] Missing` Automatic order pooling.
- `[ ] Missing` 80% truck capacity optimization enforcement.
- `[ ] Missing` Cross-dock timing window enforcement.
- `[ ] Missing` Kitale Cross-Dock/Kakuma Hub operational board.
- `[ ] Missing` Driver task board for first-mile vs long-haul.

## 11. QR Handshake

- `[x] Present` QR token backend route exists.
- `[x] Present` QR scan route exists.
- `[x] Present` QR operation tools exist on frontend.
- `[~] Modify` QR scanning is not embedded where users naturally need it.
- `[~] Modify` QR scan audit trail is not clearly visible.
- `[ ] Missing` Driver QR scanner page.
- `[ ] Missing` Hub QR scanner page.
- `[~] Modify` Seller order QR token panel shows QR handoff status; token management/scanning still needs fuller UI.
- `[ ] Missing` Buyer/final receiver QR confirmation UI.
- `[ ] Missing` GPS telemetry display for QR scans.
- `[ ] Missing` Short-lived token expiry display.
- `[ ] Missing` Fraud/spoofing warning and failed scan handling UI.

## 12. Subscriptions

- `[x] Present` Backend subscription plans exist.
- `[x] Present` Backend subscribe/cancel/change plan exists.
- `[x] Present` M-Pesa subscription payment exists.
- `[x] Present` Admin subscriptions page exists.
- `[x] Present` Seller subscription page exists.
- `[x] Present` Subscription gates exist.
- `[x] Present` Frontend subscription plan flows route paid plans through server-verified payment.
- `[x] Present` Paid subscriptions go through server-verified M-Pesa payment instead of local direct activation.
- `[~] Modify` Premium seller verification appears local/frontend-based.
- `[x] Present` Seller logistics add-on is now backend-backed with frontend local fallback.
- `[ ] Missing` Backend-backed premium seller verification.
- `[x] Present` Backend-backed seller logistics add-on.
- `[~] Modify` Subscription failed payment recovery exists through retry/clear pending flow, but failure reason history still needs backend reporting.
- `[x] Present` Subscription pending payment recovery screen.
- `[ ] Missing` Seller billing history.
- `[ ] Missing` Invoice/receipt downloads.

## 13. Seller Dashboard

- `[x] Present` Seller dashboard exists.
- `[x] Present` Sales and order metrics exist.
- `[x] Present` Inventory health exists.
- `[x] Present` Low-stock alert area exists.
- `[x] Present` Subscription feature locks exist.
- `[x] Present` Dashboard can now use backend-backed `minThreshold`.
- `[x] Present` Dashboard inventory health is graph-first per SKU with threshold/reserved context.
- `[x] Present` Logistics command center.
- `[x] Present` Pending dispatch widget.
- `[x] Present` Active deliveries widget.
- `[x] Present` QR handoff widget.
- `[x] Present` Escrow payout widget shows payout split details with settlement/logistics cost context.
- `[x] Present` RFQ inbox widget.
- `[x] Present` Subscription payment warning/recovery widget.
- `[x] Present` Verified trip PDF print/download area.
- `[x] Present` 3-way rating/feedback queue.

## 14. Seller Products

- `[x] Present` Seller products page exists.
- `[x] Present` Inventory graph exists.
- `[x] Present` SKU display exists.
- `[x] Present` Low-stock filter exists.
- `[x] Present` Low stock now depends on persisted `minThreshold`.
- `[x] Present` Product graph is fed by persisted inventory ledger/events.
- `[x] Present` Edit product threshold.
- `[x] Present` Edit MOQ/tier pricing.
- `[x] Present` Edit RFQ status.
- `[x] Present` Product warehouse status.
- `[x] Present` Product inventory movement history.

## 15. Seller Orders

- `[x] Present` Seller orders page exists.
- `[~] Modify` Page should be redesigned as an operations page, not just a status list.
- `[~] Modify` Logistics assignment starts from seller orders; direct driver/provider assignment still needs completion.
- `[ ] Missing` Route tracking.
- `[ ] Missing` Escrow state.
- `[ ] Missing` QR token controls.
- `[ ] Missing` Driver contact.
- `[ ] Missing` Delivery proof.
- `[ ] Missing` Payout breakdown.
- `[ ] Missing` Dispute/freeze controls.
- `[ ] Missing` Order event timeline.

## 16. Admin Dashboard

- `[x] Present` Admin dashboard exists.
- `[x] Present` Admin products exists.
- `[x] Present` Admin orders exists.
- `[x] Present` Admin logistics exists.
- `[x] Present` Admin subscriptions exists.
- `[~] Modify` Admin product inventory graph should be consistent everywhere.
- `[~] Modify` Admin logistics tools should become a workflow dashboard, not raw forms.
- `[ ] Missing` Cross-dock operations board.
- `[ ] Missing` Truck capacity planning board.
- `[ ] Missing` Failed M-Pesa callback queue.
- `[ ] Missing` Payout worker monitor.
- `[ ] Missing` RFQ admin monitor.
- `[ ] Missing` Stock threshold management.
- `[ ] Missing` Escrow audit timeline.

## 17. Notifications

- `[x] Present` Notification backend/frontend exists.
- `[x] Present` Notification bell exists.
- `[x] Present` Notification preferences component exists.
- `[~] Modify` Notification services have duplicated/unclean file names.
- `[~] Modify` Stock alert notifications need product threshold connection.
- `[ ] Missing` Notification delivery logs for admin.
- `[ ] Missing` Email/SMS failure dashboard.
- `[ ] Missing` Per-feature notification preferences.
- `[ ] Missing` Logistics QR/event notifications in seller order workflow.

## 18. Reviews And Feedback

- `[x] Present` Product reviews exist.
- `[~] Modify` Product review eligibility exists but should be connected clearly after completed orders.
- `[ ] Missing` Logistics trip reviews.
- `[ ] Missing` Buyer-to-driver rating.
- `[ ] Missing` Driver-to-seller rating.
- `[ ] Missing` Seller-to-driver rating.
- `[ ] Missing` Algorithmic prioritization based on ratings.
- `[ ] Missing` Bad actor detection/moderation queue.

## 19. Reports And Documents

- `[x] Present` Subscription report backend route exists.
- `[~] Modify` Existing reports are not surfaced enough in seller dashboard.
- `[ ] Missing` Monthly Verified Trip PDF.
- `[ ] Missing` Seller downloadable business statements.
- `[ ] Missing` Bank financing document workflow.
- `[ ] Missing` Admin report export center.
- `[ ] Missing` Subscription invoices/receipts.

## 20. API And Data Consistency

- `[~] Modify` Normalize API response shapes across services.
- `[~] Modify` Normalize order statuses across backend and frontend.
- `[~] Modify` Normalize escrow statuses across backend and frontend.
- `[~] Modify` Normalize product stock fields: `quantityAvailable`, `stock`, `quantity`, `inventory`.
- `[~] Modify` Normalize SKU fields: `sku`, `trackingSku`, `SKU`, `stockKeepingUnit`.
- `[~] Modify` Remove frontend fallback field guessing once backend contracts are stable.
- `[ ] Missing` API contract documentation for frontend-required fields.
- `[ ] Missing` End-to-end tests for buyer checkout to seller fulfillment to delivery payout.
- `[ ] Missing` End-to-end tests for subscription payment activation.
- `[ ] Missing` End-to-end tests for logistics QR handoff.

## 21. Production Readiness

- `[x] Present` Backend error handling/logging exists.
- `[x] Present` Request logging exists.
- `[x] Present` MongoDB fallback exists.
- `[~] Modify` Fallback mode should visibly warn frontend/admin when database routes may fail.
- `[~] Modify` Large file upload handling should be clearer in frontend.
- `[~] Modify` M-Pesa callback setup should be documented and checked at startup.
- `[ ] Missing` Health check page for database, Redis, email, M-Pesa, Cloudinary, SMS.
- `[ ] Missing` Admin system status dashboard.
- `[ ] Missing` Background job monitoring.
- `[ ] Missing` Automated test coverage for critical payment/order flows.
- `[ ] Missing` Production deployment checklist.

## Highest Priority Work

1. `[x]` Add backend `minThreshold` to products.
2. `[x]` Add stock threshold input to Add/Edit Product.
3. `[x]` Connect seller orders to logistics records.
4. `[~]` Add logistics controls to seller orders.
5. `[x]` Add seller dashboard logistics widgets.
6. `[x]` Add verified logistics provider endpoint.
7. `[x]` Persist seller logistics provider/add-on in backend.
8. `[ ]` Normalize order and escrow statuses.
9. `[~]` Add subscription payment pending/failed recovery UI.
10. `[x]` Build RFQ backend and frontend.
11. `[ ]` Add cross-dock/first-mile/long-haul entities.
12. `[ ]` Add driver/hub QR scanner pages.
13. `[ ]` Add admin callback/payout monitor.
14. `[ ]` Add Monthly Verified Trip PDF.

## Final Website Diagnosis

Lango MarketPulse has many strong modules already built. The website is not missing everything. The main missing work is connecting the modules into complete user journeys:

- Buyer pays.
- Funds enter escrow.
- Seller sees paid order.
- Seller assigns logistics.
- Driver scans pickup QR.
- Hub/cross-dock scan happens.
- Final delivery scan happens.
- Buyer confirms or dispute window expires.
- Farmer/seller, driver, platform, and sinking fund payouts happen.
- Dashboard, admin, and notifications all show the same truth.

That full journey is not fully implemented yet. The project needs integration work, data model completion, and cleaner dashboard workflows.
