import { useState } from "react";
import { Alert } from "react-native";
import apiService from "../services/api";

export const useSync = (products, customCategories, updateProductsFromSync) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState("ready"); // 'ready', 'syncing', 'success', 'error'

  // Get all products from server using authenticated API
  const getAllProducts = async () => {
    try {
      console.log("📥 Getting all products from server...");

      const products = await apiService.getProducts();
      console.log("📥 Received", products.length, "products from server");

      return products;
    } catch (error) {
      console.error("❌ Failed to get products:", error);
      throw error;
    }
  };

  // Add product to server using authenticated API
  const addProductToServer = async (product) => {
    try {
      console.log("➕ Adding product to server:", product.title);

      const addedProduct = await apiService.addProduct(product);
      console.log("✅ Product added to server with ID:", addedProduct.id);

      return addedProduct;
    } catch (error) {
      console.error("❌ Failed to add product to server:", error);
      throw error;
    }
  };

  // Delete product from server using authenticated API
  const deleteProductFromServer = async (productId) => {
    try {
      console.log("🗑️ Deleting product from server:", productId);

      await apiService.deleteProduct(productId);
      console.log("✅ Product deleted from server");
    } catch (error) {
      console.error("❌ Failed to delete product from server:", error);
      throw error;
    }
  };

  // Upload all products to server using authenticated API
  const uploadProductsToServer = async (productsToUpload) => {
    try {
      console.log("📤 Uploading products to server:", productsToUpload.length);

      const result = await apiService.syncProducts(productsToUpload);
      console.log("✅ Products uploaded to server");

      return result;
    } catch (error) {
      console.error("❌ Failed to upload products to server:", error);
      throw error;
    }
  };

  // Manual sync function - get all products from server and update local state
  const handleManualSync = async () => {
    if (isSyncing) {
      console.log("⚠️ Sync already in progress, skipping");
      return;
    }

    setIsSyncing(true);
    setSyncStatus("syncing");

    try {
      console.log(
        "🔄 Manual sync started - getting all products from server..."
      );

      // Get all products from server
      const serverProducts = await getAllProducts();

      // Update local state with server data
      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }

      // Update sync status
      setLastSyncTime(new Date());
      setSyncStatus("success");

      console.log(
        "✅ Manual sync completed:",
        serverProducts.length,
        "products"
      );

      // Show detailed sync results
      const currentCount = products.length;
      const newCount = serverProducts.length;
      const difference = newCount - currentCount;

      let message = `Found ${newCount} products on server.`;
      if (difference > 0) {
        message += `\n+ ${difference} new products added`;
      } else if (difference < 0) {
        message += `\n${Math.abs(difference)} products removed`;
      } else {
        message += `\nAll products are up to date`;
      }

      Alert.alert("Sync Complete! ✅", message, [{ text: "OK" }]);

      return serverProducts;
    } catch (error) {
      console.error("❌ Manual sync failed:", error);
      setSyncStatus("error");

      Alert.alert("Sync Failed", `Could not sync: ${error.message}`);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Function to add product and then sync
  const addProductAndSync = async (product) => {
    try {
      console.log("➕ Adding product and syncing...");

      // Add product to server
      await addProductToServer(product);

      // Get all products from server to update local state
      const serverProducts = await getAllProducts();

      // Update local state
      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }

      console.log("✅ Product added and synced successfully");

      return serverProducts;
    } catch (error) {
      console.error("❌ Failed to add product and sync:", error);
      throw error;
    }
  };

  // Function to delete product and then sync
  const deleteProductAndSync = async (productId) => {
    try {
      console.log("🗑️ Deleting product and syncing...");

      // Delete product from server
      await deleteProductFromServer(productId);

      // Get all products from server to update local state
      const serverProducts = await getAllProducts();

      // Update local state
      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }

      console.log("✅ Product deleted and synced successfully");

      return serverProducts;
    } catch (error) {
      console.error("❌ Failed to delete product and sync:", error);
      throw error;
    }
  };

  return {
    isSyncing,
    lastSyncTime,
    syncStatus,
    handleManualSync,
    addProductAndSync,
    deleteProductAndSync,
    getAllProducts,
    addProductToServer,
    deleteProductFromServer,
    uploadProductsToServer,
  };
};
