import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { SORT_OPTIONS } from "../utils/constants";

const FilterTabs = ({
  currentTab,
  setCurrentTab,
  showCategoriesDropdown,
  setShowCategoriesDropdown,
  showStoresDropdown,
  setShowStoresDropdown,
  showSortDropdown,
  setShowSortDropdown,
  currentFilter,
  setCurrentFilter,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  products,
  onFocus,
}) => {
  const getCategoryCounts = () => {
    const counts = { all: products.length };
    products.forEach((product) => {
      const category = product.category || "general";
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  };

  const getStoreCounts = () => {
    const counts = { all: products.length };
    products.forEach((product) => {
      const store = product.displaySite || product.site;
      counts[store] = (counts[store] || 0) + 1;
    });
    return counts;
  };

  return (
    <>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, currentTab === "categories" && styles.activeTab]}
          onPress={() => {
            setShowCategoriesDropdown(!showCategoriesDropdown);
            setShowStoresDropdown(false);
            setCurrentTab("categories");
          }}
        >
          <Text
            style={[
              styles.tabText,
              currentTab === "categories" && styles.activeTabText,
            ]}
          >
            Categories {showCategoriesDropdown ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentTab === "stores" && styles.activeTab]}
          onPress={() => {
            setShowStoresDropdown(!showStoresDropdown);
            setShowCategoriesDropdown(false);
            setCurrentTab("stores");
          }}
        >
          <Text
            style={[
              styles.tabText,
              currentTab === "stores" && styles.activeTabText,
            ]}
          >
            Stores {showStoresDropdown ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search and Sort Bar */}
      <View style={styles.searchSortContainer}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="#999"
            onFocus={onFocus}
          />
        </View>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            setShowSortDropdown(!showSortDropdown);
            setShowCategoriesDropdown(false);
            setShowStoresDropdown(false);
          }}
        >
          <Text style={styles.sortButtonText}>
            Sort {showSortDropdown ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categories Dropdown */}
      {showCategoriesDropdown && (
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdown}>
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                currentFilter === "all" && styles.activeDropdownItem,
              ]}
              onPress={() => {
                setCurrentFilter("all");
                setShowCategoriesDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownText,
                  currentFilter === "all" && styles.activeDropdownText,
                ]}
              >
                All Items ({products.length})
              </Text>
            </TouchableOpacity>
            {[...new Set(products.map((p) => p.category || "general"))].map(
              (category) => {
                const count = products.filter(
                  (p) => (p.category || "general") === category
                ).length;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.dropdownItem,
                      currentFilter === category && styles.activeDropdownItem,
                    ]}
                    onPress={() => {
                      setCurrentFilter(category);
                      setShowCategoriesDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        currentFilter === category && styles.activeDropdownText,
                      ]}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)} (
                      {count})
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        </View>
      )}

      {/* Sort Dropdown */}
      {showSortDropdown && (
        <View style={styles.sortDropdownContainer}>
          <View style={styles.dropdown}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownItem,
                  sortBy === option.value && styles.activeDropdownItem,
                ]}
                onPress={() => {
                  setSortBy(option.value);
                  setShowSortDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    sortBy === option.value && styles.activeDropdownText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Stores Dropdown */}
      {showStoresDropdown && (
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdown}>
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                currentFilter === "all" && styles.activeDropdownItem,
              ]}
              onPress={() => {
                setCurrentFilter("all");
                setShowStoresDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownText,
                  currentFilter === "all" && styles.activeDropdownText,
                ]}
              >
                All Stores ({products.length})
              </Text>
            </TouchableOpacity>
            {[...new Set(products.map((p) => p.displaySite || p.site))].map(
              (store) => {
                const count = products.filter(
                  (p) => (p.displaySite || p.site) === store
                ).length;
                return (
                  <TouchableOpacity
                    key={store}
                    style={[
                      styles.dropdownItem,
                      currentFilter === store && styles.activeDropdownItem,
                    ]}
                    onPress={() => {
                      setCurrentFilter(store);
                      setShowStoresDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        currentFilter === store && styles.activeDropdownText,
                      ]}
                    >
                      {store} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        </View>
      )}
    </>
  );
};

const styles = {
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6c757d",
  },
  activeTabText: {
    color: "#212529",
  },
  searchSortContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    gap: 12,
  },
  searchContainer: {
    flex: 2,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#212529",
    backgroundColor: "#fff",
  },
  sortButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sortButtonText: {
    fontSize: 14,
    color: "#495057",
    fontWeight: "500",
    textAlign: "center",
  },
  dropdownContainer: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  sortDropdownContainer: {
    position: "absolute",
    top: 170,
    right: 20,
    minWidth: 140,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  dropdown: {
    maxHeight: 250,
    borderRadius: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  activeDropdownItem: {
    backgroundColor: "#f8f9fa",
  },
  dropdownText: {
    fontSize: 14,
    color: "#495057",
  },
  activeDropdownText: {
    color: "#212529",
    fontWeight: "600",
  },
};

export default FilterTabs;
