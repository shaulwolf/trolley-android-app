// PWA Communication Setup - ADD THIS TO THE TOP
(function setupPWACommunication() {
  // Only set up PWA communication if we're on a PWA page
  if (
    window.location.hostname.includes("netlify.app") ||
    window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
  ) {
    console.log("🔌 Setting up PWA-Extension communication1");

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
    if (!text || typeof text !== "string") return null;

    // Enhanced regex patterns for different currencies and formats
    const patterns = [
      // US Dollar
      /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
      // USD with text
      /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
      // Dollar with text after
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD/i,
      // Euro
      /€(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
      // British Pound
      /£(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
      // Canadian Dollar
      /CAD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
      // Australian Dollar
      /AUD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
      // Generic number that might be a price (as last resort)
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const numericValue = parseFloat(match[1].replace(/,/g, ""));

        // Validate that this looks like a reasonable price
        if (numericValue >= 0.01 && numericValue <= 50000) {
          // Return with appropriate currency symbol
          if (text.includes("$") || text.toLowerCase().includes("usd")) {
            return `$${numericValue.toFixed(2)}`;
          } else if (text.includes("€")) {
            return `€${numericValue.toFixed(2)}`;
          } else if (text.includes("£")) {
            return `£${numericValue.toFixed(2)}`;
          } else if (text.toLowerCase().includes("cad")) {
            return `CAD $${numericValue.toFixed(2)}`;
          } else if (text.toLowerCase().includes("aud")) {
            return `AUD $${numericValue.toFixed(2)}`;
          } else {
            // Default to USD for generic numbers
            return `$${numericValue.toFixed(2)}`;
          }
        }
      }
    }

    return null;
  }

  function extractPricesFromText(text) {
    console.log(
      "📝 Analyzing text for price patterns:",
      text.substring(0, 200)
    );

    // Enhanced price regex with more currency support
    const priceRegex =
      /(?:\$|USD\s*|€|£|CAD\s*|AUD\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi;
    const matches = [...text.matchAll(priceRegex)];

    if (!matches || matches.length === 0) {
      console.log("❌ No price matches found in text");
      return { salePrice: "N/A", originalPrice: "" };
    }

    // Extract and validate prices
    const validPrices = matches
      .map((match) => {
        const fullMatch = match[0];
        const numericValue = parseFloat(match[1].replace(/,/g, ""));
        return { text: fullMatch, value: numericValue };
      })
      .filter((price) => price.value >= 0.5 && price.value <= 10000) // Reasonable price range
      .sort((a, b) => a.value - b.value); // Sort by value

    console.log(
      `💰 Found ${validPrices.length} valid prices:`,
      validPrices.map((p) => p.text)
    );

    if (validPrices.length === 0) {
      return { salePrice: "N/A", originalPrice: "" };
    }

    if (validPrices.length === 1) {
      return { salePrice: validPrices[0].text, originalPrice: "" };
    }

    // Smart price selection for multiple prices
    if (validPrices.length === 2) {
      const lowerPrice = validPrices[0];
      const higherPrice = validPrices[1];

      // If there's a significant difference (>10%), treat as sale/original
      if (higherPrice.value > lowerPrice.value * 1.1) {
        console.log(
          `💡 Detected sale scenario: ${lowerPrice.text} (sale) vs ${higherPrice.text} (original)`
        );
        return {
          salePrice: lowerPrice.text,
          originalPrice: higherPrice.text,
        };
      } else {
        // Similar prices, probably just one current price
        console.log(
          `💡 Similar prices detected, using first as current: ${lowerPrice.text}`
        );
        return {
          salePrice: lowerPrice.text,
          originalPrice: "",
        };
      }
    }

    // Multiple prices (3+) - use context analysis
    if (validPrices.length >= 3) {
      console.log("🔍 Multiple prices detected, analyzing context...");

      // Look for context clues in surrounding text
      const textLower = text.toLowerCase();
      const hasWasContext =
        textLower.includes("was") || textLower.includes("originally");
      const hasSaleContext =
        textLower.includes("sale") ||
        textLower.includes("now") ||
        textLower.includes("special");

      if (hasWasContext || hasSaleContext) {
        // Find the most reasonable current price (not too low, not too high)
        const midRangePrices = validPrices.filter(
          (p) => p.value >= 5 && p.value <= 1000
        );
        const currentPrice =
          midRangePrices.length > 0 ? midRangePrices[0] : validPrices[0];

        // Find a higher price that could be original
        const higherPrices = validPrices.filter(
          (p) => p.value > currentPrice.value * 1.1
        );
        const originalPrice = higherPrices.length > 0 ? higherPrices[0] : null;

        return {
          salePrice: currentPrice.text,
          originalPrice: originalPrice ? originalPrice.text : "",
        };
      } else {
        // No clear context, use the most reasonable price
        const midRangePrices = validPrices.filter(
          (p) => p.value >= 5 && p.value <= 1000
        );
        const bestPrice =
          midRangePrices.length > 0 ? midRangePrices[0] : validPrices[0];

        return {
          salePrice: bestPrice.text,
          originalPrice: "",
        };
      }
    }

    // Fallback
    return {
      salePrice: validPrices[0].text,
      originalPrice: "",
    };
  }

  function getPrices() {
    console.log("💰 Starting enhanced price extraction...");

    // Enhanced price selectors with more patterns
    const salePriceSelectors = [
      // High priority - specific sale price indicators
      ".price--sale",
      ".sale-price",
      ".price-sale",
      ".current-price",
      ".price__sale",
      ".price-current",
      ".price--current",
      ".special-price",
      ".discounted-price",

      // Modern e-commerce patterns
      '[data-testid*="price"]:not([data-testid*="compare"]):not([data-testid*="original"])',
      '[data-testid="currentPrice-container"]',
      '[data-testid="price-container"]',
      '[data-test*="price"]:not([data-test*="compare"]):not([data-test*="original"])',
      '[data-automation-id*="price"]:not([data-automation-id*="compare"])',
      "[data-price]:not([data-compare-price])",
      "[data-current-price]",
      "[data-sale-price]",

      // Shopify patterns
      ".price .money:not(.compare-at-price)",
      ".product-price .money",
      ".price-item--sale",
      ".price-item--regular",

      // Generic patterns with attribute selectors
      '[class*="price"][class*="current"]',
      '[class*="price"][class*="sale"]',
      '[class*="price"][class*="now"]',
      '[class*="current"][class*="price"]',
      '[class*="sale"][class*="price"]',

      // Site-specific patterns
      ".Price-module__price",
      ".price-display",
      ".product-price-value",
      ".pricing .price",
      ".price-box .price",
      ".cost",
      ".amount",

      // Nike/Adidas patterns
      ".nds-text.css-tbgmka",
      ".css-e4uzb4 span",
      "#price-container span",
      ".gl-price-item",

      // Generic fallbacks
      ".product-price:not(.was-price):not(.compare-at-price)",
      ".price:not(.price--original):not(.was-price):not(.compare-at)",
      ".price",
      ".product-price",
      "[class*=price]",
    ];

    const originalPriceSelectors = [
      // Specific original price indicators
      ".price--original",
      ".original-price",
      ".price-original",
      ".was-price",
      ".previous-price",
      ".previous_price",
      ".price__regular",
      ".price-was",
      ".price-previous",
      ".compare-at-price",
      ".price--compare",
      ".regular-price",
      ".msrp-price",
      ".old-price",
      ".old_price",

      // Modern patterns
      '[data-testid*="compare"]',
      '[data-testid*="original"]',
      '[data-testid*="previous"]',
      '[data-testid*="old"]',
      '[data-testid="originalPrice-container"]',
      '[data-testid="was-price"]',
      '[data-testid="previous-price"]',
      '[data-test*="compare"]',
      '[data-test*="original"]',
      "[data-compare-price]",
      "[data-original-price]",
      "[data-was-price]",
      "[data-previous-price]",
      "[data-old-price]",
      "[data-before-discount]",

      // Visual indicators
      '[style*="line-through"]',
      '[style*="text-decoration: line-through"]',
      ".strike-through",
      ".strikethrough",
      ".crossed-out",

      // Generic patterns
      '[class*="original"][class*="price"]',
      '[class*="was"][class*="price"]',
      '[class*="regular"][class*="price"]',
      '[class*="compare"][class*="price"]',

      // HTML elements
      "del .price",
      ".price del",
      "s .price",
      ".price s",
    ];

    let salePrice = null;
    let originalPrice = null;

    // Enhanced price extraction function
    function extractPriceFromElement(element) {
      if (!element) return null;

      // Get text from various sources
      const sources = [
        element.textContent,
        element.innerText,
        element.value,
        element.getAttribute("content"),
        element.getAttribute("data-price"),
        element.getAttribute("data-value"),
        element.title,
      ].filter(Boolean);

      for (const text of sources) {
        const price = extractFirstPrice(text);
        if (price && isValidPrice(price)) {
          return price;
        }
      }
      return null;
    }

    // Enhanced price validation
    function isValidPrice(priceStr) {
      if (!priceStr) return false;
      const numericValue = parseFloat(priceStr.replace(/[^\d.]/g, ""));
      return numericValue >= 0.01 && numericValue <= 50000;
    }

    // Look for specific sale price with enhanced logic
    console.log("🎯 Looking for sale/current price...");
    for (const selector of salePriceSelectors) {
      try {
        const elements = document.querySelectorAll(selector);

        for (const element of elements) {
          if (!element) continue;

          // Skip elements that look like original prices
          const elementText = (element.textContent || "").toLowerCase();
          const elementClass = (element.className || "").toLowerCase();
          const isStrikethrough = window
            .getComputedStyle(element)
            .textDecoration.includes("line-through");

          if (
            elementText.includes("was") ||
            elementText.includes("original") ||
            elementText.includes("compare") ||
            elementText.includes("msrp") ||
            elementClass.includes("compare") ||
            elementClass.includes("was") ||
            elementClass.includes("original") ||
            isStrikethrough
          ) {
            continue;
          }

          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(
              `✅ Found sale price: ${price} from selector: ${selector}`
            );
            break;
          }
        }
        if (salePrice) break;
      } catch (e) {
        console.warn(`Error with selector ${selector}:`, e);
      }
    }

    // Look for specific original price
    console.log("🔍 Looking for original/compare price...");
    for (const selector of originalPriceSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const price = extractPriceFromElement(element);
          if (price) {
            originalPrice = price;
            console.log(
              `✅ Found original price: ${price} from selector: ${selector}`
            );
            break;
          }
        }
      } catch (e) {
        console.warn(`Error with selector ${selector}:`, e);
      }
    }

    // Site-specific logic improvements
    const hostname = window.location.hostname.toLowerCase();

    // Amazon specific
    if (hostname.includes("amazon")) {
      console.log("🛒 Applying Amazon-specific price logic...");

      // Amazon price patterns
      const amazonSelectors = [
        ".a-price-current .a-offscreen",
        ".a-price .a-offscreen",
        "#priceblock_dealprice",
        "#priceblock_ourprice",
        ".a-price-whole",
        ".a-price-range .a-offscreen",
      ];

      for (const selector of amazonSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const price = extractPriceFromElement(element);
          if (price && !salePrice) {
            salePrice = price;
            console.log(`✅ Amazon price found: ${price}`);
            break;
          }
        }
      }
    }

    // Shopify specific
    else if (
      hostname.includes("shopify") ||
      document.querySelector("[data-shopify]")
    ) {
      console.log("🛍️ Applying Shopify-specific price logic...");

      const shopifySelectors = [
        ".price--on-sale .price-item--sale",
        ".price .money",
        ".product-form__price .money",
      ];

      for (const selector of shopifySelectors) {
        const element = document.querySelector(selector);
        if (element && !salePrice) {
          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(`✅ Shopify price found: ${price}`);
            break;
          }
        }
      }
    }

    // Target specific
    else if (hostname.includes("target.com")) {
      console.log("🎯 Applying Target-specific price logic...");

      const targetSelectors = [
        '[data-test="product-price"] span',
        ".h-text-red",
        ".h-text-bs",
        '[data-automation-id="product-price"]',
      ];

      for (const selector of targetSelectors) {
        const element = document.querySelector(selector);
        if (element && !salePrice) {
          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(`✅ Target price found: ${price}`);
            break;
          }
        }
      }
    }

    // Walmart specific
    else if (hostname.includes("walmart.com")) {
      console.log("🏪 Applying Walmart-specific price logic...");

      const walmartSelectors = [
        '[data-automation-id="product-price"]',
        '[itemprop="price"]',
        ".price-current",
        ".price-group .visuallyhidden",
      ];

      for (const selector of walmartSelectors) {
        const element = document.querySelector(selector);
        if (element && !salePrice) {
          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(`✅ Walmart price found: ${price}`);
            break;
          }
        }
      }
    }

    // Best Buy specific
    else if (hostname.includes("bestbuy.com")) {
      console.log("🔌 Applying Best Buy-specific price logic...");

      const bestBuySelectors = [
        ".pricing-price__range",
        '.sr-only:contains("current price")',
        ".pricing-price__range .sr-only",
      ];

      for (const selector of bestBuySelectors) {
        const element = document.querySelector(selector);
        if (element && !salePrice) {
          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(`✅ Best Buy price found: ${price}`);
            break;
          }
        }
      }
    }

    // eBay specific
    else if (hostname.includes("ebay.com")) {
      console.log("🏺 Applying eBay-specific price logic...");

      const ebaySelectors = [
        ".u-flL.condText",
        ".notranslate",
        "#prcIsum",
        ".u-flL span",
      ];

      for (const selector of ebaySelectors) {
        const element = document.querySelector(selector);
        if (element && !salePrice) {
          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(`✅ eBay price found: ${price}`);
            break;
          }
        }
      }
    }

    // Nike specific
    else if (hostname.includes("nike.com")) {
      console.log("👟 Applying Nike-specific price logic...");

      const nikeSelectors = [
        '[data-testid="currentPrice-container"]',
        '[data-testid="price-container"]',
        "#price-container span",
        ".css-e4uzb4 span",
        ".nds-text.css-tbgmka",
        ".product-price",
        ".current-price span",
        ".price-current",
      ];

      for (const selector of nikeSelectors) {
        const element = document.querySelector(selector);
        if (element && !salePrice) {
          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(`✅ Nike price found: ${price}`);
            break;
          }
        }
      }

      // Nike original price (if on sale) - Enhanced search
      if (!originalPrice) {
        console.log("👟 Searching for Nike original prices...");

        const nikeOriginalSelectors = [
          '[data-testid="originalPrice-container"]',
          '[data-testid="was-price"]',
          '[data-testid*="original"]',
          '[data-testid*="compare"]',
          ".css-e4uzb4 del",
          ".css-e4uzb4 s",
          "#price-container del",
          "#price-container s",
          ".price-original",
          ".was-price",
          ".original-price",
          ".previous-price",
          ".previous_price",
          ".price-previous",
          ".price-before-discount",
          ".old-price",
          ".old_price",
          // Look for any element with line-through in Nike price container
          '#price-container [style*="line-through"]',
          '.css-e4uzb4 [style*="line-through"]',
        ];

        for (const selector of nikeOriginalSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element) {
              const price = extractPriceFromElement(element);
              if (price) {
                originalPrice = price;
                console.log(
                  `✅ Nike original price found: ${price} from ${selector}`
                );
                break;
              }
            }
          }
          if (originalPrice) break;
        }

        // Special Nike fallback - look for multiple prices in price container
        if (!originalPrice) {
          console.log(
            "👟 Nike fallback: searching for multiple prices in price container..."
          );
          const priceContainer = document.querySelector(
            "#price-container, .css-e4uzb4"
          );
          if (priceContainer) {
            const allPricesInContainer = [];
            const spans = priceContainer.querySelectorAll("span");

            spans.forEach((span) => {
              const text = span.textContent || "";
              if (text.match(/€\d+|£\d+|\$\d+/)) {
                const price = extractPriceFromElement(span);
                if (price) {
                  allPricesInContainer.push({
                    price: price,
                    element: span,
                    isStrikethrough:
                      span.style.textDecoration === "line-through" ||
                      span.tagName === "DEL" ||
                      span.tagName === "S",
                  });
                }
              }
            });

            console.log(
              `👟 Found ${allPricesInContainer.length} prices in Nike container`
            );

            // If we have multiple prices, the strikethrough one is original
            const strikethroughPrice = allPricesInContainer.find(
              (p) => p.isStrikethrough
            );
            if (strikethroughPrice) {
              originalPrice = strikethroughPrice.price;
              console.log(
                `✅ Nike original price from strikethrough: ${originalPrice}`
              );
            }
            // If we have exactly 2 prices and current price is set, the other might be original
            else if (allPricesInContainer.length === 2 && salePrice) {
              const otherPrice = allPricesInContainer.find(
                (p) => p.price !== salePrice
              );
              if (otherPrice) {
                const currentNum = parseFloat(
                  salePrice.replace(/[^0-9.,]/g, "").replace(",", ".")
                );
                const otherNum = parseFloat(
                  otherPrice.price.replace(/[^0-9.,]/g, "").replace(",", ".")
                );

                if (otherNum > currentNum) {
                  originalPrice = otherPrice.price;
                  console.log(
                    `✅ Nike original price (higher of two): ${originalPrice}`
                  );
                }
              }
            }
          }
        }
      }
    }

    // Adidas specific
    else if (hostname.includes("adidas.com")) {
      console.log("👟 Applying Adidas-specific price logic...");

      const adidasSelectors = [
        ".gl-price-item",
        ".price-value",
        '[data-auto-id="price-value"]',
        ".price .gl-price-item",
        ".price-container .gl-price-item",
      ];

      for (const selector of adidasSelectors) {
        const element = document.querySelector(selector);
        if (element && !salePrice) {
          const price = extractPriceFromElement(element);
          if (price) {
            salePrice = price;
            console.log(`✅ Adidas price found: ${price}`);
            break;
          }
        }
      }
    }

    // JCrew specific (keep existing logic)
    else if (hostname.includes("jcrew.com")) {
      console.log("👔 Applying JCrew-specific price logic...");
      const priceContainer = document.querySelector(".prices");
      if (priceContainer) {
        const prices = priceContainer.querySelectorAll(".price");
        if (prices.length >= 2) {
          salePrice = extractFirstPrice(prices[0].innerText);
          originalPrice = extractFirstPrice(prices[1].innerText);
        } else if (prices.length === 1) {
          salePrice = extractFirstPrice(prices[0].innerText);
        }
      }
    }

    // If we found specific prices, use them
    if (salePrice || originalPrice) {
      console.log(
        `💰 Specific prices found - Sale: ${salePrice}, Original: ${originalPrice}`
      );
      return {
        salePrice: salePrice || "N/A",
        originalPrice: originalPrice || "",
      };
    }

    // Enhanced fallback: look for any price patterns in the page
    console.log("🔄 Using enhanced fallback price detection...");

    // Try JSON-LD structured data first
    const jsonLdScripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const price = extractPriceFromStructuredData(data);
        if (price) {
          console.log(`✅ Price from JSON-LD: ${price}`);
          return { salePrice: price, originalPrice: "" };
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }

    // Try meta tags
    const priceMetaTags = [
      'meta[property="product:price:amount"]',
      'meta[name="price"]',
      'meta[property="og:price:amount"]',
    ];

    for (const selector of priceMetaTags) {
      const meta = document.querySelector(selector);
      if (meta) {
        const price = meta.getAttribute("content");
        if (price && isValidPrice("$" + price)) {
          const formattedPrice = "$" + parseFloat(price).toFixed(2);
          console.log(`✅ Price from meta tag: ${formattedPrice}`);
          return { salePrice: formattedPrice, originalPrice: "" };
        }
      }
    }

    // Enhanced search for original prices before fallback
    console.log("🔍 Enhanced search for original/compare prices...");
    if (!originalPrice) {
      const enhancedOriginalSelectors = [
        // Visual indicators
        "del",
        "s",
        '[style*="line-through"]',
        '[style*="text-decoration: line-through"]',
        ".line-through",
        ".strikethrough",
        ".strike-through",

        // Nike specific original prices
        '[data-testid*="original"]',
        '[data-testid*="was"]',
        '[data-testid*="previous"]',
        '[data-testid*="compare"]',
        '[data-testid*="old"]',
        ".css-e4uzb4 del",
        ".css-e4uzb4 s",

        // General original price patterns
        ".was-price",
        ".original-price",
        ".previous-price",
        ".previous_price",
        ".compare-at-price",
        ".price-original",
        ".price--original",
        ".price-was",
        ".price-previous",
        ".regular-price",
        ".msrp-price",
        ".old-price",
        ".old_price",
      ];

      for (const selector of enhancedOriginalSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (!element) continue;

          const text = element.textContent || element.innerText || "";
          if (text.match(/[€$£]\d+/) || text.match(/\d+[€$£]/)) {
            const price = extractPriceFromElement(element);
            if (price && !originalPrice) {
              originalPrice = price;
              console.log(`✅ Found original price: ${price} from ${selector}`);
              break;
            }
          }
        }
        if (originalPrice) break;
      }
    }

    // Try CSS-hash based selectors (for dynamic class names like Nike)
    console.log("🔍 Trying CSS-hash based selectors...");
    const hashSelectors = [
      '[class*="css-"][class*="price"]',
      '[class*="css-"] span:contains("€")',
      '[class*="css-"] span:contains("$")',
      '[class*="css-"] span:contains("£")',
      '[class*="nds-text"]',
      '#price-container [class*="css-"]',
      '.price-container [class*="css-"]',
    ];

    for (const selector of hashSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (!element) continue;

          const text = element.textContent || element.innerText || "";
          if (text.match(/[€$£]\d+/) || text.match(/\d+[€$£]/)) {
            const price = extractPriceFromElement(element);
            if (price && !salePrice) {
              salePrice = price;
              console.log(
                `✅ CSS-hash selector price found: ${price} from ${selector}`
              );
              return { salePrice, originalPrice: originalPrice || "" };
            }
          }
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    // Enhanced text-based fallback
    const allText = document.body.innerText;
    const priceMatches = allText.match(/[€$£]\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);

    if (priceMatches && priceMatches.length > 0) {
      // Filter out unrealistic prices
      const validPrices = priceMatches.filter((price) => {
        const numValue = parseFloat(price.replace(/[^\d.]/g, ""));
        return numValue >= 1 && numValue <= 5000; // More reasonable range
      });

      if (validPrices.length > 0) {
        console.log(`💰 Found ${validPrices.length} potential prices in text`);

        if (validPrices.length === 1) {
          return { salePrice: validPrices[0], originalPrice: "" };
        } else {
          // Multiple prices - use smart selection
          return extractPricesFromText(validPrices.join(" "));
        }
      }
    }

    // Final fallback - scan all elements for currency symbols
    console.log("🔍 Final fallback - scanning all elements...");
    const currencyElements = findElementsWithCurrency();

    if (currencyElements.length > 0) {
      const bestElement = currencyElements[0];

      // Try to find original price from remaining elements
      let foundOriginalPrice = "";
      for (let i = 1; i < currencyElements.length; i++) {
        const element = currencyElements[i];
        const className = (element.element.className || "").toLowerCase();
        const id = (element.element.id || "").toLowerCase();
        const textContent = (element.text || "").toLowerCase();

        const isOriginalPrice =
          className.includes("original") ||
          className.includes("was") ||
          className.includes("previous") ||
          className.includes("compare") ||
          className.includes("msrp") ||
          className.includes("regular") ||
          className.includes("before") ||
          className.includes("old") ||
          id.includes("original") ||
          id.includes("was") ||
          id.includes("previous") ||
          id.includes("old") ||
          textContent.includes("was") ||
          textContent.includes("before") ||
          textContent.includes("previous") ||
          element.element.style.textDecoration === "line-through" ||
          element.element.tagName === "DEL" ||
          element.element.tagName === "S" ||
          (element.element.hasAttribute("data-testid") &&
            (element.element.getAttribute("data-testid").includes("original") ||
              element.element.getAttribute("data-testid").includes("was") ||
              element.element
                .getAttribute("data-testid")
                .includes("previous") ||
              element.element.getAttribute("data-testid").includes("old") ||
              element.element.getAttribute("data-testid").includes("compare")));

        if (isOriginalPrice) {
          foundOriginalPrice = element.price;
          console.log(
            `✅ Found original price: ${foundOriginalPrice} (${element.selector})`
          );
          break;
        }
      }

      // If no specific original price found, use second highest price if significantly different
      if (!foundOriginalPrice && currencyElements.length > 1) {
        const secondPrice = currencyElements[1].price;
        const currentPriceNum = parseFloat(
          bestElement.price.replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        const secondPriceNum = parseFloat(
          secondPrice.replace(/[^0-9.,]/g, "").replace(",", ".")
        );

        if (secondPriceNum > currentPriceNum * 1.05) {
          // At least 5% higher
          foundOriginalPrice = secondPrice;
          console.log(
            `✅ Using second price as original: ${foundOriginalPrice} (${(
              ((secondPriceNum - currentPriceNum) / secondPriceNum) *
              100
            ).toFixed(1)}% discount)`
          );
        }
      }

      console.log(
        `✅ Found price via currency scan: ${bestElement.price} (${bestElement.selector})`
      );
      return {
        salePrice: bestElement.price,
        originalPrice: foundOriginalPrice,
      };
    }

    console.log("❌ No prices found after exhaustive search");
    return { salePrice: "N/A", originalPrice: "" };
  }

  // Helper function to find elements containing currency symbols
  function findElementsWithCurrency() {
    console.log("💱 Searching for elements containing currency symbols...");

    const currencyRegex =
      /[€$£¥₹₽¢]\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*[€$£¥₹₽¢]/;
    const allElements = document.querySelectorAll("*");
    const priceElements = [];

    for (const element of allElements) {
      // Skip script, style, and other non-visible elements
      if (
        ["SCRIPT", "STYLE", "META", "LINK", "HEAD"].includes(element.tagName)
      ) {
        continue;
      }

      const text = element.textContent || "";
      const directText = element.childNodes[0]?.nodeValue || "";

      // Check if element directly contains price text (not inherited from children)
      if (
        directText.match(currencyRegex) ||
        (text.length < 50 && text.match(currencyRegex))
      ) {
        const price = extractPriceFromElement(element);
        if (price) {
          priceElements.push({
            element: element,
            price: price,
            text: text.trim(),
            selector: getElementSelector(element),
          });
        }
      }
    }

    // Sort by likelihood of being a product price
    priceElements.sort((a, b) => {
      const aScore = getPriceElementScore(a.element, a.text);
      const bScore = getPriceElementScore(b.element, b.text);
      return bScore - aScore;
    });

    console.log(`💱 Found ${priceElements.length} potential price elements`);
    return priceElements;
  }

  // Helper function to score price elements by likelihood
  function getPriceElementScore(element, text) {
    let score = 0;

    const className = (element.className || "").toLowerCase();
    const id = (element.id || "").toLowerCase();
    const textLower = text.toLowerCase();

    // Positive indicators
    if (className.includes("price")) score += 10;
    if (id.includes("price")) score += 10;
    if (className.includes("current")) score += 5;
    if (className.includes("sale")) score += 5;
    if (
      element.hasAttribute("data-testid") &&
      element.getAttribute("data-testid").includes("price")
    )
      score += 8;
    if (element.hasAttribute("data-price")) score += 8;

    // Original price indicators (should be secondary)
    if (className.includes("original")) score -= 1;
    if (className.includes("was")) score -= 1;
    if (className.includes("previous")) score -= 1;
    if (className.includes("compare")) score -= 1;
    if (className.includes("old")) score -= 1;
    if (element.style.textDecoration === "line-through") score -= 3;
    if (element.tagName === "DEL" || element.tagName === "S") score -= 3;

    // Negative indicators
    if (textLower.includes("shipping")) score -= 5;
    if (textLower.includes("tax")) score -= 5;
    if (textLower.includes("total")) score -= 3;
    if (textLower.includes("subtotal")) score -= 3;

    // Element position indicators
    if (element.getBoundingClientRect().top < window.innerHeight) score += 3; // Visible

    return score;
  }

  // Helper function to get a simple selector for an element
  function getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.className) {
      const classes = element.className.split(" ").filter((c) => c.length > 0);
      if (classes.length > 0) return `.${classes[0]}`;
    }
    return element.tagName.toLowerCase();
  }

  // Helper function to extract price from structured data
  function extractPriceFromStructuredData(data) {
    if (data["@type"] === "Product" && data.offers) {
      const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
      for (const offer of offers) {
        if (offer.price) {
          const price = parseFloat(offer.price);
          if (price > 0) {
            const currency =
              offer.priceCurrency === "USD" ? "$" : offer.priceCurrency || "$";
            return `${currency}${price.toFixed(2)}`;
          }
        }
      }
    }

    // Handle nested structures
    if (typeof data === "object") {
      for (const key in data) {
        if (typeof data[key] === "object") {
          const result = extractPriceFromStructuredData(data[key]);
          if (result) return result;
        }
      }
    }
    return null;
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

          // Handle authentication errors
          if (response?.needsAuth) {
            showNotification("❌ Please sign in to add products", "error");
          } else {
            showNotification("Failed to add product!");
          }
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
