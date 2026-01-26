import axios from "axios";

// API Base URL - uses relative path in production (proxied by nginx)
// or localhost in development
const API_BASE_URL = import.meta.env.PROD
  ? "/api"
  : "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add city parameter to all requests
api.interceptors.request.use((config) => {
  const citySlug = localStorage.getItem("selectedCity");
  if (citySlug) {
    config.params = { ...config.params, city: citySlug };
  }
  return config;
});

export const aggregatorsAPI = {
  getAll: () => api.get("/aggregators/"),
};

export const categoriesAPI = {
  getAll: () => api.get("/categories/"),
  getTree: () => api.get("/categories/tree/"),
  create: (data) => api.post("/categories/", data),
  update: (id, data) => api.patch(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const productsAPI = {
  getAll: () => api.get("/products/"),
  // Get products with prices for comparison
  getComparison: (params = {}) => api.get("/products/comparison/", { params }),
  getById: (id) => api.get(`/products/${id}`),
};

export const recommendationsAPI = {
  getAll: () => api.get("/recommendations/"),
  apply: (id) => api.post(`/recommendations/${id}/apply/`),
  reject: (id) => api.post(`/recommendations/${id}/reject/`),
};

export const analyticsAPI = {
  getDashboard: () => api.get("/dashboard/"),
  getGaps: (params = {}) => api.get("/dashboard/gaps/", { params }),
  getPriceHistory: () => api.get("/price-history/"),
};

export const algorithmAPI = {
  run: () => api.post("/algorithm/run/"),
};

export const productLinksAPI = {
  getAll: (productId) =>
    api.get("/product-links/", { params: { product_id: productId } }),
  create: (data) => api.post("/product-links/", data),
  update: (id, data) => api.patch(`/product-links/${id}`, data),
  delete: (id) => api.delete(`/product-links/${id}`),
};

export const importAPI = {
  // JSON import from Data folder
  getJsonInfo: () => api.get("/import/json/info/"),
  importFromJson: (data) => api.post("/import/json/", data),
  // Upload JSON file
  uploadJson: (formData) =>
    api.post("/import/upload-json/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  // External API import
  runExternalImport: (params = {}) =>
    api.post("/import/external/run/", null, { params }),
  getExternalImportProgress: () => api.get("/import/external/progress"),
  // Mapped review
  reviewMappedFile: (params = {}) =>
    api.post("/import/mapped/review-file/", null, { params }),
  reviewMappedUpload: (formData, params = {}) =>
    api.post("/import/mapped/review-upload/", formData, {
      params,
      headers: { "Content-Type": "multipart/form-data" },
    }),
  // Mapped files from external API
  getMappedApiFiles: () => api.get("/import/mapped/api-files/"),
  reviewMappedFromApi: (params = {}) =>
    api.post("/import/mapped/review-from-api/", null, { params }),
  // Run product matching
  runMatching: (params = {}) =>
    api.post("/import/run-matching/", null, { params }),
  getMatchingProgress: () => api.get("/import/matching-progress"),
};

export const exportAPI = {
  downloadProducts: (params = {}) =>
    `${API_BASE_URL}/export/products/?${new URLSearchParams(params)}`,
};

export const categoriesResetAPI = {
  reset: () => api.post("/reset-categories/"),
};

export default api;
