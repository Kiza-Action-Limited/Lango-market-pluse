# Lango MarketPulse Missing Implementation Audit

Date: 2026-07-01

Scope scanned:
- `backend/src`
- `multi-e-commerce-app/src`

This document lists the main missing, partial, or disconnected areas across logistics, orders, subscriptions, products, inventory alerts, seller dashboard, admin dashboard, and related frontend/backend flows.

## Summary

The project already contains many backend and frontend modules for logistics, orders, subscriptions, escrow, products, SKU tracking, and dashboards. The main issue is not that everything is absent. The bigger issue is that several features exist in separate pieces but are not fully connected into real user workflows.

The biggest missing areas are:
- Logistics is not fully connected inside seller dashboard and seller orders.
- Product stock alerts use frontend fields that backend does not persist.
- B2B MOQ/RFQ is mostly frontend/helper logic, not a full backend product and quote system.
- Subscription payment is backend-protected, but some frontend paths still try to activate plans directly.
- Mizigo/Plan 4 views show live-data shells, but many required backend fields/endpoints are missing.
- Seller logistics add-on/provider selection is mostly local/frontend state, not backend-backed.

## Logistics

### Implemented

Backend has:
- Logistics application route.
- Admin logistics application review.
- Logistics trip creation.
- Group trip creation and join flow.
- Nearby driver lookup.
- GPS/location update routes.
- Logistics status update routes.
- Driver accept trip route.
- Driver assignment route.
- QR token generation and QR scan routes.
- Escrow release and dispute routes.
- Admin logistics list and tracking routes.

Frontend has:
- Logistics application page.
- Logistics status page.
- Logistics operations page.
- Admin logistics page.
- Mizigo engine page.
- Buyer order tracking page with logistics escrow flow component.

### Missing Or Partial

- Seller dashboard does not include a real logistics workspace.
- Seller orders page does not include logistics assignment, delivery route, QR handoff, or driver status.
- Seller cannot create a shipment directly from an order.
- Seller cannot assign or request a verified logistics provider from the order screen.
- Seller cannot generate pickup/delivery QR tokens from seller order workflow.
- Seller cannot see first-mile driver, long-haul driver, hub arrival, or final delivery handoff inside seller orders.
- Logistics provider selection in subscription add-on is saved locally, not persisted to backend.
- Frontend calls provider endpoints such as `/v1/logistics/providers`, `/v1/logistics/providers/verified`, and `/v1/logistics/verified-providers`, but matching backend routes are not registered.
- Plan 4 Mizigo frontend depends on live API fields that are not consistently returned, such as:
  - `pickupScannedAt`
  - `deliveryScannedAt`
  - `scanHistory`
  - `hubArrivedAt`
  - `crossDockArrivedAt`
  - `crossDockDepartedAt`
  - `currentLoadKg`
  - `capacityKg`
  - buyer/driver/seller rating fields
- Two-tier logistics is not fully automated from order to first-mile pickup to cross-dock to long-haul to final delivery.
- Cross-dock workflow exists as concept/UI, but backend does not fully model the physical state transitions.
- No complete frontend workflow for QR scan by:
  - first-mile driver
  - long-haul driver
  - hub operator
  - final delivery receiver

## Orders

### Implemented

Backend has:
- Order create route.
- Order listing by role.
- Order detail route.
- Order status update route.
- Cancel order route.
- Confirm delivery route.
- Raise dispute route.
- M-Pesa payment route.
- Escrow service integration.

Frontend has:
- Buyer orders page.
- Seller orders page.
- Admin orders page.
- Order tracking page.
- Checkout/payment flow.

### Missing Or Partial

- Seller orders page is too simple. It only has:
  - customer information
  - delivery text
  - item list
  - status dropdown
- Seller orders page now shows logistics record, driver assignment, route status, QR token/scanner state, escrow status, payout split, dispute freeze timer, and proof of delivery.
- Order status values are normalized in seller UI while the backend still accepts older and newer flow values. Examples include:
  - `pending_payment`
  - `payment_escrowed`
  - `processing`
  - `dispatched`
  - `FUNDS_HELD`
  - `IN_TRANSIT`
  - `DELIVERED`
- Order logistics is now automatically created after successful M-Pesa payment confirmation when no logistics record exists.
- Seller UI now limits status actions to valid next transitions for the current status.
- Buyer order tracking and seller order management now expose comparable logistics and escrow visibility.
- Seller-facing exception handling still needs fuller damaged goods / failed pickup / failed delivery resolution workflows beyond dispute freeze display.

## Escrow And M-Pesa

### Implemented

Backend has:
- Pending escrow creation.
- M-Pesa payment hold.
- Escrow held state.
- Mark in transit.
- Mark delivered.
- 72-hour auto-release delay.
- Escrow release.
- Escrow hold.
- Partial release.
- Escrow cancel.
- Dispute handling.
- Transaction records.
- Sinking fund integration in payout split.

Frontend has:
- Escrow status lookup in logistics operations.
- Escrow release/hold/partial/cancel controls for admin contexts.
- Buyer-facing escrow flow display.
- Mizigo engine escrow summary view.

### Missing Or Partial

- Escrow states are not fully consistent with the requested state machine:
  - requested: `PENDING -> HELD -> PARTIAL_RELEASE -> DISBURSED`
  - current code also uses: `AWAITING_PAYMENT`, `HELD`, `IN_TRANSIT`, `DELIVERED`, `RELEASED`, `FAILED`, `REFUNDED`, `PARTIAL_REFUND`
- Seller dashboard/order pages do not show escrow state machine clearly.
- 72-hour dispute freeze is surfaced in seller order operations.
- Seller payout visibility is present; broader buyer/admin payout monitor views remain incomplete.
- M-Pesa B2C payout callback worker visibility is not exposed in frontend.
- Payment callback dependence can cause confusion during local development if callback URL is not reachable.
- Subscription M-Pesa payment is protected by backend, and frontend paid-plan paths now route through the verified M-Pesa payment flow instead of direct local activation.

## Subscriptions

### Implemented

Backend has:
- Plan list.
- Subscribe route.
- Current subscription route.
- Entitlements route.
- Upgrade options.
- Cancel subscription.
- Change plan.
- SMS credit balance/top-up.
- Sinking fund route.
- Daily burn route.
- Subscription report route.
- Admin subscription management.
- M-Pesa subscription STK push.
- M-Pesa subscription status check.

Frontend has:
- Subscription plans page.
- Premium payment page.
- Premium verification page.
- Admin subscriptions page.
- Subscription guard/gate components.
- Seller logistics add-on UI.

### Missing Or Partial

- Direct frontend subscription activation still exists through `subscriptionService.subscribe`.
- Paid plans should only activate through server-verified M-Pesa payment.
- `AuthContext.switchPlan` can still call subscription activation in ways that may trigger backend `402 Complete M-Pesa payment before plan activation`.
- Premium seller verification appears to be local/frontend-based, not a complete backend verification workflow.
- Premium verification data is not clearly persisted as a backend seller verification record.
- Seller logistics add-on is local state, not a backend subscription/add-on object.
- There is no full billing history UI for sellers.
- There is no clear failed/pending subscription payment recovery screen.
- M-Pesa callback and status flow needs production callback configuration for reliable activation.

## Products

### Implemented

Backend has:
- Product create/update/delete.
- Product image upload.
- Product list and detail.
- Seller products.
- Product reviews.
- Low-stock endpoint.
- SKU generation.
- SKU uniqueness index.
- Inventory history.
- Inventory graph virtual.
- Reserved quantity logic.

Frontend has:
- Add product page.
- Seller products page.
- Admin products page.
- Product cards.
- Product detail.
- Product inventory graph display in seller/admin areas.
- MOQ helper logic for some business types.

### Missing Or Partial

- Product form supports backend-backed B2B fields:
  - MOQ
  - tier pricing
  - RFQ enabled
  - quote terms
  - wholesale minimum order quantity
- Backend product model persists B2B/RFQ fields.
- No RFQ backend routes:
  - create RFQ
  - seller/farmer response
  - buyer accept
  - buyer reject
  - negotiation history
- Product warehouse status is persisted per SKU, but there is no full virtual warehouse model:
  - farm gate origin
  - cross-dock location
  - hub destination
  - GPS coordinates per SKU/unit
- SKU exists per product, but not full per-unit tracking for every physical product unit.
- Product detail does not fully show inventory graph, SKU location, logistics status, or RFQ/wholesale terms.
- Product upload still depends on user images being under configured size; frontend could benefit from image compression before upload.
- Product stock alert threshold is saved per product.

## Inventory And Inner Stock Alerts

### Implemented

Backend has:
- Low-stock products endpoint using query threshold.
- Scarcity scheduler.
- Threshold service.
- Scarcity alert model/service path.
- Notification controller can count low-stock products.

Frontend has:
- Seller dashboard inventory alert section.
- Seller products low-stock filter.
- Seller products stock alert list.
- Regional scarcity board.
- Admin dashboard low-stock/urgent alert metrics.

### Missing Or Partial

- Backend and frontend persist/use per-product `minThreshold`.
- Add/edit product pages expose per-product alert threshold input.
- Backend low-stock checks use seller-configured product thresholds where product data is available.
- Scarcity scheduler creates alerts, but there is no complete seller alert management UI.
- There is no clear alert resolve UI for sellers.
- There is no product-level restock recommendation workflow connected to real sales velocity.
- Stock alert notification preferences are not exposed per seller/product.

## Seller Dashboard

### Implemented

Seller dashboard has:
- Sales/order metrics.
- Inventory health card and graph-first per-SKU inventory rows.
- Product series graph.
- Inventory alert section.
- Recent product/performance sections.
- Subscription feature locks/tooltips.
- Links to products, orders, scarcity board, subscription.
- Logistics command center.
- Pending dispatch widget.
- Active delivery widget.
- QR handoff widget.
- Escrow payout split widget.
- Subscription payment pending/recovery banner.
- Seller-facing RFQ inbox.
- Verified trip print/PDF report area.
- 3-way feedback/rating queue.

### Missing Or Partial

- No assigned driver widget.
- Direct low-stock threshold configuration links through seller product edit instead of inline editing.
- No Plan 4 Mizigo operational summary inside seller dashboard.

## Seller Orders

### Implemented

Seller orders page has:
- Order list.
- Customer information.
- Product item display.
- Total amount.
- Order status badge.
- Status update dropdown.

### Missing Or Partial

- No logistics assignment controls.
- No create logistics/trip button.
- No nearby driver search.
- No selected logistics provider display.
- No route/tracking display.
- No QR token generation.
- No pickup QR status.
- No hub QR status.
- No delivery QR status.
- No escrow status.
- No payout status.
- No dispute freeze display.
- No proof of delivery upload/display.
- No order timeline.
- No buyer delivery confirmation state.

## Admin Dashboard And Admin Tools

### Implemented

Admin has:
- Admin dashboard metrics.
- Admin products.
- Admin orders.
- Admin logistics.
- Admin logistics tools.
- Admin subscriptions.
- Admin logistics application review.
- Admin logistics tracking update.

### Missing Or Partial

- Admin SKU inventory health exists partly, but should be more consistently shown as graph per product/SKU across admin products and dashboard.
- Admin logistics tools expose raw forms/results, but not a polished operations workflow.
- Admin does not have full cross-dock board.
- Admin does not have full truck capacity planning board.
- Admin does not have complete payout callback monitor.
- Admin does not have failed M-Pesa callback recovery queue.
- Admin does not have RFQ moderation/monitoring.
- Admin does not have product alert threshold management.

## B2B Wholesaling Engine

### Implemented

Frontend has:
- MOQ helper logic.
- Some MOQ display in product cards/cart/checkout.
- Mizigo page displays B2B fields when API returns them.

### Missing Or Partial

- No complete backend MOQ schema.
- No product tier pricing schema.
- No RFQ schema.
- No RFQ API.
- No negotiation engine.
- No RFQ inbox for sellers.
- No RFQ request form for buyers.
- No quote acceptance workflow.
- No quote-to-order conversion.
- No backend enforcement of tier pricing.

## Virtual Warehousing

### Implemented

- Product SKU generation exists.
- Inventory graph/history exists.
- Mizigo frontend attempts to display SKU/location fields.

### Missing Or Partial

- No full warehouse/location state per SKU:
  - Farm Gate
  - Kitale Cross-Dock
  - Kakuma Hub
  - Delivered
- No GPS telemetry stored per inventory movement.
- No inventory movement ledger for every warehouse transfer.
- No per-unit physical tracking; current SKU is product-level, not unit-level.
- No cross-dock arrival/departure timestamps consistently returned.
- No warehouse operator role/workflow.

## Plan 4 Mizigo Pooling

### Implemented

- Group trip backend routes exist.
- Frontend has create/join group trip operations.
- Mizigo frontend groups visible orders by destination.

### Missing Or Partial

- Pooling is not fully automated.
- Orders are not automatically assigned to pools.
- Truck 80% capacity optimization is not fully enforced by backend.
- First-mile and long-haul segments are not fully modeled as separate linked records.
- Cross-dock buffer is not a complete backend entity.
- Seller orders do not show pool membership.
- Driver dashboard does not clearly separate first-mile and long-haul tasks.

## QR Handshake

### Implemented

- QR token generation routes exist.
- QR scan route exists.
- Frontend logistics operations can generate/list/resend tokens.
- Buyer order tracking can display logistics escrow flow.

### Missing Or Partial

- QR controls are not embedded in seller order workflow.
- No clear QR scanner UI for drivers/hub operators in the main logistics dashboard.
- Short-lived token expiry/GPS telemetry may exist partially, but is not fully visible in frontend.
- No complete visual audit trail for each QR scan.
- No clear fraud/spoofing warning UI.
- No separate QR steps for:
  - Farm Gate pickup
  - Hub arrival
  - Final delivery

## Feedback And Ratings

### Implemented

- Product reviews exist.
- Some rating fields are searched/displayed if returned by logistics data.

### Missing Or Partial

- No complete buyer-driver-seller mutual rating system.
- No rating route for logistics trips.
- No rating UI after delivery.
- No automatic prioritization of top-rated drivers/sellers.
- No bad-actor scoring or moderation queue.

## Reports And PDFs

### Implemented
 report 
- Subscription report endpoint exists.
- Frontend has subscription and dashboard surfaces.

### Missing Or Partial

- No clear Monthly Verified Trip PDF generation UI.
- No seller download button for verified trip statement.
- No backend route dedicated to logistics monthly trip PDFs.
- No bank-financing statement workflow.

## Recommended Priority Order

1. Add backend product fields for `minThreshold`, MOQ, tier pricing, RFQ, and warehouse location.
2. Add per-product stock threshold UI in add/edit product.
3. Connect seller orders to logistics records.
4. Add logistics panel inside seller orders.
5. Add seller dashboard logistics summary.
6. Add real verified logistics provider endpoint.
7. Persist seller logistics add-on/provider selection in backend.
8. Build RFQ backend and frontend workflow.
9. Normalize order and escrow statuses across backend/frontend.
10. Add cross-dock and first-mile/long-haul backend entities.
11. Add QR scan workflow screens for drivers/hub/final receiver.
12. Add subscription pending/failed payment recovery UI.
13. Add admin M-Pesa callback and payout monitor.
14. Add monthly verified trip PDF generation.

## Short Final Diagnosis

The project is not empty. It has strong foundations. The missing work is mostly integration work: making logistics, orders, escrow, subscriptions, inventory alerts, and products behave as one connected system instead of separate pages and services.

The highest-value next work is to connect seller orders with logistics and escrow, then fix product-level stock thresholds so low-stock alerts become real and reliable.
