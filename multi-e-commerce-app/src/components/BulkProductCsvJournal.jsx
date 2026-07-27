import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaCheckCircle, FaDownload, FaFileCsv, FaImage, FaSpinner, FaTimesCircle, FaTrash, FaUpload } from 'react-icons/fa';
import { PRODUCT_CATEGORY_OPTIONS, getAutoLowStockThreshold } from '../utils/inventorySensitivity';

const MAX_ROWS = 50;
const JOURNAL_LIMIT = 8;
const MAX_PRODUCT_IMAGES = 10;
const MAX_RAW_IMAGE_SIZE_MB = 20;
const MAX_UPLOAD_IMAGE_SIZE_MB = 10;
const TARGET_IMAGE_SIZE_BYTES = 1600 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_COMPRESSION_QUALITY = 0.82;
const SAMPLE_HEADERS = [
  'name',
  'description',
  'price',
  'quantityAvailable',
  'category',
  'unit',
  'minThreshold',
  'minimumOrderQuantity',
  'rfqEnabled',
  'wholesaleTerms',
  'priceTiers',
  'warehouseStatus',
  'locationHub',
  'isPublished',
  'sku',
  'imageUrls',
];
const SAMPLE_ROWS = [
  [
    'Kenyan White Maize - Dry',
    'Clean dry white maize for wholesale buyers',
    '4800',
    '120',
    'grains-cereals',
    'kg',
    '50',
    '10',
    'true',
    'Bulk bags available',
    '10:4800|50:4550',
    'seller_storage',
    'Nairobi Industrial Area',
    'true',
    'MAIZE-001',
    '',
  ],
  [
    'Premium Fresh Tomatoes',
    'Grade A fresh tomatoes packed for same-day dispatch',
    '180',
    '75',
    'vegetables',
    'kg',
    '18',
    '5',
    'true',
    'Crates available on request',
    '5:180|25:165',
    'seller_storage',
    'Kisumu Market Hub',
    'true',
    'TOMATO-001',
    '',
  ],
];
const CATEGORY_VALUES = new Set(PRODUCT_CATEGORY_OPTIONS.map((category) => category.value));
const UNIT_VALUES = new Set(['kg', 'g', 'ton', 'piece', 'bunch', 'litre']);
const WAREHOUSE_VALUES = new Set(['seller_storage', 'warehouse_pending', 'warehouse_received', 'dispatch_ready', 'restricted']);

const isCompressibleImage = (file) => (
  file?.type?.startsWith('image/') &&
  !['image/gif', 'image/svg+xml'].includes(file.type)
);

const replaceFileExtension = (name, extension) => {
  const safeName = String(name || 'product-image').replace(/\.[^/.]+$/, '');
  return `${safeName}.${extension}`;
};

const loadImageFile = (file) => new Promise((resolve, reject) => {
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(imageUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    reject(new Error('Unable to read image'));
  };
  image.src = imageUrl;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
  canvas.toBlob((blob) => resolve(blob), type, quality);
});

const optimizeProductImage = async (file) => {
  if (!isCompressibleImage(file)) return file;

  try {
    const image = await loadImageFile(file);
    const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestSide);
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

    if (scale === 1 && file.size <= TARGET_IMAGE_SIZE_BYTES) {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_COMPRESSION_QUALITY);

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], replaceFileExtension(file.name, 'webp'), {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Image optimization skipped:', error);
    return file;
  }
};

const revokePreview = (preview) => {
  if (typeof preview === 'string' && preview.startsWith('blob:')) {
    URL.revokeObjectURL(preview);
  }
};

const revokeRowImages = (rowImages = {}) => {
  Object.values(rowImages).forEach((entry) => {
    (entry?.previews || []).forEach(revokePreview);
  });
};

const escapeCsvCell = (value = '') => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseCsv = (csvText = '') => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) rows.push(row);
  return rows;
};

const parseBoolean = (value, fallback = true) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  return ['true', 'yes', 'y', '1', 'active', 'published'].includes(text);
};

const parsePriceTiers = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((tier) => ({
          minQuantity: Number(tier.minQuantity),
          unitPrice: Number(tier.unitPrice),
          label: tier.label || '',
        }))
        .filter((tier) => Number.isFinite(tier.minQuantity) && Number.isFinite(tier.unitPrice));
    }
  } catch (error) {
    // Also accept a compact entry like 10:100|50:95.
  }

  return text
    .split('|')
    .map((part) => {
      const [quantity, price, label = ''] = part.split(':').map((item) => item.trim());
      return {
        minQuantity: Number(quantity),
        unitPrice: Number(price),
        label,
      };
    })
    .filter((tier) => Number.isFinite(tier.minQuantity) && Number.isFinite(tier.unitPrice));
};

const normalizeRow = (row, rowNumber) => {
  const name = String(row.name || '').trim();
  const category = String(row.category || 'other').trim() || 'other';
  const price = Number(row.price);
  const quantityAvailable = Number(row.quantityAvailable ?? row.stock ?? row.quantity ?? 0);
  const minThresholdValue = String(row.minThreshold ?? '').trim();
  const minimumOrderQuantity = Number(row.minimumOrderQuantity || 1);
  const unit = String(row.unit || 'piece').trim().toLowerCase();
  const warehouseStatus = String(row.warehouseStatus || 'seller_storage').trim();
  const normalized = {
    rowNumber,
    name,
    description: String(row.description || '').trim(),
    price,
    quantityAvailable,
    category,
    unit,
    minThreshold: minThresholdValue === '' ? getAutoLowStockThreshold({ name, category }) : Number(minThresholdValue),
    minimumOrderQuantity,
    rfqEnabled: parseBoolean(row.rfqEnabled, true),
    wholesaleTerms: String(row.wholesaleTerms || '').trim(),
    priceTiers: parsePriceTiers(row.priceTiers),
    warehouseStatus,
    locationHub: String(row.locationHub || '').trim(),
    isPublished: parseBoolean(row.isPublished, true),
    sku: String(row.sku || row.trackingSku || '').trim(),
    imageUrls: String(row.imageUrls || row.images || '')
      .split('|')
      .map((url) => url.trim())
      .filter(Boolean),
  };
  const errors = [];

  if (!name) errors.push('name is required');
  if (!Number.isFinite(price) || price < 0) errors.push('price must be 0 or more');
  if (!Number.isFinite(quantityAvailable) || quantityAvailable < 0) errors.push('quantityAvailable must be 0 or more');
  if (!CATEGORY_VALUES.has(category)) errors.push(`category must be one of: ${Array.from(CATEGORY_VALUES).join(', ')}`);
  if (!UNIT_VALUES.has(unit)) errors.push(`unit must be one of: ${Array.from(UNIT_VALUES).join(', ')}`);
  if (!Number.isFinite(normalized.minThreshold) || normalized.minThreshold < 0) errors.push('minThreshold must be 0 or more');
  if (!Number.isFinite(minimumOrderQuantity) || minimumOrderQuantity < 1) errors.push('minimumOrderQuantity must be 1 or more');
  if (!WAREHOUSE_VALUES.has(warehouseStatus)) errors.push(`warehouseStatus must be one of: ${Array.from(WAREHOUSE_VALUES).join(', ')}`);

  return { ...normalized, errors };
};

const buildFormData = (product, extraFields = {}) => {
  const formData = new FormData();
  const append = (key, value) => {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  };

  append('name', product.name);
  append('description', product.description);
  append('price', product.price);
  append('quantityAvailable', product.quantityAvailable);
  append('minThreshold', product.minThreshold);
  append('minimumOrderQuantity', product.minimumOrderQuantity);
  append('rfqEnabled', product.rfqEnabled);
  append('wholesaleTerms', product.wholesaleTerms);
  append('priceTiers', JSON.stringify(product.priceTiers));
  append('warehouseStatus', product.warehouseStatus);
  append('category', product.category);
  append('unit', product.unit);
  append('locationHub', product.locationHub);
  append('isPublished', product.isPublished);
  append('sku', product.sku);
  append('imageUrls', JSON.stringify(product.imageUrls));

  (product.uploadImages || []).forEach((image) => {
    if (image instanceof File) {
      formData.append('images', image);
    }
  });

  Object.entries(extraFields).forEach(([key, value]) => append(key, value));
  return formData;
};

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getJournal = (storageKey) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveJournalEntry = (storageKey, entry) => {
  const next = [entry, ...getJournal(storageKey)].slice(0, JOURNAL_LIMIT);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
};

const BulkProductCsvJournal = ({
  title = 'Seller Journal',
  description = 'Upload a CSV list to add up to 50 products at once.',
  storageKey = 'marketpulse_product_csv_journal_v1',
  createProduct,
  disabled = false,
  disabledMessage = '',
  extraFields = {},
  onComplete,
}) => {
  const fileInputRef = useRef(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [journal, setJournal] = useState(() => getJournal(storageKey));
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState([]);
  const [rowImages, setRowImages] = useState({});
  const rowImagesRef = useRef({});

  const validRows = useMemo(() => parsedRows.filter((row) => row.errors.length === 0), [parsedRows]);
  const invalidRows = parsedRows.length - validRows.length;

  useEffect(() => {
    rowImagesRef.current = rowImages;
  }, [rowImages]);

  useEffect(() => () => {
    revokeRowImages(rowImagesRef.current);
  }, []);

  const handleTemplateDownload = () => {
    downloadCsv('product_bulk_upload_template.csv', [SAMPLE_HEADERS, ...SAMPLE_ROWS]);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setResults([]);
    revokeRowImages(rowImagesRef.current);
    setRowImages({});

    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const text = await file.text();
    const csvRows = parseCsv(text);
    const [headers = [], ...dataRows] = csvRows;
    const normalizedHeaders = headers.map((header) => String(header || '').trim());
    const rowsToParse = dataRows.slice(0, MAX_ROWS);

    if (dataRows.length > MAX_ROWS) {
      toast.error(`Only the first ${MAX_ROWS} products were loaded`);
    }

    const nextRows = rowsToParse.map((cells, index) => {
      const rawRow = normalizedHeaders.reduce((acc, header, cellIndex) => {
        acc[header] = cells[cellIndex] ?? '';
        return acc;
      }, {});
      return normalizeRow(rawRow, index + 2);
    });

    setParsedRows(nextRows);
    toast.success(`${nextRows.length} product row${nextRows.length === 1 ? '' : 's'} loaded`);
  };

  const handleRowImageChange = async (rowNumber, files) => {
    const incomingFiles = Array.from(files || []);
    if (!incomingFiles.length) return;

    const row = parsedRows.find((item) => item.rowNumber === rowNumber);
    const existing = rowImages[rowNumber] || { files: [], previews: [] };
    const remoteImageCount = row?.imageUrls?.length || 0;
    const availableSlots = MAX_PRODUCT_IMAGES - remoteImageCount - existing.files.length;

    if (availableSlots <= 0) {
      toast.error(`Maximum ${MAX_PRODUCT_IMAGES} images allowed per product`);
      return;
    }

    const rawLimitBytes = MAX_RAW_IMAGE_SIZE_MB * 1024 * 1024;
    const uploadLimitBytes = MAX_UPLOAD_IMAGE_SIZE_MB * 1024 * 1024;
    const validFiles = incomingFiles.slice(0, availableSlots).filter((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > rawLimitBytes) {
        toast.error(`${file.name} exceeds ${MAX_RAW_IMAGE_SIZE_MB}MB limit`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    try {
      const optimizedFiles = await Promise.all(validFiles.map(optimizeProductImage));
      const uploadableFiles = optimizedFiles.filter((file) => {
        if (file.size > uploadLimitBytes) {
          toast.error(`${file.name} is still larger than ${MAX_UPLOAD_IMAGE_SIZE_MB}MB after optimization`);
          return false;
        }
        return true;
      });
      const previews = uploadableFiles.map((file) => URL.createObjectURL(file));

      setRowImages((current) => ({
        ...current,
        [rowNumber]: {
          files: [...(current[rowNumber]?.files || []), ...uploadableFiles],
          previews: [...(current[rowNumber]?.previews || []), ...previews],
        },
      }));

      if (uploadableFiles.length < incomingFiles.length) {
        toast.error(`Only ${uploadableFiles.length} image${uploadableFiles.length === 1 ? '' : 's'} attached for row ${rowNumber}`);
      }
    } catch (error) {
      console.error('Error preparing bulk product images:', error);
      toast.error('Failed to prepare images for upload');
    }
  };

  const removeRowImage = (rowNumber, imageIndex) => {
    setRowImages((current) => {
      const entry = current[rowNumber];
      if (!entry) return current;
      revokePreview(entry.previews[imageIndex]);
      return {
        ...current,
        [rowNumber]: {
          files: entry.files.filter((_, index) => index !== imageIndex),
          previews: entry.previews.filter((_, index) => index !== imageIndex),
        },
      };
    });
  };

  const handleSubmit = async () => {
    if (disabled) {
      toast.error(disabledMessage || 'Bulk upload is disabled');
      return;
    }
    if (!validRows.length) {
      toast.error('Upload a CSV with at least one valid product');
      return;
    }

    setSubmitting(true);
    const batchResults = [];

    for (const product of validRows) {
      try {
        await createProduct(buildFormData({
          ...product,
          uploadImages: rowImages[product.rowNumber]?.files || [],
        }, extraFields), product);
        batchResults.push({ rowNumber: product.rowNumber, name: product.name, status: 'created' });
      } catch (error) {
        batchResults.push({
          rowNumber: product.rowNumber,
          name: product.name,
          status: 'failed',
          message: error.response?.data?.message || error.message || 'Failed to create product',
        });
      }
      setResults([...batchResults]);
    }

    const created = batchResults.filter((result) => result.status === 'created').length;
    const failed = batchResults.length - created;
    const entry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      requested: validRows.length,
      created,
      failed,
      invalid: invalidRows,
    };

    setJournal(saveJournalEntry(storageKey, entry));
    setSubmitting(false);
    toast[failed ? 'error' : 'success'](`${created} product${created === 1 ? '' : 's'} created${failed ? `, ${failed} failed` : ''}`);
    if (created > 0) onComplete?.();
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">{title}</p>
          <h2 className="mt-1 text-lg font-bold text-[#111827]">Bulk product CSV upload</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTemplateDownload}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FaDownload />
            Template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#111827] px-3 text-sm font-semibold text-white hover:bg-black"
          >
            <FaFileCsv />
            Upload CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
        </div>
      </div>

      {disabled && disabledMessage && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
          {disabledMessage}
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#111827]">
                Preview: {validRows.length} valid, {invalidRows} needs attention
              </p>
              <p className="mt-1 text-xs text-gray-500">Attach images per row before creating products. Images use the same size checks and optimization as single product upload.</p>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || disabled || validRows.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <FaSpinner className="animate-spin" /> : <FaUpload />}
              {submitting ? 'Creating...' : `Create ${validRows.length} Products`}
            </button>
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Row</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Product</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Images</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Category</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Price</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Stock</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {parsedRows.map((row) => (
                  <tr key={`${row.rowNumber}-${row.name}`}>
                    <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                    <td className="max-w-56 px-3 py-2">
                      <p className="truncate font-semibold text-[#111827]" title={row.name}>{row.name || 'Missing name'}</p>
                      <p className="truncate text-xs text-gray-500" title={row.description}>{row.description || 'No description'}</p>
                    </td>
                    <td className="min-w-56 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {(rowImages[row.rowNumber]?.previews || []).map((preview, imageIndex) => (
                          <span key={preview} className="group relative h-10 w-10 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                            <img src={preview} alt={`${row.name} ${imageIndex + 1}`} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeRowImage(row.rowNumber, imageIndex)}
                              className="absolute inset-0 hidden items-center justify-center bg-black/55 text-white group-hover:flex"
                              aria-label={`Remove image ${imageIndex + 1} from row ${row.rowNumber}`}
                            >
                              <FaTrash size={12} />
                            </button>
                          </span>
                        ))}
                        {row.imageUrls.length > 0 && (
                          <span className="inline-flex h-8 items-center rounded-full bg-blue-50 px-2 text-xs font-semibold text-blue-700">
                            {row.imageUrls.length} URL{row.imageUrls.length === 1 ? '' : 's'}
                          </span>
                        )}
                        <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          <FaImage />
                          Add
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => {
                              handleRowImageChange(row.rowNumber, event.target.files);
                              event.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.category}</td>
                    <td className="px-3 py-2 text-gray-700">{Number.isFinite(row.price) ? row.price : '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{Number.isFinite(row.quantityAvailable) ? row.quantityAvailable : '-'}</td>
                    <td className="px-3 py-2">
                      {row.errors.length ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700" title={row.errors.join('; ')}>
                          <FaTimesCircle />
                          Fix row
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                          <FaCheckCircle />
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {results.slice(-6).map((result) => (
            <div key={`${result.rowNumber}-${result.name}`} className={`rounded-md border p-3 text-sm ${result.status === 'created' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              <p className="font-semibold">Row {result.rowNumber}: {result.name}</p>
              <p className="mt-1">{result.status === 'created' ? 'Created' : result.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#111827]">Upload journal</p>
          <span className="text-xs text-gray-500">Last {JOURNAL_LIMIT} batches</span>
        </div>
        {journal.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {journal.map((entry) => (
              <div key={entry.id} className="rounded-md bg-white p-3 text-xs shadow-sm">
                <p className="font-semibold text-[#111827]">{new Date(entry.createdAt).toLocaleString()}</p>
                <p className="mt-1 text-gray-600">{entry.created} created, {entry.failed} failed</p>
                <p className="text-gray-500">{entry.invalid} invalid rows skipped</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No CSV batches uploaded yet.</p>
        )}
      </div>
    </section>
  );
};

export default BulkProductCsvJournal;
