import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProductCard from "../components/ProductCard";
import apiService from "../services/api";
import { cleanStoreName } from "../utils/helpers";

const ArchivePage = ({ onBack }) => {
  const [archivedProducts, setArchivedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringProductId, setRestoringProductId] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);

  const loadArchivedProducts = async () => {
    try {
      setIsLoading(true);
      console.log("[ArchivePage] Loading archived products...");

      const response = await apiService.getArchivedProducts();
      setArchivedProducts(response.products || []);

      console.log(
        "[ArchivePage] Loaded archived products:",
        response.products?.length || 0
      );
    } catch (error) {
      console.error("[ArchivePage] Error loading archived products:", error);
      Alert.alert("Error", "Failed to load archived products");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadArchivedProducts();
    setRefreshing(false);
  };

  useEffect(() => {
    loadArchivedProducts();
  }, []);

  const handleRestoreProduct = async (productId) => {
    try {
      setRestoringProductId(productId);
      console.log("[ArchivePage] Restoring product:", productId);
      await apiService.restoreProduct(productId);
      setArchivedProducts((prev) =>
        prev.filter((product) => product.id !== productId)
      );
      Alert.alert("Success", "Product restored successfully");
    } catch (error) {
      console.error("[ArchivePage] Error restoring product:", error);
      Alert.alert("Error", "Failed to restore product");
    } finally {
      setRestoringProductId(null);
    }
  };

  const handleDeletePermanently = async (productId) => {
    Alert.alert(
      "Delete Permanently",
      "This action cannot be undone. Are you sure you want to delete this product permanently?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingProductId(productId);
              console.log(
                "[ArchivePage] Deleting product permanently:",
                productId
              );
              await apiService.deleteArchivedProduct(productId);
              setArchivedProducts((prev) =>
                prev.filter((product) => product.id !== productId)
              );
              Alert.alert("Success", "Product deleted permanently");
            } catch (error) {
              console.error("[ArchivePage] Error deleting product:", error);
              Alert.alert("Error", "Failed to delete product");
            } finally {
              setDeletingProductId(null);
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }) => (
    <View style={styles.productContainer}>
      <View style={styles.productContent}>
        <View style={styles.productImageContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.productImage} />
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image-outline" size={24} color="#CCC" />
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.productPricing}>
            {item.originalPrice && item.originalPrice !== item.price && (
              <Text style={styles.originalPrice}>{item.originalPrice}</Text>
            )}
            <Text
              style={[
                styles.salePrice,
                item.originalPrice && item.originalPrice !== item.price
                  ? styles.discountPrice
                  : styles.normalPrice,
              ]}
            >
              {item.price}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.siteLink}
            onPress={() => Linking.openURL(item.url)}
          >
            <Text style={styles.siteText}>{item.displaySite || item.site}</Text>
          </TouchableOpacity>

          <Text style={styles.addedDate}>
            Added {new Date(item.createdAt).toLocaleDateString()}
          </Text>

          <View style={styles.categoryContainer}>
            <Text style={styles.categoryTag}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.restoreButton]}
            onPress={() => handleRestoreProduct(item.id)}
            disabled={
              restoringProductId === item.id || deletingProductId === item.id
            }
          >
            {restoringProductId === item.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="arrow-undo" size={16} color="white" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeletePermanently(item.id)}
            disabled={
              restoringProductId === item.id || deletingProductId === item.id
            }
          >
            {deletingProductId === item.id ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="trash" size={16} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading archived products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Archived Products</Text>
        <View style={styles.placeholder} />
      </View>

      {archivedProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="archive" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No Archived Products</Text>
          <Text style={styles.emptySubtitle}>
            Products you archive will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    // paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  placeholder: {
    width: 34,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  listContainer: {
    padding: 16,
  },
  productContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  productContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  productImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 12,
    backgroundColor: "#F8F9FA",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  noImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  productInfo: {
    flex: 1,
    marginRight: 8,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
    lineHeight: 20,
  },
  productPricing: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 11,
    color: "#999",
    textDecorationLine: "line-through",
    marginRight: 6,
  },
  salePrice: {
    fontSize: 16,
    fontWeight: "700",
  },
  normalPrice: {
    color: "#333",
  },
  discountPrice: {
    color: "#FF3B30",
  },
  siteLink: {
    marginBottom: 3,
  },
  siteText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  addedDate: {
    fontSize: 11,
    color: "#999",
    marginBottom: 4,
  },
  categoryContainer: {
    alignSelf: "flex-start",
  },
  categoryTag: {
    fontSize: 10,
    color: "#666",
    fontWeight: "600",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 6,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreButton: {
    backgroundColor: "#007AFF",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
});

export default ArchivePage;
