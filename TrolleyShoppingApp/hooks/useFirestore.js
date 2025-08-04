import { useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

export const useFirestore = () => {
  const [products, setProducts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        loadProducts();
      } else {
        setProducts([]);
        setCustomCategories([]);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .collection("products")
      .orderBy("dateAdded", "desc")
      .onSnapshot(
        (snapshot) => {
          const productsData = [];
          const categories = new Set();

          snapshot.forEach((doc) => {
            const product = { id: doc.id, ...doc.data() };
            productsData.push(product);

            if (product.category && product.category !== "general") {
              categories.add(product.category);
            }
          });

          setProducts(productsData);
          setCustomCategories(Array.from(categories));
          setIsLoading(false);

          console.log(
            "📦 Firestore real-time update:",
            productsData.length,
            "products"
          );
        },
        (error) => {
          console.error("❌ Firestore listener error:", error);
          setIsLoading(false);
        }
      );

    return unsubscribe;
  }, [user]);

  const loadProducts = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log("📦 Loading products from Firestore for user:", user.uid);

      const snapshot = await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("products")
        .orderBy("dateAdded", "desc")
        .get();

      const productsData = [];
      const categories = new Set();

      snapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        productsData.push(product);

        if (product.category && product.category !== "general") {
          categories.add(product.category);
        }
      });

      setProducts(productsData);
      setCustomCategories(Array.from(categories));
      console.log("✅ Loaded", productsData.length, "products from Firestore");
    } catch (error) {
      console.error("❌ Error loading products from Firestore:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addProduct = async (newProduct) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("➕ Adding product to Firestore:", newProduct.title);

      const docRef = await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("products")
        .add({
          ...newProduct,
          dateAdded: new Date().toISOString(),
          userId: user.uid,
        });

      console.log("✅ Product added to Firestore with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("❌ Error adding product to Firestore:", error);
      throw error;
    }
  };

  const removeProduct = async (productId) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("🗑️ Removing product from Firestore:", productId);

      await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("products")
        .doc(productId)
        .delete();

      console.log("✅ Product removed from Firestore");
    } catch (error) {
      console.error("❌ Error removing product from Firestore:", error);
      throw error;
    }
  };

  const updateProduct = async (productId, updates) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      console.log("🔄 Updating product in Firestore:", productId);

      await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("products")
        .doc(productId)
        .update({
          ...updates,
          lastModified: new Date().toISOString(),
        });

      console.log("✅ Product updated in Firestore");
    } catch (error) {
      console.error("❌ Error updating product in Firestore:", error);
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
      console.log("🗑️ Clearing all products from Firestore");

      const snapshot = await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("products")
        .get();

      const batch = firestore().batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log("✅ All products cleared from Firestore");
    } catch (error) {
      console.error("❌ Error clearing products from Firestore:", error);
      throw error;
    }
  };

  const updateProductsFromSync = (newProducts) => {
    console.log("🔄 Updating products from sync:", newProducts.length);
    setProducts(newProducts);
  };

  return {
    products,
    customCategories,
    isLoading,
    user,
    loadProducts,
    addProduct,
    removeProduct,
    updateProduct,
    addCustomCategory,
    clearAllProducts,
    updateProductsFromSync,
  };
};
