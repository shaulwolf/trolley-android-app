import { useState, useEffect } from "react";
import auth from "@react-native-firebase/auth";
import apiService from "../services/api";

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  console.log("🔄 useProducts hook initialized");

  // Listen for auth state changes
  useEffect(() => {
    console.log("🔄 Setting up auth state listener");

    const unsubscribe = auth().onAuthStateChanged((user) => {
      console.log(
        "🔄 Auth state changed:",
        user ? `User: ${user.email}` : "No user"
      );
      setUser(user);

      if (user) {
        console.log("✅ User authenticated, loading products");
        loadProducts();
      } else {
        console.log("❌ No user, clearing products");
        setProducts([]);
        setCustomCategories([]);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const loadProducts = async () => {
    if (!user) {
      console.log("❌ No user in loadProducts");
      setIsLoading(false); // Stop loading if no user
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log("📦 Loading products from backend for user:", user.uid);

      const productsData = await apiService.getProducts();
      console.log("✅ Received products from backend:", productsData.length);

      // Extract custom categories from products
      const categories = new Set();
      productsData.forEach((product) => {
        if (product.category && product.category !== "general") {
          categories.add(product.category);
        }
      });

      setProducts(productsData);
      setCustomCategories(Array.from(categories));
      console.log("✅ Products loaded successfully:", productsData.length);
    } catch (error) {
      console.error("❌ Error loading products from backend:", error);
      setError(error.message);

      // Set empty products on error so UI shows empty state instead of loading
      setProducts([]);
      setCustomCategories([]);
    } finally {
      setIsLoading(false);
      console.log("✅ Loading complete, isLoading set to false");
    }
  };

  const addProduct = async (newProduct) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("➕ Adding product to backend:", newProduct.title);

      const addedProduct = await apiService.addProduct(newProduct);

      // Update local state
      setProducts((prev) => [addedProduct, ...prev]);

      console.log("✅ Product added to backend with ID:", addedProduct.id);
      return addedProduct.id;
    } catch (error) {
      console.error("❌ Error adding product to backend:", error);
      throw error;
    }
  };

  const removeProduct = async (productId) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("🗑️ Removing product from backend:", productId);

      await apiService.deleteProduct(productId);

      // Update local state
      setProducts((prev) => prev.filter((p) => p.id !== productId));

      console.log("✅ Product removed from backend");
    } catch (error) {
      console.error("❌ Error removing product from backend:", error);
      throw error;
    }
  };

  const updateProduct = async (productId, updates) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("🔄 Updating product in backend:", productId);

      const updatedProduct = await apiService.updateProduct(productId, updates);

      // Update local state
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, ...updatedProduct } : p))
      );

      console.log("✅ Product updated in backend");
    } catch (error) {
      console.error("❌ Error updating product in backend:", error);
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
      console.log("🗑️ Clearing all products from backend");

      // Delete each product individually
      await Promise.all(
        products.map((product) => apiService.deleteProduct(product.id))
      );

      // Update local state
      setProducts([]);
      setCustomCategories([]);

      console.log("✅ All products cleared from backend");
    } catch (error) {
      console.error("❌ Error clearing products from backend:", error);
      throw error;
    }
  };

  const updateProductsFromSync = (newProducts) => {
    console.log("🔄 Updating products from sync:", newProducts.length);

    // Extract custom categories from synced products
    const categories = new Set();
    newProducts.forEach((product) => {
      if (product.category && product.category !== "general") {
        categories.add(product.category);
      }
    });

    setProducts(newProducts);
    setCustomCategories(Array.from(categories));
  };

  console.log("🔄 useProducts state:", {
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
    error, // Add error to return
    loadProducts,
    addProduct,
    removeProduct,
    updateProduct,
    addCustomCategory,
    clearAllProducts,
    updateProductsFromSync,
  };
};
