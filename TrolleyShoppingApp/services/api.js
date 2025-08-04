import auth from "@react-native-firebase/auth";
import axios from "axios";
import { BACKEND_URL } from "../utils/constants";

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${idToken}`;
      }
    } catch (error) {
      console.error("[apiService] Error getting auth token:", error);
      if (error.code === "auth/user-token-expired") {
        await auth().signOut();
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    console.error("[apiService] API Error:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log("[apiService] Authentication failed, signing out user");
      await auth().signOut();
    }
    throw error;
  }
);

export const apiService = {
  getProducts: () => api.get("/api/products"),

  addProduct: (productData) => api.post("/api/products", productData),

  updateProduct: (productId, updates) =>
    api.put(`/api/products/${productId}`, updates),

  deleteProduct: (productId) => api.delete(`/api/products/${productId}`),

  archiveProduct: (productId) => api.post(`/api/products/${productId}/archive`),

  clearAllProducts: () => api.delete("/api/products"),

  getProductsForSync: (since = null) => {
    const params = since ? `?since=${encodeURIComponent(since)}` : "";
    return api.get(`/api/sync${params}`);
  },

  syncProducts: (products, deviceId = "react-native-app") =>
    api.post("/api/sync", { products, deviceId }),

  mergeProducts: (products, deviceId = "react-native-app") =>
    api.post("/api/sync/merge", { products, deviceId }),

  getSyncStatus: () => api.get("/api/sync/status"),

  extractProduct: (url) => api.post("/extract-product", { url }),

  healthCheck: () => api.get("/health"),

  checkBackendHealth: async () => {
    try {
      const response = await api.get("/health");
      console.log("[apiService] Backend health check successful:", response);
      return true;
    } catch (error) {
      console.error("[apiService] Backend health check failed:", error);
      return false;
    }
  },

  getArchivedProducts: () => api.get("/api/archive"),

  restoreProduct: (productId) => api.post(`/api/archive/${productId}/restore`),

  deleteArchivedProduct: (productId) => api.delete(`/api/archive/${productId}`),
};

export default apiService;
