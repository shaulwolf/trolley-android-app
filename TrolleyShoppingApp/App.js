import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  Alert, 
  TextInput, 
  Modal, 
  ScrollView,
  Linking,
  RefreshControl,
  Image,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const STORAGE_KEY = '@trolley_products';
const { width } = Dimensions.get('window');

export default function App() {
  const [products, setProducts] = useState([]);
  const [customCategories, setCustomCategories] = useState(['general', 'clothing', 'electronics', 'home', 'books']);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentTab, setCurrentTab] = useState('categories'); // 'categories' or 'stores'
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isScreenshotModalVisible, setIsScreenshotModalVisible] = useState(false);

  // IMPROVED URL HANDLING
const handleIncomingURL = (url) => {
  console.log('📱 Received URL:', url);
  console.log('📱 URL type:', typeof url);
  
  // Show alert to see what we're receiving
  Alert.alert('Debug: Received URL', `URL: ${url}\nType: ${typeof url}`);
  
  try {
    // Handle different types of shared content
    if (typeof url === 'string') {
      console.log('📱 Processing string URL');
      
      // Direct URL sharing
      if (url.startsWith('http://') || url.startsWith('https://')) {
        console.log('📱 Direct HTTP URL shared');
        Alert.alert('Debug', 'Found HTTP URL, setting product URL');
        setProductUrl(url);
        setIsAddModalVisible(true);
        return;
      }
      
      // Custom scheme
      if (url.startsWith('trolley://')) {
        console.log('📱 Custom scheme URL');
        Alert.alert('Debug', 'Found custom scheme URL');
        try {
          const urlObj = new URL(url);
          const productUrl = urlObj.searchParams.get('url');
          if (productUrl) {
            setProductUrl(productUrl);
            setIsAddModalVisible(true);
            return;
          }
        } catch (e) {
          console.log('Error parsing custom scheme:', e);
        }
      }
      
      // Intent URL (Android sharing)
      if (url.includes('intent://')) {
        console.log('📱 Android intent URL');
        Alert.alert('Debug', 'Found intent URL');
        const urlMatch = url.match(/intent:\/\/(.+?)#/);
        if (urlMatch) {
          const extractedUrl = 'https://' + urlMatch[1];
          setProductUrl(extractedUrl);
          setIsAddModalVisible(true);
          return;
        }
      }
      
      // Text sharing (might contain URLs)
      const httpMatch = url.match(/(https?:\/\/[^\s]+)/);
      if (httpMatch) {
        console.log('📱 Found URL in shared text');
        Alert.alert('Debug', 'Found URL in text');
        setProductUrl(httpMatch[1]);
        setIsAddModalVisible(true);
        return;
      }
      
      console.log('📱 No recognizable URL pattern found');
      Alert.alert('Debug: No URL Found', `Could not extract URL from: ${url}`);
    } else {
      console.log('📱 Received non-string URL:', typeof url);
      Alert.alert('Debug: Non-string URL', `Received: ${JSON.stringify(url)}`);
    }
    
  } catch (error) {
    console.log('❌ Error handling URL:', error);
    Alert.alert('Debug: Error', `Error: ${error.message}\nURL: ${url}`);
  }
};

  // Load products when app starts
  useEffect(() => {
    loadProducts();
  }, []);

  // IMPROVED URL LISTENER
  useEffect(() => {
    // Handle app opened from URL
    const handleInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log('📱 Initial URL:', initialUrl);
        if (initialUrl) {
          handleIncomingURL(initialUrl);
        }
      } catch (error) {
        console.log('Error getting initial URL:', error);
      }
    };

    // Handle URLs while app is running
    const handleURLChange = (event) => {
      console.log('📱 URL change event:', event);
      if (event?.url) {
        handleIncomingURL(event.url);
      } else if (typeof event === 'string') {
        handleIncomingURL(event);
      }
    };

    // Set up listeners
    handleInitialURL();
    
    // For newer React Native versions
    const subscription = Linking.addEventListener('url', handleURLChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // Save products whenever they change
  useEffect(() => {
    if (!isLoading) {
      saveProducts();
    }
  }, [products, customCategories, isLoading]);

  const loadProducts = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setProducts(data.products || []);
        setCustomCategories(data.customCategories || ['general', 'clothing', 'electronics', 'home', 'books']);
        console.log('Loaded products:', data.products?.length || 0);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load saved products');
    } finally {
      setIsLoading(false);
    }
  };

  const saveProducts = async () => {
    try {
      const data = {
        products,
        customCategories,
        lastSync: new Date().toISOString()
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('Saved products:', products.length);
    } catch (error) {
      console.error('Error saving products:', error);
      Alert.alert('Error', 'Failed to save products');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

const extractProductInfo = async (url) => {
  console.log('🔍 Starting extraction for:', url);
  
  const BACKEND_URL = 'https://flat-monkeys-trade.loca.lt';
  
  try {
    console.log('📡 Sending request to:', BACKEND_URL);
    
    const response = await fetch(`${BACKEND_URL}/extract-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const productData = await response.json();
    console.log('✅ Got product data:', productData);
    
    return {
      title: productData.title || `Product from ${new URL(url).hostname}`,
      image: productData.image,
      price: productData.price || 'N/A',
      site: productData.site || new URL(url).hostname,
      originalPrice: productData.originalPrice,
      variants: productData.variants || {}
    };
    
  } catch (error) {
    console.error('❌ Extraction failed:', error);
    
    // Fallback
    const urlObj = new URL(url);
    return {
      title: `Product from ${urlObj.hostname}`,
      image: null,
      price: 'N/A',
      site: urlObj.hostname,
      originalPrice: null,
      variants: {}
    };
  }
};

const addProduct = async () => {
  if (!productUrl.trim()) {
    Alert.alert('Error', 'Please enter a URL');
    return;
  }

  setIsExtracting(true);
  
  try {
    // Check for duplicates first
    const exists = products.some(p => p.url === productUrl.trim());
    if (exists) {
      Alert.alert('Already Added', 'This product is already in your trolley');
      return;
    }

    // Extract product info
    const extractedInfo = await extractProductInfo(productUrl.trim());
    
    const newProduct = {
      id: Date.now().toString(),
      url: productUrl.trim(),
      category: selectedCategory,
      dateAdded: new Date().toISOString(),
      ...extractedInfo
    };

    setProducts([...products, newProduct]);
    setProductUrl('');
    setSelectedCategory('general');
    setIsAddModalVisible(false);
    Alert.alert('Success', 'Product added to trolley!');
    
  } catch (error) {
    Alert.alert('Error', `Failed to add product: ${error.message}`);
  } finally {
    setIsExtracting(false);
  }
};
const addProductDirectly = async (productData) => {
  try {
    // Check for duplicates first
    const exists = products.some(p => p.url === productData.url || p.id === productData.id);
    if (exists) {
      Alert.alert('Already Added', 'This product is already in your trolley');
      return;
    }

    setProducts([...products, productData]);
    Alert.alert('Success', `Added "${productData.title}" to trolley!`);
    
  } catch (error) {
    Alert.alert('Error', `Failed to add product: ${error.message}`);
  }
}; 

  const removeProduct = (productId) => {
    Alert.alert(
      'Remove Product',
      'Are you sure you want to remove this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setProducts(products.filter(p => p.id !== productId));
            Alert.alert('Removed', 'Product removed from trolley');
          }
        }
      ]
    );
  };

  const openProduct = (url) => {
    Linking.openURL(url);
  };

  const openStore = (site) => {
    const storeUrl = site.startsWith('http') ? site : `https://${site}`;
    Linking.openURL(storeUrl);
  };

  const clearAll = () => {
    Alert.alert(
      'Clear All',
      'Remove all products from your trolley? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setProducts([]);
            setCurrentFilter('all');
            Alert.alert('Cleared', 'All products removed from trolley');
          }
        }
      ]
    );
  };

  const openAllProducts = () => {
    const filtered = getFilteredProducts();
    if (filtered.length === 0) return;

    Alert.alert(
      'Open All Products',
      `This will open ${filtered.length} product${filtered.length !== 1 ? 's' : ''} in your browser.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open All',
          onPress: () => {
            filtered.forEach(product => {
              Linking.openURL(product.url);
            });
            Alert.alert('Success', `Opened ${filtered.length} products`);
          }
        }
      ]
    );
  };

  const switchTab = (tab) => {
    setCurrentTab(tab);
    setCurrentFilter('all');
  };

  const getFilteredProducts = () => {
    if (currentFilter === 'all') return products;
    
    if (currentTab === 'categories') {
      return products.filter(p => p.category === currentFilter);
    } else {
      return products.filter(p => p.site === currentFilter);
    }
  };

  const getCategoryCounts = () => {
    const counts = { all: products.length };
    products.forEach(product => {
      const category = product.category || 'general';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  };

  const getStoreCounts = () => {
    const counts = { all: products.length };
    products.forEach(product => {
      const store = product.site;
      counts[store] = (counts[store] || 0) + 1;
    });
    return counts;
  };

  const getFilterOptions = () => {
    if (currentTab === 'categories') {
      const counts = getCategoryCounts();
      return [
        { label: `All Items (${counts.all})`, value: 'all' },
        ...customCategories.map(cat => ({
          label: `${cat.charAt(0).toUpperCase() + cat.slice(1)} (${counts[cat] || 0})`,
          value: cat
        }))
      ];
    } else {
      const counts = getStoreCounts();
      const stores = [...new Set(products.map(p => p.site))];
      return [
        { label: `All Stores (${counts.all})`, value: 'all' },
        ...stores.map(store => ({
          label: `${store} (${counts[store] || 0})`,
          value: store
        }))
      ];
    }
  };

  // Handle category change
  const openCategoryModal = (productId) => {
    setEditingProductId(productId);
    setIsCategoryModalVisible(true);
  };

  const changeProductCategory = (newCategory) => {
    if (editingProductId) {
      setProducts(products.map(p => 
        p.id === editingProductId 
          ? { ...p, category: newCategory }
          : p
      ));
      setIsCategoryModalVisible(false);
      setEditingProductId(null);
      Alert.alert('Success', 'Category updated!');
    }
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    const categoryValue = newCategoryName.toLowerCase().trim();
    if (customCategories.includes(categoryValue)) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    setCustomCategories([...customCategories, categoryValue]);
    setNewCategoryName('');
    Alert.alert('Success', 'Category added!');
  };

  const renderVariants = (variants) => {
    if (!variants || Object.keys(variants).length === 0) return null;
    
    const variantPairs = [];
    if (variants.size) variantPairs.push(`Size: ${variants.size}`);
    if (variants.color) variantPairs.push(`Color: ${variants.color}`);
    if (variants.style) variantPairs.push(`Style: ${variants.style}`);
    
    if (variantPairs.length === 0) return null;
    
    return (
      <Text style={styles.productVariants}>
        {variantPairs.join(' | ')}
      </Text>
    );
  };

  const filteredProducts = getFilteredProducts();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212529" />
          <Text style={styles.loadingText}>Loading your trolley...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
<View style={styles.header}>
  <Text style={styles.title}>🛒 Trolley v2</Text>
  <View style={styles.headerButtons}>
  <TouchableOpacity 
    style={[styles.addButton, { backgroundColor: '#007bff', marginRight: 10 }]}
    onPress={() => setIsScreenshotModalVisible(true)}
  >
    <Text style={styles.addButtonText}>📸</Text>
  </TouchableOpacity>
  <TouchableOpacity 
    style={[styles.addButton, { backgroundColor: '#28a745', marginRight: 10 }]}
    onPress={() => {
      Alert.alert('Test', 'Button works!');
      setProductUrl('https://amazon.com/test-product');
      setIsAddModalVisible(true);
    }}
  >
    <Text style={styles.addButtonText}>T</Text>
  </TouchableOpacity>
  <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
    <Text style={styles.addButtonText}>+</Text>
  </TouchableOpacity>
</View>
</View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, currentTab === 'categories' && styles.activeTab]}
          onPress={() => switchTab('categories')}
        >
          <Text style={[styles.tabText, currentTab === 'categories' && styles.activeTabText]}>
            Categories
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentTab === 'stores' && styles.activeTab]}
          onPress={() => switchTab('stores')}
        >
          <Text style={[styles.tabText, currentTab === 'stores' && styles.activeTabText]}>
            Stores
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {getFilterOptions().map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.filterChip,
                currentFilter === option.value && styles.activeFilterChip
              ]}
              onPress={() => setCurrentFilter(option.value)}
            >
              <Text style={[
                styles.filterChipText,
                currentFilter === option.value && styles.activeFilterChipText
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Products List */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>
              {currentFilter === 'all' ? 'Your trolley is empty' : 
               currentTab === 'categories' ? `No ${currentFilter} items` : 
               `No items from ${currentFilter}`}
            </Text>
            <Text style={styles.emptyText}>
              {currentFilter === 'all' ? 'Add some products to get started!' : 'Try a different filter or add new items'}
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => setIsAddModalVisible(true)}
            >
              <Text style={styles.emptyButtonText}>Add Product</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredProducts.map(product => (
            <View key={product.id} style={styles.productCard}>
              {/* Product Image */}
              <View style={styles.productImageContainer}>
                {product.image ? (
                  <Image 
                    source={{ uri: product.image }} 
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noImageContainer}>
                    <Text style={styles.noImageText}>No Image</Text>
                  </View>
                )}
              </View>

              {/* Product Info */}
              <View style={styles.productInfo}>
                <TouchableOpacity onPress={() => openProduct(product.url)}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {product.title}
                  </Text>
                </TouchableOpacity>
                
                {/* Pricing */}
                <View style={styles.productPricing}>
                  {product.originalPrice && (
                    <Text style={styles.originalPrice}>{product.originalPrice}</Text>
                  )}
                  <Text style={styles.salePrice}>{product.price}</Text>
                </View>

                {/* Store */}
                <TouchableOpacity onPress={() => openStore(product.site)}>
                  <Text style={styles.productSite}>{product.site}</Text>
                </TouchableOpacity>

                {/* Variants */}
                {renderVariants(product.variants)}

                {/* Date */}
                <Text style={styles.productDate}>
                  Added {new Date(product.dateAdded).toLocaleDateString()}
                </Text>

                {/* Footer */}
                <View style={styles.productFooter}>
                  <TouchableOpacity 
                    style={styles.categoryTagContainer}
                    onPress={() => openCategoryModal(product.id)}
                  >
                    <Text style={styles.categoryTag}>
                      {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeProduct(product.id)}>
                    <Text style={styles.removeButton}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Text style={styles.itemCount}>
          {filteredProducts.length} item{filteredProducts.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.clearButton, products.length === 0 && styles.disabledButton]} 
            onPress={clearAll}
            disabled={products.length === 0}
          >
            <Text style={[styles.clearButtonText, products.length === 0 && styles.disabledButtonText]}>
              Clear All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.openAllButton, filteredProducts.length === 0 && styles.disabledButton]}
            onPress={openAllProducts}
            disabled={filteredProducts.length === 0}
          >
            <Text style={[styles.openAllButtonText, filteredProducts.length === 0 && styles.disabledButtonText]}>
              Open All ({filteredProducts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Product Modal */}
      <Modal visible={isAddModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Product URL</Text>
            <TextInput
              style={styles.input}
              value={productUrl}
              onChangeText={setProductUrl}
              placeholder="Paste product link here..."
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
              {customCategories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryOption,
                    selectedCategory === category && styles.selectedCategoryOption
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    selectedCategory === category && styles.selectedCategoryOptionText
                  ]}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setIsAddModalVisible(false)}
                disabled={isExtracting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.addProductButton, isExtracting && styles.disabledButton]} 
                onPress={addProduct}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.addProductButtonText}>  Extracting...</Text>
                  </>
                ) : (
                  <Text style={styles.addProductButtonText}>Add to Trolley</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Change Modal */}
      <Modal visible={isCategoryModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Category</Text>
              <TouchableOpacity onPress={() => setIsCategoryModalVisible(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Select Category</Text>
            <ScrollView style={styles.categoryList}>
              {customCategories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryListItem}
                  onPress={() => changeProductCategory(category)}
                >
                  <Text style={styles.categoryListText}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={styles.inputLabel}>Add New Category</Text>
            <View style={styles.newCategoryContainer}>
              <TextInput
                style={[styles.input, styles.newCategoryInput]}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="Enter new category name..."
              />
              <TouchableOpacity 
                style={styles.addCategoryButton}
                onPress={addNewCategory}
              >
                <Text style={styles.addCategoryButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
{isScreenshotModalVisible && (
        <ScreenshotCapture
          onProductExtracted={(product) => {
            addProductDirectly(product);
            setIsScreenshotModalVisible(false);
          }}
          onClose={() => setIsScreenshotModalVisible(false)}
        />
      )}
      
    </SafeAreaView>
  );
}

// Screenshot analysis function
const analyzeScreenshot = async (imageUri) => {
  console.log('📸 Starting screenshot analysis...');
  
  const BACKEND_URL = 'https://flat-monkeys-trade.loca.lt'; // Your backend URL
  
  try {
    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64Image = reader.result;
          
          console.log('🤖 Sending to AI for analysis...');
          
          const analysisResponse = await fetch(`${BACKEND_URL}/analyze-screenshot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64Image })
          });
          
          if (!analysisResponse.ok) {
            throw new Error(`AI analysis failed: ${analysisResponse.status}`);
          }
          
          const result = await analysisResponse.json();
          console.log('✅ AI analysis result:', result);
          
          resolve(result);
          
        } catch (error) {
          console.error('❌ Analysis error:', error);
          reject(error);
        }
      };
      
      reader.onerror = reject;
    });
    
  } catch (error) {
    console.error('❌ Screenshot processing error:', error);
    throw error;
  }
};

// Screenshot Capture Component
// Screenshot Capture Component (Expo version)
const ScreenshotCapture = ({ onProductExtracted, onClose }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  const handleImagePicker = () => {
    Alert.alert(
      'Add Product Screenshot',
      'Choose how to capture the product',
      [
        { text: 'Camera', onPress: () => openCamera() },
        { text: 'Photo Library', onPress: () => openLibrary() },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const openCamera = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      handleImageResponse(result);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openLibrary = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      handleImageResponse(result);
    } catch (error) {
      console.error('Library error:', error);
      Alert.alert('Error', 'Failed to open photo library');
    }
  };

  const handleImageResponse = (result) => {
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setCapturedImage(asset);
    analyzeImage(asset.uri);
  };

  const analyzeImage = async (imageUri) => {
    setIsAnalyzing(true);
    
    // Simulate AI analysis with a delay (for testing)
    console.log('📸 Starting mock analysis for:', imageUri);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // For testing, we'll just create a mock product
      const productData = {
        id: Date.now().toString(),
        title: 'Product from Screenshot (Expo Test)',
        price: '$29.99',
        originalPrice: null,
        site: 'Screenshot',
        image: imageUri, // Use the captured screenshot as product image
        category: 'general',
        dateAdded: new Date().toISOString(),
        extractionMethod: 'screenshot_expo_test',
        confidence: 0.8
      };

      console.log('✅ Mock product created:', productData);

      Alert.alert(
        'Screenshot Captured! 📸',
        `Mock Product: ${productData.title}\nPrice: ${productData.price}\n\nThis is test mode - no AI analysis yet.`,
        [
          { text: 'Edit Info', onPress: () => showEditDialog(productData) },
          { text: 'Save to Trolley', onPress: () => onProductExtracted(productData) }
        ]
      );

    } catch (error) {
      console.error('❌ Mock analysis error:', error);
      Alert.alert(
        'Test Mode',
        'This is test mode. You can still add the screenshot manually.',
        [
          { text: 'Try Again', onPress: handleImagePicker },
          { text: 'Add Manually', onPress: () => addManually(imageUri) }
        ]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const showEditDialog = (productData) => {
    // For now, just save the product
    onProductExtracted(productData);
  };

  const addManually = (imageUri) => {
    const manualProduct = {
      id: Date.now().toString(),
      title: 'Product from Screenshot (Manual)',
      price: 'N/A',
      site: 'Screenshot',
      image: imageUri,
      category: 'general',
      dateAdded: new Date().toISOString(),
      extractionMethod: 'manual'
    };
    
    onProductExtracted(manualProduct);
  };

  return (
    <Modal visible={true} transparent={true} animationType="slide">
      <View style={screenshotStyles.modalOverlay}>
        <View style={screenshotStyles.modalContent}>
          <Text style={screenshotStyles.modalTitle}>📸 Add Product Screenshot</Text>
          
          {capturedImage && (
            <Image source={{ uri: capturedImage.uri }} style={screenshotStyles.previewImage} />
          )}
          
          {isAnalyzing ? (
            <View style={screenshotStyles.analyzingContainer}>
              <ActivityIndicator size="large" color="#212529" />
              <Text style={screenshotStyles.analyzingText}>🤖 Mock AI analyzing screenshot...</Text>
              <Text style={screenshotStyles.analyzingSubtext}>This is test mode (2 seconds)</Text>
            </View>
          ) : (
            <View style={screenshotStyles.buttonContainer}>
              <TouchableOpacity style={screenshotStyles.primaryButton} onPress={handleImagePicker}>
                <Text style={screenshotStyles.primaryButtonText}>📸 Capture Product</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={screenshotStyles.secondaryButton} onPress={onClose}>
                <Text style={screenshotStyles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
// Screenshot styles
const screenshotStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 350,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    resizeMode: 'contain',
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  analyzingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  analyzingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#212529',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  secondaryButtonText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#212529',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  activeTabText: {
    color: '#212529',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterChip: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#212529',
  },
  filterChipText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#212529',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  productCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
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
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
  },
  noImageText: {
    fontSize: 12,
    color: '#adb5bd',
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
    lineHeight: 20,
  },
  productPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#6c757d',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  salePrice: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: '500',
  },
  productSite: {
    fontSize: 12,
    color: '#007bff',
    marginBottom: 4,
  },
  productVariants: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  productDate: {
    fontSize: 10,
    color: '#6c757d',
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTagContainer: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryTag: {
    color: '#495057',
    fontSize: 10,
    fontWeight: '500',
  },
  removeButton: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomActions: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    padding: 16,
  },
  itemCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  openAllButton: {
    backgroundColor: '#212529',
  },
  openAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#6c757d',
  },
  disabledButtonText: {
    color: '#adb5bd',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: '600',
    padding: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  categorySelector: {
    marginBottom: 20,
  },
  categoryOption: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedCategoryOption: {
    backgroundColor: '#212529',
    borderColor: '#212529',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  selectedCategoryOptionText: {
    color: '#fff',
  },
  categoryList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  categoryListItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  categoryListText: {
    fontSize: 16,
    color: '#495057',
  },
  newCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newCategoryInput: {
    flex: 1,
    marginBottom: 0,
  },
  addCategoryButton: {
    backgroundColor: '#212529',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addCategoryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
  addProductButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#212529',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  addProductButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});