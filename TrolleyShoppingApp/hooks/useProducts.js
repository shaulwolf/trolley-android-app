import { useState, useEffect } from "react";
import auth from "@react-native-firebase/auth";
import apiService from "../services/api";

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  console.log("[useProducts] Hook initialized");

  useEffect(() => {
    console.log("[useProducts] Setting up auth state listener");

    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      console.log(
        "[useProducts] Auth state changed:",
        user ? `User: ${user.email}` : "No user"
      );
      setUser(user);
      setError(null);

      if (user) {
        console.log("[useProducts] User authenticated, loading products");

        setTimeout(() => {
          loadProducts();
        }, 500);
      } else {
        console.log("[useProducts] No user, clearing products");
        setProducts([]);
        setCustomCategories([]);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      console.log(
        "[useProducts] User effect triggered, loading products for:",
        user.email
      );
      loadProducts();
    }
  }, [user?.uid]);

  const loadProducts = async () => {
    if (!user) {
      console.log("[useProducts] No user in loadProducts");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log(
        "[useProducts] Loading products from backend for user:",
        user.uid
      );

      const isBackendHealthy = await apiService.checkBackendHealth();
      if (!isBackendHealthy) {
        throw new Error("Backend is not available");
      }

      const productsData = await apiService.getProducts();
      console.log(
        "[useProducts] Received products from backend:",
        productsData.length
      );

      const categories = new Set();
      productsData.forEach((product) => {
        if (product.category && product.category !== "general") {
          categories.add(product.category);
        }
      });

      setProducts(productsData);
      setCustomCategories(Array.from(categories));
      console.log(
        "[useProducts] Products loaded successfully:",
        productsData.length
      );
    } catch (error) {
      console.error(
        "[useProducts] Error loading products from backend:",
        error
      );
      setError(error.message);
    } finally {
      setIsLoading(false);
      console.log("[useProducts] Loading complete, isLoading set to false");
    }
  };

  const addProduct = async (newProduct) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("[useProducts] Adding product to backend:", newProduct.title);

      const addedProduct = await apiService.addProduct(newProduct);

      setProducts((prev) => [addedProduct, ...prev]);

      console.log(
        "[useProducts] Product added to backend with ID:",
        addedProduct.id
      );
      return addedProduct.id;
    } catch (error) {
      console.error("[useProducts] Error adding product to backend:", error);
      throw error;
    }
  };

  const removeProduct = async (productId) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const previousProducts = [...products];

    setProducts((prev) => prev.filter((p) => p.id !== productId));

    try {
      console.log("[useProducts] Archiving product from backend:", productId);
      await apiService.archiveProduct(productId);
      console.log("[useProducts] Product archived from backend successfully");
    } catch (error) {
      console.error(
        "[useProducts] Error archiving product from backend:",
        error
      );

      setProducts(previousProducts);
      throw error;
    }
  };

  const updateProduct = async (productId, updates) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("[useProducts] Updating product in backend:", productId);

      const updatedProduct = await apiService.updateProduct(productId, updates);

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, ...updatedProduct } : p))
      );

      console.log("[useProducts] Product updated in backend");
    } catch (error) {
      console.error("[useProducts] Error updating product in backend:", error);
      throw error;
    }
  };

  const addCustomCategory = (category) => {
    if (!customCategories.includes(category)) {
      setCustomCategories((prev) => [...prev, category]);
    }
  };

  const clearAllProducts = async () => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("[useProducts] Clearing all products from backend");

      await Promise.all(
        products.map((product) => apiService.deleteProduct(product.id))
      );

      setProducts([]);
      setCustomCategories([]);

      console.log("[useProducts] All products cleared from backend");
    } catch (error) {
      console.error(
        "[useProducts] Error clearing products from backend:",
        error
      );
      throw error;
    }
  };

  const updateProductsFromSync = (newProducts) => {
    console.log(
      "[useProducts] Updating products from sync:",
      newProducts.length
    );

    const categories = new Set();
    newProducts.forEach((product) => {
      if (product.category && product.category !== "general") {
        categories.add(product.category);
      }
    });

    setProducts(newProducts);
    setCustomCategories(Array.from(categories));
  };

  console.log("[useProducts] State:", {
    productsCount: products.length,
    isLoading,
    hasUser: !!user,
    error: error,
  });

  return {
    products,
    customCategories,
    isLoading,
    user,
    error,
    loadProducts,
    addProduct,
    removeProduct,
    updateProduct,
    addCustomCategory,
    clearAllProducts,
    updateProductsFromSync,
  };
};
