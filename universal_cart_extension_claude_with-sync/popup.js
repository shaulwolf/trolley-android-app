// Simple Trolley Popup
let isSyncing = false;
let isLoadingCart = false;

// Auth elements
const authSection = document.getElementById("authSection");
const mainApp = document.getElementById("mainApp");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const userInfo = document.getElementById("userInfo");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");

// DOM elements
const cartContainer = document.getElementById("cart-container");
const syncButton = document.getElementById("syncButton");
const syncStatus = document.getElementById("syncStatus");
const productCount = document.getElementById("product-count");
const clearAllButton = document.getElementById("clear-all-button");

// Auth state
let currentUser = null;
let googleAuth = null;

// Initialize popup
document.addEventListener("DOMContentLoaded", function () {
  // Initialize Google Auth
  initializeGoogleAuth();

  let customCategories = [];
  let customStores = [];
  let currentFilter = "all";
  let currentMode = "categories";
  let allProducts = [];
  let currentSort = "dateAdded-desc";
  let searchTerm = "";

  // Auth functions
  function initializeGoogleAuth() {
    // Initialize Google Auth
    googleAuth = new GoogleAuth();
    googleAuth.setAuthStateChangeCallback((isSignedIn, userInfo) => {
      if (isSignedIn && userInfo) {
        // User is signed in
        currentUser = userInfo;
        showMainApp();
        updateUserInfo(userInfo);
        console.log("User signed in:", userInfo.email);

        // Load user's products after successful authentication
        console.log("🔄 Starting product load after authentication...");
        console.log("👤 Current user set to:", userInfo.email);

        // Try immediate load first
        setTimeout(() => {
          console.log("🔄 First attempt to load cart after auth...");
          console.log(
            "👤 currentUser is:",
            currentUser ? currentUser.email : "null"
          );

          if (typeof window.loadCart === "function") {
            console.log("✅ loadCart function found, calling it...");
            window.loadCart();
          } else {
            console.log("❌ loadCart function not found");
          }
        }, 500);

        // Backup attempt with longer delay
        setTimeout(() => {
          console.log("🔄 Backup attempt to load cart...");
          if (allProducts.length === 0) {
            console.log("📦 No products loaded yet, trying again...");
            if (typeof window.loadCart === "function") {
              window.loadCart();
            }
          } else {
            console.log("📦 Products already loaded:", allProducts.length);
          }
        }, 2000);
      } else {
        // User is signed out
        currentUser = null;
        showAuthSection();
        console.log("User signed out");
      }
    });

    // Initialize auth
    googleAuth.initialize();

    // Add event listeners
    googleSignInBtn.addEventListener("click", signInWithGoogle);
    signOutBtn.addEventListener("click", signOutUser);
  }

  function signInWithGoogle() {
    googleSignInBtn.disabled = true;
    googleSignInBtn.innerHTML = "Signing in...";

    console.log("🔐 Requesting OAuth from background script...");

    // Викликати OAuth в background script
    chrome.runtime.sendMessage({ action: "performOAuth" }, (response) => {
      if (response && response.success) {
        console.log("✅ Background OAuth successful:", response.userInfo.email);

        // Оновити стан користувача
        currentUser = response.userInfo;

        // Показати головний інтерфейс
        showMainApp();
        updateUserInfo(response.userInfo);

        console.log("🔄 Starting product load after successful OAuth...");

        // Завантажити продукти після успішної авторизації
        setTimeout(() => {
          console.log("📦 Loading products after background OAuth...");
          if (typeof window.loadCart === "function") {
            window.loadCart();
          } else {
            console.log("❌ loadCart function not available");
          }
        }, 1000);
      } else {
        console.error("❌ Background OAuth failed:", response?.error);

        // Відновити кнопку входу
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = `
          <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" class="google-icon">
          Sign in with Google
        `;

        // Показати помилку користувачу
        alert(`Sign in failed: ${response?.error || "Unknown error"}`);
      }
    });
  }

  function signOutUser() {
    console.log("🚪 Signing out user...");

    // Очистити локальний стан
    currentUser = null;
    allProducts = [];
    customCategories = [];

    // Очистити Chrome storage
    chrome.storage.local.remove(["firebase_id_token", "cart"], () => {
      console.log("✅ Chrome storage cleared");
    });

    // Очистити Google OAuth токени
    chrome.identity.clearAllCachedAuthTokens(() => {
      console.log("✅ OAuth tokens cleared");
    });

    // Показати екран авторизації
    showAuthSection();

    console.log("✅ Sign out completed");
  }

  function showAuthSection() {
    authSection.style.display = "flex";
    mainApp.style.display = "none";
    // Clear cart data when user signs out
    allProducts = [];
    customCategories = [];
    customStores = [];
    currentFilter = "all";
    currentMode = "categories";
    currentSort = "dateAdded-desc";
    searchTerm = "";

    // Clear the display
    const cartContent = document.getElementById("cartContent");
    cartContent.innerHTML = `
      <div class="empty-state">
        <h3>Your trolley is empty</h3>
        <p>Visit any product page and click the trolley icon to add items!</p>
      </div>
    `;

    // Reset UI elements
    document.getElementById("totalItems").textContent = "0";
    document.getElementById("checkoutBtn").textContent = "Open All Items";
    document.getElementById("checkoutBtn").disabled = true;
  }

  function showMainApp() {
    console.log("🔄 Showing main app...");
    authSection.style.display = "none";
    mainApp.style.display = "flex";

    // Initialize cart loading - this will be called by auth callback
    console.log("📱 Main app shown, cart will be loaded by auth callback");
  }

  function updateUserInfo(userInfo) {
    userAvatar.src =
      userInfo.picture || "https://via.placeholder.com/32x32?text=U";
    userName.textContent = userInfo.name || "User";
    userEmail.textContent = userInfo.email;
  }

  // Define all functions first
  function updateSubtotal() {
    const visibleItems = document.querySelectorAll(
      '.product-item:not([style*="display: none"])'
    );
    const totalItems = visibleItems.length;

    console.log("📊 Updating subtotal - visible items:", totalItems);
    console.log("📦 allProducts length:", allProducts.length);

    document.getElementById("totalItems").textContent = totalItems;

    const checkoutBtn = document.getElementById("checkoutBtn");
    if (totalItems === 0) {
      checkoutBtn.textContent = "Open All Items";
      checkoutBtn.disabled = true;
    } else {
      checkoutBtn.textContent = `Open All Items (${totalItems})`;
      checkoutBtn.disabled = false;
    }
  }

  // Helper function to calculate discount percentage
  function calculateDiscountPercentage(originalPrice, salePrice) {
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

      console.log("💰 Price comparison:", {
        original: originalNum,
        sale: saleNum,
        difference: difference,
        percentDifference: percentDifference.toFixed(1),
      });

      // Only show discount if it's at least 1% and sale price is lower
      if (difference < 0.01 || percentDifference < 1) {
        console.log("❌ No significant discount found");
        return "";
      }

      const discountPercent = Math.round(percentDifference);
      console.log(`✅ Discount calculated: -${discountPercent}%`);
      return `-${discountPercent}%`;
    } catch (error) {
      console.error("Error calculating discount:", error);
      return "";
    }
  }

  // Store name mapping function
  function getStoreName(hostname) {
    // Remove www. and common prefixes
    const cleanHostname = hostname.replace(/^(www\.|m\.|mobile\.)/, "");

    // Store name mappings
    const storeMap = {
      "toddsnyder.com": "Todd Snyder",
      "bonobos.com": "Bonobos",
      "jcrew.com": "J.Crew",
      "amazon.com": "Amazon",
      "target.com": "Target",
      "walmart.com": "Walmart",
      "nordstrom.com": "Nordstrom",
      "macys.com": "Macy's",
      "uniqlo.com": "Uniqlo",
      "hm.com": "H&M",
      "zara.com": "Zara",
      "gap.com": "Gap",
      "bananarepublic.com": "Banana Republic",
      "oldnavy.com": "Old Navy",
      "loft.com": "LOFT",
      "anntaylor.com": "Ann Taylor",
      "nike.com": "Nike",
      "adidas.com": "Adidas",
      "underarmour.com": "Under Armour",
      "lululemon.com": "Lululemon",
      "patagonia.com": "Patagonia",
      "rei.com": "REI",
      "dickssportinggoods.com": "Dick's Sporting Goods",
      "levi.com": "Levi's",
      "dockers.com": "Dockers",
      "calvinklein.com": "Calvin Klein",
      "ralphlauren.com": "Ralph Lauren",
      "tommy.com": "Tommy Hilfiger",
      "abercrombie.com": "Abercrombie & Fitch",
      "hollisterco.com": "Hollister",
      "ae.com": "American Eagle",
      "asos.com": "ASOS",
      "shopbop.com": "Shopbop",
      "revolve.com": "Revolve",
      "ssense.com": "SSENSE",
      "mrporter.com": "Mr Porter",
      "netaporter.com": "Net-A-Porter",
      "farfetch.com": "Farfetch",
      "matchesfashion.com": "Matches Fashion",
      "saksfifthavenue.com": "Saks Fifth Avenue",
      "bergdorfgoodman.com": "Bergdorf Goodman",
      "barneys.com": "Barneys",
      "gilt.com": "Gilt",
      "ruehl.com": "Rue La La",
      "hautelook.com": "HauteLook",
      "theoutnet.com": "The Outnet",
      "yoox.com": "YOOX",
      "everlane.com": "Everlane",
      "warbyparker.com": "Warby Parker",
      "allbirds.com": "Allbirds",
      "reformation.com": "Reformation",
      "goop.com": "Goop",
      "anthropologie.com": "Anthropologie",
      "urbanoutfitters.com": "Urban Outfitters",
      "freepeople.com": "Free People",
      "bhldn.com": "BHLDN",
      "theordinary.com": "The Ordinary",
      "sephora.com": "Sephora",
      "ulta.com": "Ulta Beauty",
      "maccosmetics.com": "MAC Cosmetics",
      "nykaa.com": "Nykaa",
      "beautylish.com": "Beautylish",
      "dermstore.com": "Dermstore",
      "skinstore.com": "SkinStore",
      "lookfantastic.com": "LookFantastic",
      "cultbeauty.com": "Cult Beauty",
      "spacenk.com": "Space NK",
      "etsy.com": "Etsy",
      "wayfair.com": "Wayfair",
      "overstock.com": "Overstock",
      "westelm.com": "West Elm",
      "potterybarn.com": "Pottery Barn",
      "crateandbarrel.com": "Crate & Barrel",
      "cb2.com": "CB2",
      "ikea.com": "IKEA",
      "homedepot.com": "Home Depot",
      "lowes.com": "Lowe's",
      "bedbathandbeyond.com": "Bed Bath & Beyond",
      "williams-sonoma.com": "Williams Sonoma",
      "surlatable.com": "Sur La Table",
      "rhone.com": "Rhone",
      "outerknown.com": "Outerknown",
      "prana.com": "Prana",
      "allsaints.com": "AllSaints",
      "reiss.com": "Reiss",
      "cosstores.com": "COS",
      "stories.com": "& Other Stories",
      "weekday.com": "Weekday",
      "monki.com": "Monki",
      "arket.com": "Arket",
      "massimodutti.com": "Massimo Dutti",
      "pullandbear.com": "Pull & Bear",
      "bershka.com": "Bershka",
      "stradivarius.com": "Stradivarius",
    };

    // Check if we have a mapping
    if (storeMap[cleanHostname]) {
      return storeMap[cleanHostname];
    }

    // If no mapping, try to create a nice name from the domain
    const domainParts = cleanHostname.split(".");
    if (domainParts.length >= 2) {
      const storeName = domainParts[0];

      // Handle special cases
      if (storeName.length <= 3) {
        return storeName.toUpperCase(); // For short names like H&M
      }

      // Capitalize first letter and handle camelCase
      return storeName
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
        .trim();
    }

    // Fallback to original hostname if all else fails
    return cleanHostname;
  }

  function updateMainDropdown() {
    const dropdown = document.getElementById("mainCategoryDropdown");
    const input = dropdown.querySelector(".main-new-category-input");

    // Remove old options
    const options = dropdown.querySelectorAll(".main-category-option");
    options.forEach((option) => option.remove());

    let categories;
    const filteredProducts = getFilteredProducts();

    if (currentMode === "categories") {
      // Calculate category counts
      categories = { all: filteredProducts.length };
      filteredProducts.forEach((item) => {
        const category = item.category || "all";
        if (!categories[category]) {
          categories[category] = 0;
        }
        categories[category]++;
      });

      // Add "All Items" category
      const allOption = document.createElement("button");
      allOption.className = "main-category-option";
      allOption.setAttribute("data-value", "all");
      allOption.textContent = `All Items (${categories.all})`;
      dropdown.insertBefore(allOption, input);

      // Add custom categories
      customCategories.forEach((cat) => {
        const count = categories[cat.value] || 0;
        const option = document.createElement("button");
        option.className = "main-category-option";
        option.setAttribute("data-value", cat.value);
        option.textContent = `${cat.name} (${count})`;
        dropdown.insertBefore(option, input);
      });

      input.placeholder = "Add new category";
    } else {
      // Calculate store counts - group by actual store hostnames but display nice names
      const storeHostnames = {};
      filteredProducts.forEach((item) => {
        const hostname = item.site;
        if (!storeHostnames[hostname]) {
          storeHostnames[hostname] = 0;
        }
        storeHostnames[hostname]++;
      });

      categories = { all: filteredProducts.length };

      // Add "All Stores" option
      const allOption = document.createElement("button");
      allOption.className = "main-category-option";
      allOption.setAttribute("data-value", "all");
      allOption.textContent = `All Stores (${categories.all})`;
      dropdown.insertBefore(allOption, input);

      // Add stores with nice names, sorted alphabetically
      const sortedStores = Object.keys(storeHostnames).sort((a, b) => {
        const nameA = getStoreName(a);
        const nameB = getStoreName(b);
        return nameA.localeCompare(nameB);
      });

      sortedStores.forEach((hostname) => {
        const count = storeHostnames[hostname];
        const displayName = getStoreName(hostname);
        const option = document.createElement("button");
        option.className = "main-category-option";
        option.setAttribute("data-value", hostname); // Keep hostname as value for filtering
        option.textContent = `${displayName} (${count})`;
        dropdown.insertBefore(option, input);
      });

      input.placeholder = "Add new store";
    }
  }

  function updateAllDropdowns() {
    // Update all inline dropdowns to include custom categories
    document
      .querySelectorAll(".inline-category-dropdown")
      .forEach((dropdown) => {
        const input = dropdown.querySelector(".new-category-input");

        // Remove old options
        const options = dropdown.querySelectorAll(".category-option");
        options.forEach((option) => option.remove());

        // Add custom categories
        customCategories.forEach((cat) => {
          const option = document.createElement("button");
          option.className = "category-option";
          option.setAttribute("data-value", cat.value);
          option.textContent = cat.name;
          dropdown.insertBefore(option, input);
        });
      });
  }

  function updateCategoryCounts() {
    const filteredProducts = getFilteredProducts();

    if (currentMode === "categories") {
      const categories = { all: filteredProducts.length };

      filteredProducts.forEach((item) => {
        const category = item.category || "all";
        if (!categories[category]) {
          categories[category] = 0;
        }
        categories[category]++;
      });

      if (currentFilter === "all") {
        document
          .getElementById("categoryFilterDisplay")
          .querySelector("span").textContent = `All Items (${categories.all})`;
      } else {
        const currentCategory = customCategories.find(
          (cat) => cat.value === currentFilter
        );
        if (currentCategory) {
          document
            .getElementById("categoryFilterDisplay")
            .querySelector("span").textContent = `${currentCategory.name} (${
            categories[currentFilter] || 0
          })`;
        }
      }
    } else {
      // Store mode - use nice store names in display
      const storeHostnames = {};

      filteredProducts.forEach((item) => {
        const hostname = item.site;
        if (!storeHostnames[hostname]) {
          storeHostnames[hostname] = 0;
        }
        storeHostnames[hostname]++;
      });

      if (currentFilter === "all") {
        document
          .getElementById("categoryFilterDisplay")
          .querySelector(
            "span"
          ).textContent = `All Stores (${filteredProducts.length})`;
      } else {
        const storeName = getStoreName(currentFilter);
        const count = storeHostnames[currentFilter] || 0;
        document
          .getElementById("categoryFilterDisplay")
          .querySelector("span").textContent = `${storeName} (${count})`;
      }
    }

    updateMainDropdown();
  }

  function parsePrice(priceString) {
    if (!priceString || priceString === "N/A") return 0;
    // Remove currency symbols and commas, then parse
    const numericValue = priceString.replace(/[$,]/g, "");
    return parseFloat(numericValue) || 0;
  }

  function sortProducts(products, sortBy) {
    const [field, direction] = sortBy.split("-");

    return products.sort((a, b) => {
      let aValue, bValue;

      switch (field) {
        case "dateAdded":
          aValue = new Date(a.dateAdded || 0);
          bValue = new Date(b.dateAdded || 0);
          break;
        case "price":
          aValue = parsePrice(a.price);
          bValue = parsePrice(b.price);
          break;
        case "title":
          aValue = (a.title || "").toLowerCase();
          bValue = (b.title || "").toLowerCase();
          break;
        default:
          return 0;
      }

      if (direction === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }

  function highlightSearchTerm(text, term) {
    if (!term) return text;

    const regex = new RegExp(`(${term})`, "gi");
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }

  function getFilteredProducts() {
    let filtered = allProducts;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((product) => {
        const searchableText = [
          product.title,
          product.site,
          product.price,
          product.originalPrice,
          Object.values(product.variants || {}).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchTerm.toLowerCase());
      });
    }

    // Apply category/store filter
    if (currentFilter !== "all") {
      if (currentMode === "categories") {
        filtered = filtered.filter((product) => {
          const productCategory = product.category || "all";
          return productCategory === currentFilter;
        });
      } else {
        filtered = filtered.filter((product) => product.site === currentFilter);
      }
    }

    return filtered;
  }

  function updateSearchResultsInfo() {
    const searchInfo = document.getElementById("searchResultsInfo");
    const searchText = document.getElementById("searchResultsText");

    // Check if elements exist
    if (!searchInfo || !searchText) {
      console.log("⚠️ Search info elements not found, skipping update");
      return;
    }

    if (searchTerm) {
      const filteredProducts = getFilteredProducts();
      searchText.textContent = `Found ${filteredProducts.length} product${
        filteredProducts.length !== 1 ? "s" : ""
      } matching "${searchTerm}"`;
      searchInfo.style.display = "flex";
    } else {
      searchInfo.style.display = "none";
    }
  }

  function renderProducts() {
    console.log("🎨 Rendering products...");
    console.log("📦 allProducts array:", allProducts);
    console.log("📦 allProducts length:", allProducts.length);

    const content = document.getElementById("cartContent");

    if (allProducts.length === 0) {
      console.log("📭 No products to render, showing empty state");
      content.innerHTML = `
                <div class="empty-state">
                    <h3>Your trolley is empty</h3>
                    <p>Visit any product page and click the trolley icon to add items!</p>
                </div>
            `;
      updateSubtotal();
      return;
    }

    // Get filtered products
    let filteredProducts = getFilteredProducts();

    // Sort products
    filteredProducts = sortProducts([...filteredProducts], currentSort);

    // Update search results info
    updateSearchResultsInfo();

    // Clear content except search results info
    const existingSearchInfo = content.querySelector(".search-results-info");
    content.innerHTML = "";
    if (existingSearchInfo) {
      content.appendChild(existingSearchInfo);
    }

    if (filteredProducts.length === 0) {
      const noResultsDiv = document.createElement("div");
      noResultsDiv.className = "empty-state";
      if (searchTerm) {
        noResultsDiv.innerHTML = `
                    <h3>No products found</h3>
                    <p>No products match your search for "${searchTerm}"</p>
                `;
      } else {
        noResultsDiv.innerHTML = `
                    <h3>No products in this category</h3>
                    <p>Try selecting a different category or adding some products!</p>
                `;
      }
      content.appendChild(noResultsDiv);
      updateSubtotal();
      return;
    }

    filteredProducts.forEach((product, index) => {
      const originalIndex = allProducts.findIndex((p) => p.url === product.url);
      const productDiv = document.createElement("div");
      productDiv.className = "product-item";
      productDiv.setAttribute("data-category", product.category || "all");
      productDiv.setAttribute("data-store", product.site);
      productDiv.setAttribute("data-index", originalIndex);

      const categoryTag =
        product.category === "all" || !product.category
          ? "General"
          : customCategories.find((cat) => cat.value === product.category)
              ?.name || product.category;

      // Build variants display
      let variantsHtml = "";
      if (product.variants && Object.keys(product.variants).length > 0) {
        const variantPairs = [];
        if (product.variants.size)
          variantPairs.push(`Size: ${product.variants.size}`);
        if (product.variants.color)
          variantPairs.push(`Color: ${product.variants.color}`);
        if (product.variants.style)
          variantPairs.push(`Style: ${product.variants.style}`);

        if (variantPairs.length > 0) {
          variantsHtml = `<div class="product-variants">${variantPairs.join(
            " | "
          )}</div>`;
        }
      }

      // Highlight search terms in product title and store name
      const highlightedTitle = highlightSearchTerm(
        product.title || "Untitled Product",
        searchTerm
      );
      const highlightedStore = highlightSearchTerm(
        getStoreName(product.site) || "Unknown Store",
        searchTerm
      );

      productDiv.innerHTML = `
                <div class="product-image">
                    ${
                      product.image
                        ? `<img src="${product.image}" alt="Product image" onerror="this.style.display='none'; this.parentElement.textContent='No Image';">`
                        : "No Image"
                    }
                </div>
                <div class="product-info">
                    <div class="product-name">${highlightedTitle}</div>
                    <div class="product-pricing">
                        ${(() => {
                          if (product.originalPrice && product.price) {
                            const discount = calculateDiscountPercentage(
                              product.originalPrice,
                              product.price
                            );
                            // Only show original price if there's a real discount
                            return discount
                              ? `<span class="original-price">${product.originalPrice}</span>`
                              : "";
                          }
                          return "";
                        })()}
                        <span class="sale-price ${(() => {
                          if (product.originalPrice && product.price) {
                            const discount = calculateDiscountPercentage(
                              product.originalPrice,
                              product.price
                            );
                            return discount ? "has-discount" : "no-discount";
                          }
                          return "no-discount";
                        })()}">${product.price || "N/A"}</span>
                        ${(() => {
                          if (product.originalPrice && product.price) {
                            const discount = calculateDiscountPercentage(
                              product.originalPrice,
                              product.price
                            );
                            return discount
                              ? `<span class="discount-badge">${discount}</span>`
                              : "";
                          }
                          return "";
                        })()}
                    </div>
                    <div class="product-details">
                        <div class="product-detail">
                            <span class="product-store">${highlightedStore}</span>
                        </div>
                        ${variantsHtml}
                        <div class="product-tag" data-category="${
                          product.category || "all"
                        }">${categoryTag}</div>
                        <div class="inline-category-dropdown">
                            ${customCategories
                              .map(
                                (cat) =>
                                  `<button class="category-option" data-value="${cat.value}">${cat.name}</button>`
                              )
                              .join("")}
                            <input type="text" class="new-category-input" placeholder="Add new category">
                        </div>
                    </div>
                    <div class="product-actions">
                        <button class="action-link remove-btn" data-index="${originalIndex}">Remove</button>
                    </div>
                </div>
            `;

      content.appendChild(productDiv);
    });

    // Add event listeners for new elements
    addProductEventListeners();
    updateSubtotal();

    console.log(`✅ Rendered ${filteredProducts.length} products`);
  }

  function addProductEventListeners() {
    // Handle product tag clicks
    document.querySelectorAll(".product-tag").forEach((tag) => {
      tag.addEventListener("click", function (e) {
        e.stopPropagation();

        const dropdown = this.nextElementSibling;
        const isCurrentlyOpen = dropdown.classList.contains("show");

        // Close any other open dropdowns first
        document
          .querySelectorAll(".inline-category-dropdown")
          .forEach((otherDropdown) => {
            otherDropdown.classList.remove("show");
          });

        // If this dropdown was already open, keep it closed (toggle behavior)
        // If it was closed, open it
        if (!isCurrentlyOpen) {
          dropdown.classList.add("show");

          // Update selected state
          const currentCategory = this.getAttribute("data-category");
          dropdown.querySelectorAll(".category-option").forEach((option) => {
            option.classList.remove("selected");
            if (option.getAttribute("data-value") === currentCategory) {
              option.classList.add("selected");
            }
          });
        }
      });
    });

    // Handle remove buttons
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const index = parseInt(this.getAttribute("data-index"));
        const product = allProducts[index];

        // Delete from server and reload
        chrome.runtime.sendMessage(
          {
            action: "deleteProduct",
            productId: product.id,
          },
          (response) => {
            if (response.success) {
              console.log("✅ Product deleted:", response.message);
              window.loadCart(); // Reload cart after deletion
            } else {
              console.error("❌ Failed to delete product:", response.error);
            }
          }
        );
      });
    });

    // Handle product name and image clicks
    document
      .querySelectorAll(".product-name, .product-image")
      .forEach((element) => {
        element.addEventListener("click", function () {
          const productItem = this.closest(".product-item");
          const index = parseInt(productItem.getAttribute("data-index"));
          const product = allProducts[index];

          // Open product page in new tab
          chrome.tabs.create({ url: product.url });
        });
      });

    // Handle store name clicks
    document.querySelectorAll(".product-store").forEach((store) => {
      store.addEventListener("click", function () {
        const productItem = this.closest(".product-item");
        const index = parseInt(productItem.getAttribute("data-index"));
        const product = allProducts[index];
        const hostname = product.site; // Use the original hostname for the URL
        const storeUrl = `https://${hostname}`;
        chrome.tabs.create({ url: storeUrl });
      });
    });
  }

  // Global loadCart function
  window.loadCart = function () {
    if (isLoadingCart) {
      console.log("📦 Cart loading already in progress, skipping...");
      return;
    }

    // Check if user is authenticated first
    if (!currentUser) {
      console.log("User not authenticated, skipping cart load");
      return;
    }

    isLoadingCart = true;
    console.log("📦 Loading cart data from server...");

    // Get all products from server
    chrome.runtime.sendMessage({ action: "getAllProducts" }, (response) => {
      isLoadingCart = false;

      if (response && response.success) {
        console.log("✅ Loaded products from server:", response.message);
        console.log("📊 Response product count:", response.productCount);

        // Load from storage (background script already saved it)
        chrome.storage.local.get({ cart: {} }, ({ cart }) => {
          allProducts = [];
          customCategories = [];

          console.log(
            "📊 Cart data loaded:",
            Object.keys(cart).length,
            "folders"
          );
          console.log("📦 Raw cart data:", cart);
          console.log("📦 Response product count was:", response.productCount);

          // Flatten all products from all folders and assign categories
          Object.entries(cart).forEach(([folderName, products]) => {
            console.log(
              `📁 Folder "${folderName}":`,
              products.length,
              "products"
            );

            if (folderName === "All Items") {
              // Products in "All Items" don't have a specific category
              products.forEach((product) => {
                allProducts.push({ ...product, category: "all" });
              });
            } else {
              // Products in named folders get that category
              const categoryValue = folderName
                .toLowerCase()
                .replace(/\s+/g, "-");

              // Add to custom categories if not already there
              if (
                !customCategories.find((cat) => cat.value === categoryValue)
              ) {
                customCategories.push({
                  value: categoryValue,
                  name: folderName,
                });
              }

              products.forEach((product) => {
                allProducts.push({ ...product, category: categoryValue });
              });
            }
          });

          console.log("📦 Total products loaded:", allProducts.length);
          console.log("📂 Custom categories:", customCategories.length);
          console.log("📦 allProducts sample:", allProducts.slice(0, 3));

          // Force UI update
          setTimeout(() => {
            updateMainDropdown();
            renderProducts();
            updateCategoryCounts();
            console.log("✅ UI updated after loading products");
          }, 100);
        });
      } else {
        console.error("❌ Failed to load products:", response?.error);

        // Handle authentication errors
        if (response?.needsAuth) {
          console.log("❌ Authentication required, signing out user");
          signOutUser();
        }
      }
    });
  };

  function switchMode(mode) {
    currentMode = mode;
    currentFilter = "all";

    // Update tab appearance
    document.querySelectorAll(".tab-button").forEach((tab) => {
      tab.classList.remove("active");
    });
    document.getElementById(mode + "Tab").classList.add("active");

    // Update filter dropdown and display
    updateMainDropdown();
    updateCategoryCounts();
    renderProducts();
  }

  // Tab switching event handlers
  document.getElementById("categoriesTab").addEventListener("click", () => {
    switchMode("categories");
  });

  document.getElementById("storesTab").addEventListener("click", () => {
    switchMode("stores");
  });

  // Search functionality
  document
    .getElementById("searchInput")
    .addEventListener("input", function (e) {
      searchTerm = e.target.value.trim();

      // Show/hide clear button
      const clearBtn = document.getElementById("searchClearBtn");
      if (searchTerm) {
        clearBtn.style.display = "flex";
      } else {
        clearBtn.style.display = "none";
      }

      // Re-render products with search filter
      renderProducts();
      updateCategoryCounts();
    });

  // Clear search button
  document
    .getElementById("searchClearBtn")
    .addEventListener("click", function () {
      document.getElementById("searchInput").value = "";
      searchTerm = "";
      this.style.display = "none";
      renderProducts();
      updateCategoryCounts();
      document.getElementById("searchInput").focus();
    });

  // Clear search from results info
  document
    .getElementById("clearSearchBtn")
    .addEventListener("click", function () {
      document.getElementById("searchInput").value = "";
      searchTerm = "";
      document.getElementById("searchClearBtn").style.display = "none";
      renderProducts();
      updateCategoryCounts();
    });

  // Sort functionality
  document
    .getElementById("sortSelect")
    .addEventListener("change", function (e) {
      currentSort = e.target.value;
      renderProducts();
    });

  // Handle main category filter display click
  document
    .getElementById("categoryFilterDisplay")
    .addEventListener("click", function (e) {
      e.stopPropagation();

      // Close any open inline dropdowns first
      document
        .querySelectorAll(".inline-category-dropdown")
        .forEach((dropdown) => {
          dropdown.classList.remove("show");
        });

      const dropdown = document.getElementById("mainCategoryDropdown");
      const isOpen = dropdown.classList.contains("show");

      dropdown.classList.toggle("show");

      // Update arrow rotation
      const arrow = this.querySelector(".dropdown-arrow");
      if (isOpen) {
        arrow.style.transform = "rotate(0deg)";
      } else {
        arrow.style.transform = "rotate(180deg)";
      }

      // Update selected state
      dropdown.querySelectorAll(".main-category-option").forEach((option) => {
        option.classList.remove("selected");
        if (option.getAttribute("data-value") === currentFilter) {
          option.classList.add("selected");
        }
      });
    });

  // Handle main category option clicks
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("main-category-option")) {
      e.stopPropagation();

      const selectedValue = e.target.getAttribute("data-value");
      currentFilter = selectedValue;

      // Update display
      document
        .getElementById("categoryFilterDisplay")
        .querySelector("span").textContent = e.target.textContent;

      // Re-render products with filter
      renderProducts();
      updateCategoryCounts();

      // Close dropdown
      document.getElementById("mainCategoryDropdown").classList.remove("show");
      document.querySelector(".dropdown-arrow").style.transform =
        "rotate(0deg)";
    }

    // Handle category option clicks in product dropdowns
    if (e.target.classList.contains("category-option")) {
      e.stopPropagation();

      const newCategory = e.target.getAttribute("data-value");
      const dropdown = e.target.closest(".inline-category-dropdown");
      const tag = dropdown.previousElementSibling;
      const productItem = e.target.closest(".product-item");
      const index = parseInt(productItem.getAttribute("data-index"));
      const product = allProducts[index];

      // Update the product category
      product.category = newCategory;

      // Update in storage
      chrome.storage.local.get({ cart: {} }, (data) => {
        // Remove from all folders first
        Object.keys(data.cart).forEach((folder) => {
          data.cart[folder] = data.cart[folder].filter(
            (item) => item.url !== product.url
          );
          if (data.cart[folder].length === 0) {
            delete data.cart[folder];
          }
        });

        // Add to the new category folder
        const folderName =
          customCategories.find((cat) => cat.value === newCategory)?.name ||
          "All Items";
        if (!data.cart[folderName]) {
          data.cart[folderName] = [];
        }
        data.cart[folderName].push(product);

        chrome.storage.local.set({ cart: data.cart }, () => {
          // Close the dropdown
          dropdown.classList.remove("show");

          // Reload cart to update display
          window.loadCart();
        });
      });
    }
  });

  // Handle main new category input
  document.addEventListener("click", function (e) {
    if (
      e.target.classList.contains("main-new-category-input") ||
      e.target.classList.contains("new-category-input")
    ) {
      e.stopPropagation();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Enter" &&
      (e.target.classList.contains("main-new-category-input") ||
        e.target.classList.contains("new-category-input"))
    ) {
      e.preventDefault();
      const newCategoryName = e.target.value.trim();

      if (newCategoryName) {
        const newCategoryValue = newCategoryName
          .toLowerCase()
          .replace(/\s+/g, "-");

        // Add to custom categories if not already exists
        if (!customCategories.find((cat) => cat.value === newCategoryValue)) {
          customCategories.push({
            value: newCategoryValue,
            name: newCategoryName,
          });
        }

        // If this is from a product dropdown, move that product
        if (e.target.classList.contains("new-category-input")) {
          const dropdown = e.target.closest(".inline-category-dropdown");
          const productItem = e.target.closest(".product-item");
          const index = parseInt(productItem.getAttribute("data-index"));
          const product = allProducts[index];

          // Update the product category
          product.category = newCategoryValue;

          // Update in storage
          chrome.storage.local.get({ cart: {} }, (data) => {
            // Remove from all folders first
            Object.keys(data.cart).forEach((folder) => {
              data.cart[folder] = data.cart[folder].filter(
                (item) => item.url !== product.url
              );
              if (data.cart[folder].length === 0) {
                delete data.cart[folder];
              }
            });

            // Add to the new category folder
            if (!data.cart[newCategoryName]) {
              data.cart[newCategoryName] = [];
            }
            data.cart[newCategoryName].push(product);

            chrome.storage.local.set({ cart: data.cart }, () => {
              // Close the dropdown
              dropdown.classList.remove("show");
              e.target.value = "";

              // Reload cart to update display
              window.loadCart();
            });
          });
        } else {
          // Just creating a new category from main dropdown
          updateAllDropdowns();
          updateMainDropdown();

          // Clear input and close dropdown
          e.target.value = "";
          document
            .getElementById("mainCategoryDropdown")
            .classList.remove("show");
          document.querySelector(".dropdown-arrow").style.transform =
            "rotate(0deg)";
        }
      }
    }

    if (
      e.key === "Escape" &&
      (e.target.classList.contains("main-new-category-input") ||
        e.target.classList.contains("new-category-input"))
    ) {
      e.target.value = "";
      if (e.target.classList.contains("main-new-category-input")) {
        document
          .getElementById("mainCategoryDropdown")
          .classList.remove("show");
        document.querySelector(".dropdown-arrow").style.transform =
          "rotate(0deg)";
      } else {
        e.target.closest(".inline-category-dropdown").classList.remove("show");
      }
    }
  });

  // Handle checkout button
  document.getElementById("checkoutBtn").addEventListener("click", function () {
    const filteredProducts = getFilteredProducts();

    if (filteredProducts.length === 0) {
      return;
    }

    // Open filtered and sorted products
    const sortedProducts = sortProducts([...filteredProducts], currentSort);
    sortedProducts.forEach((product) => {
      chrome.tabs.create({ url: product.url, active: false });
    });
  });

  // Handle close button
  document.getElementById("closeBtn").addEventListener("click", function () {
    window.close();
  });

  // Close dropdowns when clicking outside
  document.addEventListener("click", function (e) {
    // Don't close if clicking on input field
    if (
      e.target.classList.contains("new-category-input") ||
      e.target.classList.contains("main-new-category-input")
    ) {
      return;
    }

    // Close main dropdown
    const mainDropdown = document.getElementById("mainCategoryDropdown");
    if (mainDropdown.classList.contains("show")) {
      mainDropdown.classList.remove("show");
      document.querySelector(".dropdown-arrow").style.transform =
        "rotate(0deg)";
    }

    // Close inline dropdowns
    document
      .querySelectorAll(".inline-category-dropdown")
      .forEach((dropdown) => {
        dropdown.classList.remove("show");
      });
  });

  // Initialize - loadCart will be called after authentication
});

// Sync functions
function updateSyncUI(syncing, message = "") {
  const syncIndicator = document.getElementById("syncIndicator");
  const syncButton = document.getElementById("syncButton");
  const syncButtonText = document.getElementById("syncButtonText");

  if (syncing) {
    syncIndicator.style.display = "flex";
    syncButton.disabled = true;
    syncButtonText.textContent = "Syncing...";
    isSyncing = true;
  } else {
    syncIndicator.style.display = "none";
    syncButton.disabled = false;
    syncButtonText.textContent = message || "🔄 Sync Now";
    isSyncing = false;
  }
}

function manualSync() {
  if (isSyncing) return;

  // Check if user is authenticated first
  if (!currentUser) {
    console.log("User not authenticated, cannot sync");
    updateSyncUI(false, "❌ Please sign in");
    return;
  }

  updateSyncUI(true);

  // Simple sync - just get all products from server
  chrome.runtime.sendMessage({ action: "getAllProducts" }, (response) => {
    if (response && response.success) {
      updateSyncUI(false, `✅ Synced (${response.productCount} products)`);

      // Reload the cart display without page reload
      if (!isLoadingCart) {
        if (typeof window.loadCart === "function") {
          window.loadCart();
        } else {
          console.log("⚠️ loadCart function not available, reloading page");
          window.location.reload();
        }
      }

      // Reset button text after 3 seconds
      setTimeout(() => {
        updateSyncUI(false);
      }, 3000);
    } else {
      console.error("❌ Sync failed:", response?.error);

      // Handle authentication errors
      if (response?.needsAuth) {
        updateSyncUI(false, "❌ Please sign in");
        signOutUser();
      } else {
        updateSyncUI(false, "❌ Sync Failed");
      }
      console.error("Sync failed:", response.error);

      // Reset button text after 3 seconds
      setTimeout(() => {
        updateSyncUI(false);
      }, 3000);
    }
  });
}

// Add event listener when DOM loads
document.addEventListener("DOMContentLoaded", function () {
  const syncButton = document.getElementById("syncButton");
  if (syncButton) {
    syncButton.addEventListener("click", function () {
      manualSync();
    });
  }

  // Initial sync status
  updateSyncUI(false);

  // Load cart data when popup opens (no auto-sync)
  // The initial loadCart() call in the main initialization will handle this

  // Listen for storage changes to update the display
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.cart && !isLoadingCart) {
      console.log("📦 Cart storage changed, updating display...");
      // Just reload the cart data, don't reload the entire page
      if (typeof window.loadCart === "function") {
        window.loadCart();
      } else {
        console.log("⚠️ loadCart function not available, reloading page");
        window.location.reload();
      }
    }
  });
});
