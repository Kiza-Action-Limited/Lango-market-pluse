const normalizeText = (value = '') => String(value).toLowerCase();

export const predictSuppliersLocal = (suppliers = [], query = '') => {
  const q = normalizeText(query).trim();

  return suppliers.map((supplier, idx) => {
    const rating = Number(supplier.rating) || 0;
    const reviews = Number(supplier.reviews) || 0;
    const capabilityScore = Math.min(30, (supplier.capabilities?.length || 0) * 6);
    const ratingScore = Math.min(40, rating * 8);
    const reviewScore = Math.min(20, reviews / 5);
    const queryScore =
      q && (normalizeText(supplier.name).includes(q) || supplier.capabilities.some((cap) => normalizeText(cap).includes(q)))
        ? 10
        : 0;
    const confidence = Math.max(55, Math.min(99, Math.round(ratingScore + reviewScore + capabilityScore + queryScore)));

    const trend =
      confidence >= 88 ? 'High conversion potential' : confidence >= 75 ? 'Stable sourcing candidate' : 'Emerging supplier';

    const tags = [];
    if (rating >= 4.5) tags.push('Top Rated');
    if ((supplier.capabilities?.length || 0) >= 4) tags.push('Customization Ready');
    if (queryScore > 0) tags.push('Query Match');
    if (!tags.length) tags.push(idx % 2 === 0 ? 'Fast Response' : 'Competitive MOQ');

    return {
      supplierId: supplier.id,
      confidence,
      trend,
      tags: tags.slice(0, 3),
    };
  });
};

export const mergeSupplierPredictions = (suppliers = [], predictions = []) => {
  const byId = new Map(predictions.map((item) => [item.supplierId, item]));
  return suppliers.map((supplier) => ({
    ...supplier,
    aiPrediction: byId.get(supplier.id) || {
      supplierId: supplier.id,
      confidence: 60,
      trend: 'Insufficient signal',
      tags: ['Monitor'],
    },
  }));
};
