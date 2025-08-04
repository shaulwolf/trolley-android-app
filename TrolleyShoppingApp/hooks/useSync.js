import { useState } from "react";
import { Alert } from "react-native";
import apiService from "../services/api";

export const useSync = (products, customCategories, updateProductsFromSync) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState("ready");

  const getAllProducts = async () => {
    try {
      console.log("[useSync] Getting all products from server...");

      const products = await apiService.getProducts();
      console.log(
        "[useSync] Received",
        products.length,
        "products from server"
      );

      return products;
    } catch (error) {
      console.error("[useSync] Failed to get products:", error);
      throw error;
    }
  };

  const addProductToServer = async (product) => {
    try {
      console.log("[useSync] Adding product to server:", product.title);

      const addedProduct = await apiService.addProduct(product);
      console.log(
        "[useSync] Product added to server with ID:",
        addedProduct.id
      );

      return addedProduct;
    } catch (error) {
      console.error("[useSync] Failed to add product to server:", error);
      throw error;
    }
  };

  const deleteProductFromServer = async (productId) => {
    try {
      console.log("[useSync] Deleting product from server:", productId);

      await apiService.deleteProduct(productId);
      console.log("[useSync] Product deleted from server");
    } catch (error) {
      console.error("[useSync] Failed to delete product from server:", error);
      throw error;
    }
  };

  const uploadProductsToServer = async (productsToUpload) => {
    try {
      console.log(
        "[useSync] Uploading products to server:",
        productsToUpload.length
      );

      const result = await apiService.syncProducts(productsToUpload);
      console.log("[useSync] Products uploaded to server");

      return result;
    } catch (error) {
      console.error("[useSync] Failed to upload products to server:", error);
      throw error;
    }
  };

  const handleManualSync = async () => {
    if (isSyncing) {
      console.log("[useSync] Sync already in progress, skipping");
      return;
    }

    setIsSyncing(true);
    setSyncStatus("syncing");

    try {
      console.log(
        "[useSync] Manual sync started - getting all products from server..."
      );

      const serverProducts = await getAllProducts();

      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }

      setLastSyncTime(new Date());
      setSyncStatus("success");

      console.log(
        "[useSync] Manual sync completed:",
        serverProducts.length,
        "products"
      );

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

      Alert.alert("Sync Complete!", message, [{ text: "OK" }]);

      return serverProducts;
    } catch (error) {
      console.error("[useSync] Manual sync failed:", error);
      setSyncStatus("error");

      Alert.alert("Sync Failed", `Could not sync: ${error.message}`);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const addProductAndSync = async (product) => {
    try {
      console.log("[useSync] Adding product and syncing...");

      await addProductToServer(product);

      const serverProducts = await getAllProducts();

      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }

      console.log("[useSync] Product added and synced successfully");

      return serverProducts;
    } catch (error) {
      console.error("[useSync] Failed to add product and sync:", error);
      throw error;
    }
  };

  const deleteProductAndSync = async (productId) => {
    try {
      console.log("[useSync] Archiving product and syncing...");

      await apiService.archiveProduct(productId);

      const serverProducts = await getAllProducts();

      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }

      console.log("[useSync] Product archived and synced successfully");

      return serverProducts;
    } catch (error) {
      console.error("[useSync] Failed to archive product and sync:", error);
      throw error;
    }
  };

  const deleteProductAndSyncOptimistic = async (
    productId,
    onOptimisticUpdate,
    onError
  ) => {
    try {
      console.log("[useSync] Archiving product with optimistic update...");

      if (onOptimisticUpdate) {
        onOptimisticUpdate(productId);
      }

      await apiService.archiveProduct(productId);

      const serverProducts = await getAllProducts();

      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }

      console.log("[useSync] Product archived and synced successfully");

      return serverProducts;
    } catch (error) {
      console.error("[useSync] Failed to archive product and sync:", error);

      if (onError) {
        onError(productId, error);
      }

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
    deleteProductAndSyncOptimistic,
    getAllProducts,
    addProductToServer,
    deleteProductFromServer,
    uploadProductsToServer,
  };
};
