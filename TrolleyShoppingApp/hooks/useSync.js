import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { STORAGE_KEY, BACKEND_URL } from "../utils/constants";

export const useSync = (products, customCategories, updateProductsFromSync) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState("ready"); // 'ready', 'syncing', 'success', 'error'

  // Simple function to get all products from server
  const getAllProducts = async () => {
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
  };

  // Simple function to add product to server
  const addProductToServer = async (product) => {
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
  };

  // Simple function to delete product from server
  const deleteProductFromServer = async (productId) => {
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

      // Save to local storage
      const data = {
        products: serverProducts,
        customCategories,
        lastSync: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      // Update sync status
      setLastSyncTime(new Date());
      setSyncStatus("success");

      console.log(
        "✅ Manual sync completed:",
        serverProducts.length,
        "products"
      );

      Alert.alert(
        "Sync Complete! ✅",
        `Downloaded ${serverProducts.length} products from server.`,
        [{ text: "OK" }]
      );

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

      // Save to local storage
      const data = {
        products: serverProducts,
        customCategories,
        lastSync: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));

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

      // Save to local storage
      const data = {
        products: serverProducts,
        customCategories,
        lastSync: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));

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
  };
};
