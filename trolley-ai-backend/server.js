const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/extract-product', async (req, res) => {
  const { url } = req.body;
  
  console.log(`🔍 Starting extraction for: ${url}`);
  
  let browser;
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('📄 Creating new page...');
    const page = await browser.newPage();
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('🌐 Navigating to URL...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for dynamic content to load
    console.log('⏳ Waiting for content...');
    await page.waitForTimeout(3000);
    
    console.log('📊 Extracting enhanced data...');
    const productData = await page.evaluate(() => {
      
      // ===== ENHANCED PRICE EXTRACTION =====
      function extractPrices() {
        const hostname = window.location.hostname.toLowerCase();
        console.log('🏪 Extracting prices for:', hostname);
        
        // Site-specific price selectors (most reliable)
        const siteSpecificSelectors = {
          'buckmason.com': {
            current: [
              '.price .money',
              '.price--current .money',
              '.product-price .money',
              '[data-price-current]',
              '.price .sale .money'
            ],
            original: [
              '.price .was .money',
              '.price--original .money', 
              '.price .compare-at .money'
            ]
          },
          'jcrew.com': {
            current: ['.prices .price:first-child', '.price-sales'],
            original: ['.prices .price:last-child', '.price-was']
          },
          'everlane.com': {
            current: ['.product-price', '.current-price'],
            original: ['.was-price', '.original-price']
          },
          'amazon.com': {
            current: ['.a-price-current .a-offscreen', '.a-price .a-offscreen:first-child'],
            original: ['.a-price-was .a-offscreen', '.a-text-strike .a-offscreen']
          },
          'shopify': { // Generic Shopify patterns
            current: [
              '.price .money',
              '.product-price .money', 
              '.price--current',
              '[data-price]'
            ],
            original: [
              '.price .was .money',
              '.price--original',
              '.compare-at-price'
            ]
          }
        };
        
        // Determine if it's a Shopify site
        const isShopify = document.querySelector('script[src*="shopify"]') ||
                         document.querySelector('link[href*="shopify"]') ||
                         window.Shopify ||
                         document.querySelector('.shopify-section');
        
        // Get selectors for this site
        let selectors = siteSpecificSelectors[hostname] || 
                       (isShopify ? siteSpecificSelectors.shopify : null);
        
        let currentPrice = null;
        let originalPrice = null;
        
        // Try site-specific selectors first
        if (selectors) {
          console.log('🎯 Using site-specific selectors');
          
          // Extract current price
          for (const selector of selectors.current) {
            const element = document.querySelector(selector);
            if (element) {
              const priceText = element.textContent || element.getAttribute('content') || element.value;
              const price = extractFirstPrice(priceText);
              if (price) {
                currentPrice = price;
                console.log(`✅ Found current price: ${price} from selector: ${selector}`);
                break;
              }
            }
          }
          
          // Extract original price
          for (const selector of selectors.original) {
            const element = document.querySelector(selector);
            if (element) {
              const priceText = element.textContent || element.getAttribute('content') || element.value;
              const price = extractFirstPrice(priceText);
              if (price) {
                originalPrice = price;
                console.log(`✅ Found original price: ${price} from selector: ${selector}`);
                break;
              }
            }
          }
        }
        
        // Fallback to generic selectors if site-specific didn't work
        if (!currentPrice) {
          console.log('🔄 Falling back to generic selectors');
          
          const genericSelectors = [
            // High priority - likely current price
            '.price--sale, .sale-price, .current-price, .price-current',
            '.price .sale, .price.sale, .product-price-sale',
            '.price:not(.price--original):not(.was-price):not(.compare-at)',
            
            // Medium priority - general price
            '.product-price, .price, [data-price], .cost',
            '.price-box .price, .pricing .price',
            
            // JSON-LD structured data
            'script[type="application/ld+json"]'
          ];
          
          for (const selector of genericSelectors) {
            if (selector.includes('json')) {
              // Handle JSON-LD
              const scripts = document.querySelectorAll(selector);
              for (const script of scripts) {
                try {
                  const data = JSON.parse(script.textContent);
                  const price = extractPriceFromStructuredData(data);
                  if (price) {
                    currentPrice = price;
                    console.log(`✅ Found price in JSON-LD: ${price}`);
                    break;
                  }
                } catch (e) {
                  // Invalid JSON, skip
                }
              }
            } else {
              const elements = document.querySelectorAll(selector);
              for (const element of elements) {
                // Skip if this looks like an original/was price
                const text = element.textContent.toLowerCase();
                if (text.includes('was') || text.includes('original') || 
                    text.includes('msrp') || element.style.textDecoration === 'line-through') {
                  continue;
                }
                
                const price = extractFirstPrice(element.textContent);
                if (price && isReasonablePrice(price)) {
                  currentPrice = price;
                  console.log(`✅ Found generic current price: ${price} from: ${selector}`);
                  break;
                }
              }
              if (currentPrice) break;
            }
          }
        }
        
        // Look for original/was prices if we haven't found one
        if (!originalPrice) {
          const originalSelectors = [
            '.price--original, .original-price, .was-price, .price-was',
            '.price .was, .compare-at-price, [data-compare-price]',
            'del .price, .price del, [style*="line-through"]'
          ];
          
          for (const selector of originalSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const price = extractFirstPrice(element.textContent);
              if (price && isReasonablePrice(price)) {
                originalPrice = price;
                console.log(`✅ Found original price: ${price} from: ${selector}`);
                break;
              }
            }
          }
        }
        
        // Final fallback - extract all prices and use smart logic
        if (!currentPrice) {
          console.log('🚨 Final fallback - extracting all prices');
          const allPrices = extractAllPricesFromPage();
          const result = chooseBestPrice(allPrices);
          currentPrice = result.current;
          originalPrice = result.original;
        }
        
        return {
          current: currentPrice,
          original: originalPrice,
          debug: {
            hostname,
            isShopify,
            usedSiteSpecific: !!selectors
          }
        };
      }
      
      // Helper function to extract first valid price from text
      function extractFirstPrice(text) {
        if (!text) return null;
        
        // Multiple currency patterns
        const patterns = [
          /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,  // US Dollar
          /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD/gi,
          /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi
        ];
        
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const priceMatch = match[0].match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
            if (priceMatch) {
              const price = parseFloat(priceMatch[1].replace(/,/g, ''));
              if (isReasonablePrice(price)) {
                return `$${price}`;
              }
            }
          }
        }
        return null;
      }
      
      // Extract price from JSON-LD structured data
      function extractPriceFromStructuredData(data) {
        if (data['@type'] === 'Product' && data.offers) {
          const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
          for (const offer of offers) {
            if (offer.price) {
              const price = parseFloat(offer.price);
              if (isReasonablePrice(price)) {
                return `$${price}`;
              }
            }
          }
        }
        return null;
      }
      
      // Check if price is in reasonable range
      function isReasonablePrice(price) {
        const numPrice = typeof price === 'string' ? 
          parseFloat(price.replace(/[^0-9.]/g, '')) : price;
        return numPrice >= 0.01 && numPrice <= 50000;
      }
      
      // Extract all prices from page for fallback analysis
      function extractAllPricesFromPage() {
        const bodyText = document.body.textContent;
        const priceMatches = bodyText.match(/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g) || [];
        
        return priceMatches
          .map(p => {
            const num = parseFloat(p.replace(/[^0-9.]/g, ''));
            return { text: p, value: num };
          })
          .filter(p => isReasonablePrice(p.value))
          .sort((a, b) => a.value - b.value); // Sort by value
      }
      
      // Smart price selection logic
      function chooseBestPrice(allPrices) {
        if (allPrices.length === 0) return { current: 'N/A', original: null };
        if (allPrices.length === 1) return { current: allPrices[0].text, original: null };
        
        // Remove duplicates
        const uniquePrices = allPrices.filter((price, index, arr) => 
          arr.findIndex(p => Math.abs(p.value - price.value) < 0.01) === index
        );
        
        if (uniquePrices.length === 1) {
          return { current: uniquePrices[0].text, original: null };
        }
        
        // If we have 2+ prices, assume lowest is current, highest is original
        // (if the difference suggests a sale)
        const lowest = uniquePrices[0];
        const highest = uniquePrices[uniquePrices.length - 1];
        
        // If highest is significantly more than lowest, it's likely original vs sale
        if (highest.value > lowest.value * 1.1) {
          return { 
            current: lowest.text, 
            original: highest.text 
          };
        }
        
        // Otherwise, just return the first reasonable price
        return { current: uniquePrices[0].text, original: null };
      }
      
      // ===== ENHANCED TITLE EXTRACTION =====
      function extractTitle() {
        // Try multiple title sources in order of preference
        const titleSources = [
          () => document.querySelector('meta[property="og:title"]')?.content,
          () => document.querySelector('meta[name="twitter:title"]')?.content,
          () => document.querySelector('h1')?.textContent?.trim(),
          () => document.querySelector('.product-title, .product-name')?.textContent?.trim(),
          () => document.title?.replace(/[-|].*$/, '').trim(), // Remove site name from title
        ];
        
        for (const source of titleSources) {
          const title = source();
          if (title && title.length > 3 && title.length < 200) {
            return title.trim();
          }
        }
        
        return 'Product';
      }
      
      // ===== ENHANCED IMAGE EXTRACTION =====
      function extractImage() {
        const imageSources = [
          () => document.querySelector('meta[property="og:image"]')?.content,
          () => document.querySelector('meta[name="twitter:image"]')?.content,
          () => document.querySelector('.product-image img, .product-gallery img')?.src,
          () => document.querySelector('main img, .main img')?.src,
          () => document.querySelector('img[src*="product"], img[src*="cdn"]')?.src
        ];
        
        for (const source of imageSources) {
          const image = source();
          if (image && !image.includes('favicon') && !image.includes('logo')) {
            return image.startsWith('//') ? `https:${image}` : image;
          }
        }
        
        return null;
      }
      
      // ===== MAIN EXTRACTION =====
      const prices = extractPrices();
      const title = extractTitle();
      const image = extractImage();
      
      const result = {
        title,
        image,
        price: prices.current,
        originalPrice: prices.original,
        site: window.location.hostname,
        url: window.location.href,
        debug: {
          ...prices.debug,
          titleLength: title.length,
          hasImage: !!image,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('📊 Final extraction result:', result);
      return result;
    });
    
    await browser.close();
    console.log('✅ Enhanced extraction complete:', productData);
    res.json(productData);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (browser) await browser.close();
    
    res.json({
      title: `Product from ${new URL(url).hostname}`,
      price: 'N/A',
      error: error.message,
      url: url
    });
  }
});

app.listen(3000, () => {
  console.log(`🚀 Enhanced scraper running on port 3000`);
});