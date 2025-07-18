// PWA Communication Setup - ADD THIS TO THE TOP
(function setupPWACommunication() {
  // Only set up PWA communication if we're on a PWA page
  if (
    window.location.hostname.includes("netlify.app") ||
    window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
  ) {
    console.log("🔌 Setting up PWA-Extension communication");

    // Listen for extension messages
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("📨 PWA received message:", message);

        if (message.type === "CART_UPDATED") {
          // Notify PWA app of cart changes
          if (window.trolleyApp && window.trolleyApp.handleExtensionUpdate) {
            console.log("🔄 Updating PWA with extension data");
            window.trolleyApp.handleExtensionUpdate(message.cart);
          } else {
            console.log("⏳ PWA not ready, storing update for later");
            // Store for when PWA loads
            window.pendingExtensionUpdate = message.cart;
          }
        }
      });

      // Expose extension API to PWA
      window.extensionAPI = {
        getCart: () => {
          console.log("🔍 PWA requesting cart data from extension");
          return new Promise((resolve) => {
            try {
              chrome.runtime.sendMessage({ type: "GET_CART" }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Extension communication error:",
                    chrome.runtime.lastError
                  );
                  resolve({});
                } else {
                  console.log("📦 Extension returned cart:", response);
                  resolve(response || {});
                }
              });
            } catch (error) {
              console.error("Extension API error:", error);
              resolve({});
            }
          });
        },

        isAvailable: () => {
          const available =
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.id;
          console.log("🔌 Extension available:", available);
          return available;
        },
      };

      console.log("✅ PWA communication setup complete");
    } else {
      console.log("❌ Chrome extension APIs not available");
    }

    // Don't run the product page detection on PWA pages
    return;
  }
})();

// Original Extension Code for Product Pages
(function () {
  console.log(
    "🛒 Trolley extension content script loaded on:",
    window.location.href
  );

  function isLikelyProductPage() {
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.content || "";
    const ogImage =
      document.querySelector('meta[property="og:image"]')?.content || "";
    const schemaProduct = document.querySelector('[itemtype*="Product"]');

    const urlPath = window.location.pathname.toLowerCase();
    const urlIndicators = ["/product/", "/products/", "/shop/", "/item/"];
    const isEcommerceURL = urlIndicators.some((keyword) =>
      urlPath.includes(keyword)
    );

    const buttons = Array.from(
      document.querySelectorAll("button, input[type=submit], a, span")
    );
    const buttonText = buttons
      .map((el) => el.innerText || el.value || "")
      .join(" ")
      .toLowerCase();

    const hasBuyButton = [
      "add to cart",
      "buy now",
      "add to bag",
      "purchase",
    ].some((txt) => buttonText.includes(txt));
    const hasSizeRef = [
      "select size",
      "choose size",
      "your size",
      "waist",
      "inseam",
    ].some((txt) => buttonText.includes(txt));

    let score = 0;
    if (ogTitle && ogImage) score++;
    if (schemaProduct) score++;
    if (isEcommerceURL) score++;
    if (hasBuyButton) score++;
    if (hasSizeRef) score++;

    return score >= 2;
  }

  function extractFirstPrice(text) {
    const match = text.match(/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
    return match ? match[0] : null;
  }

  function extractPricesFromText(text) {
    const matches = text.match(/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
    if (!matches) return { salePrice: "N/A", originalPrice: "" };

    if (matches.length === 1) {
      return { salePrice: matches[0], originalPrice: "" };
    }

    // For multiple prices, try to determine which is which
    const prices = matches.map((p) => parseFloat(p.replace(/[$,]/g, "")));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // If there's a significant difference, assume lower is sale price
    if (maxPrice > minPrice * 1.1) {
      const saleIndex = prices.indexOf(minPrice);
      const originalIndex = prices.indexOf(maxPrice);
      return {
        salePrice: matches[saleIndex],
        originalPrice: matches[originalIndex],
      };
    }

    // Otherwise, use original logic (first = original, last = sale)
    return {
      originalPrice: matches[0],
      salePrice: matches[matches.length - 1],
    };
  }

  function getPrices() {
    // Try specific sale/original price selectors first
    const salePriceSelectors = [
      ".price--sale",
      ".sale-price",
      ".price-sale",
      ".current-price",
      ".price__sale",
      ".price-current",
      '[class*="sale"][class*="price"]',
      '[class*="current"][class*="price"]',
    ];

    const originalPriceSelectors = [
      ".price--original",
      ".original-price",
      ".price-original",
      ".was-price",
      ".price__regular",
      ".price-was",
      '[class*="original"][class*="price"]',
      '[class*="was"][class*="price"]',
      '[class*="regular"][class*="price"]',
    ];

    let salePrice = null;
    let originalPrice = null;

    // Look for specific sale price
    for (const selector of salePriceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) {
        const price = extractFirstPrice(el.innerText);
        if (price) {
          salePrice = price;
          break;
        }
      }
    }

    // Look for specific original price
    for (const selector of originalPriceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) {
        const price = extractFirstPrice(el.innerText);
        if (price) {
          originalPrice = price;
          break;
        }
      }
    }

    // JCrew specific logic
    if (window.location.hostname.includes("jcrew.com")) {
      const priceContainer = document.querySelector(".prices");
      if (priceContainer) {
        const prices = priceContainer.querySelectorAll(".price");
        if (prices.length >= 2) {
          // On JCrew, first price is sale, second is original (crossed out)
          salePrice = extractFirstPrice(prices[0].innerText);
          originalPrice = extractFirstPrice(prices[1].innerText);
        } else if (prices.length === 1) {
          salePrice = extractFirstPrice(prices[0].innerText);
        }
      }
    }

    // If we found specific prices, use them
    if (salePrice || originalPrice) {
      return {
        salePrice: salePrice || "N/A",
        originalPrice: originalPrice || "",
      };
    }

    // Fallback to generic price detection
    const genericPriceSelectors = [
      "[class*=price]",
      ".price",
      ".product-price",
      ".product__price",
    ];

    for (const selector of genericPriceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) {
        return extractPricesFromText(el.innerText);
      }
    }

    // Look for prices in the entire page as last resort
    const allText = document.body.innerText;
    const priceMatches = allText.match(/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
    if (priceMatches && priceMatches.length > 0) {
      if (priceMatches.length === 1) {
        return { salePrice: priceMatches[0], originalPrice: "" };
      } else {
        // Try to determine which is sale vs original based on context
        const firstPrice = parseFloat(priceMatches[0].replace(/[$,]/g, ""));
        const secondPrice = parseFloat(priceMatches[1].replace(/[$,]/g, ""));

        // Assume the lower price is the sale price
        if (firstPrice < secondPrice) {
          return { salePrice: priceMatches[0], originalPrice: priceMatches[1] };
        } else {
          return { salePrice: priceMatches[1], originalPrice: priceMatches[0] };
        }
      }
    }

    return { salePrice: "N/A", originalPrice: "" };
  }

  function getSelectedVariants() {
    console.log("🛒 Starting variant detection...");
    console.log("Current URL:", window.location.href);

    const variants = {};

    // First, try to extract from URL parameters (works great for Bonobos and similar sites)
    const urlParams = new URLSearchParams(window.location.search);
    console.log("URL Parameters:", Object.fromEntries(urlParams));

    // Common URL parameter names for variants
    const sizeParams = [
      "size",
      "pant-waist",
      "waist",
      "pant-length",
      "length",
      "shirt-size",
      "option-0",
      "option-1",
      "sz",
    ];
    const colorParams = [
      "color",
      "colour",
      "pant-color",
      "option-2",
      "option-3",
    ];
    const styleParams = ["style", "fit", "pant-fit", "shirt-fit", "variant"];

    // Extract from URL parameters
    sizeParams.forEach((param) => {
      const value = urlParams.get(param);
      if (value && !variants.size) {
        console.log(`Found size param "${param}":`, value);
        variants.size = decodeURIComponent(value).replace(/[+%]/g, " ").trim();
      }
    });

    colorParams.forEach((param) => {
      const value = urlParams.get(param);
      if (value && !variants.color) {
        console.log(`Found color param "${param}":`, value);
        variants.color = decodeURIComponent(value).replace(/[+%]/g, " ").trim();
      }
    });

    styleParams.forEach((param) => {
      const value = urlParams.get(param);
      if (value && !variants.style && param !== "variant") {
        // Skip 'variant' parameter as it's usually just an ID, not a readable style
        console.log(`Found style param "${param}":`, value);
        variants.style = decodeURIComponent(value).replace(/[+%]/g, " ").trim();
      }
    });

    // For Bonobos specifically, combine waist and length for size
    const waist = urlParams.get("pant-waist");
    const length = urlParams.get("pant-length");
    if (waist && length) {
      console.log(`Found Bonobos sizing - waist: ${waist}, length: ${length}`);
      variants.size = `${waist}x${length}`;
    }

    // Site-specific URL parameter handling
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes("toddsnyder.com")) {
      // Todd Snyder uses option-0, option-1, etc.
      const sizeOption = urlParams.get("option-0");
      if (sizeOption) {
        console.log(`Found Todd Snyder size option:`, sizeOption);
        variants.size = sizeOption;
      }
    }

    if (hostname.includes("lululemon.com")) {
      // Lululemon has color and sz in URL
      const lululemonColor = urlParams.get("color");
      const lululemonSize = urlParams.get("sz");

      if (lululemonSize) {
        console.log(`Found Lululemon size:`, lululemonSize);
        variants.size = lululemonSize;
      }

      if (lululemonColor) {
        console.log(`Found Lululemon color ID:`, lululemonColor);

        // Try multiple strategies to find the actual color name
        let colorName = null;

        // Strategy 1: Look for selected color elements
        const colorSelectors = [
          ".pdp-color-options .selected",
          ".color-chip.selected",
          ".swatch.selected",
          '[data-color="' + lululemonColor + '"]',
          '[data-colorid="' + lululemonColor + '"]',
          ".color-selector .selected",
        ];

        for (const selector of colorSelectors) {
          const colorElement = document.querySelector(selector);
          if (colorElement) {
            colorName =
              colorElement.getAttribute("data-color-name") ||
              colorElement.getAttribute("aria-label") ||
              colorElement.getAttribute("title") ||
              colorElement.querySelector(".color-name")?.textContent?.trim() ||
              colorElement.textContent?.trim();

            if (
              colorName &&
              !colorName.includes("View More") &&
              colorName.length < 30 &&
              !colorName.match(/^\d+$/)
            ) {
              console.log(`Found Lululemon color name from DOM:`, colorName);
              break;
            }
            colorName = null;
          }
        }

        // Strategy 2: Check page title for color info
        if (!colorName) {
          const title = document.title;
          const titleColorMatch = title.match(
            /\b(Black|White|Navy|Blue|Red|Green|Gray|Grey|Brown|Pink|Purple|Orange|Yellow|Beige|Tan|Olive|Maroon|Burgundy|Teal|Coral|Mint|Sage|Cream|Ivory|Charcoal|Silver|Gold)\b/i
          );
          if (titleColorMatch) {
            colorName = titleColorMatch[1];
            console.log(`Found Lululemon color from title:`, colorName);
          }
        }

        // Strategy 3: Use a basic Lululemon color ID mapping for common colors
        if (!colorName) {
          const lululemonColorMap = {
            "0001": "Black",
            "0002": "White",
            26083: "Navy",
            31882: "Dark Red",
            45739: "Heathered Black",
            35955: "Dark Olive",
            26950: "True Navy",
            4780: "Black",
            "0002": "White",
          };

          colorName = lululemonColorMap[lululemonColor];
          if (colorName) {
            console.log(`Found Lululemon color from mapping:`, colorName);
          }
        }

        // If we found a readable color name, use it; otherwise use the ID
        variants.color = colorName || lululemonColor;
        console.log(`Final Lululemon color:`, variants.color);
      }
    }

    if (hostname.includes("rhone.com") || hostname.includes("byltbasics.com")) {
      // These sites use variant IDs in the URL
      const variantId = urlParams.get("variant");
      if (variantId) {
        console.log(`Found variant ID:`, variantId);

        // Try to get size from DOM selectors first
        const sizeSelectors = [
          ".size-selector .selected",
          ".size-option.selected",
          '[data-testid="size"] .selected',
          'input[name*="size"]:checked + label',
          ".variant-selector .selected",
          ".size-chart .selected",
          '.product-form select[name*="size"] option:checked',
          "[data-size].selected",
        ];

        let foundSize = false;
        for (const selector of sizeSelectors) {
          const sizeEl = document.querySelector(selector);
          if (sizeEl) {
            const sizeValue = sizeEl.textContent?.trim() || sizeEl.value;
            if (
              sizeValue &&
              !sizeValue.includes("Select") &&
              sizeValue.length < 10
            ) {
              variants.size = sizeValue;
              console.log(`Found size from DOM:`, variants.size);
              foundSize = true;
              break;
            }
          }
        }

        // Try to get color from DOM with better selectors
        const colorSelectors = [
          ".color-selector .selected",
          ".color-option.selected",
          '[data-testid="color"] .selected',
          'input[name*="color"]:checked + label',
          ".swatch.selected",
          '.product-form select[name*="color"] option:checked',
          "[data-color].selected",
        ];

        for (const selector of colorSelectors) {
          const colorEl = document.querySelector(selector);
          if (colorEl) {
            const colorValue =
              colorEl.getAttribute("data-color-name") ||
              colorEl.getAttribute("title") ||
              colorEl.getAttribute("aria-label") ||
              colorEl.textContent?.trim() ||
              colorEl.value;

            if (
              colorValue &&
              !colorValue.includes("Select") &&
              colorValue.length < 20 &&
              !colorValue.match(/^\d+$/)
            ) {
              variants.color = colorValue;
              console.log(`Found color from DOM:`, variants.color);
              break;
            }
          }
        }

        // If no size found from DOM, try URL/title extraction (but be specific)
        if (!foundSize) {
          const urlPath = window.location.pathname;
          const sizeMatch =
            urlPath.match(/-(xs|small|s|medium|m|large|l|xl|xxl)-?/i) ||
            urlPath.match(/-(\d{1,2}\/\d{1,2})-/) ||
            document.title.match(
              /\b(XS|Small|S|Medium|M|Large|L|XL|XXL|28|29|30|31|32|33|34|35|36|38|40)\b(?!\.\d)/i
            );

          if (sizeMatch && sizeMatch[1] && sizeMatch[1] !== "2") {
            variants.size = sizeMatch[1].toUpperCase();
            console.log(`Extracted size from URL/title:`, variants.size);
          }
        }

        // Try to extract style/fit info from title (but not the variant ID)
        const title = document.title;
        const styleMatch = title.match(
          /\b(Slim|Regular|Athletic|Relaxed|Skinny|Straight|Bootcut|Tapered)\b/i
        );
        if (styleMatch) {
          variants.style = styleMatch[1];
          console.log(`Found style from title:`, variants.style);
        }

        console.log(
          `Processed variant ID but extracted readable info:`,
          variantId
        );
      }
    }

    // If we got variants from URL, format and return early
    if (Object.keys(variants).length > 0) {
      console.log("✅ Found variants from URL:", variants);
      // Clean up the values
      Object.keys(variants).forEach((key) => {
        variants[key] = variants[key]
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      });
      console.log("✅ Cleaned variants:", variants);
      return variants;
    }

    console.log("❌ No URL params found, trying DOM selectors...");

    // DOM-based detection (keeping the existing code)
    const sizeSelectors = [
      'select[name*="size"]:not([disabled])',
      'select[id*="size"]:not([disabled])',
      ".size-selector .selected",
      ".size-option.selected",
      '[data-attribute="size"] .selected',
      ".product-form__option--size .selected",
      ".size-variant.selected",
      'input[name*="size"]:checked + label',
      'input[id*="size"]:checked + label',
      ".size-picker .selected",
      '[data-testid*="size"] .selected',
    ];

    const colorSelectors = [
      'select[name*="color"]:not([disabled])',
      'select[id*="color"]:not([disabled])',
      ".color-selector .selected",
      ".color-option.selected",
      '[data-attribute="color"] .selected',
      ".product-form__option--color .selected",
      ".color-variant.selected",
      'input[name*="color"]:checked + label',
      'input[id*="color"]:checked + label',
      ".color-picker .selected",
      '[data-testid*="color"] .selected',
    ];

    const styleSelectors = [
      'select[name*="style"]:not([disabled])',
      'select[name*="fit"]:not([disabled])',
      ".style-selector .selected",
      ".fit-selector .selected",
      ".style-option.selected",
    ];

    // Extract size from DOM
    for (const selector of sizeSelectors) {
      const sizeEl = document.querySelector(selector);
      if (sizeEl) {
        let sizeValue =
          sizeEl.textContent?.trim() ||
          sizeEl.value ||
          sizeEl.getAttribute("data-value");
        console.log(`Trying size selector "${selector}":`, sizeValue);
        if (
          sizeValue &&
          sizeValue !== "Select Size" &&
          sizeValue !== "" &&
          sizeValue !== "Size"
        ) {
          variants.size = sizeValue;
          console.log("✅ Found size from DOM:", sizeValue);
          break;
        }
      }
    }

    // Extract color from DOM
    for (const selector of colorSelectors) {
      const colorEl = document.querySelector(selector);
      if (colorEl) {
        let colorValue =
          colorEl.textContent?.trim() ||
          colorEl.value ||
          colorEl.getAttribute("data-color") ||
          colorEl.getAttribute("data-value") ||
          colorEl.getAttribute("title") ||
          colorEl.getAttribute("alt");
        console.log(`Trying color selector "${selector}":`, colorValue);
        if (
          colorValue &&
          colorValue !== "Select Color" &&
          colorValue !== "" &&
          colorValue !== "Color"
        ) {
          variants.color = colorValue;
          console.log("✅ Found color from DOM:", colorValue);
          break;
        }
      }
    }

    console.log("🔍 Final variants detected:", variants);
    return variants;
  }

  function getProductInfo() {
    console.log("📦 getProductInfo() called");

    function getTitle() {
      return (
        document.querySelector('meta[property="og:title"]')?.content ||
        document.querySelector('meta[name="title"]')?.content ||
        document.title
      );
    }

    function getDescription() {
      return (
        document.querySelector('meta[property="og:description"]')?.content ||
        document.querySelector('meta[name="description"]')?.content ||
        ""
      );
    }

    function getImage() {
      const ogImage = document.querySelector(
        'meta[property="og:image"]'
      )?.content;
      if (
        ogImage &&
        !ogImage.includes("favicon") &&
        !ogImage.includes("placeholder")
      )
        return ogImage;

      // Site-specific image selectors
      const hostname = window.location.hostname.toLowerCase();

      // Fabletics-specific selectors
      if (hostname.includes("fabletics.com")) {
        const fableticsSelectors = [
          '.product-images-carousel img[src*="product"]',
          ".product-image-carousel img",
          ".main-product-image img",
          '.product-gallery img[src*="fabletics"]',
          '.swiper-slide img[src*="product"]',
          '[data-testid="product-image"] img',
          ".product-media img",
        ];

        for (const selector of fableticsSelectors) {
          const img = document.querySelector(selector);
          if (
            img &&
            img.src &&
            !img.src.includes("favicon") &&
            !img.src.includes("placeholder")
          ) {
            console.log(
              "Found Fabletics image with selector:",
              selector,
              "→",
              img.src
            );
            return img.src;
          }
        }
      }

      // Vivaia-specific
      const vivaiaImg = document
        .querySelector(".swiper-slide img[data-original]")
        ?.getAttribute("data-original");
      if (vivaiaImg) return vivaiaImg;

      const galleryImg = document.querySelector(
        ".goods-pic-thumb-list img"
      )?.src;
      if (galleryImg) return galleryImg;

      // Brooklinen-specific fallback
      const brooklinenImg = document.querySelector(
        "div[data-product-id] img"
      )?.src;
      if (brooklinenImg) return brooklinenImg;

      // Shopify-specific selectors (many stores use Shopify)
      const shopifySelectors = [
        ".product__media img",
        ".product-single__photo img",
        ".product-photo-container img",
        ".product__photo img",
        ".featured-product__photo img",
      ];

      for (const selector of shopifySelectors) {
        const img = document.querySelector(selector);
        if (img && img.src && !img.src.includes("favicon")) return img.src;
      }

      // Generic fallback selectors (ordered by specificity)
      const candidates = [
        // Product gallery selectors
        '.product-gallery img[src*="product"]',
        '.product-images img[src*="product"]',
        ".product-image-main img",
        ".main-product-image img",
        ".primary-product-image img",

        // Carousel and slider selectors
        '.carousel img[src*="product"]',
        '.slider img[src*="product"]',
        '.swiper-slide img[src*="product"]',

        // CDN-specific selectors
        'picture img[src*="cdn"]',
        'img[src*="shopify-cdn"]',
        'img[src*="amazonaws"]',
        'img[src*="cloudfront"]',

        // Class-based selectors
        "img.product-gallery__image",
        "img.product-image",
        "img.hero-image",
        '[class*="product-image"] img',
        '[class*="hero"] img',

        // Data attribute selectors
        'img[data-src*="product"]',
        'img[data-original*="product"]',

        // Generic CDN and media selectors
        'img[src*="product"]',
        'img[src*="media"]',
        'img[src*="images"]',
      ];

      for (const sel of candidates) {
        const img = document.querySelector(sel);
        if (img) {
          let imgSrc =
            img.src ||
            img.getAttribute("data-src") ||
            img.getAttribute("data-original");
          if (
            imgSrc &&
            !imgSrc.includes("favicon") &&
            !imgSrc.includes("placeholder") &&
            imgSrc.includes("http")
          ) {
            console.log("Found image with selector:", sel, "→", imgSrc);
            return imgSrc;
          }
        }
      }

      // Last resort: find any reasonably sized image
      const allImages = document.querySelectorAll("img");
      for (const img of allImages) {
        if (
          img.width >= 200 &&
          img.height >= 200 &&
          img.src &&
          !img.src.includes("favicon") &&
          !img.src.includes("logo") &&
          !img.src.includes("placeholder") &&
          img.src.includes("http")
        ) {
          console.log("Found large image as fallback:", img.src);
          return img.src;
        }
      }

      console.log("No suitable product image found");
      return "";
    }

    const { salePrice, originalPrice } = getPrices();
    console.log(
      "💰 Prices found - Sale:",
      salePrice,
      "Original:",
      originalPrice
    );

    const variants = getSelectedVariants();
    console.log("🎯 Variants returned:", JSON.stringify(variants));

    const productInfo = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: getTitle(),
      image: getImage(),
      description: getDescription(),
      price: salePrice,
      originalPrice: originalPrice,
      url: window.location.href,
      site: window.location.hostname,
      displaySite: window.location.hostname,
      dateAdded: new Date().toISOString(),
      variants: variants,
    };

    console.log("📦 Final product info:", JSON.stringify(productInfo, null, 2));
    return productInfo;
  }

  function showCategorySelector(product) {
    // Remove any existing category selector
    const existing = document.getElementById("trolley-category-selector");
    if (existing) {
      existing.remove();
    }

    const trolleyButton = document.getElementById("universal-cart-btn");
    if (!trolleyButton) return;

    const rect = trolleyButton.getBoundingClientRect();

    const selector = document.createElement("div");
    selector.id = "trolley-category-selector";
    selector.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            right: ${window.innerWidth - rect.right}px;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 200px;
            animation: slideDown 0.2s ease-out;
        `;

    selector.innerHTML = `
            <div style="position: relative;">
                <input type="text" id="category-input" placeholder="Enter category..." 
                       style="width: 100%; padding: 12px 35px 12px 12px; border: none; border-radius: 8px; font-size: 14px; outline: none;" />
                <div id="dropdown-arrow" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #6c757d; font-size: 12px;">▼</div>
                <div id="category-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-height: 150px; overflow-y: auto; z-index: 1000000;"></div>
            </div>
        `;

    // Add CSS animation
    const style = document.createElement("style");
    style.textContent = `
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
    document.head.appendChild(style);

    document.body.appendChild(selector);

    const input = selector.querySelector("#category-input");
    const dropdown = selector.querySelector("#category-dropdown");
    const arrow = selector.querySelector("#dropdown-arrow");

    // Load existing categories
    chrome.storage.local.get({ cart: {} }, ({ cart }) => {
      const categories = Object.keys(cart).filter(
        (folder) => folder !== "All Items"
      );

      // Populate dropdown
      dropdown.innerHTML = "";

      // Add "All Items" option
      const allItemsOption = document.createElement("div");
      allItemsOption.style.cssText =
        "padding: 10px 12px; cursor: pointer; font-size: 14px; border-bottom: 1px solid #f0f0f0;";
      allItemsOption.textContent = "All Items";
      allItemsOption.onmouseenter = () =>
        (allItemsOption.style.backgroundColor = "#f8f9fa");
      allItemsOption.onmouseleave = () =>
        (allItemsOption.style.backgroundColor = "white");
      allItemsOption.onclick = () => {
        input.value = "All Items";
        dropdown.style.display = "none";
        arrow.textContent = "▼";
        // Automatically add to trolley when clicking existing category
        addToTrolley(product, "All Items");
      };
      dropdown.appendChild(allItemsOption);

      // Add existing categories
      categories.forEach((category) => {
        const option = document.createElement("div");
        option.style.cssText =
          "padding: 10px 12px; cursor: pointer; font-size: 14px; border-bottom: 1px solid #f0f0f0;";
        option.textContent = category;
        option.onmouseenter = () => (option.style.backgroundColor = "#f8f9fa");
        option.onmouseleave = () => (option.style.backgroundColor = "white");
        option.onclick = () => {
          input.value = category;
          dropdown.style.display = "none";
          arrow.textContent = "▼";
          // Automatically add to trolley when clicking existing category
          addToTrolley(product, category);
        };
        dropdown.appendChild(option);
      });

      // Remove last border
      const lastOption = dropdown.lastElementChild;
      if (lastOption) {
        lastOption.style.borderBottom = "none";
      }
    });

    // Handle dropdown toggle
    arrow.onclick = (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === "block";
      dropdown.style.display = isVisible ? "none" : "block";
      arrow.textContent = isVisible ? "▼" : "▲";
    };

    // Handle input focus to show dropdown
    input.onfocus = () => {
      dropdown.style.display = "block";
      arrow.textContent = "▲";
    };

    // Handle Enter key to add to trolley
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const category = input.value.trim() || "All Items";
        addToTrolley(product, category);
      }
      if (e.key === "Escape") {
        selector.remove();
        style.remove();
      }
    };

    // Auto-focus the input
    setTimeout(() => input.focus(), 100);

    // Add click outside to close functionality
    function handleClickOutside(e) {
      if (!selector.contains(e.target) && !trolleyButton.contains(e.target)) {
        selector.remove();
        style.remove();
        document.removeEventListener("click", handleClickOutside);
      }
    }

    // Add slight delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);
  }

  function addToTrolley(product, categoryName) {
    console.log("➕ Adding product to trolley:", product.title);

    // Add to server and get updated list
          const productId = product.id || product.url; // Use URL as fallback ID
          chrome.runtime.sendMessage(
            {
              action: "addProduct",
              product: {
                ...product,
                id: productId,
          category: categoryName === "All Items" ? "general" : categoryName,
              },
            },
            (response) => {
              if (response && response.success) {
                console.log("✅ Product added to server:", productId);
          showNotification(`Added to ${categoryName}!`);
              } else {
          console.error("❌ Failed to add product to server:", response?.error);
          showNotification("Failed to add product!");
        }
      }
    );

      // Close the selector
      const selector = document.getElementById("trolley-category-selector");
      if (selector) {
        selector.remove();
      }
      // Remove animation style
      const style = document.querySelector('style[data-trolley="animation"]');
      if (style) {
        style.remove();
      }
  }

  function injectCartButton() {
    if (document.getElementById("universal-cart-btn")) return;

    const button = document.createElement("button");
    button.id = "universal-cart-btn";
    button.style.cssText = `
        position: fixed;
        top: 50%;
        right: 10px;
        z-index: 99999;
        padding: 12px;
        border: 2px solid #000;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        transition: transform 0.2s ease;
        font-size: 20px;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Try to use image, fallback to text
    try {
      const img = document.createElement("img");
      img.src = chrome.runtime.getURL("Images/Trolley.png");
      img.alt = "Add to Trolley";
      img.style.cssText = `
            width: 30px;
            height: 30px;
            transition: transform 0.2s ease;
        `;
      button.appendChild(img);
    } catch (error) {
      console.log("🛒 Using text fallback for trolley button");
      button.textContent = "🛒";
    }

    document.body.appendChild(button);

    // Add hover effect
    button.addEventListener("mouseenter", () => {
      img.style.transform = "scale(1.1)";
    });
    button.addEventListener("mouseleave", () => {
      img.style.transform = "scale(1)";
    });

    button.onclick = () => {
      console.log("🛒 Trolley button clicked!");
      const product = getProductInfo();
      showCategorySelector(product);
    };
  }

  function showNotification(message) {
    const icon = document.getElementById("universal-cart-btn");
    if (!icon) return;

    const rect = icon.getBoundingClientRect();

    const notice = document.createElement("div");
    notice.innerText = message;
    notice.style.cssText = `
            position: fixed;
            top: ${rect.top}px;
            right: 80px;
            background: #000;
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: trolleySlideIn 0.3s ease-out;
        `;

    // Add animation
    const style = document.createElement("style");
    style.textContent = `
            @keyframes trolleySlideIn {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
    document.head.appendChild(style);

    document.body.appendChild(notice);

    setTimeout(() => {
      if (document.body.contains(notice)) {
        notice.remove();
      }
      if (document.head.contains(style)) {
        style.remove();
      }
    }, 2500);
  }

  // Initialize after page load
  setTimeout(() => {
    console.log("🚀 Content script initializing...");
    console.log("Current URL:", window.location.href);

    // Debug: Check if it's a product page
    const isProduct = isLikelyProductPage();
    console.log(" Is product page?", isProduct);

    if (isProduct) {
      console.log("✅ Detected as product page, injecting trolley button");
      injectCartButton();
    } else {
      console.log("❌ Not detected as product page");
      console.log("🔍 Debug info:");
      console.log(
        "- og:title:",
        document.querySelector('meta[property="og:title"]')?.content
      );
      console.log(
        "- og:image:",
        document.querySelector('meta[property="og:image"]')?.content
      );
      console.log(
        "- schema product:",
        !!document.querySelector('[itemtype*="Product"]')
      );
      console.log("- URL path:", window.location.pathname.toLowerCase());

      // Force inject for testing
      console.log("🧪 Force injecting button for testing...");
      injectCartButton();
    }
  }, 1000);
})();
