import { useState } from "react";
import { Alert } from "react-native";
import { cleanStoreName } from "../utils/helpers";
import apiService from "../services/api";

export const useProductExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false);

  const extractProductInfo = async (url) => {
    console.log("[useProductExtraction] Extracting product info from:", url);

    try {
      console.log(
        "[useProductExtraction] Using trolley-backend universal scraper..."
      );

      const productData = await apiService.extractProduct(url);
      console.log("[useProductExtraction] Extraction successful:", productData);

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
        "[useProductExtraction] trolley-backend failed, using fallback...",
        error.message
      );

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
      const exists = products.some((p) => p.url === url.trim());
      if (exists) {
        Alert.alert("Already Added", "This product is already in your trolley");
        return;
      }

      const extractedInfo = await extractProductInfo(url.trim());

      const finalCategory = selectedCategory.trim() || "general";

      if (finalCategory !== "general") {
        addCustomCategory(finalCategory);
      }

      const newProduct = {
        url: url.trim(),
        category: finalCategory,
        dateAdded: new Date().toISOString(),
        ...extractedInfo,
        displaySite: cleanStoreName(
          extractedInfo.site || new URL(url.trim()).hostname
        ),
      };

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
