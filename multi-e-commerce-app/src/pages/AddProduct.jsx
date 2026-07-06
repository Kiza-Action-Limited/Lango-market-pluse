// src/pages/AddProduct.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  FaStore, FaImage, FaTag, FaLayerGroup,
  FaWarehouse, FaSpinner, FaCloudUploadAlt, FaTrash,
  FaDollarSign, FaBoxes, FaMapMarkerAlt, FaExclamationTriangle,
  FaPlus
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { productService } from '../services/productService';
import { getUserCategoryLabel, isFarmerUser } from '../utils/userCategory';
import { getAutoLowStockThreshold, PRODUCT_CATEGORY_OPTIONS } from '../utils/inventorySensitivity';

const AddProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isFarmer = isFarmerUser(user);
  const userCategoryLabel = getUserCategoryLabel(user);
  const hasBusinessName = Boolean(String(user?.businessName || '').trim());
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [planUsage, setPlanUsage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantityAvailable: '',
    minThreshold: '',
    minimumOrderQuantity: '1',
    rfqEnabled: true,
    wholesaleTerms: '',
    priceTiers: [],
    warehouseStatus: 'seller_storage',
    category: '',
    unit: 'kg',
    locationHub: '',
    images: [],
    isPublished: true,
  });
  
  const [imagePreviews, setImagePreviews] = useState([]);
  const [errors, setErrors] = useState({});

  const categories = PRODUCT_CATEGORY_OPTIONS.concat([
    { value: 'electronics', label: 'Electronics', icon: '📱' },
    { value: 'fashion', label: 'Fashion', icon: '👗' },
    { value: 'home-garden', label: 'Home and Garden', icon: '🏡' },
    { value: 'beauty-health', label: 'Beauty and Health', icon: '💄' },
    { value: 'sports-outdoor', label: 'Sports and Outdoor', icon: '🏀' },
  ]).filter((category, index, list) => (
    list.findIndex((item) => item.value === category.value) === index
  ));

  const units = [
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'g', label: 'Gram (g)' },
    { value: 'ton', label: 'Ton' },
    { value: 'piece', label: 'Piece' },
    { value: 'bunch', label: 'Bunch' },
    { value: 'litre', label: 'Litre (L)' },
  ];

  const warehouseStatusOptions = [
    { value: 'seller_storage', label: 'Seller storage' },
    { value: 'warehouse_pending', label: 'Warehouse pending' },
    { value: 'warehouse_received', label: 'Warehouse received' },
    { value: 'dispatch_ready', label: 'Dispatch ready' },
    { value: 'restricted', label: 'Restricted hold' },
  ];
  const fulfillmentHubSuggestions = [
    'Nairobi Industrial Area',
    'Mombasa Port Hub',
    'Kisumu Market Hub',
    'Eldoret Dispatch Hub',
    'Kakuma Trade Hub',
    'Kitale Produce Hub',
    'Nakuru Distribution Hub',
    'Naivasha Logistics Hub',
    'Thika Industrial Hub',
    'Machakos Pickup Hub',
    'Meru Produce Hub',
    'Nyeri Market Hub',
    'Kisii Trade Hub',
    'Garissa Dispatch Hub',
  ];
  const autoLowStockThreshold = getAutoLowStockThreshold(formData);
  const hasReachedProductLimit = Boolean(planUsage && planUsage.remainingSlots !== null && Number(planUsage.remainingSlots) === 0 && !id);
  const isFreeProductLimit = Boolean(planUsage && !planUsage.currentPlan && Number(planUsage.productLimit) === 5);
  const productLimitMessage = isFreeProductLimit
    ? "You've reached your free 5 product limit. Upgrade your subscription to add more products."
    : 'Product limit reached. Upgrade your subscription to add more products.';

  useEffect(() => {
    checkPlanUsage();
    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    if (isFarmer && !formData.category) {
      setFormData((prev) => ({ ...prev, category: 'grocery' }));
    }
  }, [isFarmer, formData.category]);

  const checkPlanUsage = async () => {
    try {
      const response = await productService.getMyProducts({ page: 1, limit: 1 });
      if (response.planUsage) {
        setPlanUsage(response.planUsage);
        if (response.planUsage.remainingSlots === 0 && !id) {
          const reachedFreeLimit = !response.planUsage.currentPlan && Number(response.planUsage.productLimit) === 5;
          toast.error(
            reachedFreeLimit
              ? "You've reached your free 5 product limit. Upgrade your subscription to add more products."
              : 'Product limit reached. Upgrade your subscription to add more products.'
          );
        }
      }
    } catch (error) {
      console.error('Error checking plan usage:', error);
    }
  };

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const product = await productService.getById(id);
      
      // Extract image URLs from the product
      const imageUrls = product.images?.map(img => img.url || img) || [];
      
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        quantityAvailable: product.quantityAvailable || '',
        minThreshold: product.minThreshold ?? '',
        minimumOrderQuantity: product.minimumOrderQuantity ?? product.wholesale?.minimumOrderQuantity ?? 1,
        rfqEnabled: product.rfqEnabled ?? product.wholesale?.rfqEnabled ?? true,
        wholesaleTerms: product.wholesaleTerms ?? product.wholesale?.terms ?? '',
        priceTiers: Array.isArray(product.priceTiers)
          ? product.priceTiers
          : Array.isArray(product.wholesale?.priceTiers)
            ? product.wholesale.priceTiers
            : [],
        warehouseStatus: product.warehouseStatus || 'seller_storage',
        category: product.category || '',
        unit: product.unit || 'kg',
        locationHub: product.locationHub || '',
        images: product.images || [],
        isPublished: product.isPublished !== undefined ? product.isPublished : true,
      });
      
      setImagePreviews(imageUrls);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product');
      navigate('/seller/products');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }

    const price = Number(formData.price);
    if (formData.price === '' || Number.isNaN(price) || price < 0) {
      newErrors.price = 'Enter a valid price of 0 or more';
    }

    const quantity = Number(formData.quantityAvailable);
    if (formData.quantityAvailable === '' || Number.isNaN(quantity) || quantity < 0) {
      newErrors.quantityAvailable = 'Enter a valid stock quantity of 0 or more';
    }

    const threshold = Number(formData.minThreshold);
    if (formData.minThreshold !== '' && (Number.isNaN(threshold) || threshold < 0)) {
      newErrors.minThreshold = 'Enter a valid alert threshold of 0 or more';
    }

    const moq = Number(formData.minimumOrderQuantity);
    if (formData.minimumOrderQuantity === '' || Number.isNaN(moq) || moq < 1) {
      newErrors.minimumOrderQuantity = 'Enter an MOQ of at least 1';
    }

    const invalidTier = formData.priceTiers.some((tier) => {
      const minQuantity = Number(tier.minQuantity);
      const unitPrice = Number(tier.unitPrice);
      return !Number.isFinite(minQuantity) || minQuantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0;
    });
    if (invalidTier) {
      newErrors.priceTiers = 'Tier quantities must be at least 1 and prices cannot be negative';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }
    if (!formData.unit) {
      newErrors.unit = 'Please select a unit';
    }
    
    setErrors(newErrors);
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
  };

  const addPriceTier = () => {
    setFormData(prev => ({
      ...prev,
      priceTiers: [
        ...prev.priceTiers,
        { minQuantity: '', unitPrice: '', label: '' },
      ],
    }));
  };

  const updatePriceTier = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.map((tier, tierIndex) => (
        tierIndex === index ? { ...tier, [field]: value } : tier
      )),
    }));
    if (errors.priceTiers) {
      setErrors(prev => ({ ...prev, priceTiers: '' }));
    }
  };

  const removePriceTier = (index) => {
    setFormData(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.filter((_, tierIndex) => tierIndex !== index),
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const maxImages = 10;
    const maxImageSizeMb = 10;
    const maxImageSizeBytes = maxImageSizeMb * 1024 * 1024;
    
    if (imagePreviews.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    
    setUploadingImages(true);
    
    for (const file of files) {
      if (file.size > maxImageSizeBytes) {
        toast.error(`${file.name} exceeds ${maxImageSizeMb}MB limit`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result]);
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, file]
        }));
      };
      reader.readAsDataURL(file);
    }
    
    setUploadingImages(false);
  };

  const removeImage = (index) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasBusinessName) {
      toast.error('Add your business name in your seller profile before creating products');
      return;
    }
    
    const formErrors = validateForm();
    const firstError = Object.values(formErrors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }
    
    if (hasReachedProductLimit) {
      toast.error(productLimitMessage);
      return;
    }
    
    setLoading(true);
    
    try {
      const submitData = new FormData();
      
      // Append basic fields
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('price', parseFloat(formData.price));
      submitData.append('quantityAvailable', parseInt(formData.quantityAvailable, 10));
      submitData.append('minThreshold', formData.minThreshold === '' ? autoLowStockThreshold : parseInt(formData.minThreshold, 10));
      submitData.append('minimumOrderQuantity', parseInt(formData.minimumOrderQuantity, 10));
      submitData.append('rfqEnabled', formData.rfqEnabled);
      submitData.append('wholesaleTerms', formData.wholesaleTerms || '');
      submitData.append('priceTiers', JSON.stringify(formData.priceTiers));
      submitData.append('warehouseStatus', formData.warehouseStatus);
      submitData.append('category', formData.category);
      submitData.append('unit', formData.unit);
      submitData.append('locationHub', formData.locationHub || '');
      submitData.append('isPublished', formData.isPublished);
      
      // Append images (only new File objects)
      for (const image of formData.images) {
        if (image instanceof File) {
          submitData.append('images', image);
        }
      }
      
      let response;
      if (id) {
        response = await productService.update(id, submitData);
        toast.success('Product updated successfully!');
      } else {
        response = await productService.create(submitData);
        toast.success('Product created successfully!');
        if (response.planUsage) {
          setPlanUsage(response.planUsage);
        }
      }
      
      navigate('/seller/products');
    } catch (error) {
      console.error('Error saving product:', error);
      const message = error.response?.data?.message || 'Failed to save product';
      toast.error(message);
      
      if (message.includes('plan product limit')) {
        checkPlanUsage();
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FaSpinner className="animate-spin text-orange-500 text-4xl mx-auto mb-4" />
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  const hasFiniteProductLimit = Boolean(
    planUsage &&
    Number.isFinite(Number(planUsage.productLimit)) &&
    Number(planUsage.productLimit) < Number.MAX_SAFE_INTEGER
  );
  const isNearProductLimit = hasFiniteProductLimit && Number(planUsage?.remainingSlots || 0) <= 2;
  const slotUsagePct = hasFiniteProductLimit
    ? Math.min(100, Math.round((Number(planUsage.totalProducts || 0) / Number(planUsage.productLimit || 1)) * 100))
    : 0;
  const productSlotLabel = hasFiniteProductLimit
    ? `${planUsage?.remainingSlots} of ${planUsage?.productLimit} slots remaining`
    : 'Unlimited product slots';
  const fieldClass = 'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20';
  const iconFieldClass = 'h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20';
  const errorFieldClass = 'border-red-500 focus:border-red-500 focus:ring-red-100';

  return (
    <div className="min-h-screen bg-[#F6F7F9] py-6">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/seller/products')}
              className="mb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827]"
            >
              Back to products
            </button>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F97316] text-white shadow-sm">
                <FaStore />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-[#111827] md:text-3xl">
                  {id ? 'Edit Product' : 'Add Product'}
                </h1>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {userCategoryLabel} catalog listing
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#6B7280]">Publish state</p>
            <p className={`mt-1 text-sm font-semibold ${formData.isPublished ? 'text-green-700' : 'text-gray-700'}`}>
              {formData.isPublished ? 'Live after save' : 'Draft after save'}
            </p>
          </div>
        </div>

        {!hasBusinessName && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <div className="flex items-start gap-3">
              <FaExclamationTriangle className="mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Business name required</p>
                <p className="mt-1 text-sm">
                  Add a business name to your seller profile before creating products. Customers use it to view business details.
                </p>
              </div>
            </div>
          </div>
        )}

        {planUsage && !id && (
          <div className={`mb-5 rounded-lg border p-4 ${isNearProductLimit ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
            <div className="flex flex-wrap items-start gap-3">
              <FaExclamationTriangle className={`${isNearProductLimit ? 'text-amber-600' : 'text-blue-600'} mt-0.5 text-xl`} />
              <div className="flex-1">
                <p className="font-semibold text-[#111827]">
                  {planUsage.currentPlan ? `${planUsage.currentPlan.toUpperCase()} plan` : 'Free catalog'}: {productSlotLabel}
                </p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  You have {planUsage.totalProducts} products currently.
                  {hasReachedProductLimit && (
                    <span className="text-red-600 font-medium"> {productLimitMessage}</span>
                  )}
                </p>
                {hasReachedProductLimit ? (
                  <button
                    type="button"
                    onClick={() => navigate('/seller/subscription-plans')}
                    className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    Upgrade Subscription
                  </button>
                ) : (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 rounded-full h-2 transition-all"
                      style={{ width: `${slotUsagePct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <FaTag className="text-[#F97316]" />
                    <h2 className="text-lg font-semibold text-[#111827]">Product Details</h2>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#111827]">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`${fieldClass} ${errors.name ? errorFieldClass : ''}`}
                      placeholder="Product name"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#111827]">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="4"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                      placeholder="Product description"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className={`${fieldClass} ${errors.category ? errorFieldClass : ''}`}
                      >
                        <option value="">Select category</option>
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                      {isFarmer && (
                        <p className="mt-1 text-xs text-[#6B7280]">Farmer products default to Grocery.</p>
                      )}
                      {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">
                        Unit <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        className={`${fieldClass} ${errors.unit ? errorFieldClass : ''}`}
                      >
                        {units.map(unit => (
                          <option key={unit.value} value={unit.value}>{unit.label}</option>
                        ))}
                      </select>
                      {errors.unit && <p className="mt-1 text-sm text-red-500">{errors.unit}</p>}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <FaBoxes className="text-[#2563EB]" />
                    <h2 className="text-lg font-semibold text-[#111827]">Pricing And Inventory</h2>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">
                        Price (KSh) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <FaDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleNumberChange}
                          step="0.01"
                          min="0"
                          className={`${iconFieldClass} ${errors.price ? errorFieldClass : ''}`}
                          placeholder="0.00"
                        />
                      </div>
                      {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">
                        Stock Quantity <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <FaBoxes className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="number"
                          name="quantityAvailable"
                          value={formData.quantityAvailable}
                          onChange={handleNumberChange}
                          min="0"
                          className={`${iconFieldClass} ${errors.quantityAvailable ? errorFieldClass : ''}`}
                          placeholder="0"
                        />
                      </div>
                      {errors.quantityAvailable && <p className="mt-1 text-sm text-red-500">{errors.quantityAvailable}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">Low Stock Alert Threshold</label>
                      <div className="relative">
                        <FaExclamationTriangle className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                        <input
                          type="number"
                          name="minThreshold"
                          value={formData.minThreshold}
                          onChange={handleNumberChange}
                          min="0"
                          className={`${iconFieldClass} ${errors.minThreshold ? errorFieldClass : ''}`}
                          placeholder={`Auto ${autoLowStockThreshold}`}
                        />
                      </div>
                      {errors.minThreshold && <p className="mt-1 text-sm text-red-500">{errors.minThreshold}</p>}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">Warehouse Status</label>
                      <div className="relative">
                        <FaWarehouse className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          name="warehouseStatus"
                          value={formData.warehouseStatus}
                          onChange={handleChange}
                          className={iconFieldClass}
                        >
                          {warehouseStatusOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                      <label className="block text-sm font-medium text-[#111827]">Fulfillment / Pickup Hub</label>
                      <span className="text-xs font-medium text-[#6B7280]">Shown to logistics and scarcity tools</span>
                    </div>
                    <div className="relative">
                      <FaMapMarkerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="locationHub"
                        value={formData.locationHub}
                        onChange={handleChange}
                        className={iconFieldClass}
                        placeholder="e.g., Nairobi Industrial Area warehouse"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {fulfillmentHubSuggestions.map((hub) => (
                        <button
                          key={hub}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, locationHub: hub }))}
                          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                            formData.locationHub === hub
                              ? 'border-[#F97316] bg-orange-50 text-[#C2410C]'
                              : 'border-gray-200 bg-white text-[#374151] hover:border-[#F97316] hover:text-[#C2410C]'
                          }`}
                        >
                          {hub}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-[#6B7280]">
                      Use the nearest warehouse, market, depot, or pickup point customers and drivers can recognize.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <FaLayerGroup className="text-[#2563EB]" />
                    <h2 className="text-lg font-semibold text-[#111827]">Wholesale And RFQ</h2>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">
                        Minimum Order Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="minimumOrderQuantity"
                        value={formData.minimumOrderQuantity}
                        onChange={handleNumberChange}
                        min="1"
                        className={`${fieldClass} ${errors.minimumOrderQuantity ? errorFieldClass : ''}`}
                        placeholder="1"
                      />
                      {errors.minimumOrderQuantity && <p className="mt-1 text-sm text-red-500">{errors.minimumOrderQuantity}</p>}
                    </div>

                    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <input
                        type="checkbox"
                        name="rfqEnabled"
                        checked={formData.rfqEnabled}
                        onChange={handleChange}
                        className="h-4 w-4 rounded text-[#F97316] focus:ring-[#F97316]"
                      />
                      <span className="text-sm font-medium text-[#111827]">RFQ enabled</span>
                    </label>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#111827]">Wholesale Terms</label>
                    <textarea
                      name="wholesaleTerms"
                      value={formData.wholesaleTerms}
                      onChange={handleChange}
                      rows="3"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                      placeholder="Payment, delivery, and quotation terms"
                    />
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#111827]">Tier Pricing</p>
                      <button
                        type="button"
                        onClick={addPriceTier}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      >
                        <FaPlus />
                        Add Tier
                      </button>
                    </div>

                    <div className="space-y-3">
                      {formData.priceTiers.map((tier, index) => (
                        <div key={`tier-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                          <input
                            type="number"
                            min="1"
                            value={tier.minQuantity}
                            onChange={(event) => updatePriceTier(index, 'minQuantity', event.target.value)}
                            className={fieldClass}
                            placeholder="Min quantity"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={tier.unitPrice}
                            onChange={(event) => updatePriceTier(index, 'unitPrice', event.target.value)}
                            className={fieldClass}
                            placeholder="Unit price"
                          />
                          <input
                            type="text"
                            value={tier.label || ''}
                            onChange={(event) => updatePriceTier(index, 'label', event.target.value)}
                            className={fieldClass}
                            placeholder="Label"
                          />
                          <button
                            type="button"
                            onClick={() => removePriceTier(index)}
                            className="inline-flex h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-red-600 hover:bg-red-50"
                            title="Remove tier"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}

                      {!formData.priceTiers.length && (
                        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-[#6B7280]">No tier pricing set.</p>
                      )}
                    </div>
                    {errors.priceTiers && <p className="mt-2 text-sm text-red-500">{errors.priceTiers}</p>}
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-lg border border-gray-200 bg-white shadow-sm xl:sticky xl:top-6">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <FaImage className="text-[#16A34A]" />
                    <h2 className="text-lg font-semibold text-[#111827]">Product Images</h2>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition hover:border-[#F97316] hover:bg-orange-50">
                    {uploadingImages ? (
                      <FaSpinner className="mb-3 text-2xl text-[#F97316] animate-spin" />
                    ) : (
                      <FaCloudUploadAlt className="mb-3 text-2xl text-[#6B7280]" />
                    )}
                    <span className="text-sm font-semibold text-[#111827]">
                      {uploadingImages ? 'Uploading images' : 'Choose product images'}
                    </span>
                    <span className="mt-1 text-xs text-[#6B7280]">PNG, JPG, WebP up to 10MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImages}
                    />
                  </label>

                  {imagePreviews.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {imagePreviews.map((image, index) => (
                        <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                          <img
                            src={image}
                            alt={`Product ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-600 shadow-sm opacity-0 transition group-hover:opacity-100"
                            title="Remove image"
                          >
                            <FaTrash className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-[#6B7280]">
                      No images selected.
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-sm font-semibold text-[#111827]">Listing Summary</p>
                    <div className="mt-3 space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[#6B7280]">Name</span>
                        <span className="max-w-44 truncate font-medium text-[#111827]">{formData.name || 'Untitled'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#6B7280]">Category</span>
                        <span className="font-medium text-[#111827]">{formData.category || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#6B7280]">Stock</span>
                        <span className="font-medium text-[#111827]">{formData.quantityAvailable || 0} {formData.unit}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#6B7280]">RFQ</span>
                        <span className="font-medium text-[#111827]">{formData.rfqEnabled ? 'Enabled' : 'Off'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#6B7280]">Fulfillment</span>
                        <span className="max-w-44 truncate font-medium text-[#111827]">{formData.locationHub || 'Not set'}</span>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="text-sm font-medium text-[#111827]">Publish product</span>
                    <input
                      type="checkbox"
                      name="isPublished"
                      checked={formData.isPublished}
                      onChange={handleChange}
                      className="h-4 w-4 rounded text-[#F97316] focus:ring-[#F97316]"
                    />
                  </label>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/seller/products')}
                      className="h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !hasBusinessName || hasReachedProductLimit}
                      title={
                        !hasBusinessName
                          ? 'Add your business name before creating products.'
                          : hasReachedProductLimit
                            ? productLimitMessage
                            : ''
                      }
                      className="h-11 flex-1 rounded-lg bg-[#F97316] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <FaSpinner className="animate-spin" />
                          {id ? 'Updating' : 'Adding'}
                        </span>
                      ) : (
                        id ? 'Update Product' : 'Add Product'
                      )}
                    </button>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;
