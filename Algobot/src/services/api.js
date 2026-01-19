import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const aggregatorsAPI = {
  getAll: () => api.get('/aggregators/'),
};

export const categoriesAPI = {
  getAll: () => api.get('/categories/'),
};

export const productsAPI = {
  getAll: () => api.get('/products/'),
  getComparison: () => api.get('/products/comparison/'),
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

export default api;
