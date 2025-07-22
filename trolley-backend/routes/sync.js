const express = require("express");
const { FirebaseService } = require("../services/firebase");
const { authenticateUser } = require("../middleware/auth");
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// GET /api/sync - Get products with optional timestamp filtering
router.get("/", async (req, res) => {
  try {
    const userId = req.user.uid;
    const { since } = req.query;
    console.log(
      `📥 Enhanced Sync GET request from user: ${req.user.email}${
        since ? ` since ${since}` : ""
      }`
    );

    // Get all products for the user (Firebase handles user isolation automatically)
    const products = await FirebaseService.getUserProducts(userId);

    // Filter by timestamp if provided
    let filteredProducts = products;
    if (since) {
      filteredProducts = products.filter((product) => {
        const lastModified = product.lastModified || product.dateAdded;
        return new Date(lastModified) > new Date(since);
      });
    }

    // Parse variants and ensure proper format
    const parsedProducts = filteredProducts.map((product) => ({
      ...product,
      variants:
        typeof product.variants === "string"
          ? JSON.parse(product.variants || "{}")
          : product.variants || {},
      lastModified: product.lastModified || product.dateAdded,
    }));

    const syncData = {
      products: parsedProducts,
      timestamp: new Date().toISOString(),
      count: parsedProducts.length,
      filtered: !!since,
      userId: userId,
    };

    console.log(
      `📤 Sending ${parsedProducts.length} products for sync to user ${req.user.email}`
    );
    res.json(syncData);
  } catch (error) {
    console.error("❌ Error in enhanced sync GET:", error);
    res.status(500).json({
      error: "Failed to get sync data",
      message: error.message,
    });
  }
});

// POST /api/sync - Upload products for sync (HANDLES DELETIONS BY REPLACEMENT)
router.post("/", async (req, res) => {
  try {
    const userId = req.user.uid;
    const { products, deviceId } = req.body;

    console.log(`📥 Sync POST request from user: ${req.user.email}`);
    console.log(`📱 Device: ${deviceId || "Unknown"}`);
    console.log(`📊 Received ${products?.length || 0} products`);
    console.log(
      `🔄 Using complete state replacement (handles deletions automatically)`
    );

    // Validate input
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Products array is required",
      });
    }

    // Prepare products for sync - ensure proper format
    const productsToSync = products.map((product, index) => {
      // Ensure required fields
      if (!product.url || !product.title) {
        throw new Error(
          `Product at index ${index} is missing required fields (url, title)`
        );
      }

      return {
        id: product.id || `${Date.now()}_${index}`,
        url: product.url,
        title: product.title || "Unknown Product",
        price: product.price || "N/A",
        originalPrice: product.originalPrice || null,
        image: product.image || null,
        site: product.site || new URL(product.url).hostname,
        displaySite:
          product.displaySite || product.site || new URL(product.url).hostname,
        category: product.category || "general",
        variants: product.variants || {},
        dateAdded: product.dateAdded || new Date().toISOString(),
        lastModified: product.lastModified || new Date().toISOString(),
        deviceSource: deviceId || "unknown",
      };
    });

    // Perform complete state replacement using Firebase transaction
    const syncedProductIds = await FirebaseService.syncUserProducts(
      userId,
      productsToSync
    );

    console.log(
      `✅ Complete state sync completed for user ${req.user.email}: ${syncedProductIds.length} products`
    );
    console.log(
      `🔄 Any products not in upload from ${
        deviceId || "device"
      } have been automatically deleted`
    );

    res.json({
      success: true,
      synced: syncedProductIds.length,
      productIds: syncedProductIds,
      message: "Complete state replacement completed",
      timestamp: new Date().toISOString(),
      userId: userId,
    });
  } catch (error) {
    console.error("❌ Error in complete state sync:", error);

    if (error.message.includes("missing required fields")) {
      res.status(400).json({
        error: "Invalid product data",
        message: error.message,
      });
    } else {
      res.status(500).json({
        error: "Failed to sync products",
        message: error.message,
      });
    }
  }
});

// GET /api/sync/status - Get sync status and statistics
router.get("/status", async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(`📥 Sync status request from user: ${req.user.email}`);

    // Get all products for this user
    const products = await FirebaseService.getUserProducts(userId);

    // Calculate statistics
    const deviceStats = {};
    let newestUpdate = null;

    products.forEach((product) => {
      const deviceSource = product.deviceSource || "unknown";
      deviceStats[deviceSource] = (deviceStats[deviceSource] || 0) + 1;

      const lastModified = product.lastModified || product.dateAdded;
      if (!newestUpdate || new Date(lastModified) > new Date(newestUpdate)) {
        newestUpdate = lastModified;
      }
    });

    // Convert deviceStats object to array format for consistency
    const deviceBreakdown = Object.entries(deviceStats).map(
      ([deviceSource, count]) => ({
        deviceSource,
        count,
      })
    );

    const status = {
      totalProducts: products.length,
      deviceBreakdown: deviceBreakdown,
      newestUpdate: newestUpdate,
      serverTime: new Date().toISOString(),
      userId: userId,
      userEmail: req.user.email,
    };

    console.log(
      `📊 Sync status for user ${req.user.email}: ${products.length} products`
    );
    res.json(status);
  } catch (error) {
    console.error("❌ Error getting sync status:", error);
    res.status(500).json({
      error: "Failed to get sync status",
      message: error.message,
    });
  }
});

// POST /api/sync/merge - Merge products instead of replacing (alternative sync method)
router.post("/merge", async (req, res) => {
  try {
    const userId = req.user.uid;
    const { products, deviceId } = req.body;

    console.log(`📥 Sync MERGE request from user: ${req.user.email}`);
    console.log(`📱 Device: ${deviceId || "Unknown"}`);
    console.log(`📊 Received ${products?.length || 0} products for merging`);

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Products array is required",
      });
    }

    // Get existing products
    const existingProducts = await FirebaseService.getUserProducts(userId);
    const existingUrls = new Set(existingProducts.map((p) => p.url));

    // Filter out products that already exist
    const newProducts = products.filter(
      (product) => !existingUrls.has(product.url)
    );

    console.log(
      `🔄 Merging ${newProducts.length} new products (${
        products.length - newProducts.length
      } already exist)`
    );

    // Add only new products
    const addedProductIds = [];
    for (const product of newProducts) {
      try {
        const productData = {
          id:
            product.id ||
            Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: product.url,
          title: product.title || "Unknown Product",
          price: product.price || "N/A",
          originalPrice: product.originalPrice || null,
          image: product.image || null,
          site: product.site || new URL(product.url).hostname,
          displaySite:
            product.displaySite ||
            product.site ||
            new URL(product.url).hostname,
          category: product.category || "general",
          variants: product.variants || {},
          dateAdded: product.dateAdded || new Date().toISOString(),
          deviceSource: deviceId || "unknown",
        };

        const productId = await FirebaseService.addUserProduct(
          userId,
          productData
        );
        addedProductIds.push(productId);
      } catch (error) {
        console.error(`❌ Error adding product ${product.url}:`, error.message);
      }
    }

    console.log(
      `✅ Merge sync completed for user ${req.user.email}: ${addedProductIds.length} products added`
    );

    res.json({
      success: true,
      added: addedProductIds.length,
      skipped: products.length - newProducts.length,
      total: products.length,
      message: "Merge sync completed",
      timestamp: new Date().toISOString(),
      userId: userId,
    });
  } catch (error) {
    console.error("❌ Error in merge sync:", error);
    res.status(500).json({
      error: "Failed to merge products",
      message: error.message,
    });
  }
});

module.exports = router;
