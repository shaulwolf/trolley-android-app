import auth from "@react-native-firebase/auth";
import { BACKEND_URL } from "../utils/constants";

/**
 * API Service with automatic Firebase authentication
 * Automatically adds Firebase ID token to all requests
 */
class ApiService {
  constructor() {
    this.baseURL = BACKEND_URL;
  }

  /**
   * Get current user's Firebase ID token
   */
  async getAuthToken() {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        console.log("❌ No current user in getAuthToken");
        throw new Error("User not authenticated");
      }

      console.log("🔐 Getting ID token for user:", currentUser.email);
      const idToken = await currentUser.getIdToken();
      console.log("✅ Got ID token, length:", idToken.length);
      return idToken;
    } catch (error) {
      console.error("❌ Error getting auth token:", error);

      // If token is expired or invalid, sign out user
      if (
        error.code === "auth/network-request-failed" ||
        error.code === "auth/user-token-expired" ||
        error.message.includes("token") ||
        error.message.includes("expired")
      ) {
        console.log("🚪 Token expired, signing out user");
        await auth().signOut();
      }

      throw new Error("Failed to get authentication token");
    }
  }

  /**
   * Make authenticated API request
   */
  async makeRequest(endpoint, options = {}) {
    try {
      console.log("🌐 Making authenticated request to:", endpoint);
      const token = await this.getAuthToken();

      const url = endpoint.startsWith("http")
        ? endpoint
        : `${this.baseURL}${endpoint}`;

      console.log("🌐 Full URL:", url);

      const requestOptions = {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      };

      console.log("🌐 Request options:", {
        method: requestOptions.method || "GET",
        headers: {
          ...requestOptions.headers,
          Authorization: `Bearer ${token.substring(0, 20)}...`,
        },
      });

      const response = await fetch(url, requestOptions);

      console.log("🌐 Response status:", response.status);

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        console.log("🚪 Authentication failed, signing out user");
        await auth().signOut();
        throw new Error("Authentication failed - please login again");
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Request failed:", response.status, errorText);
        throw new Error(`Request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(
        "✅ Request successful, data length:",
        Array.isArray(data) ? data.length : "not array"
      );
      return data;
    } catch (error) {
      console.error("❌ API request error:", error);

      // Handle network or authentication errors
      if (
        error.message.includes("Authentication failed") ||
        error.message.includes("Failed to get authentication token")
      ) {
        // User will be redirected to login automatically by auth state change
      }

      throw error;
    }
  }

  /**
   * Make public API request (no authentication required)
   */
  async makePublicRequest(endpoint, options = {}) {
    try {
      const url = endpoint.startsWith("http")
        ? endpoint
        : `${this.baseURL}${endpoint}`;

      const requestOptions = {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      };

      console.log(`🌐 Public API Request: ${options.method || "GET"} ${url}`);

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Request failed with status ${response.status}`
        );
      }

      const data = await response.json();
      console.log(
        `✅ Public API Response: ${options.method || "GET"} ${url} - Success`
      );

      return data;
    } catch (error) {
      console.error(
        `❌ Public API Error: ${options.method || "GET"} ${endpoint}`,
        error
      );
      throw error;
    }
  }

  // ===== PRODUCT ENDPOINTS =====

  /**
   * Get all products for current user
   */
  async getProducts() {
    return this.makeRequest("/api/products");
  }

  /**
   * Add a product to current user's trolley
   */
  async addProduct(productData) {
    return this.makeRequest("/api/products", {
      method: "POST",
      body: JSON.stringify(productData),
    });
  }

  /**
   * Update a product in current user's trolley
   */
  async updateProduct(productId, updates) {
    return this.makeRequest(`/api/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a product from current user's trolley
   */
  async deleteProduct(productId) {
    return this.makeRequest(`/api/products/${productId}`, {
      method: "DELETE",
    });
  }

  /**
   * Clear all products from current user's trolley
   */
  async clearAllProducts() {
    return this.makeRequest("/api/products", {
      method: "DELETE",
    });
  }

  // ===== SYNC ENDPOINTS =====

  /**
   * Get products for sync (with optional timestamp filter)
   */
  async getProductsForSync(since = null) {
    const params = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.makeRequest(`/api/sync${params}`);
  }

  /**
   * Upload products for sync (complete replacement)
   */
  async syncProducts(products, deviceId = "react-native-app") {
    return this.makeRequest("/api/sync", {
      method: "POST",
      body: JSON.stringify({ products, deviceId }),
    });
  }

  /**
   * Merge products (add only new ones)
   */
  async mergeProducts(products, deviceId = "react-native-app") {
    return this.makeRequest("/api/sync/merge", {
      method: "POST",
      body: JSON.stringify({ products, deviceId }),
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    return this.makeRequest("/api/sync/status");
  }

  // ===== PUBLIC ENDPOINTS =====

  /**
   * Extract product information from URL (no authentication required)
   */
  async extractProduct(url) {
    return this.makePublicRequest("/extract-product", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }

  /**
   * Health check (no authentication required)
   */
  async healthCheck() {
    return this.makePublicRequest("/health");
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
