# 🌾 Lango Market Pulse - E-Commerce Platform

A comprehensive, production-ready e-commerce platform connecting farmers, wholesalers, retailers, and consumers with integrated payment systems, logistics, and dispute resolution.

## ✨ Features

### 👥 User Management
- Multi-role authentication (Farmer, Wholesaler, Retailer, Consumer, Logistics)
- Email verification
- Role-based access control (RBAC)
- User profiles and business information
- Location-based services with geospatial queries

### 🛍️ Shopping Experience
- Product catalog with advanced filtering
- Shopping cart and wishlist
- Product reviews and ratings
- Category management
- Inventory management
- Real-time stock updates

### 💳 Payment Integration
- **M-Pesa** integration with STK push
- Card payments
- Digital wallet system
- Bank transfers
- Multiple currency support (KES, USD)
- Payment tracking and history

### 📦 Order Management
- Order creation and tracking
- Order status management
- Automated status notifications
- Order history and analytics

### 🚚 Logistics & Delivery
- Multi-carrier support
- QR code generation for pickups/deliveries
- GPS tracking integration
- Driver management
- Delivery verification
- Sinking fund for vehicle maintenance

### ⚖️ Dispute Resolution
- Comprehensive dispute management
- Escrow protection for buyers
- Automatic fund release after 72 hours
- Admin-assisted resolution
- Partial refunds support
- Audit trail for all disputes

### 📊 Analytics & Reporting
- Sales analytics
- Revenue tracking
- User analytics
- Product performance metrics
- Logistics performance data
- Audit logging

### 🔔 Real-time Features
- WebSocket support for live updates
- Push notifications
- Order status updates
- Payment confirmations
- Delivery tracking

### 🔒 Security
- JWT-based authentication
- Password hashing (bcrypt)
- CORS protection
- Rate limiting
- Input validation
- SQL injection prevention
- Audit logging

---

## 🏗️ Project Structure

```
Lango-market-pluse/
├── backend/
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── models/             # MongoDB schemas
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Custom middleware
│   │   ├── jobs/               # Background jobs
│   │   ├── config/             # Configuration files
│   │   ├── utils/              # Utility functions
│   │   ├── app.js              # Express app setup
│   │   └── server.js           # Server entry point
│   ├── package.json
│   └── .env
│
├── multi-e-commerce-app/       # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API services
│   │   ├── hooks/              # Custom hooks
│   │   ├── context/            # Context providers
│   │   ├── redux/              # State management
│   │   └── main.jsx
│   ├── package.json
│   └── .env
│
├── API_DOCUMENTATION.md        # Complete API docs
├── SETUP_GUIDE.md             # Setup instructions
└── setup.sh                   # Setup script
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v16+ or v18+
- MongoDB v5.0+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Lango-market-pluse

# Run setup script (Linux/Mac)
chmod +x setup.sh
./setup.sh

# Or manual setup
# Backend
cd backend
npm install
cp .env.example .env  # Configure .env file
npm run dev

# Frontend (in another terminal)
cd multi-e-commerce-app
npm install
cp .env.example .env  # Configure .env file
npm run dev
```

### Access Points
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/v1
- Health Check: http://localhost:5000/health

---

## 📚 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/verify-email` - Verify email
- `POST /auth/refresh-token` - Refresh JWT token

### Products
- `GET /products` - List products
- `POST /products` - Create product
- `GET /products/:id` - Get product details
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product

### Orders
- `POST /orders` - Create order
- `GET /orders` - List orders
- `GET /orders/:id` - Get order details
- `PUT /orders/:id` - Update order
- `POST /orders/:id/cancel` - Cancel order

### Payments
- `POST /payments/mpesa/stkpush` - M-Pesa STK push
- `GET /payments/mpesa/status/:checkoutRequestId` - Check payment status
- `GET /payments/wallet/balance` - Get wallet balance
- `POST /payments/wallet/transfer` - Transfer funds
- `POST /payments/wallet/withdraw` - Withdraw to M-Pesa

### Disputes
- `POST /disputes` - Create dispute
- `GET /disputes` - List disputes
- `POST /disputes/:id/resolve` - Resolve dispute
- `POST /disputes/:id/reopen` - Reopen dispute

### QR Tokens
- `POST /qr-tokens/generate` - Generate QR token
- `POST /qr-tokens/scan` - Scan QR token
- `GET /qr-tokens/order/:orderId` - List QR tokens

### Sinking Fund
- `GET /sinking-fund/me` - Get current driver's fund
- `POST /sinking-fund/contribute` - Record contribution
- `POST /sinking-fund/withdraw` - Withdraw from fund

### Audit Logs
- `GET /audit/logs` - Get audit logs
- `GET /audit/user/:userId` - Get user activity
- `GET /audit/stats` - Get statistics

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```dotenv
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
CLOUDINARY_CLOUD_NAME=...
```

**Frontend (.env)**
```dotenv
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=ws://localhost:5000
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete configuration.

---

## 📖 Documentation

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Setup Guide](./SETUP_GUIDE.md) - Installation and deployment guide
- [Database Schema](./DATABASE_SCHEMA.md) - Database design
- [Architecture](./ARCHITECTURE.md) - System architecture

---

## 🧪 Testing

### Run Tests
```bash
npm test
```

### API Testing with Postman
Import the provided Postman collection for easy API testing.

---

## 🚢 Deployment

### Using Docker
```bash
docker build -t lango-api .
docker run -p 5000:5000 --env-file .env lango-api
```

### Using Heroku
```bash
heroku create lango-market-pulse
git push heroku main
```

### Using AWS EC2
See deployment section in [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## 📊 Performance

### Optimizations
- Indexed MongoDB queries
- Connection pooling
- Redis caching
- Pagination for large datasets
- Lean queries for read-only operations
- API rate limiting

### Monitoring
- Health check endpoint: `/health`
- Application logs in `backend/logs/`
- MongoDB performance monitoring
- Real-time error tracking

---

## 🔒 Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Input validation
- ✅ XSS protection
- ✅ SQL injection prevention
- ✅ Comprehensive audit logging
- ✅ Role-based access control
- ✅ Secure password reset flow

---

## 🐛 Known Issues & Limitations

- M-Pesa integration requires sandbox credentials for testing
- Real-time features require WebSocket support
- Geospatial queries require geospatial indexes

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see LICENSE.md for details.

---

## 📞 Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/issues)
- **Email**: support@langomarket.com
- **Documentation**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Subscription tiers for sellers
- [ ] Advanced analytics dashboard
- [ ] AI-powered recommendations
- [ ] Multi-language support
- [ ] Blockchain-based verification
- [ ] Integration with more payment providers

---

## 👨‍💻 Team

- Development Team
- Product Team
- Design Team

---

## 📝 Changelog

### v1.0.0 (Initial Release)
- ✨ Complete e-commerce platform
- 💳 M-Pesa payment integration
- 🚚 Logistics management
- ⚖️ Dispute resolution system
- 🔔 Real-time notifications

---

**Made with ❤️ by the Lango Market Pulse Team**
