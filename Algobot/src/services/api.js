import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const citySlug = localStorage.getItem('selectedCity');
  if (citySlug) {
    config.params = { ...config.params, city: citySlug };
  }
  return config;
});

export const aggregatorsAPI = {
  getAll: () => api.get('/aggregators/'),
};

export const categoriesAPI = {
  getAll: () => api.get('/categories/'),
  getTree: () => api.get('/categories/tree/'),
  create: (data) => api.post('/categories/', data),
  update: (id, data) => api.patch(`/categories/${id}/`, data),
  delete: (id) => api.delete(`/categories/${id}/`),
};

export const productsAPI = {
  getAll: () => api.get('/products/'),
  // accept optional params object -> passed to request as query params
  getComparison: (params = {}) => api.get('/products/comparison/', { params }),
};

export const recommendationsAPI = {
  getAll: () => api.get('/recommendations/'),
  apply: (id) => api.post(`/recommendations/${id}/apply/`),
  reject: (id) => api.post(`/recommendations/${id}/reject/`),
};

export const analyticsAPI = {
  getDashboard: () => api.get('/dashboard/'),
  getGaps: () => api.get('/analytics/gaps/'),
  getPriceHistory: () => api.get('/price-history/'),
};

export const algorithmAPI = {
  run: () => api.post('/algorithm/run/'),
};

export const productLinksAPI = {
  getAll: (productId) => api.get('/product-links/', { params: { product_id: productId } }),
  create: (data) => api.post('/product-links/', data),
  update: (id, data) => api.patch(`/product-links/${id}/`, data),
  delete: (id) => api.delete(`/product-links/${id}/`),
};

export const importAPI = {
  uploadProducts: (formData) => api.post('/import/products/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadPrices: (formData) => api.post('/import/prices/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadLinks: (formData) => api.post('/import/links/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadCategories: (formData) => api.post('/import/categories/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getJobs: () => api.get('/import-jobs/'),
  getJobStatus: (id) => api.get(`/import-jobs/${id}/`),
  downloadTemplate: (type) => `${API_BASE_URL}/import/template/${type}/`,
  // JSON import from Data folder
  getJsonInfo: () => api.get('/import/json/info/'),
  importFromJson: (data) => api.post('/import/json/', data),
};

export const exportAPI = {
  downloadProducts: (params = {}) => `${API_BASE_URL}/export/products/?${new URLSearchParams(params)}`,
};

export const categoriesResetAPI = {
  reset: () => api.post('/reset-categories/'),
};

export default api;

