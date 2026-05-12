// src/utils/validators.js
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePassword = (password) => {
  return password.length >= 6;
};

export const validatePhone = (phone) => {
  const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return re.test(phone);
};

export const validateZipCode = (zipCode) => {
  const re = /^\d{5}(-\d{4})?$/;
  return re.test(zipCode);
};

export const validateProductForm = (formData) => {
  const errors = {};
  
  if (!formData.name || formData.name.length < 3) {
    errors.name = 'Product name must be at least 3 characters';
  }
  
  if (!formData.price || formData.price <= 0) {
    errors.price = 'Price must be greater than 0';
  }
  
  if (!formData.stock || formData.stock < 0) {
    errors.stock = 'Stock must be 0 or greater';
  }
  
  if (!formData.categoryId) {
    errors.category = 'Please select a category';
  }
  
  return errors;
};