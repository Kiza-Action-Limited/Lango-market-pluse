import React, { lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import ErrorBoundary from './components/ErrorBoundary';
import { prefetchHomeData } from './services/homeDataService';

import ProtectedRoute from './components/ProtectedRoute';
import SellerRoute from './components/SellerRoute';
import AdminRoute from './components/AdminRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import SellerLayout from './layouts/SellerLayout';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const Profile = lazy(() => import('./pages/Profile'));
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'));
const Categories = lazy(() => import('./pages/Categories'));
const Wishlist = lazy(() => import('./pages/Wishlists'));
const Reviews = lazy(() => import('./pages/Reviews'));
const About = lazy(() => import('./pages/About'));
const NotFound = lazy(() => import('./pages/NotFound'));
const SubscriptionPlans = lazy(() => import('./pages/SubscriptionPlans'));
const FAQ = lazy(() => import('./pages/FAQ'));
const ShippingInfo = lazy(() => import('./pages/ShippingInfo'));
const Returns = lazy(() => import('./pages/Returns'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Contact = lazy(() => import('./pages/Contact'));
const Business = lazy(() => import('./pages/Business'));
const BusinessDirectory = lazy(() => import('./pages/BusinessDirectory'));
const BusinessProfile = lazy(() => import('./pages/BusinessProfile'));
const AISourcingHub = lazy(() => import('./pages/AISourcingHub'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const SellerProducts = lazy(() => import('./pages/SellerProducts'));
const AddProduct = lazy(() => import('./pages/AddProduct'));
const EditProduct = lazy(() => import('./pages/EditProduct'));
const SellerOrders = lazy(() => import('./pages/SellerOrders'));
const RegionalScarcityBoard = lazy(() => import('./pages/RegionalScarcityBoard'));
const SellerPremiumVerification = lazy(() => import('./pages/SellerPremiumVerification'));
const SellerPremiumPayment = lazy(() => import('./pages/SellerPremiumPayment'));
const LogisticsApplication = lazy(() => import('./pages/LogisticsApplication'));
const LogisticsStatus = lazy(() => import('./pages/LogisticsStatus'));
const LogisticsOperations = lazy(() => import('./pages/LogisticsOperations'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminCategories = lazy(() => import('./pages/AdminCategories'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));
const AdminProducts = lazy(() => import('./pages/AdminProducts'));
const AdminSubscriptions = lazy(() => import('./pages/AdminSubscriptions'));
const AdminContactQueue = lazy(() => import('./pages/AdminContactQueue'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminProfile = lazy(() => import('./pages/AdminProfile'));
const AdminLogistics = lazy(() => import('./pages/AdminLogistics'));
const AdminFinanceAudit = lazy(() => import('./pages/AdminFinanceAudit'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

function App() {
  useEffect(() => {
    prefetchHomeData();
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <CartProvider>
            <NotificationProvider>
              <SubscriptionProvider>
                <Toaster position="top-right" />
                <Routes>
                  <Route path="/" element={<MainLayout />}>
                      <Route index element={<Home />} />
                      <Route element={<PublicOnlyRoute />}>
                        <Route path="login" element={<Login />} />
                        <Route path="register" element={<Register />} />
                      </Route>
                      <Route path="forgot-password" element={<ForgotPassword />} />
                      <Route path="products" element={<Products />} />
                      <Route path="business" element={<Business />} />
                      <Route path="manufacturers" element={<Navigate to="/business" replace />} />
                      <Route path="businesses" element={<BusinessDirectory />} />
                      <Route path="businesses/:businessId" element={<BusinessProfile />} />
                      <Route path="products/:id" element={<ProductDetail />} />
                      <Route path="categories" element={<Categories />} />
                      <Route path="about" element={<About />} />
                      <Route path="contact" element={<Contact />} />
                      <Route path="faq" element={<FAQ />} />
                      <Route path="shipping" element={<ShippingInfo />} />
                      <Route path="returns" element={<Returns />} />
                      <Route path="privacy" element={<PrivacyPolicy />} />
                      <Route path="cart" element={<Cart />} />
                      <Route path="products/:id/reviews" element={<Reviews />} />
                      <Route path="ai-sourcing" element={<AISourcingHub />} />

                      <Route element={<ProtectedRoute />}>
                        <Route path="checkout" element={<Checkout />} />
                        <Route path="orders" element={<Orders />} />
                        <Route path="orders/:id/track" element={<OrderTracking />} />
                        <Route path="profile" element={<Profile />} />
                        <Route path="notifications/preferences" element={<NotificationPreferences />} />
                        <Route path="wishlist" element={<Wishlist />} />
                        <Route path="logistics/apply" element={<LogisticsApplication />} />
                        <Route path="logistics/status" element={<LogisticsStatus />} />
                        <Route path="logistics/dashboard" element={<LogisticsStatus />} />
                        <Route path="logistics/tools" element={<LogisticsOperations />} />
                      </Route>

                      <Route element={<SellerRoute />}>
                        <Route path="seller/profile" element={<Profile />} />
                        <Route path="seller" element={<SellerLayout />}>
                          <Route index element={<SellerDashboard />} />
                          <Route path="home" element={<Home />} />
                          <Route path="add-product" element={<AddProduct />} />
                          <Route path="edit-product/:id" element={<EditProduct />} />
                          <Route path="products" element={<SellerProducts />} />
                          <Route path="orders" element={<SellerOrders />} />
                          <Route path="scarcity-board" element={<RegionalScarcityBoard />} />
                          <Route path="subscription-plans" element={<SubscriptionPlans />} />
                          <Route path="premium-payment" element={<SellerPremiumPayment />} />
                          <Route path="premium-verification" element={<SellerPremiumVerification />} />
                        </Route>
                      </Route>

                      <Route path="admin" element={<AdminLogin />} />

                      <Route element={<AdminRoute />}>
                        <Route path="admin/profile" element={<AdminProfile />} />
                        <Route path="admin" element={<AdminLayout />}>
                          <Route path="dashboard" element={<AdminDashboard />} />
                          <Route path="users" element={<AdminUsers />} />
                          <Route path="categories" element={<AdminCategories />} />
                          <Route path="orders" element={<AdminOrders />} />
                          <Route path="products" element={<AdminProducts />} />
                          <Route path="subscriptions" element={<AdminSubscriptions />} />
                          <Route path="analytics" element={<AdminAnalytics />} />
                          <Route path="logistics" element={<AdminLogistics />} />
                          <Route path="logistics-tools" element={<LogisticsOperations />} />
                          <Route path="finance-audit" element={<AdminFinanceAudit />} />
                          <Route path="contact-queue" element={<AdminContactQueue />} />
                        </Route>
                      </Route>

                      <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </SubscriptionProvider>
            </NotificationProvider>
          </CartProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
