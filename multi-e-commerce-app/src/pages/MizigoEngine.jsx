import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBalanceScale,
  FaBoxOpen,
  FaChartLine,
  FaClipboardList,
  FaFileInvoice,
  FaLock,
  FaMapMarkerAlt,
  FaQrcode,
  FaShippingFast,
  FaSyncAlt,
  FaTruck,
  FaWarehouse,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { logisticsService } from '../services/logisticsService';
import paymentService from '../services/paymentService';
import { formatCurrency } from '../utils/formatters';

const ESCROW_STATES = ['PENDING', 'HELD', 'PARTIAL_RELEASE', 'DISBURSED'];

const readFirst = (source, keys, fallback = undefined) => {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => acc?.[part], source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
};

const rowsFrom = (payload, keys) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    const value = readFirst(payload, [key]);
    if (Array.isArray(value)) return value;
  }
  return [];
};

const safe = async (request) => {
  try {
    return { ok: true, data: await request };
  } catch (error) {
    return { ok: false, error };
  }
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const normalizeEscrowState = (value) => {
  const status = normalizeStatus(value);
  if (['disbursed', 'released', 'paid_out', 'completed'].includes(status)) return 'DISBURSED';
  if (['partial_release', 'partially_released', 'partial'].includes(status)) return 'PARTIAL_RELEASE';
  if (['held', 'funds_held', 'payment_escrowed', 'escrowed'].includes(status)) return 'HELD';
  return 'PENDING';
};

const getOrderDestination = (order) =>
  readFirst(order, [
    'shippingAddress.city',
    'shippingAddress.town',
    'deliveryAddress.city',
    'destination',
    'deliveryZone',
    'region',
  ], 'Unspecified destination');

const getOrderWeight = (order) => {
  const directWeight = Number(readFirst(order, ['weightKg', 'totalWeightKg', 'shipment.weightKg'], 0));
  if (directWeight > 0) return directWeight;
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, item) => {
    const itemWeight = Number(readFirst(item, ['weightKg', 'product.weightKg'], 0));
    const quantity = Number(item.quantity || 1);
    return sum + itemWeight * quantity;
  }, 0);
};

const getProductStock = (product) => Number(product?.quantityAvailable ?? product?.stock ?? product?.quantity ?? product?.inventory ?? 0);

const getProductInventoryGraph = (product) => {
  const graph = Array.isArray(product?.inventoryGraph)
    ? product.inventoryGraph
    : Array.isArray(product?.inventoryHistory)
      ? product.inventoryHistory
      : [];

  if (graph.length > 0) {
    return graph.map((point) => ({
      onHand: Number(point.onHand ?? point.quantityAvailable ?? point.quantity ?? 0),
      available: Number(point.available ?? point.availableQuantity ?? point.onHand ?? 0),
      reserved: Number(point.reserved ?? point.reservedQuantity ?? 0),
      recordedAt: point.recordedAt || point.createdAt,
    })).slice(-10);
  }

  const stock = getProductStock(product);
  return [{ onHand: stock, available: stock, reserved: Number(product?.reservedQuantity || 0) }];
};

const QuantityBars = ({ product }) => {
  const points = getProductInventoryGraph(product);
  const maxValue = Math.max(...points.map((point) => point.onHand), 1);

  return (
    <div>
      <div className="flex h-12 min-w-32 items-end gap-1">
        {points.map((point, index) => (
          <div
            key={`${point.recordedAt || 'inventory'}-${index}`}
            title={`${point.onHand} on hand, ${point.available} available, ${point.reserved} reserved`}
            className="flex-1 rounded-t bg-[#F97316]"
            style={{ height: `${Math.max(6, (point.onHand / maxValue) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{getProductStock(product)} {product?.unit || 'units'}</p>
    </div>
  );
};

const Section = ({ title, description, icon: Icon, children, action }) => (
  <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FFF7ED] text-[#F97316]">
          <Icon />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Kpi = ({ label, value, detail, icon: Icon }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-[#111827]">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{detail}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F3F4F6] text-[#F97316]">
        <Icon />
      </div>
    </div>
  </div>
);

const EmptyState = ({ children }) => (
  <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
    {children}
  </div>
);

const DataStatus = ({ label, result }) => {
  const ok = result?.ok;
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
      {label}: {ok ? 'live' : 'unavailable'}
    </span>
  );
};

const MizigoEngine = () => {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [results, setResults] = useState({
    products: null,
    orders: null,
    trips: null,
    adminTrips: null,
    escrowSummary: null,
    escrowTransactions: null,
    qrStats: null,
    deliveryStats: null,
  });

  const loadLiveData = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    const role = String(user?.role || '').toLowerCase();
    const orderRole = role === 'seller' ? 'seller' : 'buyer';

    const requests = {
      products: safe(productService.getAll({ page: 1, limit: 100, sortBy: 'newest' })),
      orders: safe(orderService.getAll({ role: orderRole, page: 1, limit: 100 })),
      trips: safe(logisticsService.getDriverTrips({ page: 1, limit: 100 })),
      adminTrips: isAdmin
        ? safe(logisticsService.getAdminLogisticsTrips({ page: 1, limit: 100 }))
        : Promise.resolve({ ok: false, error: new Error('Admin logistics endpoint is role restricted') }),
      escrowSummary: safe(paymentService.getEscrowSummary()),
      escrowTransactions: safe(paymentService.getEscrowTransactions()),
      qrStats: safe(logisticsService.getQrTokenStats()),
      deliveryStats: safe(logisticsService.getDeliveryStats()),
    };

    const entries = await Promise.all(Object.entries(requests).map(async ([key, request]) => [key, await request]));
    const settled = Object.fromEntries(entries);

    setResults(settled);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);

    const failures = Object.values(settled).filter((result) => !result.ok).length;
    if (!silent && failures > 0) {
      toast(`Loaded live data with ${failures} unavailable source${failures === 1 ? '' : 's'}.`, { icon: '!' });
    }
  }, [isAdmin, user?.role]);

  useEffect(() => {
    loadLiveData();
    const interval = window.setInterval(() => {
      loadLiveData({ silent: true });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadLiveData]);

  const products = useMemo(
    () => rowsFrom(results.products?.data, ['products', 'data.products', 'data', 'items']),
    [results.products]
  );
  const orders = useMemo(
    () => rowsFrom(results.orders?.data, ['orders', 'data.orders', 'data', 'items']),
    [results.orders]
  );
  const trips = useMemo(() => {
    const driverTrips = rowsFrom(results.trips?.data, ['data', 'logistics', 'trips']);
    const adminTrips = rowsFrom(results.adminTrips?.data, ['logistics', 'data', 'trips']);
    return adminTrips.length ? adminTrips : driverTrips;
  }, [results.trips, results.adminTrips]);
  const escrowTransactions = useMemo(
    () => rowsFrom(results.escrowTransactions?.data, ['transactions', 'data.transactions', 'data', 'items']),
    [results.escrowTransactions]
  );

  const skuProducts = products.filter((product) => readFirst(product, ['sku', 'SKU', 'stockKeepingUnit']));
  const moqProducts = products.filter((product) =>
    readFirst(product, ['moq', 'minimumOrderQuantity', 'minOrderQuantity', 'wholesale.minimumOrderQuantity'])
  );
  const rfqReadyProducts = products.filter((product) =>
    Boolean(readFirst(product, ['rfqEnabled', 'allowRfq', 'wholesale.rfqEnabled'], false))
  );

  const pooledOrders = useMemo(() => {
    const groups = new Map();
    orders.forEach((order) => {
      const destination = getOrderDestination(order);
      const existing = groups.get(destination) || { destination, orders: [], totalWeight: 0, totalValue: 0 };
      existing.orders.push(order);
      existing.totalWeight += getOrderWeight(order);
      existing.totalValue += Number(readFirst(order, ['total', 'totalAmount', 'grandTotal'], 0));
      groups.set(destination, existing);
    });
    return Array.from(groups.values()).sort((a, b) => b.orders.length - a.orders.length);
  }, [orders]);

  const activeTripCapacity = useMemo(() => {
    return trips
      .map((trip) => {
        const capacity = Number(readFirst(trip, ['maxCapacityKg', 'capacityKg', 'vehicle.capacityKg'], 0));
        const used = Number(readFirst(trip, ['currentLoadKg', 'usedCapacityKg', 'loadWeightKg', 'weightKg'], 0));
        return {
          id: trip._id || trip.id,
          route: readFirst(trip, ['routeName', 'destination', 'currentLocation', 'pickupAddress.city'], 'Unspecified route'),
          status: readFirst(trip, ['status'], 'pending'),
          capacity,
          used,
          percent: capacity > 0 ? Math.round((used / capacity) * 100) : null,
        };
      })
      .filter((trip) => trip.capacity > 0 || trip.used > 0)
      .slice(0, 6);
  }, [trips]);

  const escrowStateCounts = useMemo(() => {
    return escrowTransactions.reduce((acc, tx) => {
      const state = normalizeEscrowState(readFirst(tx, ['status', 'escrowStatus', 'state']));
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});
  }, [escrowTransactions]);

  const qrBackedTrips = trips.filter((trip) =>
    readFirst(trip, ['pickedUpAt', 'pickupScannedAt', 'deliveredAt', 'deliveryScannedAt', 'qrScanEvents', 'scanHistory'])
  );

  const topProductDemand = useMemo(() => {
    const counts = new Map();
    orders.forEach((order) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      items.forEach((item) => {
        const name = readFirst(item, ['name', 'product.name', 'productName'], 'Unnamed item');
        const quantity = Number(item.quantity || 0);
        const current = counts.get(name) || { name, quantity: 0 };
        current.quantity += quantity;
        counts.set(name, current);
      });
    });
    return Array.from(counts.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  }, [orders]);

  const ratingRows = useMemo(() => {
    return trips
      .map((trip) => ({
        id: trip._id || trip.id,
        route: readFirst(trip, ['routeName', 'destination', 'currentLocation'], 'Unspecified route'),
        buyerRating: readFirst(trip, ['buyerRating', 'ratings.buyer']),
        driverRating: readFirst(trip, ['driverRating', 'ratings.driver']),
        sellerRating: readFirst(trip, ['sellerRating', 'ratings.seller']),
      }))
      .filter((row) => row.buyerRating || row.driverRating || row.sellerRating)
      .slice(0, 8);
  }, [trips]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-6">
        <div className="mx-auto max-w-7xl text-sm text-gray-600">Loading live Mizigo data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Real-time frontend console</p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">Plan 4 Mizigo Engine</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Live B2B wholesaling, pooling, escrow, QR validation, and seller ecosystem views using existing API data only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              {lastUpdated ? `Live ${lastUpdated.toLocaleTimeString()}` : 'Live'}
            </span>
            <button
              type="button"
              onClick={() => loadLiveData({ silent: true })}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <DataStatus label="Products" result={results.products} />
          <DataStatus label="Orders" result={results.orders} />
          <DataStatus label="Logistics" result={results.adminTrips?.ok ? results.adminTrips : results.trips} />
          <DataStatus label="Escrow" result={results.escrowTransactions} />
          <DataStatus label="QR" result={results.qrStats} />
          <DataStatus label="Delivery stats" result={results.deliveryStats} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={FaBoxOpen} label="Live Products" value={products.length} detail={`${moqProducts.length} with MOQ fields`} />
          <Kpi icon={FaClipboardList} label="Order Pool" value={orders.length} detail={`${pooledOrders.length} destination groupings`} />
          <Kpi icon={FaTruck} label="Logistics Trips" value={trips.length} detail={`${activeTripCapacity.length} with capacity data`} />
          <Kpi icon={FaLock} label="Escrow Records" value={escrowTransactions.length} detail="from live escrow endpoint" />
        </div>

        <Section
          icon={FaBalanceScale}
          title="B2B Wholesaling Engine"
          description="MOQ, tier pricing, and RFQ readiness are shown only from live product fields."
        >
          {products.length === 0 ? (
            <EmptyState>No live products returned by the API.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3">Product</th>
                    <th className="pb-3">SKU</th>
                    <th className="pb-3">MOQ</th>
                    <th className="pb-3">Tier Pricing</th>
                    <th className="pb-3">Inventory Graph</th>
                    <th className="pb-3">RFQ</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 12).map((product) => {
                    const id = product._id || product.id || product.slug || product.name;
                    const sku = readFirst(product, ['sku', 'trackingSku', 'SKU', 'stockKeepingUnit'], 'API field required');
                    const moq = readFirst(product, ['moq', 'minimumOrderQuantity', 'minOrderQuantity', 'wholesale.minimumOrderQuantity'], 'API field required');
                    const tiers = readFirst(product, ['priceTiers', 'volumePricing', 'moqPricing', 'tieredPricing'], null);
                    const rfqEnabled = Boolean(readFirst(product, ['rfqEnabled', 'allowRfq', 'wholesale.rfqEnabled'], false));
                    return (
                      <tr key={id} className="border-b last:border-b-0">
                        <td className="py-3 font-medium text-[#111827]">{product.name || product.title || 'Unnamed product'}</td>
                        <td className="py-3 text-gray-600">{sku}</td>
                        <td className="py-3 text-gray-600">{moq}</td>
                        <td className="py-3 text-gray-600">{Array.isArray(tiers) ? `${tiers.length} tiers` : 'API field required'}</td>
                        <td className="py-3"><QuantityBars product={product} /></td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${rfqEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {rfqEnabled ? 'Enabled' : 'API field required'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section
            icon={FaWarehouse}
            title="Virtual Warehousing"
            description="Tracks real SKU and location fields when the product API exposes them."
          >
            {skuProducts.length === 0 ? (
              <EmptyState>No live SKU/location inventory fields found. Required fields: SKU plus current location, hub status, or GPS coordinates.</EmptyState>
            ) : (
              <div className="space-y-2">
                {skuProducts.slice(0, 8).map((product) => {
                  const id = product._id || product.id || product.sku || product.trackingSku;
                  const location = readFirst(product, ['currentLocation', 'warehouseLocation', 'inventoryLocation', 'hubStatus'], 'Location API field required');
                  const gps = readFirst(product, ['gps', 'gpsCoords', 'location.coordinates'], null);
                  return (
                    <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                      <div>
                        <p className="font-medium text-[#111827]">{readFirst(product, ['sku', 'trackingSku', 'SKU', 'stockKeepingUnit'])}</p>
                        <p className="text-xs text-gray-500">{product.name || product.title}</p>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <p>{location}</p>
                        <p className="text-xs">{gps ? JSON.stringify(gps) : 'GPS API field required'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            icon={FaShippingFast}
            title="Plan 4 Mizigo Pooling"
            description="Groups live orders by returned destination fields and shows truck utilization when capacity data exists."
          >
            {pooledOrders.length === 0 ? (
              <EmptyState>No live orders available for pooling.</EmptyState>
            ) : (
              <div className="space-y-3">
                {pooledOrders.slice(0, 6).map((pool) => (
                  <div key={pool.destination} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-[#111827]">{pool.destination}</p>
                        <p className="text-xs text-gray-500">{pool.orders.length} order{pool.orders.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-[#111827]">{formatCurrency(pool.totalValue)}</p>
                        <p className="text-xs text-gray-500">{pool.totalWeight > 0 ? `${pool.totalWeight.toFixed(1)} kg` : 'Weight API field required'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {activeTripCapacity.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {activeTripCapacity.map((trip) => (
                      <div key={trip.id} className="rounded-md border border-gray-200 p-3">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-[#111827]">{trip.route}</span>
                          <span className="text-gray-500">{trip.percent === null ? 'Capacity API field required' : `${trip.percent}%`}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-[#F97316]" style={{ width: `${Math.min(trip.percent || 0, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section
            icon={FaLock}
            title="Asynchronous 3-Way M-Pesa Escrow"
            description="Escrow state machine and payout records are derived from live escrow transactions."
          >
            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              Total Escrow = Seller Payouts + Driver Fares + Platform Commissions
            </div>
            {escrowTransactions.length === 0 ? (
              <EmptyState>No live escrow transaction records returned.</EmptyState>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {ESCROW_STATES.map((state) => (
                    <div key={state} className="rounded-md border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{state}</p>
                      <p className="mt-1 text-xl font-bold text-[#111827]">{escrowStateCounts[state] || 0}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {escrowTransactions.slice(0, 6).map((tx, index) => (
                    <div key={tx._id || tx.id || index} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3 text-sm">
                      <div>
                        <p className="font-medium text-[#111827]">{readFirst(tx, ['orderNumber', 'orderId', 'reference'], 'Escrow transaction')}</p>
                        <p className="text-xs text-gray-500">{normalizeEscrowState(readFirst(tx, ['status', 'escrowStatus', 'state']))}</p>
                      </div>
                      <p className="font-semibold text-[#111827]">{formatCurrency(Number(readFirst(tx, ['amount', 'totalAmount', 'value'], 0)))}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section
            icon={FaQrcode}
            title="Cryptographic QR Handshakes"
            description="Shows live QR stats and trip scan evidence when exposed by the API."
          >
            {results.qrStats?.ok && results.qrStats?.data ? (
              <pre className="max-h-48 overflow-auto rounded-md bg-[#111827] p-3 text-xs leading-5 text-green-100">
                {JSON.stringify(results.qrStats.data, null, 2)}
              </pre>
            ) : (
              <EmptyState>QR stats endpoint is unavailable for this user or not implemented.</EmptyState>
            )}
            <div className="mt-3 space-y-2">
              {qrBackedTrips.length > 0 ? qrBackedTrips.slice(0, 5).map((trip) => (
                <div key={trip._id || trip.id} className="rounded-md border border-gray-200 p-3 text-sm">
                  <p className="font-medium text-[#111827]">{readFirst(trip, ['orderNumber', 'routeName', '_id', 'id'])}</p>
                  <p className="text-xs text-gray-500">
                    Pickup: {readFirst(trip, ['pickedUpAt', 'pickupScannedAt'], 'not returned')} | Delivery: {readFirst(trip, ['deliveredAt', 'deliveryScannedAt'], 'not returned')}
                  </p>
                </div>
              )) : (
                <EmptyState>No live trip scan fields found. Required fields include pickupScannedAt, deliveryScannedAt, or scanHistory.</EmptyState>
              )}
            </div>
          </Section>
        </div>

        <Section
          icon={FaChartLine}
          title="Operational Ecosystem Upgrades"
          description="Demand signals, verified trip statements, cross-dock timing, and feedback loops from live data only."
          action={<Link to="/logistics/status" className="text-sm font-medium text-[#F97316] hover:text-[#EA580C]">Open logistics dashboard</Link>}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#111827]">Demand Forecasting Inputs</h3>
              {topProductDemand.length ? topProductDemand.map((item) => (
                <div key={item.name} className="mb-2 rounded-md border border-gray-200 p-3 text-sm">
                  <p className="font-medium text-[#111827]">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.quantity} ordered units in visible live orders</p>
                </div>
              )) : <EmptyState>No order item quantities returned for live demand signals.</EmptyState>}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#111827]">Verified Trip Statements</h3>
              {trips.length ? (
                <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-600">
                  {trips.length} live trip record{trips.length === 1 ? '' : 's'} available. Monthly CSV generation requires a backend statement endpoint.
                </div>
              ) : <EmptyState>No trip records returned.</EmptyState>}
              <h3 className="mb-2 mt-4 text-sm font-semibold text-[#111827]">Cross-Dock Timing</h3>
              {trips.some((trip) => readFirst(trip, ['hubArrivedAt', 'crossDockArrivedAt', 'crossDockDepartedAt'])) ? (
                trips.slice(0, 4).map((trip) => (
                  <div key={trip._id || trip.id} className="mb-2 rounded-md border border-gray-200 p-3 text-xs text-gray-600">
                    Arrival: {readFirst(trip, ['hubArrivedAt', 'crossDockArrivedAt'], 'not returned')} | Departure: {readFirst(trip, ['crossDockDepartedAt'], 'not returned')}
                  </div>
                ))
              ) : <EmptyState>No live cross-dock arrival/departure timestamps returned.</EmptyState>}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#111827]">3-Way Feedback Loop</h3>
              {ratingRows.length ? ratingRows.map((row) => (
                <div key={row.id} className="mb-2 rounded-md border border-gray-200 p-3 text-sm">
                  <p className="font-medium text-[#111827]">{row.route}</p>
                  <p className="text-xs text-gray-500">Buyer {row.buyerRating || '-'} | Driver {row.driverRating || '-'} | Seller {row.sellerRating || '-'}</p>
                </div>
              )) : <EmptyState>No live buyer, driver, and seller rating fields returned yet.</EmptyState>}
            </div>
          </div>
        </Section>

        <Section
          icon={FaFileInvoice}
          title="Backend Contract Visibility"
          description="This frontend intentionally avoids virtual data. Missing parts below require API fields or endpoints."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <EmptyState>RFQ submission requires a real RFQ endpoint and returned quote negotiation records.</EmptyState>
            <EmptyState>Short-lived QR hashes with GPS telemetry require token issue, expiry, and verification fields.</EmptyState>
            <EmptyState>72-hour dispute freeze requires escrow dispute window and freeze expiry fields.</EmptyState>
            <EmptyState>Decoupled M-Pesa B2C callbacks require worker status and payout callback visibility endpoints.</EmptyState>
          </div>
        </Section>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <FaMapMarkerAlt className="text-[#F97316]" />
          <span>Signed in as {user?.name || user?.email || user?.phone || 'current user'}. Data shown depends on your role and backend permissions.</span>
        </div>
      </div>
    </div>
  );
};

export default MizigoEngine;
