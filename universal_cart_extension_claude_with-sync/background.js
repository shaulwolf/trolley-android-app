// Simple Trolley Background Service
const BACKEND_URL = "http://localhost:3000";

// Get all products from server
async function getAllProducts() {
  try {
    console.log("📥 Getting all products from server...");

    const response = await fetch(`${BACKEND_URL}/api/products`);

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

// Add product to server
async function addProduct(product) {
  try {
    console.log("➕ Adding product to server:", product.title);

    const response = await fetch(`${BACKEND_URL}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: product.id,
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
    });

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

// Delete product from server
async function deleteProduct(productId) {
  try {
    console.log("🗑️ Deleting product from server:", productId);

    const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

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

// Convert server products to Chrome storage format
function serverToChrome(serverProducts) {
  console.log(
    "🔄 Converting server products to Chrome format:",
    serverProducts
  );

  const chromeData = {};

  if (!serverProducts || serverProducts.length === 0) {
    console.log("📭 No products to convert, returning empty object");
    return chromeData;
  }

  serverProducts.forEach((product) => {
    const category =
      product.category === "general" ? "All Items" : product.category;
    if (!chromeData[category]) {
      chromeData[category] = [];
    }
    chromeData[category].push(product);
  });

  console.log("✅ Converted to Chrome format:", chromeData);
  return chromeData;
}

// Initialize badge
function updateBadge() {
  chrome.storage.local.get({ cart: {} }, ({ cart }) => {
    const total = Object.values(cart).flat().length;
    chrome.action.setBadgeText({ text: total > 0 ? total.toString() : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#000" });
    console.log("📊 Badge updated:", total, "products");
  });
}

// Handle messages from popup
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
        sendResponse({ success: false, error: error.message });
      });
  } else if (request.action === "addProduct") {
    console.log("➕ Add product requested:", request.product);
    console.log(
      "📦 Product data being sent to server:",
      JSON.stringify(request.product, null, 2)
    );

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
        sendResponse({ success: false, error: error.message });
      });
  } else if (request.action === "deleteProduct") {
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
        sendResponse({ success: false, error: error.message });
      });
  }

  return true;
});

// Initialize when extension loads
chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Trolley extension installed/reloaded");
  updateBadge();
});

// Update badge when storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.cart) {
    updateBadge();
  }
});

console.log("🔄 Simple background script loaded successfully");
