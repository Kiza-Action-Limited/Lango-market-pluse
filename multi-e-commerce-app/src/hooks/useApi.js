// src/hooks/useApi.js
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export const useApi = (apiFunction, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      setData(result);
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      if (options.showSuccessToast) {
        toast.success(options.successMessage || 'Operation completed successfully');
      }
      return result;
    } catch (err) {
      setError(err);
      if (options.onError) {
        options.onError(err);
      }
      if (options.showErrorToast) {
        toast.error(err.response?.data?.message || options.errorMessage || 'Operation failed');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
};