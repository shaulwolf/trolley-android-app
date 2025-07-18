import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEY } from "../utils/constants";

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProducts = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setProducts(data.products || []);
        setCustomCategories(data.customCategories || []);
        console.log("Loaded products:", data.products?.length || 0);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProducts = async () => {
    try {
      const data = {
        products,
        customCategories,
        lastSync: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log("💾 Saved products to AsyncStorage:", products.length);
    } catch (error) {
      console.error("Error saving products:", error);
    }
  };

  const addProduct = (newProduct) => {
    setProducts((prev) => [...prev, newProduct]);
  };

  const removeProduct = (productId) => {
    console.log("🗑️ Removing product with ID:", productId);
    setProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== productId);
      console.log(`🗑️ Product removed. New count: ${filtered.length}`);
      return filtered;
    });
  };

  const updateProduct = (productId, updates) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
  };

  const addCustomCategory = (category) => {
    if (!customCategories.includes(category)) {
      setCustomCategories((prev) => [...prev, category]);
    }
  };

  const clearAllProducts = () => {
    setProducts([]);
  };

  // Function to update products from sync
  const updateProductsFromSync = (newProducts) => {
    console.log("🔄 Updating products from sync:", newProducts.length);
    setProducts(newProducts);
  };

  // Save products whenever they change
  useEffect(() => {
    if (!isLoading) {
      saveProducts();
    }
  }, [products, customCategories, isLoading]);

  return {
    products,
    customCategories,
    isLoading,
    loadProducts,
    addProduct,
    removeProduct,
    updateProduct,
    addCustomCategory,
    clearAllProducts,
    updateProductsFromSync,
  };
};
