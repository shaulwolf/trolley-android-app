// FIXED EXTRACT PRODUCT INFO FUNCTION
  const extractProductInfo = async (url) => {
    console.log('🔍 Extracting product info from:', url);
    
    try {
      console.log('🕷️ Using trolley-backend universal scraper...');
      

      
      console.log('📡 Connecting to backend:', BACKEND_URL);
      
      // Test backend connection first
      console.log('🔍 Testing backend connection...');
      const healthCheck = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (!healthCheck.ok) {
        throw new Error(`Backend health check failed: ${healthCheck.status}`);
      }
      
      console.log('✅ Backend is responding, attempting product extraction...');
      
      const response = await fetch(`${BACKEND_URL}/extract-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        timeout: 20000 // 20 second timeout
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);
      
      if (response.ok) {
        const productData = await response.json();
        console.log('✅ Extraction successful:', productData);
        
        return {
          title: productData.title || `Product from ${new URL(url).hostname}`,
          image: productData.image,
          price: productData.price || 'N/A',
          site: productData.site || new URL(url).hostname,
          originalPrice: productData.originalPrice,
          variants: productData.variants || {}
        };
      } else {
        const errorText = await response.text();
        console.log('❌ Backend error response:', errorText);
        throw new Error(`Server responded with status: ${response.status} - ${errorText}`);
      }
      
    } catch (error) {
      console.log('⚠️ Backend connection failed:', error.message);
      console.log('⚠️ Full error:', error);
      
      // Show more detailed error info
      Alert.alert(
        'Backend Connection Failed',
        `Error: ${error.message}\n\nUsing fallback mode...`,
        [{ text: 'OK' }]
      );
      
      // Simple fallback when backend is unavailable
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
  };import React, { useState, useEffect } from 'react';
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


const STORAGE_KEY = '@trolley_products';
const { width } = Dimensions.get('window');

const BACKEND_URL = __DEV__ 
  ? 'https://miniature-rotary-phone-jjgwwv6pv4r735j99-3000.app.github.dev'  // ← NEW URL
  : 'https://your-production-url.com';

export default function App() {
  const [products, setProducts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentTab, setCurrentTab] = useState('categories');
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [showStoresDropdown, setShowStoresDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recently-added');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  // 🔄 NEW SYNC STATE VARIABLES
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('ready'); // 'ready', 'syncing', 'success', 'error'

// FIXED AUTOMATIC URL HANDLING - Add this to replace your existing handleIncomingURL function
const handleIncomingURL = async (url) => {
  console.log('📱 Received URL for auto-addition:', url);
  
  try {
    let extractedUrl = null;
    
    // Extract URL from different sharing formats
    if (typeof url === 'string') {
      // Handle Expo development client URLs
      if (url.includes('exp+trolley-shopping-app://expo-development-client/')) {
        console.log('📱 Expo development client URL detected');
        const urlParams = new URLSearchParams(url.split('?')[1]);
        extractedUrl = urlParams.get('url');
        if (extractedUrl) {
          extractedUrl = decodeURIComponent(extractedUrl);
          console.log('📱 Decoded URL from Expo client:', extractedUrl);
        }
      }
      // Direct HTTP URL sharing
      else if (url.startsWith('http://') || url.startsWith('https://')) {
        extractedUrl = url;
      }
      // Custom scheme: trolley://add?url=https://example.com
      else if (url.startsWith('trolley://')) {
        const urlObj = new URL(url);
        extractedUrl = urlObj.searchParams.get('url');
      }
      // Android intent URL
      else if (url.includes('intent://')) {
        const urlMatch = url.match(/intent:\/\/(.+?)#/);
        if (urlMatch) {
          extractedUrl = 'https://' + urlMatch[1];
        }
      }
      // Text sharing with URL embedded
      else {
        const httpMatch = url.match(/(https?:\/\/[^\s]+)/);
        if (httpMatch) {
          extractedUrl = httpMatch[1];
        }
      }
    }
    
    if (extractedUrl) {
      console.log('📱 Extracted URL:', extractedUrl);
      
      // ===== FILTER OUT DEVELOPMENT URLS =====
      const isDevelopmentUrl = 
        extractedUrl.includes('.exp.direct') ||           // Expo development
        extractedUrl.includes('expo-development') ||      // Expo development
        extractedUrl.includes('localhost') ||             // Local development
        extractedUrl.includes('127.0.0.1') ||            // Local IP
        extractedUrl.includes('192.168.') ||             // Local network
        extractedUrl.includes('10.0.') ||                // Local network
        extractedUrl.includes('.ngrok.') ||              // Ngrok tunnels
        extractedUrl.includes('codespace') ||            // GitHub Codespaces
        extractedUrl.includes('.github.dev') ||          // GitHub dev domains
        extractedUrl.includes('stackblitz') ||           // StackBlitz
        extractedUrl.includes('codesandbox') ||          // CodeSandbox
        extractedUrl.includes('replit') ||               // Replit
        extractedUrl.includes('vercel.app') ||           // Vercel preview
        extractedUrl.includes('netlify.app');            // Netlify preview
      
      if (isDevelopmentUrl) {
        console.log('🚫 Development URL detected, ignoring:', extractedUrl);
        console.log('📱 This appears to be a development/preview URL, not a real product URL');
        return; // Exit early, don't process development URLs
      }
      
      // Proceed with normal product addition for real URLs
      console.log('✅ Valid product URL detected, proceeding with extraction...');
      
      // Show loading indicator
      Alert.alert('Adding Product', 'Extracting product information...', [], { cancelable: false });
      
      // Automatically add the product
      await addProductFromUrl(extractedUrl);
    } else {
      console.log('❌ Could not extract URL from:', url);
      // Don't show error for development URLs - just log it
      if (!url.includes('.exp.direct')) {
        Alert.alert('Error', 'Could not extract product URL from shared content');
      }
    }
    
  } catch (error) {
    console.log('❌ Error handling shared URL:', error);
    // Only show error for non-development URLs
    if (!url.includes('.exp.direct')) {
      Alert.alert('Error', `Failed to process shared URL: ${error.message}`);
    }
  }
};

  // NEW FUNCTION: Add product directly from URL (automatic)
  const addProductFromUrl = async (url) => {
    try {
      // Check for duplicates first
      const exists = products.some(p => p.url === url);
      if (exists) {
        Alert.alert('Already Added', 'This product is already in your trolley!');
        return;
      }

      console.log('🔄 Extracting product info from:', url);
      
      // Extract product info using your backend
      const extractedInfo = await extractProductInfo(url);
      
      const newProduct = {
        id: Date.now().toString(),
        url: url,
        category: 'general', // Default category
        dateAdded: new Date().toISOString(),
        ...extractedInfo,
        // Clean up the site name for display only
        displaySite: cleanStoreName(extractedInfo.site || new URL(url).hostname)
      };

      // Add to products list
      const updatedProducts = [...products, newProduct];
      setProducts(updatedProducts);
      
      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        products: updatedProducts,
        customCategories,
        lastSync: new Date().toISOString()
      }));
      
      // Show success message
      Alert.alert(
        'Product Added! 🛒', 
        `"${newProduct.title}" has been added to your trolley`,
        [{ text: 'View Trolley', onPress: () => setCurrentTab('categories') }]
      );
      
      console.log('✅ Product auto-added successfully:', newProduct.title);
      
    } catch (error) {
      console.error('❌ Auto-addition failed:', error);
      Alert.alert(
        'Extraction Failed', 
        `Could not extract product info. Would you like to add it manually?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Manually', 
            onPress: () => {
              setProductUrl(url);
              setIsAddModalVisible(true);
            }
          }
        ]
      );
    }
  };

// Load products when app starts AND start auto-sync
useEffect(() => {
  const initializeApp = async () => {
    await loadProducts();
    
    // Initial sync after loading - with longer delay
    setTimeout(() => {
      console.log('🚀 Initial sync starting...');
      syncWithBackend();
    }, 5000); // Wait 5 seconds after app loads
  };
  
  initializeApp();
}, []); // Empty dependency array

// Auto-sync every 30 seconds when app is active
useEffect(() => {
  const syncInterval = setInterval(() => {
    // Only sync if we're not already syncing and have loaded products
    if (!isSyncing && !isLoading) {
      console.log('⏰ Auto-sync triggered');
      syncWithBackend();
    }
  }, 30000); // 30 seconds

  return () => clearInterval(syncInterval);
}, [isSyncing, isLoading]); // Remove products dependency to avoid loops

// Remove or comment out the "sync when products change" useEffect temporarily
/*
useEffect(() => {
  if (!isLoading && products.length > 0) {
    const timeoutId = setTimeout(() => {
      syncWithBackend();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }
}, [products]);
*/

  // IMPROVED URL LISTENER
  useEffect(() => {
    // Handle app opened from URL when app was closed
    const handleInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log('📱 App opened with initial URL:', initialUrl);
        if (initialUrl) {
          // Wait a bit for app to fully load
          setTimeout(() => handleIncomingURL(initialUrl), 1000);
        }
      } catch (error) {
        console.log('Error getting initial URL:', error);
      }
    };

    // Handle URLs while app is running (app switcher/sharing)
    const handleURLChange = (event) => {
      console.log('📱 App received URL while running:', event);
      const url = event?.url || event;
      if (url) {
        handleIncomingURL(url);
      }
    };

    // Set up listeners
    handleInitialURL();
    
    // Listen for URL events while app is running
    const subscription = Linking.addEventListener('url', handleURLChange);

    return () => {
      subscription?.remove();
    };
  }, [products]); // Add products as dependency so it has access to current state

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
        setCustomCategories(data.customCategories || []);
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
    await syncWithBackend(); // Also sync when user pulls to refresh
    setRefreshing(false);
  };

  // 🔄 SYNC FUNCTIONS
// ===== CLEAN SYNC FUNCTIONS - REPLACE EVERYTHING =====

// Enhanced upload function
const syncUp = async () => {
  try {
    console.log('📤 Android: Deletion-aware smart sync UP...');
    
    // Step 1: Get what we had before (to detect deletions)
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    let localProducts = [];
    let previousProducts = [];
    
    if (saved) {
      const data = JSON.parse(saved);
      localProducts = data.products || [];
      previousProducts = data.previousProducts || data.products || []; // Track what we had before
    }
    
    // Step 2: Get current remote products
    console.log('📥 Getting current backend state...');
    const getResponse = await fetch(`${BACKEND_URL}/api/sync`);
    if (!getResponse.ok) {
      throw new Error(`Failed to get current state: ${getResponse.status}`);
    }
    const currentState = await getResponse.json();
    const remoteProducts = currentState.products || [];
    
    // Step 3: Detect local deletions
    const locallyDeleted = previousProducts.filter(prev => 
      !localProducts.some(current => current.id === prev.id)
    );
    
    if (locallyDeleted.length > 0) {
      console.log('🗑️ Detected local deletions:', locallyDeleted.map(p => p.title));
    }
    
    // Step 4: Smart merge - add remote products BUT respect local deletions
    const mergedProducts = [...localProducts];
    
    remoteProducts.forEach(remoteProduct => {
      const existsLocally = mergedProducts.some(local => local.id === remoteProduct.id);
      const wasLocallyDeleted = locallyDeleted.some(deleted => deleted.id === remoteProduct.id);
      
      if (!existsLocally && !wasLocallyDeleted) {
        console.log('➕ Adding remote product:', remoteProduct.title);
        mergedProducts.push(remoteProduct);
      } else if (wasLocallyDeleted) {
        console.log('🗑️ Respecting local deletion of:', remoteProduct.title);
      }
    });
    
    // Step 5: Prepare for upload
    const enhancedProducts = mergedProducts.map(product => ({
      ...product,
      deviceSource: product.deviceSource || 'android-app',
      lastModified: product.lastModified || product.dateAdded || new Date().toISOString(),
      category: product.category || 'general'
    }));
    
    console.log('📊 Android: Deletion-aware upload -', enhancedProducts.length, 'products');
    console.log('🔄 Preserved additions, respected deletions');
    
    // Step 6: Upload merged state
    const response = await fetch(`${BACKEND_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: enhancedProducts,
        deviceId: 'android-app'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deletion-aware sync failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Android: Deletion-aware sync completed:', result.inserted, 'products');
    
    // Step 7: Update local state and remember current state for next deletion detection
    setProducts(enhancedProducts);
    const dataToSave = {
      products: enhancedProducts,
      previousProducts: enhancedProducts, // Remember this state for next sync
      customCategories,
      lastSync: new Date().toISOString()
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    
    return result;
    
  } catch (error) {
    console.error('❌ Android: Deletion-aware sync failed:', error);
    throw error;
  }
};


// Download function (keep existing)
// Simple complete state sync - replaces everything
const syncDown = async () => {
  try {
    console.log('📥 Syncing DOWN - complete state replacement...');
    
    const response = await fetch(`${BACKEND_URL}/api/sync`);
    
    if (!response.ok) {
      throw new Error(`Sync download failed: ${response.status}`);
    }

    const result = await response.json();
    const remoteProducts = result.products || [];
    
    console.log('📊 Downloaded', remoteProducts.length, 'products from backend');
    console.log('🔄 Replacing local state completely with remote state');
    
    // COMPLETE REPLACEMENT - this handles deletions automatically
    setProducts(remoteProducts);
    
    // Save to local storage
    const data = {
      products: remoteProducts,  // Replace everything
      customCategories,
      lastSync: new Date().toISOString()
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    console.log('✅ Sync DOWN completed - state replaced');
    return remoteProducts;
    
  } catch (error) {
    console.error('❌ Sync DOWN failed:', error);
    throw error;
  }
};

// Main sync function
const syncWithBackend = async () => {
  console.log('🔍 Enhanced SYNC TRIGGERED');
  
  if (isSyncing) {
    console.log('⚠️ Enhanced sync already in progress, skipping');
    return;
  }

  setIsSyncing(true);
  setSyncStatus('syncing');
  
  try {
    console.log('🔄 Starting enhanced bidirectional sync...');
    
    // Step 1: Upload local products to backend
    await syncUp();
    
    // Step 2: Download latest products from backend
    const syncedProducts = await syncDown();
    
    // Step 3: Update sync status
    setLastSyncTime(new Date());
    setSyncStatus('success');
    
    console.log(`✅ Enhanced sync completed: ${syncedProducts.length} products`);
    
  } catch (error) {
    console.error('❌ Enhanced sync failed:', error);
    setSyncStatus('error');
    
    Alert.alert(
      'Sync Failed',
      `Could not sync: ${error.message}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => syncWithBackend() }
      ]
    );
  } finally {
    setIsSyncing(false);
  }
};

  // Manual sync function (for sync button)
  const handleManualSync = async () => {
    await syncWithBackend();
    
    if (syncStatus === 'success') {
      Alert.alert(
        'Sync Complete! ✅',
        `Your products are now synchronized with the Chrome extension.`,
        [{ text: 'OK' }]
      );
    }
  };

  // FIXED EXTRACT PRODUCT INFO FUNCTION
  const extractProductInfo = async (url) => {
    console.log('🔍 Extracting product info from:', url);
    
    try {
      console.log('🕷️ Using trolley-backend universal scraper...');
      
 
      
      const response = await fetch(`${BACKEND_URL}/extract-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        timeout: 20000 // 20 second timeout
      });
      
      if (response.ok) {
        const productData = await response.json();
        console.log('✅ Extraction successful:', productData);
        
        return {
          title: productData.title || `Product from ${new URL(url).hostname}`,
          image: productData.image,
          price: productData.price || 'N/A',
          site: productData.site || new URL(url).hostname,
          originalPrice: productData.originalPrice,
          variants: productData.variants || {}
        };
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
    } catch (error) {
      console.log('⚠️ trolley-backend failed, using fallback...', error.message);
      
      // Simple fallback when backend is unavailable
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

  // Helper function to clean up store names
  const cleanStoreName = (url) => {
    try {
      const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      
      // Remove www. prefix
      const withoutWww = hostname.replace(/^www\./, '');
      
      // Store name mappings
      const storeNames = {
        'amazon.com': 'Amazon',
        'ebay.com': 'eBay', 
        'target.com': 'Target',
        'walmart.com': 'Walmart',
        'bestbuy.com': 'Best Buy',
        'homedepot.com': 'Home Depot',
        'lowes.com': 'Lowe\'s',
        'macys.com': 'Macy\'s',
        'nordstrom.com': 'Nordstrom',
        'zappos.com': 'Zappos',
        'etsy.com': 'Etsy',
        'wayfair.com': 'Wayfair',
        'overstock.com': 'Overstock',
        'costco.com': 'Costco',
        'samsclub.com': 'Sam\'s Club',
        'buckmason.com': 'Buck Mason',
        'everlane.com': 'Everlane',
        'uniqlo.com': 'Uniqlo',
        'hm.com': 'H&M',
        'zara.com': 'Zara',
        'gap.com': 'Gap',
        'oldnavy.com': 'Old Navy',
        'bananarepublic.com': 'Banana Republic'
      };
      
      // Return mapped name or capitalize the domain
      return storeNames[withoutWww] || 
             withoutWww.split('.')[0]
               .split(/[-_]/)
               .map(word => word.charAt(0).toUpperCase() + word.slice(1))
               .join(' ');
    } catch {
      return url;
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
      
      // Use custom category or default to general
      const finalCategory = selectedCategory.trim() || 'general';
      
      // Add to custom categories if it's new
      if (finalCategory !== 'general' && !customCategories.includes(finalCategory)) {
        setCustomCategories([...customCategories, finalCategory]);
      }
      
      const newProduct = {
        id: Date.now().toString(),
        url: productUrl.trim(),
        category: finalCategory,
        dateAdded: new Date().toISOString(),
        ...extractedInfo,
        // Clean up the site name for display only
        displaySite: cleanStoreName(extractedInfo.site || new URL(productUrl.trim()).hostname)
      };

      setProducts([...products, newProduct]);
      setProductUrl('');
      setSelectedCategory('');
      setIsAddModalVisible(false);
      
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

const removeProduct = async (productId) => {
  try {
    console.log('🗑️ Starting deletion of product:', productId);
    console.log('🔍 Current products count before deletion:', products.length);
    console.log('🔍 Product IDs before deletion:', products.map(p => p.id));
    
    // Remove from products array
    const updatedProducts = products.filter(p => p.id !== productId);
    console.log('🔍 Updated products count after filter:', updatedProducts.length);
    console.log('🔍 Deleted product found?', products.length !== updatedProducts.length);
    
    setProducts(updatedProducts);
    
    // Check what's actually in AsyncStorage before saving
    const currentSaved = await AsyncStorage.getItem(STORAGE_KEY);
    if (currentSaved) {
      const currentData = JSON.parse(currentSaved);
      console.log('🔍 Current AsyncStorage product count:', currentData.products?.length || 0);
    }
    
    // Save to AsyncStorage immediately
    const dataToSave = {
      products: updatedProducts,
      customCategories,
      lastSync: new Date().toISOString()
    };
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    console.log('✅ Saved to AsyncStorage. New count should be:', updatedProducts.length);
    
    // Verify what was actually saved
    const verifySaved = await AsyncStorage.getItem(STORAGE_KEY);
    if (verifySaved) {
      const verifyData = JSON.parse(verifySaved);
      console.log('🔍 Verified AsyncStorage now has:', verifyData.products?.length || 0, 'products');
    }
    
    console.log('🔄 Triggering sync in 2 seconds...');
    setTimeout(() => {
      console.log('🔄 About to sync after deletion');
      syncWithBackend();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    Alert.alert('Error', 'Failed to delete product');
  }
};

  const openProduct = (url) => {
    Linking.openURL(url);
  };

  const openStore = (product) => {
    // Use the original site URL to construct the store homepage
    const siteUrl = product.site;
    
    // Check if site URL exists
    if (!siteUrl) {
      console.log('No site URL available for product:', product);
      return;
    }
    
    let storeUrl;
    
    try {
      // Extract the base domain from the site
      const url = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
      storeUrl = `${url.protocol}//${url.hostname}`;
    } catch (error) {
      console.log('Error parsing store URL:', error);
      // Fallback if URL parsing fails
      storeUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    }
    
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
    let filtered = [];
    if (currentFilter === 'all') {
      filtered = products;
    } else if (currentTab === 'categories') {
      filtered = products.filter(p => p.category === currentFilter);
    } else {
      filtered = products.filter(p => (p.displaySite || p.site) === currentFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'a-z':
          return a.title.localeCompare(b.title);
        case 'z-a':
          return b.title.localeCompare(a.title);
        case 'recently-added':
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        case 'last-added':
          return new Date(a.dateAdded) - new Date(b.dateAdded);
        case 'price-high':
          const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, '')) || 0;
          const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, '')) || 0;
          return priceB - priceA;
        case 'price-low':
          const priceA2 = parseFloat(a.price.replace(/[^0-9.-]+/g, '')) || 0;
          const priceB2 = parseFloat(b.price.replace(/[^0-9.-]+/g, '')) || 0;
          return priceA2 - priceB2;
        default:
          return new Date(b.dateAdded) - new Date(a.dateAdded);
      }
    });
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
      const store = product.displaySite || product.site;
      counts[store] = (counts[store] || 0) + 1;
    });
    return counts;
  };

  const getFilterOptions = () => {
    if (currentTab === 'categories') {
      const counts = getCategoryCounts();
      const uniqueCategories = [...new Set(products.map(p => p.category || 'general'))];
      return [
        { label: `All Items (${counts.all})`, value: 'all' },
        ...uniqueCategories.map(cat => ({
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
      // If it's a new category, add it to the list
      if (newCategory !== 'general' && !customCategories.includes(newCategory)) {
        setCustomCategories([...customCategories, newCategory]);
      }
      
      setProducts(products.map(p => 
        p.id === editingProductId 
          ? { ...p, category: newCategory }
          : p
      ));
      setIsCategoryModalVisible(false);
      setEditingProductId(null);
      setNewCategoryName('');
    }
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    const categoryValue = newCategoryName.toLowerCase().trim();
    
    // Add the new category and change the product's category
    changeProductCategory(categoryValue);
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
const formatSyncTime = (time) => {
    const now = new Date();
    const syncTime = new Date(time);
    const diffMs = now - syncTime;
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return syncTime.toLocaleDateString();
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🛒 Trolley v2</Text>
        <View style={styles.syncStatus}>
      {isSyncing && (
        <View style={styles.syncIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.syncText}>Syncing...</Text>
        </View>
      )}
      
      {!isSyncing && syncStatus === 'success' && lastSyncTime && (
        <TouchableOpacity onPress={handleManualSync} style={styles.syncButton}>
          <Text style={styles.syncText}>
            ✅ Synced {formatSyncTime(lastSyncTime)}
          </Text>
        </TouchableOpacity>
      )}
      
      {!isSyncing && syncStatus === 'error' && (
        <TouchableOpacity onPress={handleManualSync} style={styles.syncButton}>
          <Text style={[styles.syncText, { color: '#FF3B30' }]}>
            ❌ Sync Failed - Tap to Retry
          </Text>
        </TouchableOpacity>
      )}
      
      {!isSyncing && syncStatus === 'ready' && (
        <TouchableOpacity onPress={handleManualSync} style={styles.syncButton}>
          <Text style={styles.syncText}>
            🔄 Tap to Sync
          </Text>
        </TouchableOpacity>
      )}
    </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation - Real Dropdowns */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, currentTab === 'categories' && styles.activeTab]}
          onPress={() => {
            setShowCategoriesDropdown(!showCategoriesDropdown);
            setShowStoresDropdown(false);
            setCurrentTab('categories');
          }}
        >
          <Text style={[styles.tabText, currentTab === 'categories' && styles.activeTabText]}>
            Categories {showCategoriesDropdown ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentTab === 'stores' && styles.activeTab]}
          onPress={() => {
            setShowStoresDropdown(!showStoresDropdown);
            setShowCategoriesDropdown(false);
            setCurrentTab('stores');
          }}
        >
          <Text style={[styles.tabText, currentTab === 'stores' && styles.activeTabText]}>
            Stores {showStoresDropdown ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categories Dropdown */}
      {showCategoriesDropdown && (
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdown}>
            <TouchableOpacity
              style={[styles.dropdownItem, currentFilter === 'all' && styles.activeDropdownItem]}
              onPress={() => {
                setCurrentFilter('all');
                setShowCategoriesDropdown(false);
              }}
            >
              <Text style={[styles.dropdownText, currentFilter === 'all' && styles.activeDropdownText]}>
                All Items ({products.length})
              </Text>
            </TouchableOpacity>
            {[...new Set(products.map(p => p.category || 'general'))].map(category => {
              const count = products.filter(p => (p.category || 'general') === category).length;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.dropdownItem, currentFilter === category && styles.activeDropdownItem]}
                  onPress={() => {
                    setCurrentFilter(category);
                    setShowCategoriesDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownText, currentFilter === category && styles.activeDropdownText]}>
                    {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Search and Sort Bar */}
      <View style={styles.searchSortContainer}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="#999"
            onFocus={() => {
              setShowCategoriesDropdown(false);
              setShowStoresDropdown(false);
              setShowSortDropdown(false);
            }}
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
            Sort {showSortDropdown ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sort Dropdown */}
      {showSortDropdown && (
        <View style={styles.sortDropdownContainer}>
          <View style={styles.dropdown}>
            {[
              { label: 'Recently Added', value: 'recently-added' },
              { label: 'Last Added', value: 'last-added' },
              { label: 'A-Z', value: 'a-z' },
              { label: 'Z-A', value: 'z-a' },
              { label: 'Price High', value: 'price-high' },
              { label: 'Price Low', value: 'price-low' }
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.dropdownItem, sortBy === option.value && styles.activeDropdownItem]}
                onPress={() => {
                  setSortBy(option.value);
                  setShowSortDropdown(false);
                }}
              >
                <Text style={[styles.dropdownText, sortBy === option.value && styles.activeDropdownText]}>
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
              style={[styles.dropdownItem, currentFilter === 'all' && styles.activeDropdownItem]}
              onPress={() => {
                setCurrentFilter('all');
                setShowStoresDropdown(false);
              }}
            >
              <Text style={[styles.dropdownText, currentFilter === 'all' && styles.activeDropdownText]}>
                All Stores ({products.length})
              </Text>
            </TouchableOpacity>
            {[...new Set(products.map(p => p.displaySite || p.site))].map(store => {
              const count = products.filter(p => (p.displaySite || p.site) === store).length;
              return (
                <TouchableOpacity
                  key={store}
                  style={[styles.dropdownItem, currentFilter === store && styles.activeDropdownItem]}
                  onPress={() => {
                    setCurrentFilter(store);
                    setShowStoresDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownText, currentFilter === store && styles.activeDropdownText]}>
                    {store} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      
      {/* Products List */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={filteredProducts.length === 0 ? styles.emptyContentContainer : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={() => {
          // Close dropdowns when scrolling
          setShowCategoriesDropdown(false);
          setShowStoresDropdown(false);
          setShowSortDropdown(false);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        {filteredProducts.length === 0 ? (
          <TouchableOpacity 
            style={styles.emptyState}
            onPress={() => setIsAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>
              {currentFilter === 'all' ? 'Your trolley is empty' : 
               currentTab === 'categories' ? `No ${currentFilter} items` : 
               `No items from ${currentFilter}`}
            </Text>
            <Text style={styles.emptyText}>
              {currentFilter === 'all' && !searchQuery ? 'Tap anywhere to add your first product!' : 
               searchQuery ? `No products found for "${searchQuery}"` :
               'Try a different filter or add new items'}
            </Text>
            <View style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>+ Add Product</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {filteredProducts.map(product => (
              <View key={product.id} style={styles.productCard}>
                {/* Product Image */}
                <TouchableOpacity 
                  style={styles.productImageContainer}
                  onPress={() => openProduct(product.url)}
                  activeOpacity={0.7}
                >
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
            ))}
            
            {/* Empty space that acts as add button */}
            <TouchableOpacity 
              style={styles.addProductArea}
              onPress={() => setIsAddModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addProductAreaText}>+ Tap to add another product</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.removeAllButton, products.length === 0 && styles.disabledButton]} 
            onPress={clearAll}
            disabled={products.length === 0}
          >
            <Text style={[styles.removeAllButtonText, products.length === 0 && styles.disabledButtonText]}>
              Remove All
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
              style={[styles.input, styles.urlInput]}
              value={productUrl}
              onChangeText={setProductUrl}
              placeholder="Paste product link here..."
              placeholderTextColor="#999"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <Text style={styles.inputLabel}>Category (optional)</Text>
            <TextInput
              style={[styles.input, styles.categoryInput]}
              value={selectedCategory}
              onChangeText={setSelectedCategory}
              placeholder="Enter category or leave blank for 'general'"
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
            
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
            
            <Text style={styles.inputLabel}>Select Existing Category</Text>
            <ScrollView style={styles.categoryList}>
              {[...new Set(products.map(p => p.category || 'general'))].map(category => (
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
            
            <Text style={styles.inputLabel}>Or Create New Category</Text>
            <View style={styles.newCategoryContainer}>
              <TextInput
                style={[styles.input, styles.newCategoryInput]}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="Enter new category name..."
                placeholderTextColor="#999"
              />
              <TouchableOpacity 
                style={styles.addCategoryButton}
                onPress={addNewCategory}
              >
                <Text style={styles.addCategoryButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
    padding: 12, // Reduced from 20
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20, // Reduced from 24
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
    marginHorizontal: 16, // Reduced from 20
    marginVertical: 8, // Reduced from 16
    borderRadius: 8,
    padding: 2, // Reduced from 4
  },
  tab: {
    flex: 1,
    paddingVertical: 6, // Reduced from 10
    paddingHorizontal: 12, // Reduced from 16
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
  emptyContentContainer: {
    flex: 1,
    justifyContent: 'center',
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
  addProductArea: {
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    backgroundColor: '#f8f9fa',
  },
  addProductAreaText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
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
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  removeAllButton: {
    backgroundColor: '#212529',
  },
  removeAllButtonText: {
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
  urlInput: {
    color: '#212529', // Dark text color so you can see what you're typing
  },
  categoryInput: {
    color: '#212529', // Dark text color
  },
  dropdownContainer: {
    position: 'absolute',
    top: 50, // Reduced from 60 due to smaller tab container
    left: 16, // Reduced from 20 to match margins
    right: 16, // Reduced from 20 to match margins
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000, // Make sure it appears above other content
  },
  dropdown: {
    maxHeight: 250,
    borderRadius: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeDropdownItem: {
    backgroundColor: '#f8f9fa',
  },
  dropdownText: {
    fontSize: 14,
    color: '#495057',
  },
  activeDropdownText: {
    color: '#212529',
    fontWeight: '600',
  },
  searchSortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16, // Reduced from 20
    paddingVertical: 6, // Reduced from 10
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 12,
  },
  searchContainer: {
    flex: 2, // Takes up 2/3 of the space
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212529',
    backgroundColor: '#fff',
  },
  sortButton: {
    flex: 1, // Takes up 1/3 of the space
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
    textAlign: 'center',
  },
  sortDropdownContainer: {
    position: 'absolute',
    top: 170, // Position it below search/sort bar
    right: 20,
    minWidth: 140, // Ensure minimum width for single line text
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
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
syncStatus: {
    alignItems: 'center',
    marginVertical: 5,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  syncText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});