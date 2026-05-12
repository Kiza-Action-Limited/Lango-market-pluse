// src/utils/errorHandler.js
export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return { message: data.message || 'Bad request', status };
      case 401:
        return { message: 'Unauthorized. Please login again.', status };
      case 403:
        return { message: 'You do not have permission to perform this action.', status };
      case 404:
        return { message: data.message || 'Resource not found', status };
      case 409:
        return { message: data.message || 'Conflict occurred', status };
      case 422:
        return { message: data.message || 'Validation failed', status };
      case 429:
        return { message: 'Too many requests. Please try again later.', status };
      case 500:
        return { message: 'Server error. Please try again later.', status };
      default:
        return { message: data.message || 'An error occurred', status };
    }
  } else if (error.request) {
    // Request made but no response
    return { message: 'Network error. Please check your connection.', status: 0 };
  } else {
    // Something else happened
    return { message: error.message || 'An unexpected error occurred', status: 0 };
  }
};

export const showErrorToast = (error, toast) => {
  const { message } = handleApiError(error);
  toast.error(message);
};