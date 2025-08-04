import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import auth from "@react-native-firebase/auth";

import Header from "../components/Header";
import ProductCard from "../components/ProductCard";
import AddProductModal from "../components/AddProductModal";
import CategoryModal from "../components/CategoryModal";
import FilterTabs from "../components/FilterTabs";
import BurgerMenu from "../components/BurgerMenu";
import ArchivePage from "./ArchivePage";

import { useProducts } from "../hooks/useProducts";
import { useSync } from "../hooks/useSync";
import { useProductExtraction } from "../hooks/useProductExtraction";
import { SORT_OPTIONS, STORE_NAMES } from "../utils/constants";
import { cleanStoreName } from "../utils/helpers";

const HomePage = () => {
  const [currentTab, setCurrentTab] = useState("categories");
  const [currentFilter, setCurrentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recently-added");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [isBurgerMenuVisible, setIsBurgerMenuVisible] = useState(false);
  const [showArchivePage, setShowArchivePage] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [showStoresDropdown, setShowStoresDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [user, setUser] = useState(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const {
    products,
    customCategories,
    isLoading,
    error,
    loadProducts,
    addProduct,
    removeProduct,
    updateProduct,
    addCustomCategory,
    clearAllProducts,
    updateProductsFromSync,
  } = useProducts();

  const {
    isSyncing,
    lastSyncTime,
    syncStatus,
    handleManualSync,
    addProductAndSync,
    deleteProductAndSync,
    getAllProducts,
  } = useSync(products, customCategories, updateProductsFromSync);

  const { isExtracting, addProductManually } = useProductExtraction();

  const handleSignOut = async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error("[HomePage] Error signing out:", error);
    }
  };

  const handleNavigateToArchive = () => {
    setShowArchivePage(true);
  };

  const handleBackFromArchive = () => {
    setShowArchivePage(false);
  };

  useEffect(() => {
    const initializeApp = async () => {
      console.log("🚀 App initialization started");
      await loadProducts();

      setTimeout(async () => {
        console.log(
          "🚀 Initial load starting - getting all products from server..."
        );
        try {
          const serverProducts = await getAllProducts();
          console.log(
            "📥 Downloaded",
            serverProducts.length,
            "products from server"
          );

          if (updateProductsFromSync) {
            updateProductsFromSync(serverProducts);
          }
        } catch (error) {
          console.error("❌ Initial load failed:", error);
        }
      }, 2000);
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (!isSyncing && !isLoading) {
        console.log(
          "⏰ Auto-refresh triggered - getting all products from server"
        );
        try {
          const serverProducts = await getAllProducts();
          console.log(
            "📥 Auto-refresh downloaded",
            serverProducts.length,
            "products from server"
          );

          if (updateProductsFromSync) {
            updateProductsFromSync(serverProducts);
          }
        } catch (error) {
          console.error("❌ Auto-refresh failed:", error);
        }
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [isSyncing, isLoading]);

  const handleIncomingURL = async (url) => {
    if (
      !url ||
      typeof url !== "string" ||
      url.trim() === "" ||
      url === "null" ||
      url === "undefined"
    ) {
      console.log("[HomePage] No valid URL provided, skipping");
      return;
    }
    console.log("[HomePage] Received URL for auto-addition:", url);

    try {
      let extractedUrl = null;

      if (typeof url === "string") {
        if (
          url.includes("exp+trolley-shopping-app://expo-development-client/")
        ) {
          console.log("[HomePage] Expo development client URL detected");
          const urlParams = new URLSearchParams(url.split("?")[1]);
          extractedUrl = urlParams.get("url");
          if (extractedUrl) {
            extractedUrl = decodeURIComponent(extractedUrl);
            console.log(
              "[HomePage] Decoded URL from Expo client:",
              extractedUrl
            );
          }
        } else if (url.startsWith("http://") || url.startsWith("https://")) {
          extractedUrl = url;
        } else if (url.startsWith("trolley://")) {
          const urlObj = new URL(url);
          extractedUrl = urlObj.searchParams.get("url");
        } else if (url.includes("intent://")) {
          const urlMatch = url.match(/intent:\/\/(.+?)#/);
          if (urlMatch) {
            extractedUrl = "https://" + urlMatch[1];
          }
        } else {
          const httpMatch = url.match(/(https?:\/\/[^\s]+)/);
          if (httpMatch) {
            extractedUrl = httpMatch[1];
          }
        }
      }

      if (
        !extractedUrl ||
        typeof extractedUrl !== "string" ||
        !/^https?:\/\//.test(extractedUrl)
      ) {
        console.log("[HomePage] Not a valid product URL:", extractedUrl);
        return;
      }

      const isDevelopmentUrl =
        extractedUrl.includes(".exp.direct") ||
        extractedUrl.includes("expo-development") ||
        extractedUrl.includes("localhost") ||
        extractedUrl.includes("127.0.0.1") ||
        extractedUrl.includes("192.168.") ||
        extractedUrl.includes("10.0.") ||
        extractedUrl.includes(".ngrok.") ||
        extractedUrl.includes("trolley-shopping-app");

      if (isDevelopmentUrl) {
        console.log(
          "[HomePage] Development URL detected, skipping:",
          extractedUrl
        );
        return;
      }

      console.log("[HomePage] Processing valid product URL:", extractedUrl);

      setProductUrl(extractedUrl);
      setIsAddModalVisible(true);
    } catch (error) {
      console.error("[HomePage] Error processing incoming URL:", error);
    }
  };

  useEffect(() => {
    const handleInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log("[HomePage] App opened with initial URL:", initialUrl);
        if (initialUrl && initialUrl.trim() !== "") {
          setTimeout(() => handleIncomingURL(initialUrl), 1000);
        } else {
          console.log("[HomePage] No initial URL found, app opened normally");
        }
      } catch (error) {
        console.log("[HomePage] Error getting initial URL:", error);
      }
    };

    const handleURLChange = (event) => {
      console.log("[HomePage] App received URL while running:", event);
      const url = event?.url || event;
      if (url && url.trim() !== "") {
        handleIncomingURL(url);
      }
    };

    handleInitialURL();

    const subscription = Linking.addEventListener("url", handleURLChange);

    return () => {
      subscription?.remove();
    };
  }, [products]);

  if (showArchivePage) {
    return <ArchivePage onBack={handleBackFromArchive} />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadProducts();

      const serverProducts = await getAllProducts();
      if (updateProductsFromSync) {
        updateProductsFromSync(serverProducts);
      }
    } catch (error) {
      console.error("[HomePage] Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddProduct = async () => {
    try {
      const newProduct = await addProductManually(
        productUrl,
        selectedCategory,
        products,
        addProduct,
        addCustomCategory
      );

      if (newProduct) {
        await addProductAndSync(newProduct);
      }

      setProductUrl("");
      setSelectedCategory("");
      setIsAddModalVisible(false);
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      console.log("[HomePage] Starting archiving of product:", productId);
      console.log(
        "[HomePage] Current products count before archiving:",
        products.length
      );

      // Зберігаємо поточний стан для відновлення у випадку помилки
      const previousProducts = [...products];

      // Оптимістично оновлюємо UI
      const updatedProducts = products.filter((p) => p.id !== productId);
      // Оновлюємо products через updateProductsFromSync
      if (updateProductsFromSync) {
        updateProductsFromSync(updatedProducts);
      }

      // Викликаємо API напряму без sync
      await apiService.archiveProduct(productId);
      console.log("[HomePage] Product archiving completed successfully");
    } catch (error) {
      console.error("[HomePage] Error archiving product:", error);
      // Відновлюємо попередній стан у випадку помилки
      if (updateProductsFromSync) {
        updateProductsFromSync(previousProducts);
      }
      Alert.alert("Error", "Failed to archive product");
    }
  };

  const openCategoryModal = (productId) => {
    setEditingProductId(productId);
    setIsCategoryModalVisible(true);
  };

  const changeProductCategory = (newCategory) => {
    if (editingProductId) {
      if (newCategory !== "general") {
        addCustomCategory(newCategory);
      }

      updateProduct(editingProductId, { category: newCategory });
      setIsCategoryModalVisible(false);
      setEditingProductId(null);
      setNewCategoryName("");
    }
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    const categoryValue = newCategoryName.toLowerCase().trim();
    changeProductCategory(categoryValue);
  };

  const clearAll = () => {
    Alert.alert(
      "Clear All",
      "Remove all products from your trolley? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              setIsClearingAll(true);
              console.log("[HomePage] Starting clear all operation...");

              // Зберігаємо поточний стан для відновлення у випадку помилки
              const previousProducts = [...products];

              // Оптимістично очищаємо UI
              if (updateProductsFromSync) {
                updateProductsFromSync([]);
              }

              console.log("[HomePage] Archiving all products from backend...");

              // Видаляємо всі товари без оновлення UI під час процесу
              const archivePromises = previousProducts.map((product) =>
                apiService.archiveProduct(product.id)
              );

              await Promise.all(archivePromises);

              console.log("[HomePage] All products archived from backend");

              setCurrentFilter("all");

              console.log("[HomePage] Clear all completed successfully");
              Alert.alert("Cleared", "All products removed from trolley");
            } catch (error) {
              console.error("[HomePage] Error during clear all:", error);
              // Відновлюємо попередній стан у випадку помилки
              if (updateProductsFromSync) {
                updateProductsFromSync(previousProducts);
              }
              Alert.alert("Error", "Failed to clear all products");
            } finally {
              setIsClearingAll(false);
            }
          },
        },
      ]
    );
  };

  const getFilteredProducts = () => {
    let filtered = [];
    if (currentFilter === "all") {
      filtered = products;
    } else if (currentTab === "categories") {
      filtered = products.filter((p) => p.category === currentFilter);
    } else {
      filtered = products.filter(
        (p) => (p.displaySite || p.site) === currentFilter
      );
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "a-z":
          return a.title.localeCompare(b.title);
        case "z-a":
          return b.title.localeCompare(a.title);
        case "recently-added":
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        case "last-added":
          return new Date(a.dateAdded) - new Date(b.dateAdded);
        case "price-high":
          const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, "")) || 0;
          const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, "")) || 0;
          return priceB - priceA;
        case "price-low":
          const priceA2 = parseFloat(a.price.replace(/[^0-9.-]+/g, "")) || 0;
          const priceB2 = parseFloat(b.price.replace(/[^0-9.-]+/g, "")) || 0;
          return priceA2 - priceB2;
        default:
          return new Date(b.dateAdded) - new Date(a.dateAdded);
      }
    });
  };

  const filteredProducts = getFilteredProducts();

  // if (isLoading) {
  //   return (
  //     <SafeAreaView style={styles.container}>
  //       <View style={styles.loadingContainer}>
  //         <ActivityIndicator size="large" color="#212529" />
  //         <Text style={styles.loadingText}>Loading your trolley...</Text>
  //       </View>
  //     </SafeAreaView>
  //   );
  // }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Trolley"
        onAddProduct={() => setIsAddModalVisible(true)}
        onOpenBurgerMenu={() => setIsBurgerMenuVisible(true)}
      />

      <BurgerMenu
        isVisible={isBurgerMenuVisible}
        onClose={() => setIsBurgerMenuVisible(false)}
        onNavigateToArchive={handleNavigateToArchive}
        onSignOut={handleSignOut}
      />

      <FilterTabs
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentFilter={currentFilter}
        setCurrentFilter={setCurrentFilter}
        customCategories={customCategories}
        products={products}
        showCategoriesDropdown={showCategoriesDropdown}
        setShowCategoriesDropdown={setShowCategoriesDropdown}
        showStoresDropdown={showStoresDropdown}
        setShowStoresDropdown={setShowStoresDropdown}
        showSortDropdown={showSortDropdown}
        setShowSortDropdown={setShowSortDropdown}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onFocus={() => {
          setShowCategoriesDropdown(false);
          setShowStoresDropdown(false);
          setShowSortDropdown(false);
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={
          filteredProducts.length === 0
            ? styles.emptyContentContainer
            : undefined
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={() => {
          setShowCategoriesDropdown(false);
          setShowStoresDropdown(false);
          setShowSortDropdown(false);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        {isLoading && products.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#212529" />
            <Text style={styles.loadingText}>Loading your trolley...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadProducts()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredProducts.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyState}
            onPress={() => setIsAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>
              {products.length === 0
                ? "Your trolley is empty"
                : currentTab === "categories"
                ? `No ${currentFilter} items`
                : `No items from ${currentFilter}`}
            </Text>
            <Text style={styles.emptyText}>
              {currentFilter === "all" && !searchQuery
                ? "Tap anywhere to add your first product!"
                : searchQuery
                ? `No products found for "${searchQuery}"`
                : "Try a different filter or add new items"}
            </Text>
            <View style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>+ Add Product</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {isLoading && products.length > 0 && (
              <View style={styles.subtleLoadingContainer}>
                <ActivityIndicator size="small" color="#6c757d" />
                <Text style={styles.subtleLoadingText}>Updating...</Text>
              </View>
            )}

            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onRemove={() => handleRemoveProduct(product.id)}
                onCategoryChange={() => {
                  setEditingProductId(product.id);
                  setIsCategoryModalVisible(true);
                }}
              />
            ))}

            <TouchableOpacity
              style={styles.addProductArea}
              onPress={() => setIsAddModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addProductAreaText}>
                + Tap to add another product
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomActions}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.removeAllButton,
              products.length === 0 && styles.disabledButton,
            ]}
            onPress={clearAll}
            disabled={products.length === 0 || isClearingAll}
          >
            {isClearingAll ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text
                style={[
                  styles.removeAllButtonText,
                  products.length === 0 && styles.disabledButtonText,
                ]}
              >
                Delete All
              </Text>
            )}
          </TouchableOpacity>
          {/* <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: "#e74c3c", marginTop: 12 },
            ]}
            onPress={handleSignOut}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
              Logout
            </Text>
          </TouchableOpacity> */}
        </View>
      </View>

      <AddProductModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        productUrl={productUrl}
        setProductUrl={setProductUrl}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        onAdd={handleAddProduct}
        isExtracting={isExtracting}
      />

      <CategoryModal
        visible={isCategoryModalVisible}
        onClose={() => setIsCategoryModalVisible(false)}
        products={products}
        onCategoryChange={changeProductCategory}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        onAddNewCategory={addNewCategory}
      />
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
    marginTop: 16,
  },
  content: {
    flex: 1,
  },
  emptyContentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#212529",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  addProductArea: {
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e9ecef",
    borderStyle: "dashed",
    backgroundColor: "#f8f9fa",
  },
  addProductAreaText: {
    color: "#6c757d",
    fontSize: 16,
    fontWeight: "500",
  },
  bottomActions: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    padding: 16,
  },
  actionButtons: {
    justifyContent: "center",
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  removeAllButton: {
    backgroundColor: "#212529",
  },
  removeAllButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#6c757d",
  },
  disabledButtonText: {
    color: "#adb5bd",
  },
  content: {
    flex: 1,
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    margin: 16,
    backgroundColor: "#fff3cd",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffeaa7",
  },
  errorText: {
    color: "#856404",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    margin: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e9ecef",
    borderStyle: "dashed",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#495057",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  subtleLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#f8f9fa",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 6,
  },
  subtleLoadingText: {
    marginLeft: 8,
    color: "#6c757d",
    fontSize: 14,
  },
};

export default HomePage;
