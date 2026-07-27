import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaBook,
  FaBox,
  FaCheckCircle,
  FaPlus,
  FaReceipt,
  FaSave,
  FaShoppingCart,
  FaSyncAlt,
  FaWarehouse,
} from 'react-icons/fa';
import { productService } from '../services/productService';
import { sellerJournalService } from '../services/sellerJournalService';
import { formatCurrency } from '../utils/formatters';
import { PRODUCT_CATEGORY_OPTIONS, getAutoLowStockThreshold, getEffectiveLowStockThreshold } from '../utils/inventorySensitivity';

const units = ['kg', 'g', 'ton', 'piece', 'bunch', 'litre'];
const paymentMethods = ['cash', 'mpesa', 'bank', 'card', 'credit', 'mixed'];

const initialProductForm = {
  name: '',
  description: '',
  price: '',
  quantityAvailable: '',
  minThreshold: '',
  minimumOrderQuantity: '1',
  category: 'grocery',
  unit: 'piece',
  locationHub: '',
  sku: '',
  isPublished: true,
};

const initialSaleForm = {
  productId: '',
  quantity: '',
  unitPrice: '',
  partyName: '',
  partyPhone: '',
  paymentMethod: 'cash',
  category: 'Walk-in sale',
  reference: '',
  notes: '',
};

const getProductId = (product) => product?._id || product?.id;
const getStock = (product) => Number(product?.quantityAvailable ?? product?.stock ?? product?.quantity ?? product?.inventory ?? 0);
const getSku = (product) => product?.sku || product?.trackingSku || product?.SKU || product?.stockKeepingUnit || 'SKU pending';
const formatLabel = (value) => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const buildProductFormData = (form) => {
  const threshold = form.minThreshold === ''
    ? getAutoLowStockThreshold({ name: form.name, category: form.category })
    : Number(form.minThreshold);
  const data = new FormData();

  data.append('name', form.name.trim());
  data.append('description', form.description.trim());
  data.append('price', Number(form.price));
  data.append('quantityAvailable', Number(form.quantityAvailable));
  data.append('minThreshold', threshold);
  data.append('minimumOrderQuantity', Number(form.minimumOrderQuantity || 1));
  data.append('rfqEnabled', true);
  data.append('wholesaleTerms', '');
  data.append('priceTiers', JSON.stringify([]));
  data.append('warehouseStatus', 'seller_storage');
  data.append('category', form.category);
  data.append('unit', form.unit);
  data.append('locationHub', form.locationHub.trim());
  data.append('sku', form.sku.trim());
  data.append('isPublished', form.isPublished);

  return data;
};

const SellerJournal = () => {
  const [products, setProducts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalSummary, setJournalSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [saleForm, setSaleForm] = useState(initialSaleForm);

  const selectedProduct = useMemo(
    () => products.find((product) => String(getProductId(product)) === String(saleForm.productId)),
    [products, saleForm.productId]
  );
  const saleQuantity = Number(saleForm.quantity || 0);
  const saleUnitPrice = Number(saleForm.unitPrice || selectedProduct?.price || 0);
  const currentStock = getStock(selectedProduct);
  const stockAfterSale = selectedProduct ? Math.max(0, currentStock - saleQuantity) : 0;
  const saleTotal = Math.max(0, saleQuantity * saleUnitPrice);

  const fetchJournalData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [productsRes, journalRes] = await Promise.all([
        productService.getMyProducts({ page: 1, limit: 100 }),
        sellerJournalService.list({ limit: 20 }),
      ]);
      setProducts(Array.isArray(productsRes?.data) ? productsRes.data : []);
      setJournalEntries(Array.isArray(journalRes?.data) ? journalRes.data : []);
      setJournalSummary(journalRes?.summary || null);
    } catch (error) {
      console.error('Error loading seller journal:', error);
      toast.error(error.response?.data?.message || 'Failed to load seller journal');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalData();
  }, []);

  const handleProductChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProductForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSaleChange = (event) => {
    const { name, value } = event.target;
    setSaleForm((current) => ({ ...current, [name]: value }));
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    const price = Number(productForm.price);
    const quantity = Number(productForm.quantityAvailable);

    if (!productForm.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid product price');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error('Enter a valid inventory quantity');
      return;
    }

    setSavingProduct(true);
    try {
      await productService.create(buildProductFormData(productForm));
      toast.success('Product added to inventory');
      setProductForm(initialProductForm);
      fetchJournalData({ silent: true });
    } catch (error) {
      console.error('Error adding product from seller journal:', error);
      toast.error(error.response?.data?.message || 'Failed to add product');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProduct) {
      toast.error('Select the product sold offline');
      return;
    }
    if (!Number.isFinite(saleQuantity) || saleQuantity <= 0) {
      toast.error('Enter a sale quantity greater than zero');
      return;
    }
    if (saleQuantity > currentStock) {
      toast.error('Offline sale quantity is higher than current stock');
      return;
    }
    if (!Number.isFinite(saleUnitPrice) || saleUnitPrice < 0) {
      toast.error('Enter a valid selling price');
      return;
    }

    setSavingSale(true);
    try {
      await sellerJournalService.create({
        entryType: 'offline_sale',
        productId: saleForm.productId,
        adjustmentMode: 'subtract',
        inventoryAction: 'decrease',
        quantity: saleQuantity,
        unitPrice: saleUnitPrice,
        amount: saleTotal,
        affectsMainAccount: saleForm.paymentMethod !== 'credit',
        partyName: saleForm.partyName,
        partyPhone: saleForm.partyPhone,
        partyType: 'offline_customer',
        paymentMethod: saleForm.paymentMethod,
        category: saleForm.category,
        reference: saleForm.reference,
        notes: saleForm.notes,
      });
      toast.success('Offline sale recorded and inventory updated');
      setSaleForm(initialSaleForm);
      fetchJournalData({ silent: true });
    } catch (error) {
      console.error('Error recording offline sale:', error);
      toast.error(error.response?.data?.message || 'Failed to record offline sale');
    } finally {
      setSavingSale(false);
    }
  };

  const inventoryValue = products.reduce((sum, product) => sum + (Number(product?.price || 0) * getStock(product)), 0);
  const lowStockCount = products.filter((product) => {
    const stock = getStock(product);
    return stock > 0 && stock <= getEffectiveLowStockThreshold(product);
  }).length;
  const offlineSalesToday = Number(journalSummary?.today?.sales || 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Seller journal</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">Offline Sales & Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">Add stock items and record customer sales that happen outside the platform.</p>
        </div>
        <button
          type="button"
          onClick={() => fetchJournalData({ silent: true })}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FaSyncAlt />
          Refresh
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <FaBox className="text-[#F97316]" />
          <p className="mt-3 text-xs font-semibold uppercase text-gray-500">Products</p>
          <p className="text-2xl font-bold text-[#111827]">{products.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <FaWarehouse className="text-blue-600" />
          <p className="mt-3 text-xs font-semibold uppercase text-gray-500">Inventory Value</p>
          <p className="text-xl font-bold text-[#111827]">{formatCurrency(inventoryValue)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <FaShoppingCart className="text-green-600" />
          <p className="mt-3 text-xs font-semibold uppercase text-gray-500">Offline Sales Today</p>
          <p className="text-xl font-bold text-[#111827]">{formatCurrency(offlineSalesToday)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <FaReceipt className="text-amber-600" />
          <p className="mt-3 text-xs font-semibold uppercase text-gray-500">Low Stock</p>
          <p className="text-2xl font-bold text-[#111827]">{lowStockCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <form onSubmit={handleProductSubmit} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Add Product to Inventory</h2>
              <p className="text-sm text-gray-500">Create a product record and starting stock quantity.</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F97316]/10 text-[#F97316]">
              <FaPlus />
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#111827] sm:col-span-2">
              Product name
              <input name="name" value={productForm.name} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" required />
            </label>
            <label className="block text-sm font-semibold text-[#111827] sm:col-span-2">
              Description
              <textarea name="description" value={productForm.description} onChange={handleProductChange} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]" />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Price
              <input name="price" type="number" min="0" step="0.01" value={productForm.price} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" required />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Starting stock
              <input name="quantityAvailable" type="number" min="0" step="0.001" value={productForm.quantityAvailable} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" required />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Category
              <select name="category" value={productForm.category} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]">
                {PRODUCT_CATEGORY_OPTIONS.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Unit
              <select name="unit" value={productForm.unit} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]">
                {units.map((unit) => <option key={unit} value={unit}>{formatLabel(unit)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Low stock alert
              <input name="minThreshold" type="number" min="0" step="1" value={productForm.minThreshold} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Auto" />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              MOQ
              <input name="minimumOrderQuantity" type="number" min="1" step="1" value={productForm.minimumOrderQuantity} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              SKU
              <input name="sku" value={productForm.sku} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Optional" />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Location hub
              <input name="locationHub" value={productForm.locationHub} onChange={handleProductChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Nairobi, Kakuma..." />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <input name="isPublished" type="checkbox" checked={productForm.isPublished} onChange={handleProductChange} className="h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]" />
            Publish product after saving
          </label>

          <button type="submit" disabled={savingProduct} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
            <FaSave />
            {savingProduct ? 'Saving...' : 'Add Product'}
          </button>
        </form>

        <form onSubmit={handleSaleSubmit} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Record Offline Customer Sale</h2>
              <p className="text-sm text-gray-500">Use this for walk-in customers, phone orders, or cash/M-Pesa sales outside the site.</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-green-50 text-green-700">
              <FaShoppingCart />
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#111827] sm:col-span-2">
              Product sold
              <select name="productId" value={saleForm.productId} onChange={handleSaleChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={getProductId(product)} value={getProductId(product)}>
                    {product.name} - stock {getStock(product)} {product.unit || ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Quantity sold
              <input name="quantity" type="number" min="0.001" step="0.001" value={saleForm.quantity} onChange={handleSaleChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" required />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Selling price
              <input name="unitPrice" type="number" min="0" step="0.01" value={saleForm.unitPrice} onChange={handleSaleChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" placeholder={selectedProduct?.price || '0'} />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Customer name
              <input name="partyName" value={saleForm.partyName} onChange={handleSaleChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Optional" />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Customer phone
              <input name="partyPhone" value={saleForm.partyPhone} onChange={handleSaleChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Optional" />
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Payment
              <select name="paymentMethod" value={saleForm.paymentMethod} onChange={handleSaleChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]">
                {paymentMethods.map((method) => <option key={method} value={method}>{formatLabel(method)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#111827]">
              Reference
              <input name="reference" value={saleForm.reference} onChange={handleSaleChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Receipt or M-Pesa code" />
            </label>
            <label className="block text-sm font-semibold text-[#111827] sm:col-span-2">
              Notes
              <textarea name="notes" value={saleForm.notes} onChange={handleSaleChange} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]" placeholder="Delivery, customer, discount, or location notes" />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Current stock</p>
              <p className="font-bold text-[#111827]">{selectedProduct ? `${currentStock} ${selectedProduct.unit || ''}` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Stock after sale</p>
              <p className="font-bold text-[#111827]">{selectedProduct ? `${stockAfterSale} ${selectedProduct.unit || ''}` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sale total</p>
              <p className="font-bold text-green-700">{formatCurrency(saleTotal)}</p>
            </div>
          </div>

          <button type="submit" disabled={savingSale} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60">
            <FaReceipt />
            {savingSale ? 'Recording...' : 'Record Offline Sale'}
          </button>
        </form>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <FaBook className="text-[#F97316]" />
            <h2 className="text-lg font-bold text-[#111827]">Recent Journal Entries</h2>
          </div>
          <div className="space-y-2">
            {journalEntries.slice(0, 10).map((entry) => (
              <div key={entry.id || entry._id || `${entry.entryType}-${entry.createdAt}`} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#111827]">{entry.product?.name || entry.productName || formatLabel(entry.entryType)}</p>
                    <p className="mt-1 text-xs text-gray-500">{entry.partyName || entry.customerName || 'Offline customer'} {entry.reference ? `- ${entry.reference}` : ''}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#111827]">
                    {formatLabel(entry.entryType)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                  <span>{Number(entry.stockDelta || 0) >= 0 ? '+' : ''}{entry.stockDelta || 0} {entry.unit || entry.product?.unit || ''}</span>
                  <span>{formatCurrency(entry.totalAmount || entry.amount || 0)}</span>
                  <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                </div>
              </div>
            ))}
            {!journalEntries.length && <p className="text-sm text-gray-500">No offline activity recorded yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-7">
          <div className="mb-3 flex items-center gap-2">
            <FaCheckCircle className="text-green-600" />
            <h2 className="text-lg font-bold text-[#111827]">Inventory Watch</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {products.slice(0, 8).map((product) => {
              const stock = getStock(product);
              const threshold = getEffectiveLowStockThreshold(product);
              const low = threshold > 0 && stock <= threshold;
              return (
                <div key={getProductId(product)} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#111827]">{product.name}</p>
                      <p className="mt-1 truncate font-mono text-xs text-gray-500">{getSku(product)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${low ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      {low ? 'low' : 'ok'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">On hand</span>
                    <strong className="text-[#111827]">{stock} {product.unit || ''}</strong>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div className={`h-full rounded-full ${low ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, Math.max(4, (stock / Math.max(threshold, stock, 1)) * 100))}%` }} />
                  </div>
                </div>
              );
            })}
            {!products.length && <p className="text-sm text-gray-500">Add a product to start tracking inventory.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SellerJournal;
