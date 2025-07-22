import { useState } from "react";
import { Alert } from "react-native";
import { cleanStoreName } from "../utils/helpers";
import apiService from "../services/api";

export const useProductExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false);

  const extractProductInfo = async (url) => {
    console.log("🔍 Extracting product info from:", url);

    try {
      console.log("🕷️ Using trolley-backend universal scraper...");

      const productData = await apiService.extractProduct(url);
      console.log("✅ Extraction successful:", productData);

      return {
        title: productData.title || `Product from ${new URL(url).hostname}`,
        image: productData.image,
        price: productData.price || "N/A",
        site: productData.site || new URL(url).hostname,
        originalPrice: productData.originalPrice,
        variants: productData.variants || {},
      };
    } catch (error) {
      console.log(
        "⚠️ trolley-backend failed, using fallback...",
        error.message
      );

      // Simple fallback when backend is unavailable
      const urlObj = new URL(url);
      return {
        title: `Product from ${urlObj.hostname}`,
        image: null,
        price: "N/A",
        site: urlObj.hostname,
        originalPrice: null,
        variants: {},
      };
    }
  };

  const addProductManually = async (
    url,
    selectedCategory,
    products,
    addProduct,
    addCustomCategory
  ) => {
    if (!url.trim()) {
      Alert.alert("Error", "Please enter a URL");
      return;
    }

    setIsExtracting(true);

    try {
      // Check for duplicates first
      const exists = products.some((p) => p.url === url.trim());
      if (exists) {
        Alert.alert("Already Added", "This product is already in your trolley");
        return;
      }

      // Extract product info
      const extractedInfo = await extractProductInfo(url.trim());

      // Use custom category or default to general
      const finalCategory = selectedCategory.trim() || "general";

      // Add to custom categories if it's new
      if (finalCategory !== "general") {
        addCustomCategory(finalCategory);
      }

      const newProduct = {
        url: url.trim(),
        category: finalCategory,
        dateAdded: new Date().toISOString(),
        ...extractedInfo,
        // Clean up the site name for display only
        displaySite: cleanStoreName(
          extractedInfo.site || new URL(url.trim()).hostname
        ),
      };

      // Add product using the backend API (which will assign an ID)
      await addProduct(newProduct);
    } catch (error) {
      Alert.alert("Error", `Failed to add product: ${error.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  return {
    isExtracting,
    extractProductInfo,
    addProductManually,
  };
};
