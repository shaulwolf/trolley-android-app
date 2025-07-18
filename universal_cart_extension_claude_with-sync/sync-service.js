// Enhanced Chrome Extension Sync Service
class EnhancedTrolleySyncService {
  constructor() {
    this.BACKEND_URL = 'http://localhost:3000';
    this.syncInProgress = false;
    this.lastSyncTime = null;
    
    this.initializeDeviceId();
    this.loadLastSyncTime();
    
    console.log('🔄 Enhanced Trolley Sync Service initialized');
  }

  // Initialize consistent device ID
  async initializeDeviceId() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['deviceId'], resolve);
    });
    
    if (result.deviceId) {
      this.deviceId = result.deviceId;
    } else {
      this.deviceId = 'chrome-ext-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      chrome.storage.local.set({ deviceId: this.deviceId });
    }
  }

  // Load last sync time from storage
  async loadLastSyncTime() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['lastSyncTime'], resolve);
    });
    this.lastSyncTime = result.lastSyncTime ? new Date(result.lastSyncTime) : null;
  }

  // Save last sync time to storage
  async saveLastSyncTime() {
    this.lastSyncTime = new Date();
    await new Promise(resolve => {
      chrome.storage.local.set({ lastSyncTime: this.lastSyncTime.toISOString() }, resolve);
    });
  }

  // Convert Chrome folder structure to flat array
  chromeToFlat(chromeData) {
    const products = [];
    
    Object.entries(chromeData.cart || {}).forEach(([folderName, folderProducts]) => {
      const categoryId = folderName === 'All Items' ? 'general' : 
                        folderName.toLowerCase().replace(/\s+/g, '-');
      
      folderProducts.forEach(product => {
        products.push({
          ...product,
          category: categoryId,
          lastModified: product.lastModified || new Date().toISOString(),
          deviceSource: this.deviceId,
          id: product.id || this.generateProductId(product.url)
        });
      });
    });
    
    console.log('🔄 Converted Chrome folders to flat array:', products.length, 'products');
    return products;
  }

  // Convert flat array back to Chrome folder structure
  flatToChrome(products) {
    const cart = {};
    const categoryMap = {
      'general': 'All Items',
      'electronics': 'Electronics',
      'clothing': 'Clothing',
      'home': 'Home & Garden',
      'books': 'Books',
      'sports': 'Sports & Outdoors'
    };
    
    products.forEach(product => {
      const folderName = categoryMap[product.category] || 
                        this.capitalizeWords(product.category) || 
                        'All Items';
      
      if (!cart[folderName]) cart[folderName] = [];
      
      const chromeProduct = {
        id: product.id,
        url: product.url,
        title: product.title,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        site: product.site,
        displaySite: product.displaySite,
        dateAdded: product.dateAdded,
        lastModified: product.lastModified || new Date().toISOString(),
        variants: product.variants || {}
      };
      
      cart[folderName].push(chromeProduct);
    });
    
    console.log('🔄 Converted flat array to Chrome folders:', Object.keys(cart).length, 'folders');
    return { cart };
  }

  // Helper functions
  generateProductId(url) {
    return 'chrome-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
  }

  capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase()).replace(/-/g, ' ');
  }

  // Smart merge local and remote products
  smartMerge(localProducts, remoteProducts) {
    const merged = new Map();
    const conflicts = [];

    // Add all remote products first
    remoteProducts.forEach(product => {
      merged.set(product.id, product);
    });

    // Process local products - check for conflicts
    localProducts.forEach(localProduct => {
      const remoteProduct = merged.get(localProduct.id);
      
      if (!remoteProduct) {
        // New local product - add it
        merged.set(localProduct.id, localProduct);
      } else {
        // Conflict resolution by timestamp
        const localTime = new Date(localProduct.lastModified || 0);
        const remoteTime = new Date(remoteProduct.lastModified || 0);
        
        if (localTime > remoteTime) {
          // Local is newer - keep local
          merged.set(localProduct.id, localProduct);
          conflicts.push({
            id: localProduct.id,
            resolution: 'local-wins',
            localTime,
            remoteTime
          });
        }
      }
    });

    console.log('🔄 Smart merge completed:', merged.size, 'products,', conflicts.length, 'conflicts resolved');
    return Array.from(merged.values());
  }

  // Upload Chrome products to backend
  async syncUp() {
    try {
      console.log('📤 Chrome: Enhanced sync UP...');
      
      const chromeData = await new Promise(resolve => {
        chrome.storage.local.get({ cart: {} }, resolve);
      });
      
      const flatProducts = this.chromeToFlat(chromeData);
      console.log('📊 Chrome: Uploading', flatProducts.length, 'products');
      
      const response = await fetch(`${this.BACKEND_URL}/api/sync/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: flatProducts,
          deviceId: this.deviceId,
          timestamp: new Date().toISOString(),
          lastSyncTime: this.lastSyncTime?.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Sync upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Chrome: Enhanced sync UP completed:', result.stats);
      return result;
      
    } catch (error) {
      console.error('❌ Chrome: Enhanced sync UP failed:', error);
      throw error;
    }
  }

  // Download products from backend
  async syncDown() {
    try {
      console.log('📥 Chrome: Enhanced sync DOWN...');
      
      // Get current local data for merging
      const chromeData = await new Promise(resolve => {
        chrome.storage.local.get({ cart: {} }, resolve);
      });
      const localProducts = this.chromeToFlat(chromeData);
      
      // Fetch from backend with timestamp filter
      const url = this.lastSyncTime 
        ? `${this.BACKEND_URL}/api/sync?since=${this.lastSyncTime.toISOString()}`
        : `${this.BACKEND_URL}/api/sync`;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Sync download failed: ${response.status}`);
      }

      const result = await response.json();
      const remoteProducts = result.products || [];
      
      console.log('📊 Chrome: Downloaded', remoteProducts.length, 'remote products');
      
      // Smart merge
      const mergedProducts = this.smartMerge(localProducts, remoteProducts);
      
      // Convert back to Chrome format
      const chromeFormat = this.flatToChrome(mergedProducts);
      
      // Update Chrome storage
      await new Promise(resolve => {
        chrome.storage.local.set(chromeFormat, resolve);
      });
      
      console.log('✅ Chrome: Enhanced sync DOWN completed');
      return mergedProducts;
      
    } catch (error) {
      console.error('❌ Chrome: Enhanced sync DOWN failed:', error);
      throw error;
    }
  }

  // Full bidirectional sync
  async sync() {
    if (this.syncInProgress) {
      console.log('⚠️ Chrome: Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    
    try {
      console.log('🔄 Chrome: Starting enhanced bidirectional sync...');
      
      // Step 1: Download latest (for conflict detection)
      await this.syncDown();
      
      // Step 2: Upload our changes
      await this.syncUp();
      
      // Step 3: Final download (authoritative state)
      const finalProducts = await this.syncDown();
      
      // Step 4: Update sync timestamp
      await this.saveLastSyncTime();
      
      console.log(`✅ Chrome: Enhanced sync completed: ${finalProducts.length} products`);
      
      // Notify extension about sync completion
      chrome.runtime.sendMessage({
        type: 'SYNC_COMPLETED',
        productCount: finalProducts.length
      });
      
      return finalProducts;
      
    } catch (error) {
      console.error('❌ Chrome: Enhanced sync failed:', error);
      
      chrome.runtime.sendMessage({
        type: 'SYNC_FAILED',
        error: error.message
      });
      
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Start auto-sync with exponential backoff
  startAutoSync() {
    console.log('⏰ Chrome: Starting intelligent auto-sync');
    
    let syncInterval = 30000; // 30 seconds
    const maxInterval = 300000; // 5 minutes max
    let consecutiveFailures = 0;
    
    const performAutoSync = async () => {
      try {
        await this.sync();
        syncInterval = 30000; // Reset on success
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        syncInterval = Math.min(syncInterval * 2, maxInterval);
        console.log(`🔄 Chrome: Auto-sync failed ${consecutiveFailures} times, next in ${syncInterval/1000}s`);
      }
    };
    
    // Initial sync
    setTimeout(performAutoSync, 5000);
    
    // Recurring sync
    setInterval(() => {
      if (!this.syncInProgress) {
        performAutoSync();
      }
    }, syncInterval);
  }

  // Enhanced storage change handler
  onStorageChange() {
    let syncTimeout;
    
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.cart && !this.syncInProgress) {
        console.log('🔄 Chrome: Storage changed, debouncing sync...');
        
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        
        syncTimeout = setTimeout(async () => {
          try {
            await this.sync();
          } catch (error) {
            console.log('🔄 Chrome: Storage change sync failed:', error.message);
          }
        }, 3000);
      }
    });
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedTrolleySyncService;
}