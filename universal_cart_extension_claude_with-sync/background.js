// Enhanced Trolley Background Service with Firebase Auth
const BACKEND_URL = "http://localhost:3000";

// Get current Firebase ID token
async function getFirebaseToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["firebase_id_token"], (result) => {
      resolve(result.firebase_id_token || null);
    });
  });
}

// Store Firebase ID token
async function storeFirebaseToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ firebase_id_token: token }, resolve);
  });
}

// Make authenticated API request
async function makeAuthenticatedRequest(url, options = {}) {
  const token = await getFirebaseToken();

  if (!token) {
    throw new Error("User not authenticated. Please sign in first.");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid, clear it
    chrome.storage.local.remove(["firebase_id_token"]);
    throw new Error("Authentication expired. Please sign in again.");
  }

  return response;
}

// Get all products from server (authenticated)
async function getAllProducts() {
  try {
    console.log("📥 Getting all products from server...");

    const response = await makeAuthenticatedRequest(
      `${BACKEND_URL}/api/products`
    );

    if (!response.ok) {
      throw new Error(`Failed to get products: ${response.status}`);
    }

    const products = await response.json();
    console.log("📥 Received", products.length, "products from server");

    return products;
  } catch (error) {
    console.error("❌ Failed to get products:", error);
    throw error;
  }
}

// Add product to server (authenticated)
async function addProduct(product) {
  try {
    console.log("➕ Adding product to server:", product.title);

    const response = await makeAuthenticatedRequest(
      `${BACKEND_URL}/api/products`,
      {
        method: "POST",
        body: JSON.stringify({
          url: product.url,
          title: product.title,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          site: product.site,
          displaySite: product.displaySite,
          category: product.category || "general",
          variants: product.variants || {},
          dateAdded: product.dateAdded || new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to add product: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log("✅ Product added to server successfully");

    return result;
  } catch (error) {
    console.error("❌ Failed to add product to server:", error);
    throw error;
  }
}

// Delete product from server (authenticated)
async function deleteProduct(productId) {
  try {
    console.log("🗑️ Deleting product from server:", productId);

    const response = await makeAuthenticatedRequest(
      `${BACKEND_URL}/api/products/${productId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete product: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log("✅ Product deleted from server successfully");

    return result;
  } catch (error) {
    console.error("❌ Failed to delete product from server:", error);
    throw error;
  }
}

// Extract product info from URL (public endpoint)
async function extractProductInfo(url) {
  try {
    console.log("🔍 Extracting product info from:", url);

    const response = await fetch(`${BACKEND_URL}/extract-product`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Failed to extract product: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Product info extracted successfully");

    return result;
  } catch (error) {
    console.error("❌ Failed to extract product info:", error);
    throw error;
  }
}

// Convert server format to Chrome storage format
function serverToChrome(products) {
  const chromeData = {};

  products.forEach((product) => {
    const category = product.category || "general";

    if (!chromeData[category]) {
      chromeData[category] = [];
    }

    chromeData[category].push({
      id: product.id,
      url: product.url,
      title: product.title,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      site: product.site,
      displaySite: product.displaySite,
      variants: product.variants || {},
      dateAdded: product.dateAdded,
    });
  });

  return chromeData;
}

// Update badge with product count
function updateBadge() {
  chrome.storage.local.get({ cart: {} }, (result) => {
    let count = 0;
    Object.values(result.cart).forEach((category) => {
      Object.values(category).forEach((siteProducts) => {
        count += siteProducts.length;
      });
    });

    chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : "",
    });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  });
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Trolley Extension installed");
  updateBadge();
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Received message:", request);

  if (request.action === "getAllProducts") {
    console.log("📥 Get all products requested");

    getAllProducts()
      .then((products) => {
        // Convert to Chrome format and save
        const chromeData = serverToChrome(products);
        console.log("💾 Saving to Chrome storage:", chromeData);
        chrome.storage.local.set({ cart: chromeData }, () => {
          console.log(
            "✅ Chrome storage updated with",
            Object.keys(chromeData).length,
            "folders"
          );
          updateBadge();
          sendResponse({
            success: true,
            message: `Loaded ${products.length} products`,
            productCount: products.length,
          });
        });
      })
      .catch((error) => {
        console.error("❌ Error getting products:", error);
        sendResponse({
          success: false,
          error: error.message,
          needsAuth:
            error.message.includes("not authenticated") ||
            error.message.includes("Authentication expired"),
        });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === "addProduct") {
    console.log("➕ Add product requested:", request.product);

    addProduct(request.product)
      .then((result) => {
        console.log("✅ Product added to server, result:", result);
        // After adding, get all products again
        return getAllProducts();
      })
      .then((products) => {
        console.log("📥 Retrieved products after adding:", products.length);
        // Convert to Chrome format and save
        const chromeData = serverToChrome(products);
        chrome.storage.local.set({ cart: chromeData }, () => {
          updateBadge();
          sendResponse({
            success: true,
            message: `Product added successfully`,
            productCount: products.length,
          });
        });
      })
      .catch((error) => {
        console.error("❌ Error in addProduct flow:", error);
        sendResponse({
          success: false,
          error: error.message,
          needsAuth:
            error.message.includes("not authenticated") ||
            error.message.includes("Authentication expired"),
        });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === "deleteProduct") {
    console.log("🗑️ Delete product requested:", request.productId);

    deleteProduct(request.productId)
      .then((result) => {
        // After deleting, get all products again
        return getAllProducts();
      })
      .then((products) => {
        // Convert to Chrome format and save
        const chromeData = serverToChrome(products);
        chrome.storage.local.set({ cart: chromeData }, () => {
          updateBadge();
          sendResponse({
            success: true,
            message: `Product deleted successfully`,
            productCount: products.length,
          });
        });
      })
      .catch((error) => {
        console.error("❌ Error in deleteProduct flow:", error);
        sendResponse({
          success: false,
          error: error.message,
          needsAuth:
            error.message.includes("not authenticated") ||
            error.message.includes("Authentication expired"),
        });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === "extractProduct") {
    console.log("🔍 Extract product requested:", request.url);

    extractProductInfo(request.url)
      .then((result) => {
        sendResponse({
          success: true,
          productInfo: result,
        });
      })
      .catch((error) => {
        console.error("❌ Error extracting product:", error);
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === "storeFirebaseToken") {
    console.log("🔐 Storing Firebase token");
    storeFirebaseToken(request.token)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (request.action === "getAuthStatus") {
    getFirebaseToken()
      .then((token) => {
        sendResponse({
          isAuthenticated: !!token,
          hasToken: !!token,
        });
      })
      .catch(() => {
        sendResponse({
          isAuthenticated: false,
          hasToken: false,
        });
      });

    return true;
  }

  if (request.action === "clearAuth") {
    chrome.storage.local.remove(["firebase_id_token"], () => {
      sendResponse({ success: true });
    });

    return true;
  }
});

// Update badge on startup
updateBadge();
