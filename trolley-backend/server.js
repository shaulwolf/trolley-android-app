// server.js - Universal Pure Scraper (No AI Dependencies)
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    scraper: 'universal-pure-scraper',
    version: '2.0'
  });
});

// Universal product scraping with maximum coverage
async function scrapeProduct(url, retryCount = 0) {
  console.log(`🕷️ Universal scraping attempt ${retryCount + 1} for: ${url}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=site-per-process'
      ]
    });
    
    const page = await browser.newPage();
    
    // Advanced stealth setup
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    ];
    
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
    await page.setViewport({ 
      width: 1920 + Math.floor(Math.random() * 100), 
      height: 1080 + Math.floor(Math.random() * 100) 
    });
    
    // Enhanced headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    });
    
    // Block images for speed, keep CSS/JS for functionality
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'image') {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Advanced anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
      
      // Remove automation indicators
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });
    
    console.log(`🌐 Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Smart waiting strategy with dynamic content detection
    const baseDelay = 2000 + (retryCount * 1000) + Math.floor(Math.random() * 2000);
    console.log(`⏳ Waiting ${baseDelay}ms for content to load...`);
    await page.waitForTimeout(baseDelay);
    
    // Enhanced waiting for dynamic pricing sites
    const hostname = new URL(url).hostname.toLowerCase();
    const isDynamicSite = hostname.includes('kotn.com') || 
                         hostname.includes('everlane.com') ||
                         hostname.includes('allbirds.com') ||
                         hostname.includes('lululemon.com') ||
                         url.includes('variant=') || 
                         url.includes('size=') ||
                         url.includes('color=');
    
    if (isDynamicSite) {
      console.log('🔄 Detected dynamic pricing site, enhanced loading...');
      
      try {
      try {
        // Wait for network to settle (Puppeteer way)
        await page.waitForSelector('body', { timeout: 5000 });
        
        // Wait for any ongoing network requests to complete
        await new Promise(resolve => {
          let requestCount = 0;
          const startTime = Date.now();
          
          page.on('request', () => requestCount++);
          page.on('response', () => requestCount--);
          
          const checkNetworkIdle = () => {
            if (requestCount <= 0 || Date.now() - startTime > 8000) {
              resolve();
            } else {
              setTimeout(checkNetworkIdle, 500);
            }
          };
          
          setTimeout(checkNetworkIdle, 1000);
        });
        
        console.log('🌐 Network activity settled');
        
        // Additional wait for JavaScript to process
        await page.waitForTimeout(3000);
        
        // Try to interact with variant selectors if URL has parameters
        const urlParams = new URL(url).searchParams;
        if (urlParams.has('size') || urlParams.has('colour') || urlParams.has('color')) {
          console.log('🎯 Triggering variant selection...');
          
          // Scroll to ensure elements are in view
          await page.evaluate(() => {
            window.scrollTo(0, 500);
          });
          await page.waitForTimeout(1000);
          
          // Try to trigger size/color selection
          const size = urlParams.get('size');
          const color = urlParams.get('colour') || urlParams.get('color');
          
          if (size) {
            const sizeSelectors = [
              `[data-value*="${size}"]`, `[value*="${size}"]`,
              `button[title*="${size}"]`, `input[value*="${size}"]`,
              `[data-size*="${size}"]`, `label:contains("${size}")`,
              `.size-option`, `.size-selector button`, `[data-testid*="size"]`
            ];
            
            for (const selector of sizeSelectors) {
              try {
                const elements = await page.$(selector);
                for (const element of elements) {
                  const text = await element.evaluate(el => el.textContent || el.value || el.title);
                  if (text && text.toLowerCase().includes(size.toLowerCase())) {
                    await element.click();
                    console.log(`✅ Clicked size: ${text}`);
                    await page.waitForTimeout(2000);
                    break;
                  }
                }
              } catch (e) {
                // Continue to next selector
              }
            }
          }
          
          if (color) {
            const colorSelectors = [
              `[data-value*="${color}"]`, `[value*="${color}"]`,
              `button[title*="${color}"]`, `input[value*="${color}"]`,
              `[data-color*="${color}"]`, `label:contains("${color}")`,
              `.color-option`, `.color-selector button`, `[data-testid*="color"]`
            ];
            
            for (const selector of colorSelectors) {
              try {
                const elements = await page.$(selector);
                for (const element of elements) {
                  const text = await element.evaluate(el => el.textContent || el.value || el.title);
                  if (text && text.toLowerCase().includes(color.toLowerCase())) {
                    await element.click();
                    console.log(`✅ Clicked color: ${text}`);
                    await page.waitForTimeout(2000);
                    break;
                  }
                }
              } catch (e) {
                // Continue to next selector
              }
            }
          }
        }
        
        // Force any lazy-loaded content
        await page.evaluate(() => {
          // Trigger events that might load prices
          window.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new Event('scroll'));
          window.scrollTo(0, document.body.scrollHeight / 2);
          window.scrollTo(0, 0);
          
          // Force any pending JavaScript
          if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {});
          }
        });
        
        await page.waitForTimeout(2000);
        console.log('🎯 Dynamic content loading complete');
        
      } catch (e) {
        console.log('⚠️ Dynamic loading failed, continuing with regular extraction');
      }
    }
    
    // Handle cookie banners and overlays
    try {
      const overlaySelectors = [
        'button[id*="accept"]', 'button[class*="accept"]',
        'button[id*="cookie"]', 'button[class*="cookie"]',
        'button:contains("Accept")', 'button:contains("OK")',
        'button:contains("Allow")', '[data-testid*="accept"]',
        '.modal button', '.overlay button', '.popup button'
      ];
      
      for (const selector of overlaySelectors) {
        try {
          await page.click(selector, { timeout: 1000 });
          await page.waitForTimeout(1000);
          console.log(`✅ Closed overlay: ${selector}`);
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
    } catch (e) {
      // No overlays found, continue
    }
    
    // Enhanced content extraction
    const result = await page.evaluate(() => {
      
      // ===== UNIVERSAL PRICE EXTRACTION SYSTEM =====
      function extractUniversalPrice() {
        console.log('💰 Starting universal price extraction...');
        
        // Comprehensive price selector database
        const priceSelectors = {
          // Current/Sale Price Selectors (Priority Order)
          current: [
            // High Priority - Sale/Current Price Indicators
            '.price--sale .money', '.sale-price .money', '.current-price .money',
            '.price-sale', '.price-current', '.price--current',
            '[data-testid*="price"]:not([data-testid*="compare"]):not([data-testid*="original"])',
            '[data-test*="price"]:not([data-test*="compare"]):not([data-test*="original"])',
            '[data-automation-id*="price"]:not([data-automation-id*="compare"])',
            
            // Shopify Patterns
            '.price .money:not(.compare-at-price)', '.product-price .money',
            '.price-item--sale', '.price-item--regular',
            
            // Generic E-commerce Patterns  
            '.product-price:not(.was-price):not(.compare-at-price)',
            '.price:not(.price--original):not(.was-price):not(.compare-at)',
            '.current-price', '.sale-price', '.special-price',
            
            // Modern React/Vue Patterns
            '[class*="price"][class*="current"]',
            '[class*="price"][class*="sale"]',
            '[data-price]:not([data-compare-price])',
            '[data-current-price]', '[data-sale-price]',
            
            // Site-Specific Patterns (Common Platforms)
            '.Price-module__price', '.price-display', '.product-price-value',
            '.pricing .price', '.price-box .price', '.cost',
            
            // Fallback Generic
            '.price', '[data-price]', '.product-price'
          ],
          
          // Original/Compare Price Selectors
          original: [
            '.price--original .money', '.compare-at-price .money', '.was-price .money',
            '.price--compare', '.price-was', '.original-price',
            '[data-testid*="compare"]', '[data-testid*="original"]',
            '[data-test*="compare"]', '[data-test*="original"]',
            '[data-compare-price]', '[data-original-price]',
            '.compare-at-price', '.was-price', '.strike-through',
            '[style*="line-through"]', 'del .price', '.price del'
          ]
        };
        
        let currentPrice = null;
        let originalPrice = null;
        
        // Extract current price with priority system
        console.log('🎯 Extracting current price...');
        for (const selector of priceSelectors.current) {
          const elements = document.querySelectorAll(selector);
          
          for (const element of elements) {
            if (!element) continue;
            
            // Skip if this looks like an original/was price
            const text = element.textContent?.toLowerCase() || '';
            const className = element.className?.toLowerCase() || '';
            
            if (text.includes('was') || text.includes('original') || 
                text.includes('compare') || text.includes('msrp') ||
                className.includes('compare') || className.includes('was') ||
                element.style.textDecoration === 'line-through') {
              continue;
            }
            
            const price = extractPriceFromText(element.textContent || element.value || element.getAttribute('content'));
            if (price && isValidProductPrice(price)) {
              currentPrice = price;
              console.log(`✅ Found current price: ${price} from selector: ${selector}`);
              break;
            }
          }
          if (currentPrice) break;
        }
        
        // Extract original price
        console.log('🔍 Looking for original/compare price...');
        for (const selector of priceSelectors.original) {
          const element = document.querySelector(selector);
          if (element) {
            const price = extractPriceFromText(element.textContent || element.value || element.getAttribute('content'));
            if (price && isValidProductPrice(price)) {
              originalPrice = price;
              console.log(`✅ Found original price: ${price} from selector: ${selector}`);
              break;
            }
          }
        }
        
        // JSON-LD Structured Data Extraction
        if (!currentPrice) {
          console.log('📊 Trying JSON-LD structured data...');
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent);
              const price = extractPriceFromStructuredData(data);
              if (price) {
                currentPrice = price;
                console.log(`✅ Found price in structured data: ${price}`);
                break;
              }
            } catch (e) {
              // Invalid JSON, skip
            }
          }
        }
        
        // Final fallback - extract all prices and use smart selection
        if (!currentPrice) {
          console.log('🚨 Final fallback - extracting all prices...');
          const allPrices = extractAllPricesFromPage();
          const result = selectBestPrice(allPrices);
          currentPrice = result.current;
          if (!originalPrice) originalPrice = result.original;
        }
        
        return {
          current: currentPrice || 'N/A',
          original: originalPrice,
          method: currentPrice ? 'selector-extraction' : 'fallback'
        };
      }
      
      // Extract price from text with multiple currency support
      function extractPriceFromText(text) {
        if (!text || typeof text !== 'string') return null;
        
        const patterns = [
          /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
          /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
          /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD/gi,
          /€(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
          /£(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
        ];
        
        for (const pattern of patterns) {
          const matches = [...text.matchAll(pattern)];
          if (matches.length > 0) {
            const priceNum = parseFloat(matches[0][1].replace(/,/g, ''));
            if (priceNum > 0) {
              return text.includes('$') ? `$${priceNum}` : 
                     text.includes('€') ? `€${priceNum}` :
                     text.includes('£') ? `£${priceNum}` : `$${priceNum}`;
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
              if (price > 0) {
                const currency = offer.priceCurrency === 'USD' ? '$' : offer.priceCurrency || '$';
                return `${currency}${price}`;
              }
            }
          }
        }
        // Handle nested structures
        if (typeof data === 'object') {
          for (const key in data) {
            if (typeof data[key] === 'object') {
              const result = extractPriceFromStructuredData(data[key]);
              if (result) return result;
            }
          }
        }
        return null;
      }
      
      // Validate if price is reasonable for a product
      function isValidProductPrice(priceStr) {
        if (!priceStr) return false;
        const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
        return price >= 0.01 && price <= 50000; // Very wide range
      }
      
      // Extract all prices from page for intelligent selection
      function extractAllPricesFromPage() {
        const bodyText = document.body?.textContent || '';
        const priceRegex = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;
        const matches = bodyText.match(priceRegex) || [];
        
        return matches
          .map(priceText => {
            const value = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            return { text: priceText, value };
          })
          .filter(p => p.value >= 0.01 && p.value <= 50000)
          .sort((a, b) => a.value - b.value);
      }
      
      // Smart price selection from multiple candidates
      function selectBestPrice(prices) {
        if (prices.length === 0) return { current: null, original: null };
        if (prices.length === 1) return { current: prices[0].text, original: null };
        
        // Remove duplicates
        const unique = prices.filter((price, index, arr) => 
          arr.findIndex(p => Math.abs(p.value - price.value) < 0.01) === index
        );
        
        if (unique.length === 1) return { current: unique[0].text, original: null };
        if (unique.length === 2) {
          // Two prices - likely sale and original
          return {
            current: unique[0].text, // Lower price (sale)
            original: unique[1].text  // Higher price (original)
          };
        }
        
        // Multiple prices - choose most reasonable
        const midRange = unique.filter(p => p.value >= 5 && p.value <= 1000);
        const bestPrice = midRange.length > 0 ? midRange[0] : unique[0];
        
        return { current: bestPrice.text, original: null };
      }
      
      // ===== ENHANCED TITLE EXTRACTION =====
      function extractTitle() {
        const selectors = [
          'meta[property="og:title"]',
          'meta[name="twitter:title"]',
          'h1[data-testid*="product"]',
          'h1[class*="product"]',
          '.product-title', '.product-name',
          '[data-testid="product-title"]',
          'h1'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const title = element.content || element.textContent;
            if (title && title.trim().length > 3 && title.length < 200) {
              return title.trim();
            }
          }
        }
        
        // Fallback to page title, cleaned
        const pageTitle = document.title;
        if (pageTitle) {
          return pageTitle.replace(/[-|].*$/, '').trim() || pageTitle;
        }
        
        return 'Product';
      }
      
      // ===== ENHANCED IMAGE EXTRACTION =====
      function extractImage() {
        const selectors = [
          'meta[property="og:image"]',
          'meta[name="twitter:image"]',
          '.product-image img', '.product-gallery img',
          '[data-testid*="product"] img',
          'picture img', 'main img',
          'img[src*="product"]', 'img[src*="cdn"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const src = element.content || element.src;
            if (src && !src.includes('favicon') && !src.includes('logo') && 
                src.length > 10 && !src.includes('placeholder')) {
              return src.startsWith('//') ? `https:${src}` : src;
            }
          }
        }
        
        return null;
      }
      
      // ===== MAIN EXTRACTION =====
      const prices = extractUniversalPrice();
      const title = extractTitle();
      const image = extractImage();
      
      return {
        title,
        image,
        price: prices.current,
        originalPrice: prices.original,
        site: document.location.hostname,
        url: document.location.href,
        extractionMethod: prices.method,
        bodyLength: document.body?.textContent?.length || 0,
        timestamp: new Date().toISOString()
      };
    });
    
    await browser.close();
    
    // Enhanced success validation
    const isValidResult = result.title && 
                         result.title.length > 3 && 
                         result.bodyLength > 1000 &&
                         !result.title.includes('Access Denied') &&
                         !result.title.includes('Page Not Found') &&
                         !result.title.includes('Error');
    
    console.log(`📊 Extraction result - Success: ${isValidResult}`);
    console.log(`   Title: "${result.title}" (${result.title?.length || 0} chars)`);
    console.log(`   Price: ${result.price} (${result.originalPrice ? `was ${result.originalPrice}` : 'no original'})`);
    console.log(`   Method: ${result.extractionMethod}`);
    
    if (!isValidResult && retryCount < 2) {
      console.log(`🔄 Retrying extraction (attempt ${retryCount + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 2000 + (retryCount * 1000)));
      return scrapeProduct(url, retryCount + 1);
    }
    
    return {
      success: isValidResult,
      data: result
    };
    
  } catch (error) {
    console.error(`❌ Scraping error (attempt ${retryCount + 1}):`, error.message);
    if (browser) await browser.close();
    
    // Retry on network errors
    if (retryCount < 2 && (error.message.includes('timeout') || error.message.includes('net::'))) {
      console.log(`🔄 Retrying due to network error...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return scrapeProduct(url, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

// Main extraction endpoint - Pure Scraping Only
app.post('/extract-product', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({
      error: 'URL is required',
      extractionMethod: 'error'
    });
  }
  
  console.log(`🔍 Starting universal extraction for: ${url}`);
  
  try {
    const scrapingResult = await scrapeProduct(url);
    
    if (scrapingResult.success) {
      console.log('✅ Universal scraping successful');
      
      return res.json({
        title: scrapingResult.data.title,
        image: scrapingResult.data.image,
        price: scrapingResult.data.price,
        originalPrice: scrapingResult.data.originalPrice,
        site: scrapingResult.data.site,
        url: scrapingResult.data.url,
        extractionMethod: 'universal-scraping',
        confidence: 0.9,
        timestamp: scrapingResult.data.timestamp
      });
    }
    
    // Scraping failed - return best effort result
    console.log('⚠️ Scraping failed, returning fallback data');
    
    return res.json({
      title: scrapingResult.data?.title || `Product from ${new URL(url).hostname}`,
      image: scrapingResult.data?.image || null,
      price: scrapingResult.data?.price || 'N/A',
      originalPrice: scrapingResult.data?.originalPrice || null,
      site: new URL(url).hostname,
      url: url,
      extractionMethod: 'fallback',
      confidence: 0.3,
      error: scrapingResult.error
    });
    
  } catch (error) {
    console.error('❌ Universal extraction failed:', error.message);
    
    return res.status(500).json({
      title: `Product from ${new URL(url).hostname}`,
      price: 'N/A',
      error: error.message,
      url: url,
      extractionMethod: 'error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Universal Pure Scraper running on port ${PORT}`);
  console.log(`🕷️ No AI dependencies - Pure scraping only`);
  console.log(`💪 Built for maximum compatibility and reliability`);
});