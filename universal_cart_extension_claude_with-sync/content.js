(function setupPWACommunication() {
  if (
    window.location.hostname.includes("netlify.app") ||
    window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
  ) {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "CART_UPDATED") {
          if (window.trolleyApp && window.trolleyApp.handleExtensionUpdate) {
            window.trolleyApp.handleExtensionUpdate(message.cart);
          } else {
            window.pendingExtensionUpdate = message.cart;
          }
        }
      });

      window.extensionAPI = {
        getCart: () => {
          return new Promise((resolve) => {
            try {
              chrome.runtime.sendMessage({ type: "GET_CART" }, (response) => {
                if (chrome.runtime.lastError) {
                  resolve({});
                } else {
                  resolve(response || {});
                }
              });
            } catch (error) {
              resolve({});
            }
          });
        },

        isAvailable: () => {
          return (
            typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id
          );
        },
      };
    }
    return;
  }
})();

(function () {
  function isLikelyProductPage() {
    let score = 0;
    const checks = {};
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes("amazon.")) {
      const amazonSelectors = {
        title: ["#productTitle", 'h1[data-automation-id="title"]'],
        price: [
          ".a-price-current .a-offscreen",
          ".a-price .a-offscreen",
          "#priceblock_dealprice",
        ],
        image: ["#landingImage", "#imgTagWrapperId img"],
        buyButton: [
          "#add-to-cart-button",
          "#buy-now-button",
          '[data-feature-name="addToCart"]',
        ],
      };

      for (const selector of amazonSelectors.title) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          score += 1;
          checks.title = true;
          break;
        }
      }

      for (const selector of amazonSelectors.price) {
        const element = document.querySelector(selector);
        if (
          element &&
          element.textContent &&
          element.textContent.match(/[€$£]\d+/)
        ) {
          score += 1;
          checks.price = true;
          break;
        }
      }

      for (const selector of amazonSelectors.image) {
        const element = document.querySelector(selector);
        if (element && element.src) {
          score += 1;
          checks.image = true;
          break;
        }
      }

      for (const selector of amazonSelectors.buyButton) {
        const element = document.querySelector(selector);
        if (element && !element.disabled) {
          score += 1;
          checks.buyButton = true;
          break;
        }
      }

      if (
        window.location.pathname.includes("/dp/") ||
        window.location.pathname.includes("/gp/product/")
      ) {
        score += 0.5;
        checks.productUrl = true;
      }

      return score >= 2.5;
    }

    const siteSpecificChecks = {
      "target.com": {
        title: ['[data-test="product-title"]', "h1"],
        price: ['[data-test="product-price"]', ".h-text-red"],
        image: ['[data-test="product-image"] img', ".hero-image img"],
        buyButton: [
          '[data-test="addToCart"]',
          'button:contains("Add to cart")',
        ],
      },
      "walmart.com": {
        title: ['[data-automation-id="product-title"]', "h1"],
        price: ['[data-automation-id="product-price"]', ".price-current"],
        image: [
          '[data-automation-id="product-image"] img',
          ".product-image img",
        ],
        buyButton: [
          '[data-automation-id="add-to-cart"]',
          'button:contains("Add to cart")',
        ],
      },
      "bestbuy.com": {
        title: ["h1.heading-5", ".sku-title"],
        price: [".pricing-price__range", '.sr-only:contains("current price")'],
        image: [".primary-image img", ".product-image img"],
        buyButton: [
          '[data-button-state="ADD_TO_CART"]',
          'button:contains("Add to Cart")',
        ],
      },
      "temu.com": {
        title: ["h1", ".product-title", "[data-testid*='title']"],
        price: ["#goods_price", "[data-type='0']", ".d6YtcpXw", "._1lS1CJSS"],
        image: [
          ".product-image img",
          ".main-image img",
          "[data-testid*='image']",
        ],
        buyButton: [
          'button:contains("Додати")',
          'button:contains("Add")',
          '[data-testid*="add"]',
        ],
      },
      "ebay.com": {
        title: ["h1.x-item-title__mainTitle", ".x-item-title__mainTitle"],
        price: [".u-flL.condText", "#prcIsum"],
        image: [".ux-image-carousel-item img", ".ux-image-magnify img"],
        buyButton: ["#atcRedesignId_btn", 'button:contains("Add to cart")'],
      },
    };

    for (const [site, selectors] of Object.entries(siteSpecificChecks)) {
      if (hostname.includes(site)) {
        for (const [field, fieldSelectors] of Object.entries(selectors)) {
          for (const selector of fieldSelectors) {
            const element = document.querySelector(selector);
            if (element && (element.textContent || element.src)) {
              score += 1;
              checks[field] = true;
              break;
            }
          }
        }

        if (
          window.location.pathname.includes("/p/") ||
          window.location.pathname.includes("/product/")
        ) {
          score += 0.5;
          checks.productUrl = true;
        }

        return score >= 2.5;
      }
    }

    const titleSelectors = [
      'meta[property="og:title"]',
      'h1[itemprop="name"]',
      ".product-title",
      ".product-name",
      "#productTitle",
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && (element.content || element.textContent)) {
        score += 1;
        checks.title = true;
        break;
      }
    }

    const priceSelectors = [
      '[itemprop="price"]',
      ".price",
      ".product-price",
      ".current-price",
      ".sale-price",
    ];

    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (
        element &&
        element.textContent &&
        element.textContent.match(/[€$£]\d+/)
      ) {
        score += 1;
        checks.price = true;
        break;
      }
    }

    const imageSelectors = [
      'meta[property="og:image"]',
      '[itemprop="image"]',
      ".product-image img",
      ".main-image",
    ];

    for (const selector of imageSelectors) {
      const element = document.querySelector(selector);
      if (element && (element.content || element.src)) {
        score += 1;
        checks.image = true;
        break;
      }
    }

    const buyButtonTexts = ["add to cart", "buy now", "add to bag", "purchase"];
    const buttons = document.querySelectorAll(
      'button, input[type="submit"], a'
    );
    let hasBuyButton = false;

    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || "";
      if (buyButtonTexts.some((btnText) => text.includes(btnText))) {
        score += 1;
        checks.buyButton = true;
        hasBuyButton = true;
        break;
      }
    }

    const urlPath = window.location.pathname.toLowerCase();
    const productUrlPatterns = [
      "/product/",
      "/products/",
      "/shop/",
      "/item/",
      "/p/",
    ];
    const hasProductUrl = productUrlPatterns.some((pattern) =>
      urlPath.includes(pattern)
    );

    if (hasProductUrl) {
      score += 0.5;
      checks.productUrl = true;
    }

    return score >= 3;
  }

  function extractFirstPrice(text) {
    if (!text || typeof text !== "string") return null;

    const patterns = [
      /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,

      /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,

      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD/i,

      /€(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,

      /£(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,

      /CAD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,

      /AUD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,

      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const numericValue = parseFloat(match[1].replace(/,/g, ""));

        if (numericValue >= 0.01 && numericValue <= 50000) {
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
            return `$${numericValue.toFixed(2)}`;
          }
        }
      }
    }

    return null;
  }

  function extractPricesFromText(text) {
    const priceRegex =
      /(?:\$|USD\s*|€|£|CAD\s*|AUD\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi;
    const matches = [...text.matchAll(priceRegex)];

    if (!matches || matches.length === 0) {
      return { salePrice: "N/A", originalPrice: "" };
    }

    const validPrices = matches
      .map((match) => {
        const fullMatch = match[0];
        const numericValue = parseFloat(match[1].replace(/,/g, ""));
        return { text: fullMatch, value: numericValue };
      })
      .filter((price) => price.value >= 0.5 && price.value <= 10000)
      .sort((a, b) => a.value - b.value);

    if (validPrices.length === 0) {
      return { salePrice: "N/A", originalPrice: "" };
    }

    if (validPrices.length === 1) {
      return { salePrice: validPrices[0].text, originalPrice: "" };
    }

    if (validPrices.length === 2) {
      const lowerPrice = validPrices[0];
      const higherPrice = validPrices[1];

      if (higherPrice.value > lowerPrice.value * 1.1) {
        return {
          salePrice: lowerPrice.text,
          originalPrice: higherPrice.text,
        };
      } else {
        return {
          salePrice: lowerPrice.text,
          originalPrice: "",
        };
      }
    }

    if (validPrices.length >= 3) {
      const textLower = text.toLowerCase();
      const hasWasContext =
        textLower.includes("was") || textLower.includes("originally");
      const hasSaleContext =
        textLower.includes("sale") ||
        textLower.includes("now") ||
        textLower.includes("special");

      if (hasWasContext || hasSaleContext) {
        const midRangePrices = validPrices.filter(
          (p) => p.value >= 5 && p.value <= 1000
        );
        const currentPrice =
          midRangePrices.length > 0 ? midRangePrices[0] : validPrices[0];

        const higherPrices = validPrices.filter(
          (p) => p.value > currentPrice.value * 1.1
        );
        const originalPrice = higherPrices.length > 0 ? higherPrices[0] : null;

        return {
          salePrice: currentPrice.text,
          originalPrice: originalPrice ? originalPrice.text : "",
        };
      } else {
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

    return {
      salePrice: validPrices[0].text,
      originalPrice: "",
    };
  }

  function getPrices() {
    if (window.location.hostname.includes("temu.com")) {
      const temuPriceSelectors = [
        "#goods_price",
        "#goods_price span",
        "[data-type='0']",
        "[role='button']",
        ".d6YtcpXw",
        ".PjdWJn3s",
        "._1lS1CJSS",
        "._1uv7QxlH",
      ];

      let currentPrice = "";
      let originalPrice = "";

      for (const selector of temuPriceSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          if (text) {
            const priceMatch = text.match(/[\d,]+(?:[.,]\d{2})?/);
            if (priceMatch) {
              const price = priceMatch[0].replace(",", ".");
              if (!currentPrice && element.closest("#goods_price")) {
                currentPrice = price;
              } else if (!originalPrice && element.closest(".d6YtcpXw")) {
                originalPrice = price;
              }
            }
          }
        }
      }

      if (currentPrice) {
        return {
          salePrice: currentPrice,
          originalPrice: originalPrice,
        };
      }

      const allText = document.body.innerText;
      const priceMatches = allText.match(/[€$£]\d+(?:[.,]\d{2})?/g);

      if (priceMatches && priceMatches.length > 0) {
        const currentPrice = priceMatches[0];
        let originalPrice = "";
        if (priceMatches.length > 1) {
          originalPrice = priceMatches[1];
        }

        return {
          salePrice: currentPrice,
          originalPrice: originalPrice,
        };
      }
    }

    const salePriceSelectors = [
      ".price--sale",
      ".sale-price",
      ".price-sale",
      ".current-price",
      ".price__sale",
      ".price-current",
      ".price--current",
      ".special-price",
      ".discounted-price",

      '[data-testid*="price"]:not([data-testid*="compare"]):not([data-testid*="original"])',
      '[data-testid="currentPrice-container"]',
      '[data-testid="price-container"]',
      '[data-test*="price"]:not([data-test*="compare"]):not([data-test*="original"])',
      '[data-automation-id*="price"]:not([data-automation-id*="compare"])',
      "[data-price]:not([data-compare-price])",
      "[data-current-price]",
      "[data-sale-price]",

      ".price .money:not(.compare-at-price)",
      ".product-price .money",
      ".price-item--sale",
      ".price-item--regular",

      '[class*="price"][class*="current"]',
      '[class*="price"][class*="sale"]',
      '[class*="price"][class*="now"]',
      '[class*="current"][class*="price"]',
      '[class*="sale"][class*="price"]',

      ".Price-module__price",
      ".price-display",
      ".product-price-value",
      ".pricing .price",
      ".price-box .price",
      ".cost",
      ".amount",

      ".nds-text.css-tbgmka",
      ".css-e4uzb4 span",
      "#price-container span",
      ".gl-price-item",

      ".product-price:not(.was-price):not(.compare-at-price)",
      ".price:not(.price--original):not(.was-price):not(.compare-at)",
      ".price",
      ".product-price",
      "[class*=price]",
    ];

    const originalPriceSelectors = [
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

      '[style*="line-through"]',
      '[style*="text-decoration: line-through"]',
      ".strike-through",
      ".strikethrough",
      ".crossed-out",

      '[class*="original"][class*="price"]',
      '[class*="was"][class*="price"]',
      '[class*="regular"][class*="price"]',
      '[class*="compare"][class*="price"]',

      "del .price",
      ".price del",
      "s .price",
      ".price s",
    ];

    let salePrice = null;
    let originalPrice = null;

    function extractPriceFromElement(element) {
      if (!element) return null;

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

    function isValidPrice(priceStr) {
      if (!priceStr) return false;
      const numericValue = parseFloat(priceStr.replace(/[^\d.]/g, ""));
      return numericValue >= 0.01 && numericValue <= 50000;
    }

    for (const selector of salePriceSelectors) {
      try {
        const elements = document.querySelectorAll(selector);

        for (const element of elements) {
          if (!element) continue;

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
            break;
          }
        }
        if (salePrice) break;
      } catch (e) {
        // Ignore selector errors
      }
    }

    for (const selector of originalPriceSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const price = extractPriceFromElement(element);
          if (price) {
            originalPrice = price;
            break;
          }
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes("amazon")) {
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
            break;
          }
        }
      }
    } else if (
      hostname.includes("shopify") ||
      document.querySelector("[data-shopify]")
    ) {
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
            break;
          }
        }
      }
    } else if (hostname.includes("target.com")) {
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
            break;
          }
        }
      }
    } else if (hostname.includes("walmart.com")) {
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
            break;
          }
        }
      }
    } else if (hostname.includes("bestbuy.com")) {
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
            break;
          }
        }
      }
    } else if (hostname.includes("ebay.com")) {
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
            break;
          }
        }
      }
    } else if (hostname.includes("nike.com")) {
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
            break;
          }
        }
      }

      if (!originalPrice) {
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
                break;
              }
            }
          }
          if (originalPrice) break;
        }

        if (!originalPrice) {
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

            const strikethroughPrice = allPricesInContainer.find(
              (p) => p.isStrikethrough
            );
            if (strikethroughPrice) {
              originalPrice = strikethroughPrice.price;
            } else if (allPricesInContainer.length === 2 && salePrice) {
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
                }
              }
            }
          }
        }
      }
    } else if (hostname.includes("adidas.com")) {
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
            break;
          }
        }
      }
    } else if (hostname.includes("jcrew.com")) {
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

    if (salePrice || originalPrice) {
      return {
        salePrice: salePrice || "N/A",
        originalPrice: originalPrice || "",
      };
    }

    const jsonLdScripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const price = extractPriceFromStructuredData(data);
        if (price) {
          return { salePrice: price, originalPrice: "" };
        }
      } catch (e) {}
    }

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
          return { salePrice: formattedPrice, originalPrice: "" };
        }
      }
    }

    if (!originalPrice) {
      const enhancedOriginalSelectors = [
        "del",
        "s",
        '[style*="line-through"]',
        '[style*="text-decoration: line-through"]',
        ".line-through",
        ".strikethrough",
        ".strike-through",

        '[data-testid*="original"]',
        '[data-testid*="was"]',
        '[data-testid*="previous"]',
        '[data-testid*="compare"]',
        '[data-testid*="old"]',
        ".css-e4uzb4 del",
        ".css-e4uzb4 s",

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
              break;
            }
          }
        }
        if (originalPrice) break;
      }
    }

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
              return { salePrice, originalPrice: originalPrice || "" };
            }
          }
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    const allText = document.body.innerText;
    const priceMatches = allText.match(/[€$£]\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);

    if (priceMatches && priceMatches.length > 0) {
      const validPrices = priceMatches.filter((price) => {
        const numValue = parseFloat(price.replace(/[^\d.]/g, ""));
        return numValue >= 1 && numValue <= 5000;
      });

      if (validPrices.length > 0) {
        if (validPrices.length === 1) {
          return { salePrice: validPrices[0], originalPrice: "" };
        } else {
          return extractPricesFromText(validPrices.join(" "));
        }
      }
    }

    const currencyElements = findElementsWithCurrency();

    if (currencyElements.length > 0) {
      const bestElement = currencyElements[0];

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
          break;
        }
      }

      if (!foundOriginalPrice && currencyElements.length > 1) {
        const secondPrice = currencyElements[1].price;
        const currentPriceNum = parseFloat(
          bestElement.price.replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        const secondPriceNum = parseFloat(
          secondPrice.replace(/[^0-9.,]/g, "").replace(",", ".")
        );

        if (secondPriceNum > currentPriceNum * 1.05) {
          foundOriginalPrice = secondPrice;
        }
      }

      return {
        salePrice: bestElement.price,
        originalPrice: foundOriginalPrice,
      };
    }

    return { salePrice: "N/A", originalPrice: "" };
  }

  function findElementsWithCurrency() {
    const currencyRegex =
      /[€$£¥₹₽¢]\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*[€$£¥₹₽¢]/;
    const allElements = document.querySelectorAll("*");
    const priceElements = [];

    for (const element of allElements) {
      if (
        ["SCRIPT", "STYLE", "META", "LINK", "HEAD"].includes(element.tagName)
      ) {
        continue;
      }

      const text = element.textContent || "";
      const directText = element.childNodes[0]?.nodeValue || "";

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

    priceElements.sort((a, b) => {
      const aScore = getPriceElementScore(a.element, a.text);
      const bScore = getPriceElementScore(b.element, b.text);
      return bScore - aScore;
    });

    return priceElements;
  }

  function getPriceElementScore(element, text) {
    let score = 0;

    const className = (element.className || "").toLowerCase();
    const id = (element.id || "").toLowerCase();
    const textLower = text.toLowerCase();

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

    if (className.includes("original")) score -= 1;
    if (className.includes("was")) score -= 1;
    if (className.includes("previous")) score -= 1;
    if (className.includes("compare")) score -= 1;
    if (className.includes("old")) score -= 1;
    if (element.style.textDecoration === "line-through") score -= 3;
    if (element.tagName === "DEL" || element.tagName === "S") score -= 3;

    if (textLower.includes("shipping")) score -= 5;
    if (textLower.includes("tax")) score -= 5;
    if (textLower.includes("total")) score -= 3;
    if (textLower.includes("subtotal")) score -= 3;

    if (element.getBoundingClientRect().top < window.innerHeight) score += 3;

    return score;
  }

  function getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.className) {
      const classes = element.className.split(" ").filter((c) => c.length > 0);
      if (classes.length > 0) return `.${classes[0]}`;
    }
    return element.tagName.toLowerCase();
  }

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
    const variants = {};

    const urlParams = new URLSearchParams(window.location.search);

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

    sizeParams.forEach((param) => {
      const value = urlParams.get(param);
      if (value && !variants.size) {
        variants.size = decodeURIComponent(value).replace(/[+%]/g, " ").trim();
      }
    });

    colorParams.forEach((param) => {
      const value = urlParams.get(param);
      if (value && !variants.color) {
        variants.color = decodeURIComponent(value).replace(/[+%]/g, " ").trim();
      }
    });

    styleParams.forEach((param) => {
      const value = urlParams.get(param);
      if (value && !variants.style && param !== "variant") {
        variants.style = decodeURIComponent(value).replace(/[+%]/g, " ").trim();
      }
    });

    const waist = urlParams.get("pant-waist");
    const length = urlParams.get("pant-length");
    if (waist && length) {
      variants.size = `${waist}x${length}`;
    }

    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes("toddsnyder.com")) {
      const sizeOption = urlParams.get("option-0");
      if (sizeOption) {
        variants.size = sizeOption;
      }
    }

    if (hostname.includes("lululemon.com")) {
      const lululemonColor = urlParams.get("color");
      const lululemonSize = urlParams.get("sz");

      if (lululemonSize) {
        variants.size = lululemonSize;
      }

      if (lululemonColor) {
        let colorName = null;

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
              break;
            }
            colorName = null;
          }
        }

        if (!colorName) {
          const title = document.title;
          const titleColorMatch = title.match(
            /\b(Black|White|Navy|Blue|Red|Green|Gray|Grey|Brown|Pink|Purple|Orange|Yellow|Beige|Tan|Olive|Maroon|Burgundy|Teal|Coral|Mint|Sage|Cream|Ivory|Charcoal|Silver|Gold)\b/i
          );
          if (titleColorMatch) {
            colorName = titleColorMatch[1];
          }
        }

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
        }

        variants.color = colorName || lululemonColor;
      }
    }

    if (hostname.includes("rhone.com") || hostname.includes("byltbasics.com")) {
      const variantId = urlParams.get("variant");
      if (variantId) {
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
              foundSize = true;
              break;
            }
          }
        }

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
              break;
            }
          }
        }

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
          }
        }

        const title = document.title;
        const styleMatch = title.match(
          /\b(Slim|Regular|Athletic|Relaxed|Skinny|Straight|Bootcut|Tapered)\b/i
        );
        if (styleMatch) {
          variants.style = styleMatch[1];
        }
      }
    }

    if (Object.keys(variants).length > 0) {
      Object.keys(variants).forEach((key) => {
        variants[key] = variants[key]
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      });
      return variants;
    }

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

    for (const selector of sizeSelectors) {
      const sizeEl = document.querySelector(selector);
      if (sizeEl) {
        let sizeValue =
          sizeEl.textContent?.trim() ||
          sizeEl.value ||
          sizeEl.getAttribute("data-value");
        if (
          sizeValue &&
          sizeValue !== "Select Size" &&
          sizeValue !== "" &&
          sizeValue !== "Size"
        ) {
          variants.size = sizeValue;
          break;
        }
      }
    }

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
        if (
          colorValue &&
          colorValue !== "Select Color" &&
          colorValue !== "Color"
        ) {
          variants.color = colorValue;
          break;
        }
      }
    }

    return variants;
  }

  function getProductInfo() {
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
      if (window.location.hostname.includes("amazon.")) {
        const amazonImage =
          document.getElementById("landingImage") ||
          document.querySelector("#imgTagWrapperId img");
        if (amazonImage) return amazonImage.src;
      }

      if (window.location.hostname.includes("temu.com")) {
        const temuImageSelectors = [
          ".product-image img",
          ".main-image img",
          "[data-testid*='image'] img",
          ".image-gallery img",
          "img[src*='product']",
          "img[src*='item']",
        ];

        for (const selector of temuImageSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const src =
              el.src ||
              el.getAttribute("data-src") ||
              el.getAttribute("data-lazy");
            if (
              src &&
              !src.includes("logo") &&
              !src.includes("icon") &&
              src.includes("http")
            ) {
              return src.split("?")[0];
            }
          }
        }
      }

      const imageSelectors = [
        '[itemprop="image"]',
        'meta[property="og:image"]',
        'link[rel="image_src"]',
        ".product-image img",
        ".main-image",
        "#main-image",
        "#product-image",
        ".image-gallery-image",
        'img[src*="product"]',
        'img[src*="item"]',
        'img[src*="catalog"]',
        'img:not([src*="icon"]):not([src*="logo"]):not([width<100])',
      ];

      for (const selector of imageSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const src =
            el.src ||
            el.getAttribute("data-src") ||
            el.getAttribute("data-lazy");
          if (src && !src.includes("logo") && !src.includes("icon")) {
            return src
              .split("?")[0]
              .replace("_SL250_", "_SL1000_")
              .replace("_AC_US40_", "_AC_US1000_");
          }
        }
      }

      const ogImage = document.querySelector('meta[property="og:image"]');
      return ogImage ? ogImage.content : null;
    }

    const { salePrice, originalPrice } = getPrices();
    const variants = getSelectedVariants();

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

    return productInfo;
  }

  function showCategorySelector(product) {
    try {
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

      try {
        chrome.storage.local.get({ cart: {} }, ({ cart }) => {
          const categories = Object.keys(cart).filter(
            (folder) => folder !== "All Items"
          );

          dropdown.innerHTML = "";

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

            addToTrolley(product, "All Items");
          };
          dropdown.appendChild(allItemsOption);

          categories.forEach((category) => {
            const option = document.createElement("div");
            option.style.cssText =
              "padding: 10px 12px; cursor: pointer; font-size: 14px; border-bottom: 1px solid #f0f0f0;";
            option.textContent = category;
            option.onmouseenter = () =>
              (option.style.backgroundColor = "#f8f9fa");
            option.onmouseleave = () =>
              (option.style.backgroundColor = "white");
            option.onclick = () => {
              input.value = category;
              dropdown.style.display = "none";
              arrow.textContent = "▼";

              addToTrolley(product, category);
            };
            dropdown.appendChild(option);
          });

          const lastOption = dropdown.lastElementChild;
          if (lastOption) {
            lastOption.style.borderBottom = "none";
          }
        });
      } catch (error) {
        console.error("Chrome storage error:", error);
        dropdown.innerHTML =
          '<div style="padding: 10px 12px; color: #6c757d;">All Items</div>';
      }

      arrow.onclick = (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === "block";
        dropdown.style.display = isVisible ? "none" : "block";
        arrow.textContent = isVisible ? "▼" : "▲";
      };

      input.onfocus = () => {
        dropdown.style.display = "block";
        arrow.textContent = "▲";
      };

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

      setTimeout(() => input.focus(), 100);

      function handleClickOutside(e) {
        if (!selector.contains(e.target) && !trolleyButton.contains(e.target)) {
          selector.remove();
          style.remove();
          document.removeEventListener("click", handleClickOutside);
        }
      }

      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 100);
    } catch (error) {
      console.error("Error in showCategorySelector:", error);
    }
  }

  function addToTrolley(product, categoryName) {
    try {
      const productId = product.id || product.url;
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
            showNotification(`Added to ${categoryName}!`);
          } else {
            if (response?.needsAuth) {
              showNotification("❌ Please sign in to add products", "error");
            } else {
              showNotification("Failed to add product!");
            }
          }
        }
      );
    } catch (error) {
      console.error("Error in addToTrolley:", error);
      showNotification(
        "Error: Extension context invalidated. Please refresh the page."
      );
    }

    const selector = document.getElementById("trolley-category-selector");
    if (selector) {
      selector.remove();
    }

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

    let img = null;
    try {
      img = document.createElement("img");
      img.src = chrome.runtime.getURL("Images/Trolley.png");
      img.alt = "Add to Trolley";
      img.style.cssText = `
            width: 30px;
            height: 30px;
            transition: transform 0.2s ease;
        `;
      button.appendChild(img);
    } catch (error) {
      button.textContent = "🛒";
    }

    document.body.appendChild(button);

    if (img) {
      button.addEventListener("mouseenter", () => {
        img.style.transform = "scale(1.1)";
      });
      button.addEventListener("mouseleave", () => {
        img.style.transform = "scale(1)";
      });
    }

    button.onclick = () => {
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

  function debugProductPageDetection() {
    const checks = {
      title: false,
      price: false,
      image: false,
      buyButton: false,
      productUrl: false,
    };

    const titleSelectors = [
      'meta[property="og:title"]',
      'h1[itemprop="name"]',
      ".product-title",
      ".product-name",
      "#productTitle",
      "h1",
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = element.content || element.textContent;
        if (content && content.trim()) {
          checks.title = true;
          break;
        }
      }
    }

    if (window.location.hostname.includes("temu.com")) {
      const temuPriceSelectors = [
        '[data-testid="price"]',
        ".price",
        ".product-price",
        ".current-price",
        ".sale-price",
        '[class*="price"]',
        "span",
        "div",
      ];

      for (const selector of temuPriceSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const text = element.textContent;
          if (text && text.match(/[€$£]\d+/)) {
            checks.price = true;
          }
        });
      }

      if (!checks.price) {
        const allText = document.body.innerText;
        const priceMatches = allText.match(/[€$£]\d+(?:[.,]\d{2})?/g);
        if (priceMatches) {
          checks.price = true;
        }
      }

      if (!checks.price) {
        const allElements = document.querySelectorAll("*");
        for (const element of allElements) {
          const text = element.textContent;
          if (text && text.match(/[€$£]\d+(?:[.,]\d{2})?/)) {
            checks.price = true;
            break;
          }
        }
      }
    } else {
      const priceSelectors = [
        '[itemprop="price"]',
        ".price",
        ".product-price",
        ".current-price",
        ".sale-price",
        '[data-testid*="price"]',
      ];

      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const text = element.textContent;
          if (text && text.match(/[€$£]\d+/)) {
            checks.price = true;
          }
        });
      }
    }

    const imageSelectors = [
      'meta[property="og:image"]',
      '[itemprop="image"]',
      ".product-image img",
      ".main-image",
      'img[src*="product"]',
    ];

    for (const selector of imageSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const src = element.src || element.content;
        if (src) {
          checks.image = true;
          break;
        }
      }
    }

    const buttons = document.querySelectorAll(
      'button, input[type="submit"], a'
    );
    const buyButtonTexts = [
      "add to cart",
      "buy now",
      "add to bag",
      "purchase",
      "купити",
      "додати в кошик",
    ];

    buttons.forEach((button) => {
      const text = button.textContent?.toLowerCase() || "";
      if (buyButtonTexts.some((btnText) => text.includes(btnText))) {
        checks.buyButton = true;
      }
    });

    const urlPath = window.location.pathname.toLowerCase();
    const productUrlPatterns = [
      "/product/",
      "/products/",
      "/shop/",
      "/item/",
      "/p/",
      "/dp/",
    ];
    checks.productUrl = productUrlPatterns.some((pattern) =>
      urlPath.includes(pattern)
    );

    let score = 0;
    Object.values(checks).forEach((check) => {
      if (check) score++;
    });

    return { checks, score, isProductPage: score >= 3 };
  }

  setTimeout(() => {
    console.log("🚀 Content script initializing...");

    const debugResult = debugProductPageDetection();

    if (debugResult.isProductPage) {
      console.log("✅ Detected as product page, injecting trolley button");
      injectCartButton();
    } else {
      console.log("❌ Not detected as product page - no trolley button");
      console.log(
        "💡 Try visiting a specific product page (not category or home page)"
      );
    }
  }, 1000);
})();
