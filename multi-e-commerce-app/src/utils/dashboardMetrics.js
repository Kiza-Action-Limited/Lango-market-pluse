export const PAID_ORDER_STATUSES = new Set(['payment_escrowed', 'processing', 'dispatched', 'delivered', 'completed']);

export const isPaidOrder = (order) => PAID_ORDER_STATUSES.has(order?.status) || order?.paymentStatus === 'completed';

export const getOrderAmount = (order) => Number(order?.totalAmount ?? order?.total ?? order?.amount ?? 0);

export const getOrderLocation = (order) =>
  order?.deliveryAddress?.city ||
  order?.deliveryAddress?.town ||
  order?.deliveryAddress?.county ||
  order?.shippingAddress?.city ||
  order?.shippingAddress?.town ||
  order?.customer?.campus ||
  order?.buyer?.campus ||
  order?.customer?.location ||
  order?.buyer?.location ||
  'Unknown';

export const formatCompactNumber = (value) => {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
};

export const buildSalesByLocation = (orders = [], limit = 6) => {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - 28);
  const previousStart = new Date(currentStart);
  previousStart.setDate(currentStart.getDate() - 28);

  const byLocation = new Map();

  orders.filter(isPaidOrder).forEach((order) => {
    const createdAt = order?.createdAt ? new Date(order.createdAt) : now;
    const amount = getOrderAmount(order);
    const label = getOrderLocation(order);
    const row = byLocation.get(label) || { label, current: 0, previous: 0 };

    if (createdAt >= currentStart) {
      row.current += amount || 1;
    } else if (createdAt >= previousStart && createdAt < currentStart) {
      row.previous += amount || 1;
    }

    byLocation.set(label, row);
  });

  const rows = Array.from(byLocation.values()).filter((row) => row.current > 0);
  const max = Math.max(...rows.map((row) => row.current), 1);

  return rows
    .sort((a, b) => b.current - a.current)
    .slice(0, limit)
    .map((row) => {
      const trendValue = row.previous > 0 ? ((row.current - row.previous) / row.previous) * 100 : row.current > 0 ? 100 : 0;
      return {
        label: row.label,
        pct: (row.current / max) * 100,
        trend: `${trendValue >= 0 ? '+' : ''}${trendValue.toFixed(1)}%`,
      };
    });
};

export const buildReviewSummary = (products = [], verifiedPurchases = 0) => {
  const reviews = products.flatMap((product) =>
    (product?.reviews || []).map((review) => ({
      ...review,
      productName: product?.name,
    }))
  );

  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((review) => {
    const rating = Math.max(1, Math.min(5, Math.round(Number(review?.rating) || 0)));
    ratingCounts[rating] += 1;
  });

  const total = reviews.length;
  const average = total
    ? reviews.reduce((sum, review) => sum + Number(review?.rating || 0), 0) / total
    : 0;
  const latest = [...reviews].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))[0];

  return {
    total,
    average,
    ratingCounts,
    verifiedPurchases,
    latest: latest
      ? {
          title: latest.productName || 'Customer feedback',
          comment: latest.comment,
          author: latest.user?.fullName || latest.user?.name || 'Verified customer',
          date: latest.createdAt ? new Date(latest.createdAt).toLocaleDateString() : '',
        }
      : null,
  };
};

export const buildStoreVisitSources = ({ orders = [], usersTotal = 0, productsTotal = 0 } = {}) => {
  const sourceCounts = new Map();
  orders.forEach((order) => {
    const rawSource = order?.source || order?.trafficSource || order?.referrer || order?.channel;
    if (!rawSource) return;
    const source = String(rawSource).toLowerCase();
    const label =
      source.includes('social') ? 'Social' :
      source.includes('email') ? 'Email' :
      source.includes('refer') ? 'Referrals' :
      source.includes('direct') ? 'Direct' :
      'Other';
    sourceCounts.set(label, (sourceCounts.get(label) || 0) + 1);
  });

  const labels = ['Direct', 'Social', 'Email', 'Referrals', 'Other'];
  const colors = ['#F97316', '#3B82F6', '#16A34A', '#8B5CF6', '#6B7280'];
  const totalSourceCount = Array.from(sourceCounts.values()).reduce((sum, count) => sum + count, 0);
  const fallback = [42, 24, 16, 11, 7];
  const totalVisitors = Math.max(Number(usersTotal) || 0, orders.length, productsTotal);

  return {
    totalLabel: formatCompactNumber(totalVisitors),
    sources: labels.map((label, index) => ({
      label,
      value: totalSourceCount ? ((sourceCounts.get(label) || 0) / totalSourceCount) * 100 : fallback[index],
      color: colors[index],
    })),
  };
};
