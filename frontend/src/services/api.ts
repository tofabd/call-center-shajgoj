import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// WooCommerce API functions
export const getPaymentMethods = async () => {
  const response = await api.get('/woocom/payment-methods');
  return response.data;
};

export const getShippingMethods = async () => {
  const response = await api.get('/woocom/shipping-methods');
  return response.data;
};

export const searchProducts = async (params: any) => {
  const response = await api.get('/woocom/search-products', { params });
  return response.data;
};

export const createOrder = async (orderData: any) => {
  const response = await api.post('/woocom/create-order', orderData);
  return response.data;
};

// Fetch WooCommerce order notes by order ID
export const getOrderNotes = async (orderId: number) => {
  const response = await api.get(`/woocom/orders/${orderId}/notes`);
  return response.data;
};

// Add a note to a WooCommerce order
export const addOrderNote = async (
  orderId: number,
  note: string,
  customerNote: boolean = false,
  addedByUser?: string
) => {
  const response = await api.post(`/woocom/orders/${orderId}/notes`, {
    note,
    customer_note: customerNote,
    ...(addedByUser ? { added_by_user: addedByUser } : {})
  });
  return response.data;
};

export const getShippingZonesWithMethods = async () => {
  const response = await api.get('/woocom/shipping-zones-methods');
  return response.data;
};

export default api;