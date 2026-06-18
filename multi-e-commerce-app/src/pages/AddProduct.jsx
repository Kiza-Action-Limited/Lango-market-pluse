// src/pages/AddProduct.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  FaBrain, FaStore, FaImage, FaTag, FaLayerGroup, 
  FaWarehouse, FaSpinner, FaCloudUploadAlt, FaTrash,
  FaDollarSign, FaBoxes, FaMapMarkerAlt, FaExclamationTriangle,
  FaLeaf, FaCalendarAlt, FaTint, FaBarcode
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { productService } from '../services/productService';
import { getUserCategoryLabel, isFarmerUser } from '../utils/userCategory';

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
    category: '',
    unit: 'kg',
    locationHub: '',
    customAttributes: {},
    images: [],
    isPublished: true,
  });
  
  const [imagePreviews, setImagePreviews] = useState([]);
  const [errors, setErrors] = useState({});

  const categories = [
    { value: 'electronics', label: 'Electronics', icon: '📱' },
    { value: 'fashion', label: 'Fashion', icon: '👗' },
    { value: 'home-garden', label: 'Home and Garden', icon: '🏡' },
    { value: 'beauty-health', label: 'Beauty and Health', icon: '💄' },
    { value: 'sports-outdoor', label: 'Sports and Outdoor', icon: '🏀' },
  ];

  const units = [
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'g', label: 'Gram (g)' },
    { value: 'ton', label: 'Ton' },
    { value: 'piece', label: 'Piece' },
    { value: 'bunch', label: 'Bunch' },
    { value: 'litre', label: 'Litre (L)' },
  ];

  useEffect(() => {
    checkPlanUsage();
    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    if (isFarmer && formData.category !== 'grocery') {
      setFormData((prev) => ({ ...prev, category: 'grocery' }));
    }
  }, [isFarmer, formData.category]);

  const checkPlanUsage = async () => {
    try {
      const response = await productService.getMyProducts({ page: 1, limit: 1 });
      if (response.planUsage) {
        setPlanUsage(response.planUsage);
        if (response.planUsage.remainingSlots === 0 && !id) {
          const planLabel = response.planUsage.currentPlan
            ? response.planUsage.currentPlan.toUpperCase()
            : 'subscription';
          toast.error(`You've reached your ${planLabel} product limit. Activate a subscription to add more products.`);
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
        category: product.category || '',
        unit: product.unit || 'kg',
        locationHub: product.locationHub || '',
        customAttributes: product.customAttributes || {},
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

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const maxImages = 10;
    
    if (imagePreviews.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    
    setUploadingImages(true);
    
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
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

  const handleCustomAttributeChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      customAttributes: {
        ...prev.customAttributes,
        [key]: value,
      },
    }));
  };

  const addCustomAttribute = () => {
    const key = prompt('Enter attribute name (e.g., organic, harvest_date, origin):');
    if (key && key.trim()) {
      setFormData(prev => ({
        ...prev,
        customAttributes: {
          ...prev.customAttributes,
          [key.trim()]: '',
        },
      }));
    }
  };

  const removeCustomAttribute = (key) => {
    const newAttributes = { ...formData.customAttributes };
    delete newAttributes[key];
    setFormData(prev => ({
      ...prev,
      customAttributes: newAttributes,
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
    
    if (planUsage && planUsage.remainingSlots === 0 && !id) {
      toast.error('Product limit reached. Please upgrade your plan.');
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
      submitData.append('category', formData.category);
      submitData.append('unit', formData.unit);
      submitData.append('locationHub', formData.locationHub || '');
      submitData.append('isPublished', formData.isPublished);
      
      // Append custom attributes as JSON
      if (Object.keys(formData.customAttributes).length > 0) {
        submitData.append('customAttributes', JSON.stringify(formData.customAttributes));
      }
      
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

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FaStore className="text-orange-500 text-3xl" />
            <h1 className="text-3xl font-bold text-gray-900">
              {id ? 'Edit Product' : 'Add New Product'}
            </h1>
          </div>
          <p className="text-gray-600">
            List products for your {userCategoryLabel} account and reach customers across Kenya
          </p>
        </div>

        {!hasBusinessName && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
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

        {/* Plan Usage Alert */}
        {planUsage && !id && (
          <div className={`mb-6 p-4 rounded-lg ${planUsage.remainingSlots <= 2 ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-start gap-3">
              <FaExclamationTriangle className={`${planUsage.remainingSlots <= 2 ? 'text-yellow-600' : 'text-blue-600'} text-xl mt-0.5`} />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {planUsage.currentPlan ? `${planUsage.currentPlan.toUpperCase()} Plan` : 'No active subscription'} - {planUsage.remainingSlots} of {planUsage.productLimit} slots remaining
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  You have {planUsage.totalProducts} products currently.
                  {planUsage.remainingSlots === 0 && (
                    <span className="text-red-600 font-medium"> Upgrade your plan to add more products.</span>
                  )}
                </p>
                {planUsage.remainingSlots > 0 && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 rounded-full h-2 transition-all"
                      style={{ width: `${(planUsage.totalProducts / planUsage.productLimit) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center gap-2 mb-4">
              <FaTag className="text-orange-500 text-xl" />
              <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter product name"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Describe your product in detail..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">
                    Price (KSh) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FaDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleNumberChange}
                      step="0.01"
                      min="0"
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.price ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">
                    Stock Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FaBoxes className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      name="quantityAvailable"
                      value={formData.quantityAvailable}
                      onChange={handleNumberChange}
                      min="0"
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors.quantityAvailable ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0"
                    />
                  </div>
                  {errors.quantityAvailable && <p className="text-red-500 text-sm mt-1">{errors.quantityAvailable}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    disabled={isFarmer}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      errors.category ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select category</option>
                    {isFarmer ? (
                      <option value="grocery">Grocery</option>
                    ) : (
                      categories.filter((cat) => cat.value !== 'grocery').map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))
                    )}
                  </select>
                  {isFarmer && (
                    <p className="text-sm text-gray-500 mt-1">
                      Your account category is Farmer, so all products are automatically categorized as Grocery.
                    </p>
                  )}
                  {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      errors.unit ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    {units.map(unit => (
                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                    ))}
                  </select>
                  {errors.unit && <p className="text-red-500 text-sm mt-1">{errors.unit}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">
                  Location Hub
                </label>
                <div className="relative">
                  <FaMapMarkerAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="locationHub"
                    value={formData.locationHub}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="e.g., Nairobi Fresh Produce Market"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="isPublished"
                  checked={formData.isPublished}
                  onChange={handleChange}
                  className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-900">Publish product immediately</span>
              </label>
            </div>
          </div>

          {/* Product Images */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center gap-2 mb-4">
              <FaImage className="text-green-500 text-xl" />
              <h2 className="text-xl font-semibold text-gray-900">Product Images</h2>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-900">
                Upload Images (Up to 10)
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-500 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploadingImages ? (
                      <FaSpinner className="text-orange-500 text-3xl animate-spin mb-2" />
                    ) : (
                      <FaCloudUploadAlt className="text-gray-400 text-3xl mb-2" />
                    )}
                    <p className="text-sm text-gray-600">
                      {uploadingImages ? 'Uploading...' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, WebP (MAX. 5MB each)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImages}
                  />
                </label>
              </div>
            </div>
            
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {imagePreviews.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Attributes */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <FaWarehouse className="text-purple-500 text-xl" />
                <h2 className="text-xl font-semibold text-gray-900">Custom Attributes</h2>
              </div>
              <button
                type="button"
                onClick={addCustomAttribute}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
              >
                + Add Attribute
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Add specific details like organic certification, harvest date, origin, etc.
            </p>
            
            {Object.keys(formData.customAttributes).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(formData.customAttributes).map(([key, value]) => (
                  <div key={key} className="flex gap-3 items-start">
                    <div className="flex-1 relative">
                      {key === 'organic' && <FaLeaf className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-500" />}
                      {key === 'harvest_date' && <FaCalendarAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500" />}
                      {key === 'moisture_level' && <FaTint className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" />}
                      {key === 'batch_id' && <FaBarcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />}
                      <input
                        type="text"
                        value={key}
                        readOnly
                        className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700"
                      />
                    </div>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleCustomAttributeChange(key, e.target.value)}
                      className="flex-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Value"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomAttribute(key)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4 bg-gray-50 rounded-lg">
                No custom attributes added. Click "Add Attribute" to add product-specific details.
              </p>
            )}
          </div>

          {/* AI Tip */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200">
            <div className="flex items-start gap-3">
              <FaBrain className="text-orange-500 text-xl mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">AI Selling Tip</h4>
                <p className="text-sm text-gray-700">
                  Products with high-quality images and detailed descriptions get <span className="text-green-600 font-medium">40% more views</span>. 
                  Add custom attributes to highlight unique features and improve search visibility.
                </p>
              </div>
            </div>
          </div>
          
          {/* Submit Buttons */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/seller/products')}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !hasBusinessName || (planUsage && planUsage.remainingSlots === 0 && !id)}
              title={
                !hasBusinessName
                  ? 'Add your business name before creating products.'
                  : planUsage && planUsage.remainingSlots === 0 && !id
                    ? 'Plan limit reached. Upgrade to Smart or Growth for unlimited SKUs.'
                    : ''
              }
              className="px-8 py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <FaSpinner className="animate-spin" />
                  {id ? 'Updating...' : 'Adding...'}
                </span>
              ) : (
                id ? 'Update Product' : 'Add Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;
