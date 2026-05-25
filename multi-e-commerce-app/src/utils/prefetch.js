const prefetchedRoutes = new Set();

const routeImporters = {
  '/': () => import('../pages/Home'),
  '/products': () => import('../pages/Products'),
  '/login': () => import('../pages/Login'),
  '/register': () => import('../pages/Register'),
  '/seller': async () => {
    await Promise.all([import('../layouts/SellerLayout'), import('../pages/SellerDashboard')]);
  },
  '/admin': async () => {
    await Promise.all([import('../layouts/AdminLayout'), import('../pages/AdminDashboard')]);
  },
};

const normalizePath = (path) => {
  if (!path) return '/';
  const [base] = String(path).split('?');
  return base || '/';
};

export const prefetchRoute = (path) => {
  const normalized = normalizePath(path);
  const importer = routeImporters[normalized];
  if (!importer || prefetchedRoutes.has(normalized)) return;
  prefetchedRoutes.add(normalized);
  importer().catch(() => {
    prefetchedRoutes.delete(normalized);
  });
};

export const createPrefetchHandlers = (path) => ({
  onMouseEnter: () => prefetchRoute(path),
  onFocus: () => prefetchRoute(path),
  onTouchStart: () => prefetchRoute(path),
});
