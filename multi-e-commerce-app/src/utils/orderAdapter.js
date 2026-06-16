const getId = (value) => value?.id || value?._id || value;

const getImageUrl = (image) => {
  if (!image) return null;
  if (typeof image === 'string') return image;
  return image.url || null;
};

export const normalizeOrder = (order = {}) => {
  const id = getId(order);
  const product = order.product && typeof order.product === 'object' ? order.product : null;
  const productId = getId(product) || getId(order.product);
  const quantity = Number(order.quantity || 0);
  const unitPrice = Number(order.unitPrice ?? product?.price ?? 0);
  const total = Number(order.total ?? order.totalAmount ?? unitPrice * quantity);
  const deliveryAddress = order.shippingAddress || order.deliveryAddress || {};
  const buyer = order.buyer && typeof order.buyer === 'object' ? order.buyer : {};

  return {
    ...order,
    id,
    total,
    subtotal: Number(order.subtotal ?? total),
    shippingCost: Number(order.shippingCost ?? 0),
    items: Array.isArray(order.items) ? order.items : [
      {
        id: productId || id,
        productId,
        name: product?.name || 'Product',
        image: getImageUrl(product?.images?.[0] || product?.image),
        quantity,
        price: unitPrice,
      },
    ],
    shippingAddress: {
      fullName: order.shippingAddress?.fullName || buyer.fullName || buyer.name || '',
      addressLine1: order.shippingAddress?.addressLine1 || deliveryAddress.street || deliveryAddress.label || order.deliveryAddressText || '',
      addressLine2: order.shippingAddress?.addressLine2 || '',
      city: order.shippingAddress?.city || deliveryAddress.town || '',
      state: order.shippingAddress?.state || deliveryAddress.county || '',
      zipCode: order.shippingAddress?.zipCode || '',
      country: order.shippingAddress?.country || deliveryAddress.country || 'Kenya',
      phone: order.shippingAddress?.phone || buyer.phone || '',
    },
  };
};

export const normalizeTracking = (order = {}) => ({
  updates: (order.timeline || []).map((entry) => ({
    status: entry.status,
    timestamp: entry.timestamp,
    description: entry.note,
  })),
});
