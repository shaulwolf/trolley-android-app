import React from "react";
import { View, Text, TouchableOpacity, Image, Linking } from "react-native";
import { renderVariants } from "../utils/helpers";
import { useImageLoader } from "../hooks/useImageLoader";

const ProductCard = ({ product, onRemove, onCategoryChange }) => {
  const imageUri = useImageLoader(product.image);

  const calculateDiscountPercentage = (originalPrice, salePrice) => {
    if (!originalPrice || !salePrice) return "";

    try {
      // Extract numeric values from prices
      const originalNum = parseFloat(
        originalPrice.replace(/[^0-9.,]/g, "").replace(",", ".")
      );
      const saleNum = parseFloat(
        salePrice.replace(/[^0-9.,]/g, "").replace(",", ".")
      );

      // Check for invalid numbers
      if (isNaN(originalNum) || isNaN(saleNum)) {
        console.log("⚠️ Invalid price numbers:", { originalNum, saleNum });
        return "";
      }

      // Check if there's actually a discount (at least 1% difference)
      const difference = originalNum - saleNum;
      const percentDifference = (difference / originalNum) * 100;

      // Only show discount if it's at least 1% and sale price is lower
      if (difference < 0.01 || percentDifference < 1) {
        return "";
      }

      const discountPercent = Math.round(percentDifference);
      return `-${discountPercent}%`;
    } catch (error) {
      console.error("Error calculating discount:", error);
      return "";
    }
  };

  const openProduct = (url) => {
    Linking.openURL(url);
  };

  const openStore = (product) => {
    const siteUrl = product.site;

    if (!siteUrl) {
      console.log("No site URL available for product:", product);
      return;
    }

    let storeUrl;

    try {
      const url = new URL(
        siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`
      );
      storeUrl = `${url.protocol}//${url.hostname}`;
    } catch (error) {
      console.log("Error parsing store URL:", error);
      storeUrl = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    }

    Linking.openURL(storeUrl);
  };

  return (
    <View style={styles.productCard}>
      {/* Product Image */}
      <TouchableOpacity
        style={styles.productImageContainer}
        onPress={() => openProduct(product.url)}
        activeOpacity={0.7}
      >
        {product.image ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noImageContainer}>
            <Text style={styles.noImageText}>No Image</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <TouchableOpacity onPress={() => openProduct(product.url)}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {product.title}
          </Text>
        </TouchableOpacity>

        {/* Pricing */}
        <View style={styles.productPricing}>
          {(() => {
            if (product.originalPrice && product.price) {
              const discount = calculateDiscountPercentage(
                product.originalPrice,
                product.price
              );
              // Only show original price if there's a real discount
              return discount ? (
                <Text style={styles.originalPrice}>
                  {product.originalPrice}
                </Text>
              ) : null;
            }
            return null;
          })()}
          <Text
            style={[
              styles.salePrice,
              (() => {
                if (product.originalPrice && product.price) {
                  const discount = calculateDiscountPercentage(
                    product.originalPrice,
                    product.price
                  );
                  return discount ? styles.discountPrice : styles.normalPrice;
                }
                return styles.normalPrice;
              })(),
            ]}
          >
            {product.price}
          </Text>
          {(() => {
            if (product.originalPrice && product.price) {
              const discount = calculateDiscountPercentage(
                product.originalPrice,
                product.price
              );
              return discount ? (
                <Text style={styles.discountBadge}>{discount}</Text>
              ) : null;
            }
            return null;
          })()}
        </View>

        {/* Store */}
        <TouchableOpacity onPress={() => openStore(product)}>
          <Text style={styles.productSite}>{product.site}</Text>
        </TouchableOpacity>

        {/* Variants */}
        {renderVariants(product.variants) && (
          <Text style={styles.productVariants}>
            {renderVariants(product.variants)}
          </Text>
        )}

        {/* Date */}
        <Text style={styles.productDate}>
          Added {new Date(product.dateAdded).toLocaleDateString()}
        </Text>

        {/* Footer */}
        <View style={styles.productFooter}>
          <TouchableOpacity
            style={styles.categoryTagContainer}
            onPress={() => onCategoryChange(product.id)}
          >
            <Text style={styles.categoryTag}>
              {product.category.charAt(0).toUpperCase() +
                product.category.slice(1)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRemove(product.id)}>
            <Text style={styles.removeButton}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = {
  productCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  noImageContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
  },
  noImageText: {
    fontSize: 12,
    color: "#adb5bd",
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 4,
    lineHeight: 20,
  },
  productPricing: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  originalPrice: {
    fontSize: 13,
    color: "#6c757d",
    textDecorationLine: "line-through",
    marginRight: 8,
    fontWeight: "400",
  },
  salePrice: {
    fontSize: 14,
    fontWeight: "600",
  },
  discountPrice: {
    color: "#dc3545",
  },
  normalPrice: {
    color: "#212529",
    fontWeight: "500",
  },
  discountBadge: {
    fontSize: 11,
    color: "#ffffff",
    backgroundColor: "#dc3545",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
    fontWeight: "600",
    overflow: "hidden",
  },
  productSite: {
    fontSize: 12,
    color: "#007bff",
    marginBottom: 4,
  },
  productVariants: {
    fontSize: 12,
    color: "#6c757d",
    fontStyle: "italic",
    marginBottom: 4,
  },
  productDate: {
    fontSize: 10,
    color: "#6c757d",
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryTagContainer: {
    backgroundColor: "#e9ecef",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryTag: {
    color: "#495057",
    fontSize: 10,
    fontWeight: "500",
  },
  removeButton: {
    color: "#dc3545",
    fontSize: 12,
    fontWeight: "500",
  },
};

export default ProductCard;
