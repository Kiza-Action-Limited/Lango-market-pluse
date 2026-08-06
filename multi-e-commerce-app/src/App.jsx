import React, { lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
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
import BuyerLayout from './layouts/BuyerLayout';
import AdminLayout from './layouts/AdminLayout';
import SellerLayout from './layouts/SellerLayout';
import LogisticsLayout from './layouts/LogisticsLayout';
import { isBuyerUser, isLogisticsUser } from './utils/userCategory';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const BuyerDashboard = lazy(() => import('./pages/BuyerDashboard'));
const BuyerRFQInbox = lazy(() => import('./pages/BuyerRFQInbox'));
const BuyerSellers = lazy(() => import('./pages/BuyerSellers'));
const BuyerReviews = lazy(() => import('./pages/BuyerReviews'));
const BuyerProductAlerts = lazy(() => import('./pages/BuyerProductAlerts'));
const BuyerLogisticsPreference = lazy(() => import('./pages/BuyerLogisticsPreference'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const Profile = lazy(() => import('./pages/Profile'));
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'));
const SupportInbox = lazy(() => import('./pages/SupportInbox'));
const Categories = lazy(() => import('./pages/Categories'));
const Wishlist = lazy(() => import('./pages/Wishlists'));
const Reviews = lazy(() => import('./pages/Reviews'));
const About = lazy(() => import('./pages/About'));
const NotFound = lazy(() => import('./pages/NotFound'));
const SubscriptionPlans = lazy(() => import('./pages/SubscriptionPlans'));
const SellerPlansLanding = lazy(() => import('./pages/SellerPlansLanding'));
const FAQ = lazy(() => import('./pages/FAQ'));
const ShippingInfo = lazy(() => import('./pages/ShippingInfo'));
const Returns = lazy(() => import('./pages/Returns'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Contact = lazy(() => import('./pages/Contact'));
const Business = lazy(() => import('./pages/Business'));
const BusinessDirectory = lazy(() => import('./pages/BusinessDirectory'));
const BusinessProfile = lazy(() => import('./pages/BusinessProfile'));
const AISourcingHub = lazy(() => import('./pages/AISourcingHub'));
const MizigoEngine = lazy(() => import('./pages/MizigoEngine'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const SellerProducts = lazy(() => import('./pages/SellerProducts'));
const SellerJournal = lazy(() => import('./pages/SellerJournal'));
const AddProduct = lazy(() => import('./pages/AddProduct'));
const EditProduct = lazy(() => import('./pages/EditProduct'));
const SellerOrders = lazy(() => import('./pages/SellerOrders'));
const SellerRFQs = lazy(() => import('./pages/SellerRFQs'));
const SellerFinance = lazy(() => import('./pages/SellerFinance'));
const SellerLogisticsRequests = lazy(() => import('./pages/SellerLogisticsRequests'));
const RegionalScarcityBoard = lazy(() => import('./pages/RegionalScarcityBoard'));
const SellerPremiumVerification = lazy(() => import('./pages/SellerPremiumVerification'));
const SellerPremiumPayment = lazy(() => import('./pages/SellerPremiumPayment'));
const LogisticsApplication = lazy(() => import('./pages/LogisticsApplication'));
const LogisticsStatus = lazy(() => import('./pages/LogisticsStatus'));
const LogisticsOperations = lazy(() => import('./pages/LogisticsOperations'));
const LogisticsQrScanner = lazy(() => import('./pages/LogisticsQrScanner'));
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
const AdminHomepageAds = lazy(() => import('./pages/AdminHomepageAds'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

const HomeEntry = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-white" />
    );
  }

  if (!loading && isAuthenticated) {
    if (isBuyerUser(user)) return <Navigate to="/buyer" replace />;
    if (isLogisticsUser(user)) return <Navigate to="/logistics/dashboard" replace />;
  }

  return <Home />;
};

const MizigoAccessRoute = () => {
  const { user } = useAuth();

  if (isBuyerUser(user)) {
    return <Navigate to="/buyer" replace />;
  }

  return <MizigoEngine />;
};

const LegacyOrderTrackingRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/buyer/orders/${id}/track`} replace />;
};

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

                {/* Public Routes */}
                <Routes>
                  <Route path="/" element={<MainLayout />}>
                      <Route index element={<HomeEntry />} />
                      <Route element={<PublicOnlyRoute />}>
                        <Route path="login" element={<Login />} />
                        <Route path="buyer/login" element={<Login />} />
                        <Route path="seller/login" element={<Login />} />
                        <Route path="logistics/login" element={<Login />} />
                        <Route path="register" element={<Register />} />
                      </Route>
                      <Route path="forgot-password" element={<ForgotPassword />} />
                      <Route path="products" element={<Products />} />
                      <Route path="business" element={<Business />} />
                      <Route path="seller-plans" element={<SellerPlansLanding />} />
                      <Route path="seller-subscription-plans" element={<Navigate to="/seller-plans" replace />} />
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


                      {/* Protected Routes */}

                      <Route element={<ProtectedRoute />}>
                        <Route path="checkout" element={<Checkout />} />
                        <Route path="orders" element={<Navigate to="/buyer/orders" replace />} />
                        <Route path="orders/:id/track" element={<LegacyOrderTrackingRedirect />} />
                        <Route path="buyer" element={<BuyerLayout />}>
                          <Route index element={<BuyerDashboard />} />
                          <Route path="orders" element={<Orders />} />
                          <Route path="orders/:id/track" element={<OrderTracking />} />
                          <Route path="rfqs" element={<BuyerRFQInbox />} />
                          <Route path="sellers" element={<BuyerSellers />} />
                          <Route path="logistics" element={<BuyerLogisticsPreference />} />
                          <Route path="reviews" element={<BuyerReviews />} />
                          <Route path="product-alerts" element={<BuyerProductAlerts />} />
                          <Route path="profile" element={<Profile />} />
                          <Route path="support" element={<SupportInbox />} />
                          <Route path="notifications/preferences" element={<NotificationPreferences />} />
                          <Route path="wishlist" element={<Wishlist />} />
                        </Route>
                        <Route path="profile" element={<Profile />} />
                        <Route path="support" element={<SupportInbox />} />
                        <Route path="notifications/preferences" element={<NotificationPreferences />} />
                        <Route path="wishlist" element={<Wishlist />} />
                        <Route path="mizigo-engine" element={<MizigoAccessRoute />} />
                        <Route path="plan-4-mizigo" element={<MizigoAccessRoute />} />
                        <Route path="logistics" element={<LogisticsLayout />}>
                          <Route index element={<Navigate to="/logistics/dashboard" replace />} />
                          <Route path="apply" element={<LogisticsApplication />} />
                          <Route path="status" element={<LogisticsStatus section="status" />} />
                          <Route path="dashboard" element={<LogisticsStatus />} />
                          <Route path="assignments" element={<LogisticsStatus section="assignments" />} />
                          <Route path="driver-scanner" element={<LogisticsQrScanner mode="driver" />} />
                          <Route path="hub-scanner" element={<LogisticsQrScanner mode="hub" />} />
                          <Route path="tools" element={<LogisticsOperations />} />
                          <Route path="profile" element={<Profile />} />
                          <Route path="support" element={<SupportInbox />} />
                        </Route>
                      </Route>

                      {/* Seller Routes */}

                      <Route element={<SellerRoute />}>
                        <Route path="seller/profile" element={<Profile />} />
                        <Route path="seller" element={<SellerLayout />}>
                          <Route index element={<SellerDashboard />} />
                          <Route path="add-product" element={<AddProduct />} />
                          <Route path="edit-product/:id" element={<EditProduct />} />
                          <Route path="products" element={<SellerProducts />} />
                          <Route path="journal" element={<SellerJournal />} />
                          <Route path="orders" element={<SellerOrders />} />
                          <Route path="logistics-requests" element={<SellerLogisticsRequests />} />
                          <Route path="rfqs" element={<SellerRFQs />} />
                          <Route path="finance" element={<SellerFinance />} />
                          <Route path="support" element={<SupportInbox />} />
                          <Route path="scarcity-board" element={<RegionalScarcityBoard />} />
                          <Route path="subscription-plans" element={<SubscriptionPlans />} />
                          <Route path="premium-payment" element={<SellerPremiumPayment />} />
                          <Route path="premium-verification" element={<SellerPremiumVerification />} />
                        </Route>
                      </Route>

                      {/* Admin Routes */}

                      <Route path="admin" element={<AdminLogin />} />

                      <Route element={<AdminRoute />}>
                        <Route element={<AdminLayout />}>
                          <Route path="admin/dashboard" element={<AdminDashboard />} />
                          <Route path="admin/documents" element={<AdminDashboard section="documents" />} />
                          <Route path="admin/agent-referrals" element={<AdminDashboard section="agent-referrals" />} />
                          <Route path="admin/users" element={<AdminUsers />} />
                          <Route path="admin/categories" element={<AdminCategories />} />
                          <Route path="admin/homepage-ads" element={<AdminHomepageAds />} />
                          <Route path="admin/orders" element={<AdminOrders />} />
                          <Route path="admin/products" element={<AdminProducts />} />
                          <Route path="admin/subscriptions" element={<AdminSubscriptions />} />
                          <Route path="admin/analytics" element={<AdminAnalytics />} />
                          <Route path="admin/logistics" element={<AdminLogistics />} />
                          <Route path="admin/logistics-tools" element={<LogisticsOperations />} />
                          <Route path="admin/finance-audit" element={<AdminFinanceAudit />} />
                          <Route path="admin/profile" element={<AdminProfile />} />
                          <Route path="admin/contact-queue" element={<AdminContactQueue />} />
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
