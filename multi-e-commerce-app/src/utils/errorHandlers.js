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
    const validationMessage = Array.isArray(data?.errors)
      ? data.errors
          .map((item) => item?.msg)
          .filter(Boolean)
          .join(', ')
      : '';
    const message = data?.message || validationMessage;
    const code = data?.code;
    
    switch (status) {
      case 400:
        return { message: message || 'Bad request', status, code };
      case 401:
        return { message: message || 'Unauthorized. Please login again.', status, code };
      case 403:
        return { message: message || 'You do not have permission to perform this action.', status, code };
      case 404:
        return { message: message || 'Resource not found', status, code };
      case 409:
        return { message: message || 'Conflict occurred', status, code };
      case 422:
        return { message: message || 'Validation failed', status, code };
      case 429:
        return { message: message || 'Too many requests. Please try again later.', status, code };
      case 500:
        return { message: message || 'Server error. Please try again later.', status, code };
      default:
        return { message: message || 'An error occurred', status, code };
    }
  } else if (error.request) {
    // Request made but no response
    return { message: 'Network error. Please check your connection.', status: 0, code: 'NETWORK_ERROR' };
  } else {
    // Something else happened
    return { message: error.message || 'An unexpected error occurred', status: 0, code: 'CLIENT_ERROR' };
  }
};

export const showErrorToast = (error, toast) => {
  const { message } = handleApiError(error);
  toast.error(message);
};
