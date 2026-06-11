# Lango Market Pulse - Complete Backend API Documentation

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication
All protected endpoints require Bearer token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## 1. Authentication Routes
### POST /auth/register
Register a new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "0712345678",
  "role": "farmer|wholesaler|retailer|consumer|logistics",
  "businessName": "John's Farm",
  "location": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  }
}
```

### POST /auth/login
Login user
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /auth/verify-email
Verify email with OTP
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

### POST /auth/refresh-token
Refresh JWT token
```json
{
  "refreshToken": "refresh_token_here"
}
```

---

## 2. Product Routes

### GET /products
List all products with filters
Query params:
- `page` (default: 1)
- `limit` (default: 20)
- `category` (category ID)
- `search` (search term)
- `minPrice`, `maxPrice`
- `inStock` (true/false)
- `sort` (price, rating, newest)

### POST /products
Create new product (Farmer/Wholesaler)
```json
{
  "name": "Tomatoes",
  "description": "Fresh red tomatoes",
  "price": 100,
  "stock": 50,
  "category": "category_id",
  "unit": "kg",
  "images": ["url1", "url2"],
  "specifications": {
    "weight": "5kg",
    "quality": "A-Grade"
  }
}
```

### GET /products/:id
Get product details

### PUT /products/:id
Update product (Owner only)

### DELETE /products/:id
Delete product (Owner only)

---

## 3. Order Routes

### POST /orders
Create new order
```json
{
  "items": [
    {
      "product": "product_id",
      "quantity": 10
    }
  ],
  "deliveryAddress": {
    "street": "123 Main St",
    "city": "Nairobi",
    "postalCode": "00100"
  },
  "deliveryMethod": "pickup|home_delivery|courier",
  "paymentMethod": "wallet|mpesa|card"
}
```

### GET /orders
List user orders with filters
Query params:
- `status` (pending, processing, shipped, delivered, cancelled)
- `page`, `limit`

### GET /orders/:id
Get order details

### PUT /orders/:id
Update order (Admin only for status changes)

### POST /orders/:id/cancel
Cancel order (Before shipped)

---

## 4. Payment Routes

### POST /payments/mpesa/stkpush
Initiate M-Pesa STK Push
```json
{
  "orderId": "order_id",
  "phoneNumber": "0712345678"
}
```

### GET /payments/mpesa/status/:checkoutRequestId
Check M-Pesa payment status

### GET /payments/wallet/balance
Get wallet balance

### POST /payments/wallet/transfer
Transfer to another user
```json
{
  "toUserId": "user_id",
  "amount": 500,
  "description": "Payment for goods"
}
```

### POST /payments/wallet/withdraw
Withdraw to M-Pesa
```json
{
  "amount": 1000,
  "phoneNumber": "0712345678"
}
```

### GET /payments/transactions
Get transaction history with filters
Query params:
- `page`, `limit`
- `type` (deposit, withdrawal, payment, etc)
- `status`

---

## 5. Wallet Routes

### GET /wallet
Get wallet details

### GET /wallet/balance
Get wallet balance

### POST /wallet/transfer
Transfer funds to another user
```json
{
  "toUserId": "user_id",
  "amount": 500,
  "description": "optional description"
}
```

### POST /wallet/withdraw
Withdraw to M-Pesa
```json
{
  "amount": 1000,
  "phoneNumber": "0712345678"
}
```

### GET /wallet/transactions
Get transaction history

---

## 6. Escrow Routes

### GET /escrow/:orderId
Get escrow details for order

### POST /escrow/release/:orderId
Release escrow funds (Admin/Auto)
```json
{
  "forceRelease": false
}
```

### POST /escrow/hold/:orderId
Hold escrow (During dispute)

---

## 7. Dispute Routes

### POST /disputes
Create dispute
```json
{
  "orderId": "order_id",
  "reason": "product_not_received|quality_issue|quantity_mismatch|damaged_goods|late_delivery|other",
  "description": "Description of issue",
  "evidenceUrls": ["url1", "url2"]
}
```

### GET /disputes
List disputes with filters
Query params:
- `status` (open, under_review, resolved_buyer, resolved_seller, partial_refund, closed)
- `page`, `limit`

### GET /disputes/:id
Get dispute details

### POST /disputes/:id/messages
Add message to dispute
```json
{
  "message": "Message content"
}
```

### POST /disputes/:id/resolve
Resolve dispute (Admin only)
```json
{
  "resolution": "refund_buyer|release_to_seller|partial_refund|cancelled",
  "refundAmount": 500,
  "faultParty": "buyer_or_seller_id",
  "notes": "Resolution notes"
}
```

### POST /disputes/:id/reopen
Reopen dispute (Admin only)
```json
{
  "reason": "Reason to reopen"
}
```

---

## 8. QR Token Routes

### POST /qr-tokens/generate
Generate QR token for pickup/delivery
```json
{
  "orderId": "order_id",
  "logisticsId": "logistics_id",
  "type": "PICKUP|DELIVERY"
}
```

### POST /qr-tokens/scan
Scan QR token (Driver)
```json
{
  "token": "token_string",
  "gpsLat": 1.2345,
  "gpsLng": 36.7890
}
```

### GET /qr-tokens/:id
Get QR token details

### GET /qr-tokens/order/:orderId
List QR tokens for order

### POST /qr-tokens/:id/resend
Resend expired QR token

### GET /qr-tokens/stats
Get QR token statistics (Admin)

---

## 9. Sinking Fund Routes

### GET /sinking-fund/me
Get current driver's sinking fund

### GET /sinking-fund/:driverId
Get driver's sinking fund details

### POST /sinking-fund/contribute
Record contribution (Admin)
```json
{
  "driverId": "driver_id",
  "amount": 500,
  "orderId": "order_id",
  "logisticsId": "logistics_id"
}
```

### POST /sinking-fund/update-mileage
Update driver mileage
```json
{
  "driverId": "driver_id",
  "mileageKm": 15000
}
```

### POST /sinking-fund/withdraw
Withdraw from fund
```json
{
  "driverId": "driver_id",
  "amount": 1000,
  "reason": "Maintenance"
}
```

### GET /sinking-fund/:driverId/contributions
Get contribution history

### GET /sinking-fund/admin/all
Get all drivers' funds (Admin)

### GET /sinking-fund/admin/service-alerts
Get service alerts (Admin)

### GET /sinking-fund/admin/analytics
Get analytics (Admin)

---

## 10. Audit Routes (Admin Only)

### GET /audit/logs
Get audit logs with filters
Query params:
- `entityType`, `action`, `actor`
- `page`, `limit`
- `startDate`, `endDate`

### GET /audit/logs/:id
Get single audit log

### GET /audit/entity/:entityType/:entityId
Get entity audit history

### GET /audit/user/:userId
Get user activity

### GET /audit/stats
Get audit statistics

### GET /audit/export
Export audit logs to CSV

### GET /audit/recent
Get recent activities

### POST /audit/search
Search audit logs
```json
{
  "query": "search term",
  "page": 1,
  "limit": 20
}
```

---

## 11. Notification Routes

### GET /notifications
Get user notifications
Query params:
- `page`, `limit`
- `read` (true/false)

### POST /notifications/:id/read
Mark notification as read

### POST /notifications/read-all
Mark all as read

### DELETE /notifications/:id
Delete notification

---

## 12. Category Routes

### GET /categories
List all categories

### POST /categories
Create category (Admin)
```json
{
  "name": "Vegetables",
  "description": "All vegetables",
  "image": "url"
}
```

### GET /categories/:id
Get category details

### PUT /categories/:id
Update category (Admin)

### DELETE /categories/:id
Delete category (Admin)

---

## 13. Cart Routes

### GET /cart
Get user cart

### POST /cart
Add item to cart
```json
{
  "product": "product_id",
  "quantity": 5
}
```

### PUT /cart/:itemId
Update cart item quantity
```json
{
  "quantity": 10
}
```

### DELETE /cart/:itemId
Remove from cart

### DELETE /cart
Clear cart

---

## 14. Wishlist Routes

### GET /wishlist
Get user wishlist

### POST /wishlist
Add to wishlist
```json
{
  "product": "product_id"
}
```

### DELETE /wishlist/:productId
Remove from wishlist

---

## 15. Review Routes

### POST /reviews
Create review
```json
{
  "order": "order_id",
  "product": "product_id",
  "rating": 5,
  "comment": "Great product!",
  "images": ["url1", "url2"]
}
```

### GET /reviews/product/:productId
Get product reviews

### GET /reviews/seller/:sellerId
Get seller reviews

### PUT /reviews/:id
Update review (Owner)

### DELETE /reviews/:id
Delete review (Owner)

---

## 16. Subscription Routes

### GET /subscriptions
Get available subscription plans

### POST /subscriptions/subscribe
Subscribe to plan
```json
{
  "plan": "basic|premium|enterprise",
  "paymentMethod": "mpesa|card|wallet"
}
```

### GET /subscriptions/my-subscription
Get current subscription

### POST /subscriptions/cancel
Cancel subscription

---

## 17. Group Buy Routes

### POST /groupbuy
Create group buy
```json
{
  "product": "product_id",
  "targetQuantity": 100,
  "unitPrice": 80,
  "endDate": "2024-12-31"
}
```

### GET /groupbuy
List group buys
Query params:
- `status` (active, closed, completed)
- `page`, `limit`

### GET /groupbuy/:id
Get group buy details

### POST /groupbuy/:id/join
Join group buy
```json
{
  "quantity": 10
}
```

### POST /groupbuy/:id/close
Close group buy (Creator/Admin)

---

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error"
    }
  ]
}
```

Common Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## Response Format

All successful responses follow this format:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Paginated responses:
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Authentication Headers

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Rate Limiting

- 100 requests per 15 minutes per IP
- 1000 requests per hour per user

---

## WebSocket Events (Real-time)

Connect to: `ws://localhost:5000`

Events:
- `order_status_update` - Order status changed
- `payment_received` - Payment confirmation
- `new_notification` - New notification
- `driver_location` - Driver location update
- `dispute_update` - Dispute status update
