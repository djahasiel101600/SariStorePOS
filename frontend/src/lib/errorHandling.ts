// src/lib/errorHandling.ts
import { AxiosError } from 'axios';

/**
 * Extract a user-friendly error message from an API error
 */
export const getErrorMessage = (error: unknown): string => {
  if (!error) return 'An unknown error occurred';

  // Handle Axios errors
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError<any>;
    
    // Check for specific status codes
    if (axiosError.response) {
      const status = axiosError.response.status;
      const data = axiosError.response.data;

      // 403 Forbidden - Permission denied
      if (status === 403) {
        if (data?.detail) {
          return data.detail;
        }
        return 'You do not have permission to perform this action';
      }

      // 401 Unauthorized
      if (status === 401) {
        return 'Authentication required. Please log in again';
      }

      // 400 Bad Request
      if (status === 400) {
        if (data?.detail) {
          return data.detail;
        }
        if (data?.error) {
          return data.error;
        }
        // Handle validation errors
        if (typeof data === 'object') {
          const errors = Object.entries(data)
            .map(([field, messages]) => {
              if (Array.isArray(messages)) {
                return `${field}: ${messages.join(', ')}`;
              }
              return `${field}: ${messages}`;
            })
            .join('; ');
          if (errors) return errors;
        }
        return 'Invalid request data';
      }

      // 404 Not Found
      if (status === 404) {
        if (data?.detail) {
          return data.detail;
        }
        return 'Resource not found';
      }

      // 500 Server Error
      if (status >= 500) {
        if (data?.detail) {
          return `Server error: ${data.detail}`;
        }
        return 'Server error. Please try again later';
      }

      // Other errors with detail
      if (data?.detail) {
        return data.detail;
      }

      if (data?.error) {
        return data.error;
      }

      if (data?.message) {
        return data.message;
      }
    }

    // Network errors
    if (axiosError.message === 'Network Error') {
      return 'Network error. Please check your connection';
    }

    // Timeout errors
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again';
    }

    // Return the error message if available
    if (axiosError.message) {
      return axiosError.message;
    }
  }

  // Handle regular Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Fallback
  return 'An unexpected error occurred';
};

/**
 * Get a user-friendly success message for an action
 */
export const getSuccessMessage = (action: string, resourceName?: string): string => {
  const resource = resourceName || 'item';
  
  switch (action) {
    case 'create':
      return `${resource} created successfully`;
    case 'update':
      return `${resource} updated successfully`;
    case 'delete':
      return `${resource} deleted successfully`;
    case 'import':
      return `${resource} imported successfully`;
    default:
      return 'Action completed successfully';
  }
};
