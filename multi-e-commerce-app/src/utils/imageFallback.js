export const createImageFallback = (label = 'Lango Market Plus') => {
  const safeLabel = String(label || 'Product')
    .replace(/[<>&"']/g, '')
    .slice(0, 28);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <rect width="600" height="600" fill="#F3F4F6"/>
      <circle cx="300" cy="245" r="96" fill="#FED7AA"/>
      <path d="M203 395c38-58 156-58 194 0" fill="none" stroke="#F97316" stroke-width="28" stroke-linecap="round"/>
      <text x="300" y="486" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#111827">${safeLabel}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const PRODUCT_IMAGE_FALLBACK = createImageFallback('Product image');
